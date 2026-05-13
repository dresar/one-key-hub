import { Hono } from "hono";
import { q } from "../db.js";
import { cacheGet, cacheSet } from "../lib/cache.js";
import { requireAuth } from "../middleware/auth.js";
import { dashboardRateLimit } from "../middleware/dashboard-rate-limit.js";
import type { AppEnv } from "../types.js";
import { dashKey, invalidateDashboardCache, invalidateKeyDetailCache } from "../lib/dash-cache.js";
import { createApiKeyRow, decryptApiKeyPlain, rotateApiKey } from "../services/api-key-service.js";
import { makePagedResponse, parseListQuery } from "../lib/list-query.js";
import { config } from "../config.js";

const DASH_TTL = 2000;

type ApiKeyRow = {
  id: string;
  tenant_id: string;
  key_ciphertext?: string | null;
  status: string;
  grace_until?: string | null;
  rotated_from?: string | null;
  quota_per_minute: number;
  allowed_providers: string[] | null;
  name: string | null;
  created_at: string;
  client_username: string | null;
};

export const keyRoutes = new Hono<AppEnv>();
keyRoutes.use("/api/keys/*", requireAuth, dashboardRateLimit);
keyRoutes.use("/api/keys", requireAuth, dashboardRateLimit);

keyRoutes.get("/api/keys", async (c) => {
  const user = c.get("user");
  const list = parseListQuery((k) => c.req.query(k), {
    defaultPageSize: 15,
    maxPageSize: 60,
    allowedSortBy: ["created_at", "name", "status", "quota_per_minute"],
  });
  const cacheKey = dashKey(
    "api_keys_list",
    user.id,
    `pg:${list.page}|ps:${list.pageSize}|s:${list.status || ""}|p:${list.provider || ""}|q:${list.search || ""}|f:${list.from || ""}|t:${list.to || ""}|sb:${list.sortBy}|sd:${list.sortDir}`
  );
  const hit = cacheGet(cacheKey);
  if (hit) return c.json(hit);
  const params: unknown[] = [user.id];
  const where = ["tenant_id = $1"];
  if (list.status && list.status !== "all") {
    params.push(list.status);
    where.push(`status = $${params.length}`);
  }
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
    where.push(`(coalesce(name,'') ilike $${si} or coalesce(client_username,'') ilike $${si})`);
  }
  const sortMap: Record<string, string> = {
    created_at: "created_at",
    name: "name",
    status: "status",
    quota_per_minute: "quota_per_minute",
  };
  const orderBy = sortMap[list.sortBy] || "created_at";
  const countRows = await q<{ total: number }>(`select count(*)::int as total from public.api_keys where ${where.join(" and ")}`, params);
  params.push(list.limit, list.offset);
  const rows = await q<ApiKeyRow>(
    `select id, tenant_id, key_ciphertext, status, grace_until, rotated_from, quota_per_minute, allowed_providers, name, created_at, client_username
       from public.api_keys
      where ${where.join(" and ")}
      order by ${orderBy} ${list.sortDir}, created_at desc
      limit $${params.length - 1} offset $${params.length}`,
    params
  );
  const items = rows.map((r) => {
    const { key_ciphertext: _ct, ...safe } = r as unknown as Record<string, unknown>;
    if (!config.exposeKeyPlaintext) return { ...safe, api_key_plain: null, api_key_plain_error: "disabled" };
    const ct = r.key_ciphertext || null;
    if (!ct) return { ...safe, api_key_plain: null, api_key_plain_error: "missing_ciphertext" };
    let plain: string | null = null;
    try {
      plain = decryptApiKeyPlain(ct);
    } catch {
      plain = null;
    }
    return plain
      ? { ...safe, api_key_plain: plain, api_key_plain_error: null }
      : { ...safe, api_key_plain: null, api_key_plain_error: "decrypt_failed" };
  });
  const payload = makePagedResponse(items as unknown as ApiKeyRow[], Number(countRows[0]?.total || 0), list.page, list.pageSize);
  cacheSet(cacheKey, payload, DASH_TTL);
  return c.json(payload);
});

keyRoutes.post("/api/keys", async (c) => {
  const user = c.get("user");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  const created = await createApiKeyRow({
    tenantId: user.id,
    quota_per_minute: body.quota_per_minute != null ? Number(body.quota_per_minute) : undefined,
    allowed_providers: Array.isArray(body.allowed_providers)
      ? body.allowed_providers.map((x) => String(x).trim().toLowerCase()).filter(Boolean)
      : [],
    name: typeof body.name === "string" ? body.name : null,
    client_username: typeof body.client_username === "string" ? body.client_username : null,
    client_password: typeof body.client_password === "string" ? body.client_password : null,
  });
  invalidateDashboardCache(user.id);
  return c.json(created);
});

keyRoutes.post("/api/keys/:id/rotate", async (c) => {
  const user = c.get("user");
  const keyId = c.req.param("id");
  const rows = await q<{ key_hash: string }>(
    "select key_hash from public.api_keys where id = $1 and tenant_id = $2",
    [keyId, user.id]
  );
  const oldHash = rows[0]?.key_hash ?? null;
  const rotated = await rotateApiKey(user.id, keyId, oldHash);
  invalidateDashboardCache(user.id);
  invalidateKeyDetailCache(user.id, keyId);
  invalidateKeyDetailCache(user.id, String(rotated.id));
  return c.json(rotated);
});

keyRoutes.get("/api/keys/:id/health", async (c) => {
  const user = c.get("user");
  const keyId = c.req.param("id");
  const cacheKey = dashKey("key_health", user.id, keyId);
  const hit = cacheGet(cacheKey);
  if (hit) return c.json(hit);
  const rows = await q(
    `select response_time_ms as last_latency_ms,
            status_code as last_status,
            created_at as checked_at
       from public.gateway_request_logs
      where tenant_id = $1 and api_key_id = $2
      order by created_at desc
      limit 1`,
    [user.id, keyId]
  );
  const latest = rows[0] as Record<string, unknown> | undefined;
  const payload = {
    id: keyId,
    last_latency_ms: latest?.last_latency_ms ?? null,
    last_status: latest?.last_status ?? null,
    checked_at: latest?.checked_at ?? null,
    remaining: null,
  };
  cacheSet(cacheKey, payload, DASH_TTL);
  return c.json(payload);
});

keyRoutes.get("/api/keys/:id/stats", async (c) => {
  const user = c.get("user");
  const keyId = c.req.param("id");
  const cacheKey = dashKey("key_stats", user.id, keyId);
  const hit = cacheGet(cacheKey);
  if (hit) return c.json(hit);
  const ok = await q("select 1 from public.api_keys where id = $1 and tenant_id = $2", [keyId, user.id]);
  if (!ok.length) return c.json({ error: "Not found" }, 404);
  const days = 7;
  const r = await q<{ day: string; requests: number; errors: number }>(
    `select date_trunc('day', created_at at time zone 'UTC')::date as day, count(*)::int as requests,
            count(*) filter (where status_code >= 400)::int as errors
       from public.gateway_request_logs where api_key_id = $1 and created_at >= now() - interval '1 day' * $2
      group by 1 order by 1`,
    [keyId, days]
  );
  const daily = r.map((row) => ({ date: row.day, requests: row.requests, errors: row.errors }));
  const payload = { daily };
  cacheSet(cacheKey, payload, DASH_TTL);
  return c.json(payload);
});

keyRoutes.get("/api/keys/:id/analytics", async (c) => {
  const user = c.get("user");
  const keyId = c.req.param("id");
  const cacheKey = dashKey("key_analytics", user.id, keyId);
  const hit = cacheGet(cacheKey);
  if (hit) return c.json(hit);
  const ok = await q("select 1 from public.api_keys where id = $1 and tenant_id = $2", [keyId, user.id]);
  if (!ok.length) return c.json({ error: "Not found" }, 404);
  const { getApiKeyAnalytics } = await import("../services/observability.js");
  const data = await getApiKeyAnalytics(user.id, keyId);
  cacheSet(cacheKey, data, DASH_TTL);
  return c.json(data);
});

keyRoutes.get("/api/keys/:id/domains", async (c) => {
  const user = c.get("user");
  const keyId = c.req.param("id");
  const cacheKey = dashKey("key_domains", user.id, keyId);
  const hit = cacheGet(cacheKey);
  if (hit) return c.json(hit);
  const ok = await q("select 1 from public.api_keys where id = $1 and tenant_id = $2", [keyId, user.id]);
  if (!ok.length) return c.json({ error: "Not found" }, 404);
  const r = await q<{ domain: string }>(
    "select distinct origin_domain as domain from public.gateway_request_logs where api_key_id = $1 and origin_domain is not null order by 1",
    [keyId]
  );
  const payload = { domains: r.map((x) => x.domain) };
  cacheSet(cacheKey, payload, DASH_TTL);
  return c.json(payload);
});

keyRoutes.patch("/api/keys/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  const body = (await c.req.json().catch(() => ({}))) as Record<string, unknown>;
  if (typeof body.name === "string") {
    await q("update public.api_keys set name = $1, updated_at = now() where id = $2 and tenant_id = $3", [
      body.name.trim() || null,
      id,
      user.id,
    ]);
  }
  const rows = await q<ApiKeyRow>(
    `select id, tenant_id, status, quota_per_minute, allowed_providers, name, created_at, client_username
       from public.api_keys where id = $1 and tenant_id = $2`,
    [id, user.id]
  );
  invalidateDashboardCache(user.id);
  invalidateKeyDetailCache(user.id, id);
  return c.json(rows[0] ?? {});
});

keyRoutes.delete("/api/keys/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");
  await q("delete from public.api_keys where id = $1 and tenant_id = $2", [id, user.id]);
  invalidateDashboardCache(user.id);
  invalidateKeyDetailCache(user.id, id);
  return c.body(null, 204);
});
