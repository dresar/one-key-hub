import { q } from "../db.js";
import { cacheGet, cacheSet } from "../lib/cache.js";
import { config } from "../config.js";

const trimMessage = (value: unknown, maxLen = 240) => {
  const text = String(value || "").trim();
  if (!text) return null;
  return text.length > maxLen ? text.slice(0, maxLen - 1) + "…" : text;
};

const toJson = (v: unknown) => JSON.stringify(v ?? {});

const parseJsonSafe = (value: unknown, fallback: Record<string, unknown> = {}) => {
  if (value == null) return fallback;
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value === "string") {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return fallback;
    }
  }
  return fallback;
};

export async function reactivateExpiredCredentialCooldowns(userId: string, provider?: string) {
  const params: unknown[] = [userId];
  let sql = `update public.provider_credentials
    set status = 'active', cooldown_until = null
  where user_id = $1 and status = 'cooldown'
    and cooldown_until is not null and cooldown_until <= now()`;
  if (provider) {
    params.push(provider);
    sql += " and provider_name = $2";
  }
  try {
    await q(sql, params);
  } catch {
    /* */
  }
}

export async function upsertProviderCredentialStats(credentialId: string | null | undefined, success: boolean) {
  if (!credentialId) return;
  try {
    await q(
      `update public.provider_credentials
         set total_requests = total_requests + 1,
             failed_requests = failed_requests + $2
       where id = $1`,
      [credentialId, success ? 0 : 1]
    );
  } catch {
    /* */
  }
}

function classifyErrorType(statusCode: number | null | undefined, errorMessage: string, rateLimited: boolean) {
  const msg = (errorMessage || "").toLowerCase();
  if (!statusCode || statusCode < 400) return "success";
  if (rateLimited || statusCode === 429 || msg.includes("rate limit")) return "provider_rate_limit";
  if (msg.includes("timeout")) return "upstream_timeout";
  if (msg.includes("api key not valid") || msg.includes("invalid api key") || msg.includes("invalid signature"))
    return "provider_auth";
  if (msg.includes("credential") && msg.includes("not found")) return "credential_missing";
  if (statusCode === 401 || statusCode === 403) return "auth_rejected";
  if (statusCode >= 500) return "upstream_unavailable";
  return "client_error";
}

export async function logGatewayRequest(event: Record<string, unknown>) {
  const errT = classifyErrorType(
    event.statusCode as number,
    String(event.errorMessage || ""),
    Boolean(event.rateLimited)
  );
  const baseMeta = (event.metadata as Record<string, unknown>) || {};
  const rows = await q<Record<string, unknown>>(
    `insert into public.gateway_request_logs
      (api_key_id, tenant_id, provider, method, status_code, response_time_ms, origin_domain, request_path,
       error_type, error_message, credential_id, client_auth_used, rate_limited, breaker_open, upstream_status, detected_anomaly_types, metadata)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17::jsonb)
     returning *`,
    [
      event.apiKeyId,
      event.tenantId,
      event.provider,
      event.method,
      event.statusCode,
      event.responseTimeMs,
      event.originDomain,
      event.requestPath,
      errT,
      trimMessage(event.errorMessage),
      event.credentialId,
      Boolean(event.clientAuthUsed),
      Boolean(event.rateLimited),
      Boolean(event.breakerOpen),
      event.upstreamStatus,
      [],
      toJson(baseMeta),
    ]
  );
  const logRow = rows[0] ?? {};
  await upsertProviderCredentialStats(event.credentialId as string, !(event.statusCode && Number(event.statusCode) >= 400));

  if (config.gatewayLogMode !== "full") {
    return { log: logRow, anomalyTypes: [] as string[], alerts: [] as unknown[] };
  }

  /* Full anomaly path omitted on serverless for latency — insert only */
  return { log: logRow, anomalyTypes: [] as string[], alerts: [] as unknown[] };
}

export async function listGatewayLogs(
  tenantId: string,
  opts: {
    limit?: number;
    offset?: number;
    provider?: string | null;
    api_key_id?: string | null;
    status?: string | null;
    search?: string | null;
    date_from?: string | null;
    date_to?: string | null;
    sort_by?: "created_at" | "status_code" | "response_time_ms";
    sort_dir?: "asc" | "desc";
  }
) {
  const params: unknown[] = [tenantId];
  const where = ["g.tenant_id = $1"];
  if (opts.provider) {
    params.push(opts.provider);
    where.push(`g.provider = $${params.length}`);
  }
  if (opts.api_key_id) {
    params.push(opts.api_key_id);
    where.push(`g.api_key_id = $${params.length}`);
  }
  if (opts.status === "success") where.push("coalesce(g.status_code, 0) < 400");
  if (opts.status === "error") where.push("coalesce(g.status_code, 0) >= 400");
  if (opts.date_from) {
    params.push(opts.date_from);
    where.push(`g.created_at >= $${params.length}`);
  }
  if (opts.date_to) {
    params.push(opts.date_to);
    where.push(`g.created_at <= $${params.length}`);
  }
  if (opts.search) {
    params.push(`%${opts.search}%`);
    const si = params.length;
    where.push(
      `(coalesce(g.error_message, '') ilike $${si}
        or coalesce(g.origin_domain, '') ilike $${si}
        or coalesce(g.request_path, '') ilike $${si}
        or coalesce(k.name, '') ilike $${si})`
    );
  }
  const lim = Math.min(opts.limit || 100, 500);
  const offset = Math.max(0, opts.offset || 0);
  const sortByMap: Record<string, string> = {
    created_at: "g.created_at",
    status_code: "g.status_code",
    response_time_ms: "g.response_time_ms",
  };
  const orderBy = sortByMap[opts.sort_by || "created_at"] || "g.created_at";
  const sortDir = opts.sort_dir === "asc" ? "asc" : "desc";

  const countRows = await q<{ total: number }>(
    `select count(*)::int as total
       from public.gateway_request_logs g
       left join public.api_keys k on k.id = g.api_key_id
      where ${where.join(" and ")}`,
    params
  );
  params.push(lim);
  params.push(offset);
  const items = await q(
    `select g.id, g.provider as provider_name, 'gateway' as provider_type,
            g.request_path as endpoint, g.method, g.status_code, g.response_time_ms,
            g.error_message, g.error_type, g.origin_domain, g.request_path,
            g.detected_anomaly_types, g.created_at, g.api_key_id, g.credential_id,
            k.name as api_key_name
       from public.gateway_request_logs g
       left join public.api_keys k on k.id = g.api_key_id
      where ${where.join(" and ")}
      order by ${orderBy} ${sortDir}, g.created_at desc
      limit $${params.length - 1}
      offset $${params.length}`,
    params
  );
  return {
    items,
    total: Number(countRows[0]?.total || 0),
  };
}

export async function listGatewayAlerts(tenantId: string, status = "active", limit = 25) {
  const params: unknown[] = [tenantId];
  const where = ["tenant_id = $1"];
  if (status && status !== "all") {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  const lim = Math.min(limit || 25, 100);
  params.push(lim);
  const rows = await q<Record<string, unknown>>(
    `select * from public.gateway_alerts where ${where.join(" and ")}
     order by created_at desc limit $${params.length}`,
    params
  );
  return rows.map((d) => ({
    ...d,
    metadata: parseJsonSafe(d.metadata, {}),
  }));
}

export async function acknowledgeAlert(tenantId: string, alertId: string) {
  const rows = await q(
    `update public.gateway_alerts
        set acknowledged_at = coalesce(acknowledged_at, now()),
            read_at = coalesce(read_at, now()),
            status = case when status = 'active' then 'acknowledged' else status end,
            updated_at = now()
      where id = $1 and tenant_id = $2 returning *`,
    [alertId, tenantId]
  );
  return rows[0] ?? null;
}

export async function getMonitoringOverview(tenantId: string) {
  const [requestRows, alertRows, providerRows, keyRows] = await Promise.all([
    q(
      `select count(*)::int as total_requests,
              count(*) filter (where status_code >= 400)::int as total_errors,
              coalesce(avg(response_time_ms), 0)::int as avg_latency_ms
         from public.gateway_request_logs
        where tenant_id = $1 and created_at >= now() - interval '24 hours'`,
      [tenantId]
    ),
    q(
      `select count(*) filter (where status = 'active')::int as active_alerts,
              count(*) filter (where severity = 'critical' and status = 'active')::int as critical_alerts
         from public.gateway_alerts
        where tenant_id = $1 and created_at >= now() - interval '7 days'`,
      [tenantId]
    ),
    q(
      `select provider_name as provider,
              count(*)::int as total_credentials,
              count(*) filter (where status = 'active')::int as active_credentials,
              count(*) filter (where status = 'cooldown')::int as cooldown_credentials
         from public.provider_credentials
        where user_id = $1
        group by provider_name
        order by provider_name`,
      [tenantId]
    ),
    q(
      `select g.api_key_id, coalesce(k.name, 'Unnamed') as api_key_name,
              count(*)::int as requests,
              count(*) filter (where g.status_code >= 400)::int as errors,
              count(distinct g.origin_domain) filter (where g.origin_domain is not null and g.origin_domain <> '')::int as domains
         from public.gateway_request_logs g
         left join public.api_keys k on k.id = g.api_key_id
        where g.tenant_id = $1 and g.created_at >= now() - interval '24 hours'
        group by g.api_key_id, k.name
        order by requests desc
        limit 5`,
      [tenantId]
    ),
  ]);
  const rq = requestRows[0] as Record<string, number>;
  const aq = alertRows[0] as Record<string, number>;
  return {
    totals: {
      totalRequests24h: Number(rq?.total_requests || 0),
      totalErrors24h: Number(rq?.total_errors || 0),
      avgLatencyMs24h: Number(rq?.avg_latency_ms || 0),
      activeAlerts: Number(aq?.active_alerts || 0),
      criticalAlerts: Number(aq?.critical_alerts || 0),
    },
    providerHealth: providerRows,
    noisyKeys: keyRows,
  };
}

export async function getApiKeyAnalytics(tenantId: string, apiKeyId: string) {
  const [summaryRows, seriesRows, alertRows] = await Promise.all([
    q(
      `select count(*)::int as requests,
              count(*) filter (where status_code >= 400)::int as errors,
              coalesce(avg(response_time_ms), 0)::int as avg_latency_ms,
              count(distinct origin_domain) filter (where origin_domain is not null and origin_domain <> '')::int as domains
         from public.gateway_request_logs
        where tenant_id = $1 and api_key_id = $2 and created_at >= now() - interval '7 days'`,
      [tenantId, apiKeyId]
    ),
    q(
      `select date_trunc('hour', created_at at time zone 'UTC') as bucket,
              count(*)::int as requests,
              count(*) filter (where status_code >= 400)::int as errors,
              coalesce(avg(response_time_ms), 0)::int as avg_latency_ms
         from public.gateway_request_logs
        where tenant_id = $1 and api_key_id = $2 and created_at >= now() - interval '24 hours'
        group by 1 order by 1`,
      [tenantId, apiKeyId]
    ),
    q(
      `select * from public.gateway_alerts
        where tenant_id = $1 and api_key_id = $2
        order by created_at desc limit 10`,
      [tenantId, apiKeyId]
    ),
  ]);
  const s0 = summaryRows[0] as Record<string, number>;
  const alerts = (alertRows as Record<string, unknown>[]).map((d) => ({
    ...d,
    metadata: parseJsonSafe(d.metadata, {}),
  }));
  return {
    summary: {
      requests: Number(s0?.requests || 0),
      errors: Number(s0?.errors || 0),
      avgLatencyMs: Number(s0?.avg_latency_ms || 0),
      domains: Number(s0?.domains || 0),
    },
    series: seriesRows,
    alerts,
  };
}
