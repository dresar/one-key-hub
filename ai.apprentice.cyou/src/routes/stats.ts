import { Hono } from "hono";
import { q } from "../db.js";
import { cacheGet, cacheSet } from "../lib/cache.js";
import { config } from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import { dashboardRateLimit } from "../middleware/dashboard-rate-limit.js";
import type { AppEnv } from "../types.js";
import { dashKey } from "../lib/dash-cache.js";
import { getMonitoringOverview } from "../services/observability.js";

const DASH_TTL = 2000;

export const statsRoutes = new Hono<AppEnv>();
statsRoutes.use("/api/stats", requireAuth, dashboardRateLimit);
statsRoutes.use("/api/stats/*", requireAuth, dashboardRateLimit);
statsRoutes.use("/api/monitoring/*", requireAuth, dashboardRateLimit);
statsRoutes.use("/api/dashboard/keys", requireAuth, dashboardRateLimit);
statsRoutes.use("/api/bootstrap", requireAuth, dashboardRateLimit);

statsRoutes.get("/api/stats", async (c) => {
  const user = c.get("user");
  const cacheKey = dashKey("stats", user.id);
  const hit = cacheGet<Record<string, number>>(cacheKey);
  if (hit) return c.json(hit);

  const [creds, clients, requests, alerts] = await Promise.all([
    q<{ status: string; total_requests: number }>(
      "select status, total_requests from public.provider_credentials where user_id = $1",
      [user.id]
    ),
    q<{ n: number }>("select count(*)::int as n from public.api_clients where user_id = $1", [user.id]),
    q<{ total: number; errors: number }>(
      `select count(*)::int as total,
              count(*) filter (where status_code >= 400 and created_at > now() - interval '24 hours')::int as errors
         from public.gateway_request_logs where tenant_id = $1`,
      [user.id]
    ),
    q<{ active: number }>(
      "select count(*) filter (where status = 'active')::int as active from public.gateway_alerts where tenant_id = $1",
      [user.id]
    ),
  ]);
  const result = {
    totalCredentials: creds.length,
    activeCredentials: creds.filter((x) => x.status === "active").length,
    cooldownCredentials: creds.filter((x) => x.status === "cooldown").length,
    totalClients: clients[0]?.n ?? 0,
    totalRequests: creds.reduce((n, x) => n + Number(x.total_requests || 0), 0),
    recentErrors: requests[0]?.errors ?? 0,
    activeAlerts: alerts[0]?.active ?? 0,
  };
  cacheSet(cacheKey, result, DASH_TTL);
  return c.json(result);
});

statsRoutes.get("/api/stats/usage", async (c) => {
  const user = c.get("user");
  const days = 7;
  const cacheKey = dashKey("usage", user.id, `days:${days}`);
  const hit = cacheGet(cacheKey);
  if (hit) return c.json(hit);
  const r = await q(
    `select date_trunc('day', created_at at time zone 'UTC')::date as date,
            count(*)::int as requests,
            count(*) filter (where status_code >= 400)::int as errors
       from public.gateway_request_logs
      where tenant_id = $1 and created_at >= now() - interval '1 day' * $2
      group by 1 order by 1`,
    [user.id, days]
  );
  cacheSet(cacheKey, { daily: r }, DASH_TTL);
  return c.json({ daily: r });
});

statsRoutes.get("/api/monitoring/overview", async (c) => {
  const user = c.get("user");
  const cacheKey = dashKey("monitoring", user.id);
  const hit = cacheGet(cacheKey);
  if (hit) return c.json(hit);
  const data = await getMonitoringOverview(user.id);
  cacheSet(cacheKey, data, DASH_TTL);
  return c.json(data);
});

statsRoutes.get("/api/dashboard/keys", async (c) => {
  const user = c.get("user");
  const cacheKey = dashKey("keys", user.id);
  const hit = cacheGet<unknown[]>(cacheKey);
  if (hit) return c.json(hit);

  const keys = await q<{
    id: string;
    tenant_id: string;
    status: string;
    quota_per_minute: number;
    allowed_providers: string[] | null;
    name: string | null;
    created_at: string;
    client_username: string | null;
  }>(
    `select id, tenant_id, status, quota_per_minute, allowed_providers, name, created_at, client_username
       from public.api_keys where tenant_id = $1 order by created_at desc`,
    [user.id]
  );
  const healthRows = await q<{
    api_key_id: string;
    last_latency_ms: number | null;
    last_status: number | null;
    checked_at: string | null;
  }>(
    `select distinct on (api_key_id)
        api_key_id,
        response_time_ms as last_latency_ms,
        status_code as last_status,
        created_at as checked_at
      from public.gateway_request_logs
      where tenant_id = $1
      order by api_key_id, created_at desc`,
    [user.id]
  );
  const byKey = new Map(healthRows.map((x) => [x.api_key_id, x]));
  const out = keys.map((k) => ({ ...k, health: byKey.get(k.id) ?? null, remaining: null }));
  cacheSet(cacheKey, out, config.apiKeyCacheTtlMs);
  return c.json(out);
});

statsRoutes.get("/api/bootstrap", async (c) => {
  const user = c.get("user");
  const tier = c.req.query("tier") === "full" ? "full" : "critical";
  const cacheKey = dashKey("bootstrap", user.id, tier);
  const hit = cacheGet(cacheKey);
  if (hit) return c.json(hit);

  const [stats, usage, monitoring] = await Promise.all([
      (async () => {
        const [creds, clientRows, requestRows, alertRows] = await Promise.all([
          q<{ status: string; total_requests: number }>(
            "select status, total_requests from public.provider_credentials where user_id = $1",
            [user.id]
          ),
          q<{ n: number }>("select count(*)::int as n from public.api_clients where user_id = $1", [user.id]),
          q<{ errors: number }>(
            `select count(*) filter (where status_code >= 400 and created_at > now() - interval '24 hours')::int as errors
               from public.gateway_request_logs where tenant_id = $1`,
            [user.id]
          ),
          q<{ active: number }>(
            "select count(*) filter (where status = 'active')::int as active from public.gateway_alerts where tenant_id = $1",
            [user.id]
          ),
        ]);
        return {
          totalCredentials: creds.length,
          activeCredentials: creds.filter((x) => x.status === "active").length,
          cooldownCredentials: creds.filter((x) => x.status === "cooldown").length,
          totalClients: clientRows[0]?.n ?? 0,
          totalRequests: creds.reduce((n, x) => n + Number(x.total_requests || 0), 0),
          recentErrors: requestRows[0]?.errors ?? 0,
          activeAlerts: alertRows[0]?.active ?? 0,
        };
      })(),
      q<{ date: string; requests: number; errors: number }>(
        `select date_trunc('day', created_at at time zone 'UTC')::date as date,
                count(*)::int as requests,
                count(*) filter (where status_code >= 400)::int as errors
           from public.gateway_request_logs
          where tenant_id = $1 and created_at >= now() - interval '1 day' * 7
          group by 1 order by 1`,
        [user.id]
      ),
      getMonitoringOverview(user.id),
    ]);

  if (tier === "critical") {
    const criticalPayload = {
      tier,
      stats,
      usage: { daily: usage },
      monitoring: {
        totals: monitoring.totals,
      },
      meta: { generatedAt: Date.now() },
    };
    cacheSet(cacheKey, criticalPayload, DASH_TTL);
    return c.json(criticalPayload);
  }

  const [credentials, keys, clients, settingsRows, geminiModels, groqModels, logs] = await Promise.all([
    q(
        `select id, provider_name, provider_type, label, status, total_requests, failed_requests, cooldown_until, created_at
           from public.provider_credentials where user_id = $1
          order by created_at desc limit 200`,
        [user.id]
      ),
    q(
        `select id, tenant_id, status, quota_per_minute, allowed_providers, name, created_at, client_username
           from public.api_keys where tenant_id = $1
          order by created_at desc limit 200`,
        [user.id]
      ),
    q(
        `select id, name, api_key, is_active, rate_limit, allowed_providers, created_at
           from public.api_clients where user_id = $1
          order by created_at desc limit 200`,
        [user.id]
      ),
    q<{ setting_key: string; setting_value: unknown }>(
        "select setting_key, setting_value from public.system_settings where user_id = $1",
        [user.id]
      ),
    q(
        `select id, provider, model_id, display_name, is_default, supports_vision, sort_order
           from public.ai_models where provider = 'gemini' order by sort_order, model_id`
      ),
    q(
        `select id, provider, model_id, display_name, is_default, supports_vision, sort_order
           from public.ai_models where provider = 'groq' order by sort_order, model_id`
      ),
    q(
        `select id, provider as provider_name, request_path as endpoint, method, status_code, response_time_ms, error_message,
                error_type, origin_domain, request_path, detected_anomaly_types, created_at, api_key_id, credential_id
           from public.gateway_request_logs
          where tenant_id = $1
          order by created_at desc limit 20`,
        [user.id]
      ),
  ]);

  const settings: Record<string, unknown> = {};
  for (const row of settingsRows) {
    const raw = row.setting_value;
    try {
      settings[row.setting_key] = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      settings[row.setting_key] = raw;
    }
  }

  const payload = {
    tier,
    stats,
    usage: { daily: usage },
    monitoring,
    credentials: { items: credentials },
    keys: { items: keys },
    clients: { items: clients },
    settings,
    models: { gemini: geminiModels, groq: groqModels },
    logs: { items: logs },
    meta: { generatedAt: Date.now() },
  };
  cacheSet(cacheKey, payload, DASH_TTL);
  return c.json(payload);
});
