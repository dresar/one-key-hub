import type { MiddlewareHandler } from "hono";
import { verifyUserJwt } from "../lib/jwt.js";
import { q } from "../db.js";
import type { AppEnv } from "../types.js";
import { isTokenRevoked } from "../services/session-store.js";

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const auth = c.req.header("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token) return c.json({ error: "Unauthorized" }, 401);
  try {
    const payload = await verifyUserJwt(token);
    if (!payload.sub) return c.json({ error: "Unauthorized" }, 401);
    if (await isTokenRevoked(payload.jti)) return c.json({ error: "Session revoked" }, 401);
    const rows = await q<{ id: string; email: string; display_name: string | null }>(
      "select id, email, display_name from public.users where id = $1::uuid limit 1",
      [payload.sub]
    );
    if (!rows[0]) {
      return c.json(
        {
          error:
            "Sesi tidak valid: akun tidak ada di database ini. Logout lalu login atau daftar lagi (mis. setelah ganti DATABASE_URL / Neon).",
        },
        401
      );
    }
    c.set("user", {
      id: String(rows[0].id),
      email: rows[0].email,
      displayName: rows[0].display_name ?? null,
    });
    await next();
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
};
