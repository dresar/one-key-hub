import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { q } from "../db.js";
import { config } from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import { dashboardRateLimit } from "../middleware/dashboard-rate-limit.js";
import type { AppEnv } from "../types.js";
import { dashKey, invalidateDashboardCache } from "../lib/dash-cache.js";
import {
  listGatewayLogs,
  listGatewayAlerts,
  acknowledgeAlert,
} from "../services/observability.js";
import { cacheGet, cacheSet } from "../lib/cache.js";
import * as pgw from "../services/playground.js";
import { makePagedResponse, parseListQuery } from "../lib/list-query.js";

const DASH_TTL = 2000;
const DATA_PROVIDERS = new Set(["newsapi", "gnews", "mediastack", "openweather", "alphavantage"]);

const parseCredBlob = (raw: unknown): Record<string, string> => {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, string>;
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, string>;
    } catch {
      return {};
    }
  }
  return {};
};

const normalizeProviderName = (v: unknown) => String(v || "").trim().toLowerCase();
const normalizeProviderType = (v: unknown) => String(v || "ai").trim().toLowerCase() || "ai";

const normalizeCredentials = (provider: string, raw: unknown): Record<string, string> => {
  const input = parseCredBlob(raw);
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v == null) continue;
    out[k] = String(v).trim();
  }
  const setIfMissing = (snake: string, aliases: string[]) => {
    if (out[snake]) return;
    for (const a of aliases) {
      if (out[a]) {
        out[snake] = out[a];
        return;
      }
    }
  };

  setIfMissing("api_key", ["apiKey", "key"]);
  setIfMissing("api_token", ["apiToken", "token"]);
  setIfMissing("cloud_name", ["cloudName"]);
  setIfMissing("api_secret", ["apiSecret"]);
  setIfMissing("public_key", ["publicKey"]);
  setIfMissing("private_key", ["privateKey"]);
  setIfMissing("url_endpoint", ["urlEndpoint"]);
  setIfMissing("access_key", ["accessKey"]);
  setIfMissing("appid", ["appId"]);
  setIfMissing("rapidapi_host", ["rapidapiHost"]);

  if (provider === "gnews") {
    setIfMissing("token", ["api_key", "apiKey"]);
  }

  return out;
};

type DupSigPart = { field: string; value: string };

const getDuplicateSignature = (provider: string, credentials: Record<string, string>): DupSigPart[] => {
  const p = provider;
  const addOne = (field: string) => {
    const v = String(credentials[field] || "").trim();
    return v ? [{ field, value: v }] : [];
  };
  const addAllOrNone = (fields: string[]) => {
    const parts: DupSigPart[] = [];
    for (const f of fields) {
      const v = String(credentials[f] || "").trim();
      if (!v) return [];
      parts.push({ field: f, value: v });
    }
    return parts;
  };

  if (p === "gemini" || p === "groq" || p === "newsapi" || p === "alphavantage" || p === "huggingface") {
    return addOne("api_key");
  }
  if (p === "apify") return addOne("api_token");
  if (p === "openweather") return addOne("appid");
  if (p === "mediastack") return addOne("access_key");
  if (p === "gnews") return addOne("token") || addOne("api_key");
  if (p === "rapidapi") return addAllOrNone(["api_key", "rapidapi_host"]);
  if (p === "cloudinary") return addAllOrNone(["cloud_name", "api_key"]);
  if (p === "imagekit") return addAllOrNone(["public_key", "url_endpoint"]);
  return addOne("api_key");
};

const isDuplicateCredential = async (opts: {
  userId: string;
  providerName: string;
  credentials: Record<string, string>;
  excludeId?: string | null;
}) => {
  const provider = normalizeProviderName(opts.providerName);
  const sig = getDuplicateSignature(provider, opts.credentials);
  if (!sig.length) return false;

  const where: string[] = ["user_id = $1", "lower(provider_name) = $2"];
  const values: unknown[] = [opts.userId, provider];
  let i = 3;
  if (opts.excludeId) {
    where.push(`id <> $${i++}`);
    values.push(opts.excludeId);
  }
  for (const part of sig) {
    where.push(`credentials->>'${part.field}' = $${i++}`);
    values.push(part.value);
  }
  const rows = await q(`select 1 from public.provider_credentials where ${where.join(" and ")} limit 1`, values);
  return rows.length > 0;
};

const r = new Hono<AppEnv>();
r.use("/api/*", requireAuth, dashboardRateLimit);

r.patch("/api/profile", async (c) => {
  const user = c.get("user");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const displayName = body.displayName ?? body.display_name;
  let email: string | undefined;
  if (body.email) email = String(body.email).trim().toLowerCase();
  const uid = user.id;
  if (displayName !== undefined && displayName !== null) {
    await q("update public.users set display_name = $1 where id = $2", [displayName, uid]);
  }
  if (email && email !== user.email) {
    const ex = await q("select id from public.users where email = $1 and id != $2", [email, uid]);
    if (ex.length) return c.json({ error: "Email sudah dipakai" }, 409);
    await q("update public.users set email = $1 where id = $2", [email, uid]);
  }
  const rows = await q<{ id: string; email: string; display_name: string | null }>(
    "select id, email, display_name from public.users where id = $1",
    [uid]
  );
  const u = rows[0];
  return c.json({ id: String(u?.id), email: u?.email, displayName: u?.display_name ?? null });
});

r.post("/api/auth/change-password", async (c) => {
  const user = c.get("user");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const current = body.current_password ?? body.currentPassword;
  const nxt = body.new_password ?? body.newPassword;
  if (!current || !nxt) return c.json({ error: "current_password dan new_password wajib" }, 400);
  if (String(nxt).length < 8) return c.json({ error: "Password baru minimal 8 karakter" }, 400);
  const rows = await q<{ password_hash: string }>("select password_hash from public.users where id = $1", [user.id]);
  const ph = rows[0]?.password_hash || "";
  if (!(await bcrypt.compare(String(current), String(ph)))) return c.json({ error: "Password lama salah" }, 401);
  const nh = await bcrypt.hash(String(nxt), 10);
  await q("update public.users set password_hash = $1 where id = $2", [nh, user.id]);
  return c.json({ success: true });
});

r.get("/api/logs", async (c) => {
  const user = c.get("user");
  const list = parseListQuery((k) => c.req.query(k), {
    defaultPageSize: 25,
    maxPageSize: 100,
    allowedSortBy: ["created_at", "status_code", "response_time_ms"],
  });
  const provider = list.provider;
  const apiKeyId = c.req.query("apiKeyId");
  const cacheSuffix = `pg:${list.page}|ps:${list.pageSize}|p:${provider || ""}|k:${apiKeyId || ""}|s:${list.status || ""}|q:${list.search || ""}|f:${list.from || ""}|t:${list.to || ""}|sb:${list.sortBy}|sd:${list.sortDir}`;
  const cacheKey = dashKey("logs", user.id, cacheSuffix);
  const hit = cacheGet(cacheKey);
  if (hit) return c.json(hit);
  const data = await listGatewayLogs(user.id, {
    limit: list.limit,
    offset: list.offset,
    provider: provider || null,
    api_key_id: apiKeyId || null,
    status: list.status || null,
    search: list.search || null,
    date_from: list.from || null,
    date_to: list.to || null,
    sort_by: list.sortBy as "created_at" | "status_code" | "response_time_ms",
    sort_dir: list.sortDir,
  });
  const payload = makePagedResponse(data.items, data.total, list.page, list.pageSize);
  cacheSet(cacheKey, payload, DASH_TTL);
  return c.json(payload);
});

r.get("/api/alerts", async (c) => {
  const user = c.get("user");
  const status = c.req.query("status") || "active";
  const limit = c.req.query("limit");
  const cacheKey = dashKey("alerts", user.id, `status:${status}|limit:${limit || 25}`);
  const hit = cacheGet(cacheKey);
  if (hit) return c.json(hit);
  const data = await listGatewayAlerts(user.id, status, Number(limit || 25));
  cacheSet(cacheKey, data, DASH_TTL);
  return c.json(data);
});

r.patch("/api/alerts/:id/ack", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const a = await acknowledgeAlert(user.id, id);
  if (!a) return c.json({ error: "Not found" }, 404);
  invalidateDashboardCache(user.id);
  return c.json(a);
});

r.get("/api/credentials", async (c) => {
  const user = c.get("user");
  const list = parseListQuery((k) => c.req.query(k), {
    defaultPageSize: 15,
    maxPageSize: 60,
    allowedSortBy: ["created_at", "provider_name", "status", "total_requests"],
  });
  const cacheKey = dashKey(
    "credentials_list",
    user.id,
    `pg:${list.page}|ps:${list.pageSize}|s:${list.status || ""}|p:${list.provider || ""}|q:${list.search || ""}|f:${list.from || ""}|t:${list.to || ""}|sb:${list.sortBy}|sd:${list.sortDir}`
  );
  const hit = cacheGet(cacheKey);
  if (hit) return c.json(hit);
  const params: unknown[] = [user.id];
  const where = ["user_id = $1"];
  if (list.provider) {
    params.push(list.provider);
    where.push(`provider_name = $${params.length}`);
  }
  if (list.status && list.status !== "all") {
    params.push(list.status);
    where.push(`status = $${params.length}`);
  }
  if (list.from) {
    params.push(list.from);
    where.push(`created_at >= $${params.length}`);
  }
  if (list.to) {
    params.push(list.to);
    where.push(`created_at <= $${params.length}`);
  }
  if (list.search) {
    params.push(`%${list.search}%`);
    const si = params.length;
    where.push(`(coalesce(label,'') ilike $${si} or provider_name ilike $${si})`);
  }
  const sortMap: Record<string, string> = {
    created_at: "created_at",
    provider_name: "provider_name",
    status: "status",
    total_requests: "total_requests",
  };
  const orderBy = sortMap[list.sortBy] || "created_at";

  const countRows = await q<{ total: number }>(`select count(*)::int as total from public.provider_credentials where ${where.join(" and ")}`, params);
  params.push(list.limit, list.offset);
  const items = await q(
    `select id, provider_name, provider_type, label, status, total_requests, failed_requests, cooldown_until, created_at
       from public.provider_credentials
      where ${where.join(" and ")}
      order by ${orderBy} ${list.sortDir}, created_at desc
      limit $${params.length - 1} offset $${params.length}`,
    params
  );
  const payload = makePagedResponse(items, Number(countRows[0]?.total || 0), list.page, list.pageSize);
  cacheSet(cacheKey, payload, DASH_TTL);
  return c.json(payload);
});

r.get("/api/credentials/export", async (c) => {
  if (!config.allowCredentialExport) return c.json({ error: "Ekspor credential dinonaktifkan di environment ini." }, 403);
  const user = c.get("user");
  const rows = await q<Record<string, unknown>>(
    `select id, provider_name, provider_type, label, credentials, status, total_requests, failed_requests, cooldown_until, created_at
       from public.provider_credentials where user_id = $1 order by created_at desc`,
    [user.id]
  );
  const items = rows.map((row) => {
    let creds = row.credentials;
    if (typeof creds === "string") {
      try {
        creds = JSON.parse(creds);
      } catch {
        creds = {};
      }
    }
    return {
      provider_name: row.provider_name,
      provider_type: row.provider_type,
      label: row.label,
      credentials: typeof creds === "object" && creds ? creds : {},
      status: row.status,
    };
  });
  return c.json(items);
});

r.post("/api/credentials", async (c) => {
  const user = c.get("user");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const providerName = normalizeProviderName(body.provider_name);
  const providerType = normalizeProviderType(body.provider_type);
  const credentials = normalizeCredentials(providerName, body.credentials);
  if (
    await isDuplicateCredential({
      userId: user.id,
      providerName,
      credentials,
    })
  ) {
    return c.json({ error: "API key sudah ada (duplikat)." }, 409);
  }
  const rows = await q(
    `insert into public.provider_credentials (user_id, provider_name, provider_type, label, credentials)
     values ($1, $2, $3, $4, $5)
     returning id, provider_name, provider_type, label, status, total_requests, failed_requests, cooldown_until, created_at`,
    [
      user.id,
      providerName,
      providerType,
      body.label ?? null,
      JSON.stringify(credentials),
    ]
  );
  invalidateDashboardCache(user.id);
  return c.json(rows[0]);
});

r.get("/api/credentials/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const cacheKey = dashKey("credential_detail", user.id, id);
  const hit = cacheGet(cacheKey);
  if (hit) return c.json(hit);
  const rows = await q(
    `select id, provider_name, provider_type, label, credentials, status, total_requests, failed_requests, cooldown_until, created_at
       from public.provider_credentials where id = $1 and user_id = $2 limit 1`,
    [id, user.id]
  );
  if (!rows.length) return c.json({ error: "Not found" }, 404);
  cacheSet(cacheKey, rows[0], DASH_TTL);
  return c.json(rows[0]);
});

r.patch("/api/credentials/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if ("label" in body) {
    await q("update public.provider_credentials set label = $1 where id = $2 and user_id = $3", [
      body.label,
      id,
      user.id,
    ]);
  }
  if (body.credentials != null && typeof body.credentials === "object") {
    const cur = await q<{ provider_name: string }>(
      "select provider_name from public.provider_credentials where id = $1 and user_id = $2 limit 1",
      [id, user.id]
    );
    if (!cur.length) return c.json({ error: "Not found" }, 404);
    const providerName = normalizeProviderName(cur[0]?.provider_name);
    const credentials = normalizeCredentials(providerName, body.credentials);
    if (
      await isDuplicateCredential({
        userId: user.id,
        providerName,
        credentials,
        excludeId: id,
      })
    ) {
      return c.json({ error: "API key sudah ada (duplikat)." }, 409);
    }
    await q("update public.provider_credentials set credentials = $1 where id = $2 and user_id = $3", [
      JSON.stringify(credentials),
      id,
      user.id,
    ]);
  }
  const rows = await q(
    `select id, provider_name, provider_type, label, status, total_requests, failed_requests, cooldown_until, created_at
       from public.provider_credentials where id = $1 and user_id = $2`,
    [id, user.id]
  );
  invalidateDashboardCache(user.id);
  const { cacheDel } = await import("../lib/cache.js");
  cacheDel(dashKey("credential_detail", user.id, id));
  return c.json(rows[0] ?? {});
});

r.delete("/api/credentials/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  await q("delete from public.provider_credentials where id = $1 and user_id = $2", [id, user.id]);
  invalidateDashboardCache(user.id);
  const { cacheDel } = await import("../lib/cache.js");
  cacheDel(dashKey("credential_detail", user.id, id));
  return c.body(null, 204);
});

r.post("/api/credentials/:id/reactivate", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  await q(
    "update public.provider_credentials set status = 'active', cooldown_until = null where id = $1 and user_id = $2",
    [id, user.id]
  );
  invalidateDashboardCache(user.id);
  return c.body(null, 204);
});

r.post("/api/credentials/import", async (c) => {
  const user = c.get("user");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const items = Array.isArray(body.items) ? body.items : [];
  let imported = 0;
  let duplicates = 0;
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const o = it as Record<string, unknown>;
    const providerName = normalizeProviderName(o.provider_name ?? o.providerName ?? "");
    const providerType = normalizeProviderType(o.provider_type ?? o.providerType ?? "ai");
    const label = o.label;
    const credentials = normalizeCredentials(providerName, o.credentials ?? o.creds ?? {});
    if (!providerName) continue;
    if (
      await isDuplicateCredential({
        userId: user.id,
        providerName,
        credentials,
      })
    ) {
      duplicates++;
      continue;
    }
    await q(
      `insert into public.provider_credentials (user_id, provider_name, provider_type, label, credentials)
       values ($1, $2, $3, $4, $5)`,
      [user.id, providerName, providerType, label ?? null, JSON.stringify(credentials)]
    );
    imported++;
  }
  invalidateDashboardCache(user.id);
  return c.json({ imported, duplicates, total: items.length });
});

r.get("/api/clients", async (c) => {
  const user = c.get("user");
  const list = parseListQuery((k) => c.req.query(k), {
    defaultPageSize: 15,
    maxPageSize: 60,
    allowedSortBy: ["created_at", "name", "is_active", "rate_limit"],
  });
  const cacheKey = dashKey(
    "clients_list",
    user.id,
    `pg:${list.page}|ps:${list.pageSize}|s:${list.status || ""}|p:${list.provider || ""}|q:${list.search || ""}|f:${list.from || ""}|t:${list.to || ""}|sb:${list.sortBy}|sd:${list.sortDir}`
  );
  const hit = cacheGet(cacheKey);
  if (hit) return c.json(hit);
  const params: unknown[] = [user.id];
  const where = ["user_id = $1"];
  if (list.status === "active") where.push("is_active = true");
  if (list.status === "inactive") where.push("is_active = false");
  if (list.provider) {
    params.push(list.provider.toLowerCase());
    where.push(`$${params.length} = any(allowed_providers)`);
  }
  if (list.from) {
    params.push(list.from);
    where.push(`created_at >= $${params.length}`);
  }
  if (list.to) {
    params.push(list.to);
    where.push(`created_at <= $${params.length}`);
  }
  if (list.search) {
    params.push(`%${list.search}%`);
    const si = params.length;
    where.push(`(coalesce(name,'') ilike $${si} or coalesce(api_key,'') ilike $${si})`);
  }
  const sortMap: Record<string, string> = {
    created_at: "created_at",
    name: "name",
    is_active: "is_active",
    rate_limit: "rate_limit",
  };
  const orderBy = sortMap[list.sortBy] || "created_at";
  const countRows = await q<{ total: number }>(`select count(*)::int as total from public.api_clients where ${where.join(" and ")}`, params);
  params.push(list.limit, list.offset);
  const items = await q(
    `select id, name, api_key, is_active, rate_limit, allowed_providers, created_at
       from public.api_clients
      where ${where.join(" and ")}
      order by ${orderBy} ${list.sortDir}, created_at desc
      limit $${params.length - 1} offset $${params.length}`,
    params
  );
  const payload = makePagedResponse(items, Number(countRows[0]?.total || 0), list.page, list.pageSize);
  cacheSet(cacheKey, payload, DASH_TTL);
  return c.json(payload);
});

r.post("/api/clients", async (c) => {
  const user = c.get("user");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const name = String(body.name || "Unnamed");
  const rateLimit = Number(body.rate_limit || 100);
  const raw = body.allowed_providers;
  const allowed = Array.isArray(raw) ? raw.map((p) => String(p).trim().toLowerCase()).filter(Boolean) : [];
  const rows = await q(
    `insert into public.api_clients (user_id, name, rate_limit, allowed_providers)
     values ($1, $2, $3, $4)
     returning id, name, api_key, is_active, rate_limit, allowed_providers, created_at`,
    [user.id, name, rateLimit, allowed.length ? allowed : []]
  );
  invalidateDashboardCache(user.id);
  return c.json(rows[0]);
});

r.patch("/api/clients/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.is_active === "boolean") {
    await q("update public.api_clients set is_active = $1 where id = $2 and user_id = $3", [
      body.is_active,
      id,
      user.id,
    ]);
  }
  const raw = body.allowed_providers;
  if (Array.isArray(raw)) {
    const allowed = raw.map((p) => String(p).trim().toLowerCase()).filter(Boolean);
    await q("update public.api_clients set allowed_providers = $1 where id = $2 and user_id = $3", [
      allowed,
      id,
      user.id,
    ]);
  }
  const rows = await q(
    `select id, name, api_key, is_active, rate_limit, allowed_providers, created_at
       from public.api_clients where id = $1 and user_id = $2`,
    [id, user.id]
  );
  invalidateDashboardCache(user.id);
  return c.json(rows[0] ?? {});
});

r.delete("/api/clients/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  await q("delete from public.api_clients where id = $1 and user_id = $2", [id, user.id]);
  invalidateDashboardCache(user.id);
  return c.body(null, 204);
});

r.post("/api/playground/chat", async (c) => {
  const user = c.get("user");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const credentialId = String(body.credential_id ?? body.credentialId ?? "");
  const prompt = String(body.prompt || "");
  const imageB64 = String(body.image_base64 ?? body.imageBase64 ?? "");
  const mid = body.model_id ?? body.modelId;
  const modelId = typeof mid === "string" && mid.trim() ? mid.trim() : null;
  if (!credentialId) return c.json({ error: "credential_id required" }, 400);
  const result = await pgw.chatWithProvider({
    userId: user.id,
    credentialId,
    prompt,
    imageBase64: imageB64,
    modelId,
  });
  if (result.error) return c.json({ error: result.error }, 400);
  return c.json(result);
});

r.post("/api/playground/upload", async (c) => {
  const user = c.get("user");
  const body = await c.req.parseBody();
  const file = body.file;
  const credentialId = String(body.credential_id || "");
  const provider = String(body.provider || "cloudinary");
  if (!(file instanceof File) || !credentialId) return c.json({ error: "file and credential_id required" }, 400);
  const buf = Buffer.from(await file.arrayBuffer());
  const result = await pgw.uploadToCloud({
    userId: user.id,
    credentialId,
    provider: provider || "cloudinary",
    buffer: buf,
    mimeType: file.type || "application/octet-stream",
    originalName: file.name || "upload",
  });
  if (result.error) return c.json({ error: result.error }, 400);
  if (result.external_id) {
    const deleteAt = new Date(Date.now() + 3600 * 1000).toISOString();
    try {
      await q(
        `insert into public.upload_expiry (tenant_id, credential_id, provider, external_id, delete_at)
         values ($1, $2, $3, $4, $5)`,
        [user.id, credentialId, provider, result.external_id, deleteAt]
      );
    } catch {
      /* */
    }
  }
  return c.json(result);
});

r.post("/api/playground/proxy", async (c) => {
  const user = c.get("user");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const credentialId = String(body.credential_id ?? body.credentialId ?? "");
  const method = String(body.method ?? "GET").toUpperCase();
  const endpoint = String(body.endpoint ?? "/").trim();
  const query = (body.query && typeof body.query === "object" ? body.query : {}) as Record<string, unknown>;
  const bodyJson = (body.body && typeof body.body === "object" ? body.body : {}) as Record<string, unknown>;
  if (!credentialId) return c.json({ error: "credential_id wajib diisi" }, 400);
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) return c.json({ error: "method tidak didukung" }, 400);
  if (!endpoint.startsWith("/")) return c.json({ error: "endpoint harus diawali /" }, 400);

  const rows = await q<{ provider_name: string; credentials: unknown }>(
    `select provider_name, credentials
       from public.provider_credentials
      where id = $1 and user_id = $2 and status = 'active'
      limit 1`,
    [credentialId, user.id]
  );
  if (!rows.length) return c.json({ error: "Credential tidak ditemukan/aktif" }, 404);
  const provider = String(rows[0].provider_name || "").toLowerCase();
  const cred = parseCredBlob(rows[0].credentials);

  const upstreams = config.providerUpstreams;
  const base = upstreams[provider];
  let target = "";
  const headers: Record<string, string> = {};

  if (provider === "rapidapi") {
    const host = String(cred.rapidapi_host || "").trim().replace(/^https?:\/\//, "").split("/")[0];
    const key = String(cred.api_key || "").trim();
    if (!host || !key) return c.json({ error: "rapidapi_host + api_key wajib" }, 400);
    const u = new URL(`https://${host}${endpoint}`);
    for (const [k, v] of Object.entries(query)) u.searchParams.set(k, String(v));
    target = u.toString();
    headers["X-RapidAPI-Key"] = key;
    headers["X-RapidAPI-Host"] = host;
  } else {
    if (!base) return c.json({ error: `Provider ${provider} belum didukung` }, 400);
    const u = new URL(endpoint, base.endsWith("/") ? base : `${base}/`);
    for (const [k, v] of Object.entries(query)) u.searchParams.set(k, String(v));
    target = u.toString();
    const providerApiKey = String(cred.api_key || cred.apiKey || "").trim();
    if (provider === "gemini" && providerApiKey) {
      u.searchParams.set("key", providerApiKey);
      target = u.toString();
    } else if ((provider === "groq" || provider === "huggingface") && providerApiKey) {
      headers.Authorization = `Bearer ${providerApiKey}`;
    } else if (provider === "apify") {
      const token = String(cred.api_token || cred.api_key || "").trim();
      if (token) {
        u.searchParams.set("token", token);
        target = u.toString();
      }
    } else if (DATA_PROVIDERS.has(provider)) {
      if (provider === "newsapi") u.searchParams.set("apiKey", String(cred.api_key || ""));
      else if (provider === "gnews") u.searchParams.set("token", String(cred.token || cred.api_key || ""));
      else if (provider === "mediastack") u.searchParams.set("access_key", String(cred.access_key || ""));
      else if (provider === "openweather") u.searchParams.set("appid", String(cred.appid || ""));
      else if (provider === "alphavantage") u.searchParams.set("apikey", String(cred.api_key || ""));
      target = u.toString();
    }
  }

  try {
    const res = await fetch(target, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: method === "GET" ? undefined : JSON.stringify(bodyJson),
      signal: AbortSignal.timeout(12000),
    });
    const contentType = res.headers.get("content-type") || "";
    const payload = contentType.includes("application/json") ? await res.json().catch(() => ({})) : await res.text();
    return c.json(
      {
        ok: res.ok,
        status: res.status,
        provider,
        endpoint,
        upstream: target,
        data: payload,
      },
      res.ok ? 200 : 400
    );
  } catch (e) {
    return c.json({ error: String((e as Error).message || e) }, 502);
  }
});

r.get("/api/settings", async (c) => {
  const user = c.get("user");
  const cacheKey = dashKey("settings", user.id);
  const hit = cacheGet(cacheKey);
  if (hit) return c.json(hit);
  const rows = await q<{ setting_key: string; setting_value: unknown }>(
    "select setting_key, setting_value from public.system_settings where user_id = $1",
    [user.id]
  );
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    const raw = row.setting_value;
    try {
      out[row.setting_key] = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      out[row.setting_key] = raw;
    }
  }
  cacheSet(cacheKey, out, DASH_TTL);
  return c.json(out);
});

r.put("/api/settings", async (c) => {
  const user = c.get("user");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const data =
    body.settings && typeof body.settings === "object" ? (body.settings as Record<string, unknown>) : body;
  if (typeof data !== "object" || !data) return c.json({ error: "Permintaan tidak valid." }, 400);
  for (const [key, value] of Object.entries(data)) {
    await q(
      `insert into public.system_settings (user_id, setting_key, setting_value)
       values ($1, $2, $3)
       on conflict (user_id, setting_key) do update set setting_value = $3`,
      [user.id, key, JSON.stringify(value)]
    );
  }
  const rows = await q<{ setting_key: string; setting_value: unknown }>(
    "select setting_key, setting_value from public.system_settings where user_id = $1",
    [user.id]
  );
  const out: Record<string, unknown> = {};
  for (const row of rows) {
    const raw = row.setting_value;
    try {
      out[row.setting_key] = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      out[row.setting_key] = raw;
    }
  }
  invalidateDashboardCache(user.id);
  return c.json(out);
});

export const dashboardRoutes = r;
