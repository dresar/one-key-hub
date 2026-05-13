import { q } from "../db.js";
import { findLatestActiveCredential } from "../gateway/credentials.js";
import { logGatewayRequest } from "./observability.js";
import { config } from "../config.js";

function parseCredentialJson(value: unknown): Record<string, string> {
  if (value == null) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, string>;
  try {
    return JSON.parse(String(value)) as Record<string, string>;
  } catch {
    return {};
  }
}

export function getApifyTokenFromCredential(credentialRow: Record<string, unknown> | null): string {
  if (!credentialRow) return "";
  const creds = parseCredentialJson(credentialRow.credentials);
  return String(creds.api_token || creds.apiToken || "").trim();
}

export function normalizeApifyCollection(payload: unknown): Record<string, unknown> {
  const pdata = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const dataBlock = pdata.data && typeof pdata.data === "object" ? (pdata.data as Record<string, unknown>) : {};
  let items: unknown =
    dataBlock.items ?? pdata.items ?? (Array.isArray(payload) ? payload : undefined);
  if (!Array.isArray(items)) items = [];
  const arr = items as unknown[];
  return {
    total: Number(dataBlock.total ?? pdata.total ?? arr.length ?? 0),
    count: arr.length,
    offset: Number(dataBlock.offset ?? pdata.offset ?? 0),
    limit: Number(dataBlock.limit ?? pdata.limit ?? arr.length ?? 0),
    items: arr,
    raw: payload,
  };
}

export function normalizeApifyRun(payload: unknown): Record<string, unknown> {
  const p = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const data = (p.data && typeof p.data === "object" ? p.data : p) as Record<string, unknown>;
  return {
    id: data.id,
    status: data.status,
    actId: data.actId,
    actorTaskId: data.actorTaskId,
    startedAt: data.startedAt,
    finishedAt: data.finishedAt,
    defaultDatasetId: data.defaultDatasetId,
    defaultKeyValueStoreId: data.defaultKeyValueStoreId,
    usageTotalUsd: data.usageTotalUsd,
    origin: data.origin,
    raw: payload,
  };
}

export async function getOwnedGatewayKeyForProvider(
  tenantId: string,
  apiKeyId: string,
  provider: string
): Promise<Record<string, unknown> | null> {
  const rows = await q(
    `select id, tenant_id, key_hash, client_username, allowed_providers, name, quota_per_minute
       from public.api_keys
      where id = $1 and tenant_id = $2 and $3 = any(coalesce(allowed_providers, '{}'::text[]))
      limit 1`,
    [apiKeyId, tenantId, provider]
  );
  return rows[0] ?? null;
}

function buildApifyUrl(path: string, query: Record<string, string | number | undefined>) {
  const base = config.providerUpstreams.apify || "https://api.apify.com/v2";
  const u = new URL(base);
  const p = path.startsWith("/") ? path : `/${path}`;
  const qobj = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== "") qobj.set(k, String(v));
  }
  const qs = qobj.toString();
  return `${u.origin}${p}${qs ? `?${qs}` : ""}`;
}

export async function callApifyHelper(opts: {
  tenantId: string;
  apiKey: Record<string, unknown>;
  path: string;
  method?: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  requestPath?: string;
}) {
  const method = opts.method || "GET";
  const rp = opts.requestPath || opts.path;
  const credential = await findLatestActiveCredential(opts.tenantId, "apify");
  if (!credential) {
    await logGatewayRequest({
      tenantId: opts.tenantId,
      apiKeyId: opts.apiKey.id,
      provider: "apify",
      method,
      statusCode: 404,
      responseTimeMs: 1,
      originDomain: "dashboard-internal",
      requestPath: rp,
      errorMessage: "Credential Apify aktif tidak ditemukan.",
      clientAuthUsed: Boolean(opts.apiKey.client_username),
      upstreamStatus: 404,
      metadata: { helper_test: true, query: opts.query },
    });
    return {
      ok: false,
      status: 404,
      error: "Credential Apify aktif tidak ditemukan. Tambahkan credential Apify di halaman Credentials.",
    };
  }
  const token = getApifyTokenFromCredential(credential);
  if (!token) {
    await logGatewayRequest({
      tenantId: opts.tenantId,
      apiKeyId: opts.apiKey.id,
      provider: "apify",
      method,
      statusCode: 400,
      responseTimeMs: 1,
      originDomain: "dashboard-internal",
      requestPath: rp,
      errorMessage: "Credential Apify belum berisi api_token yang valid.",
      credentialId: credential.id,
      clientAuthUsed: Boolean(opts.apiKey.client_username),
      upstreamStatus: 400,
      metadata: { helper_test: true, query: opts.query },
    });
    return { ok: false, status: 400, error: "Credential Apify belum berisi api_token yang valid." };
  }
  const url = buildApifyUrl(opts.path, opts.query || {});
  const started = Date.now();
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  try {
    const res = await fetch(url, {
      method,
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      signal: AbortSignal.timeout(config.breakerTimeoutMs),
    });
    const latency = Date.now() - started;
    const ct = res.headers.get("content-type") || "";
    let payload: unknown;
    if (ct.includes("application/json")) payload = await res.json().catch(() => ({}));
    else payload = await res.text();
    let errMsg: string | null = null;
    if (!res.ok) {
      if (typeof payload === "string") errMsg = payload.slice(0, 240);
      else if (payload && typeof payload === "object") {
        const e = (payload as Record<string, unknown>).error as Record<string, unknown> | undefined;
        errMsg = String(e?.message || (payload as Record<string, unknown>).error || "Apify request failed");
      }
    }
    await logGatewayRequest({
      tenantId: opts.tenantId,
      apiKeyId: opts.apiKey.id,
      provider: "apify",
      method,
      statusCode: res.status,
      responseTimeMs: latency,
      originDomain: "dashboard-internal",
      requestPath: rp,
      errorMessage: errMsg,
      credentialId: credential.id as string,
      clientAuthUsed: Boolean(opts.apiKey.client_username),
      upstreamStatus: res.status,
      metadata: { helper_test: true, upstream: opts.path, query: opts.query },
    });
    if (!res.ok) {
      return { ok: false, status: res.status, error: errMsg || "Apify request failed", payload };
    }
    return { ok: true, status: res.status, payload };
  } catch (e) {
    await logGatewayRequest({
      tenantId: opts.tenantId,
      apiKeyId: opts.apiKey.id,
      provider: "apify",
      method,
      statusCode: 503,
      responseTimeMs: Date.now() - started,
      originDomain: "dashboard-internal",
      requestPath: rp,
      errorMessage: String(e),
      credentialId: credential.id as string,
      clientAuthUsed: Boolean(opts.apiKey.client_username),
      upstreamStatus: 503,
      metadata: { helper_test: true, query: opts.query },
    });
    return { ok: false, status: 503, error: String(e) };
  }
}
