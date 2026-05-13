import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { q } from "../db.js";
import { config } from "../config.js";
import { signUserJwt } from "../lib/jwt.js";
import { requireAuth } from "../middleware/auth.js";
import type { AppEnv } from "../types.js";
import { memoryEval } from "../services/memory-store.js";
import { revokeToken } from "../services/session-store.js";
import { verifyUserJwt } from "../lib/jwt.js";

const authBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const authRoutes = new Hono<AppEnv>();

const rateLimitAnon = (path: string) => {
  const key = `auth:anon:${path}`;
  const res = memoryEval("rl", 1, key, String(Date.now()), String(config.rateLimitWindowMs), "10");
  if (Number(res[0]) > 10) return false;
  return true;
};

authRoutes.post("/api/auth/login", async (c) => {
  if (!rateLimitAnon(c.req.path)) return c.json({ error: "Rate limited" }, 429);
  const parsed = authBody.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Permintaan tidak valid." }, 400);
  const email = parsed.data.email.trim().toLowerCase();
  const rows = await q<{ id: string; email: string; display_name: string | null; password_hash: string }>(
    "select id, email, display_name, password_hash from public.users where email = $1 limit 1",
    [email]
  );
  const user = rows[0];
  if (!user) return c.json({ error: "Email atau password salah." }, 401);
  const ok = await bcrypt.compare(parsed.data.password, String(user.password_hash || ""));
  if (!ok) return c.json({ error: "Email atau password salah." }, 401);
  const payload = { id: String(user.id), email: user.email, displayName: user.display_name ?? null };
  const token = await signUserJwt(payload);
  return c.json({ token, user: payload });
});

authRoutes.post("/api/auth/register", async (c) => {
  if (!rateLimitAnon(c.req.path)) return c.json({ error: "Rate limited" }, 429);
  if (!config.enableSelfRegistration) {
    return c.json({ error: "Pendaftaran mandiri tidak tersedia." }, 403);
  }
  const parsed = authBody.safeParse(await c.req.json().catch(() => ({})));
  if (!parsed.success) return c.json({ error: "Permintaan tidak valid." }, 400);
  const email = parsed.data.email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  try {
    const rows = await q<{ id: string; email: string; display_name: string | null }>(
      "insert into public.users (email, password_hash) values ($1, $2) returning id, email, display_name",
      [email, passwordHash]
    );
    const user = rows[0];
    const payload = { id: String(user.id), email: user.email, displayName: user.display_name ?? null };
    const token = await signUserJwt(payload);
    return c.json({ token, user: payload });
  } catch {
    return c.json({ error: "Email sudah terdaftar" }, 409);
  }
});

authRoutes.get("/api/auth/me", requireAuth, async (c) => {
  return c.json(c.get("user"));
});

authRoutes.post("/api/auth/refresh", requireAuth, async (c) => {
  const user = c.get("user");
  const token = await signUserJwt({ id: user.id, email: user.email, displayName: user.displayName });
  return c.json({ token, user });
});

authRoutes.post("/api/auth/logout", requireAuth, async (c) => {
  const auth = c.req.header("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (token) {
    try {
      const payload = await verifyUserJwt(token);
      await revokeToken(payload.jti, payload.exp);
    } catch {
      // ignore invalid token on logout
    }
  }
  return c.json({ success: true });
});

