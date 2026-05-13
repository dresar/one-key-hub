import { Hono } from "hono";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { q } from "../db.js";
import { config } from "../config.js";
import { sha256Hex, signHmacHex, safeEqualHex } from "../lib/hmac.js";
import { memoryEval } from "../services/memory-store.js";
import { gatewayBreaker } from "../services/circuit-breaker.js";
import { findLatestActiveCredential } from "../gateway/credentials.js";
import { uploadToCloud } from "../services/playground.js";
import { chatWithProvider } from "../services/playground.js";
import { logGatewayRequest } from "../services/observability.js";
import { getApiKeyByHash } from "../services/api-key-service.js";

const DATA_PROVIDERS = new Set(["newsapi", "gnews", "mediastack", "openweather", "alphavantage", "huggingface"]);

function parseCredBlob(cred: Record<string, unknown> | null): Record<string, string> {
  if (!cred?.credentials) return {};
  const raw = cred.credentials;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Record<string, string>;
    } catch {
      return {};
    }
  }
  return typeof raw === "object" && raw ? (raw as Record<string, string>) : {};
}

function extractApiKey(request: Request): string | null {
  const h = request.headers.get("x-api-key");
  if (h) return h.trim();
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  return null;
}

function originDomain(request: Request): string | null {
  const o = request.headers.get("origin") || request.headers.get("referer");
  if (!o) return null;
  try {
    return new URL(o).hostname;
  } catch {
    return null;
  }
}

function mergeUrlQuery(url: string, extra: Record<string, string>) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(extra)) {
    if (v != null && String(v).trim() !== "") u.searchParams.set(k, v);
  }
  return u.toString();
}

async function resolveApiKey(request: Request): Promise<Record<string, unknown>> {
  const plain = extractApiKey(request);
  if (!plain) throw new Error("Missing API key");
  const kh = sha256Hex(plain);
  const row = await getApiKeyByHash(kh);
  if (!row) throw new Error("Invalid API key");
  const now = Date.now();
  if (row.status !== "active") {
    const gu = row.grace_until as string | Date | null | undefined;
    const graceUntil = gu ? new Date(gu).getTime() : 0;
    if (!graceUntil || now > graceUntil) throw new Error("API key disabled");
  }
  if (row.client_username && row.client_password_hash) {
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Basic ")) throw new Error("Basic Auth required");
    let raw: string;
    try {
      raw = Buffer.from(auth.slice(6).trim(), "base64").toString("utf8");
    } catch {
      throw new Error("Invalid Basic Auth");
    }
    const colon = raw.indexOf(":");
    const user = colon >= 0 ? raw.slice(0, colon).trim() : raw.trim();
    const pw = colon >= 0 ? raw.slice(colon + 1) : "";
    const expUser = String(row.client_username || "").trim();
    const ok = user === expUser && (await bcrypt.compare(pw, String(row.client_password_hash || "")));
    if (!ok) throw new Error("Invalid client username or password");
  }
  return row;
}

async function hmacSecretForRequest(tenantId: string): Promise<string | null> {
  const cacheKey = `hmac:${tenantId}`;
  const { cacheGet, cacheSet } = await import("../lib/cache.js");
  const hit = cacheGet<string>(cacheKey);
  if (hit) return hit;
  const rows = await q<{ hmac_secret: string | null }>("select hmac_secret from public.users where id = $1 limit 1", [
    tenantId,
  ]);
  let secret = rows[0]?.hmac_secret || null;
  if (!secret) {
    secret = randomBytes(32).toString("hex");
    await q("update public.users set hmac_secret = $1 where id = $2", [secret, tenantId]);
  }
  cacheSet(cacheKey, secret, 30 * 60 * 1000);
  return secret;
}

async function verifyHmacIfPresent(apiKey: Record<string, unknown>, request: Request, body: Buffer) {
  const ct = request.headers.get("content-type") || "";
  if (ct.startsWith("multipart/form-data")) return;
  const sig = request.headers.get("x-signature") || "";
  if (!sig || sig.length < 16) return;
  const tid = String(apiKey.tenant_id);
  const secret = await hmacSecretForRequest(tid);
  if (!secret) throw new Error("Invalid signature");
  const tsRaw = request.headers.get("x-timestamp") || "";
  const nonce = request.headers.get("x-nonce") || "";
  const ts = Number(tsRaw);
  if (Number.isNaN(ts)) throw new Error("Invalid signature");
  if (!nonce || nonce.length < 8) throw new Error("Invalid signature");
  if (Math.abs(Date.now() - ts) > config.hmacMaxSkewMs) throw new Error("Invalid signature");
  const method = request.method.toUpperCase();
  const url = new URL(request.url);
  const path = url.pathname + (url.search || "");
  const bh = sha256Hex(body);
  const message = `${Math.floor(ts)}.${nonce}.${method}.${path}.${bh}`;
  const expected = signHmacHex(secret, message);
  if (!safeEqualHex(expected, sig)) throw new Error("Invalid signature");
}

async function gatewayRateLimit(apiKey: Record<string, unknown>, path: string) {
  const limit = Number(apiKey.quota_per_minute || config.rateLimitDefault);
  const key = `rlk:${apiKey.id}:${path}`;
  const res = memoryEval("rl", 1, key, String(Date.now()), String(config.rateLimitWindowMs), String(limit));
  if (Number(res[0]) > limit) throw new Error("Rate limited");
}

export const gatewayRoutes = new Hono();

gatewayRoutes.get("/verify", (c) => c.json({ ok: true }));

gatewayRoutes.post("/cloudinary/upload", async (c) => {
  let apiKey: Record<string, unknown>;
  try {
    apiKey = await resolveApiKey(c.req.raw);
  } catch (e) {
    const m = String((e as Error).message || e);
    const code = m.includes("Missing") || m.includes("Invalid") ? 401 : m.includes("disabled") || m.includes("password") ? 403 : 401;
    return c.json({ error: m }, code);
  }
  const allowed = (apiKey.allowed_providers as string[]) || [];
  if (allowed.length && !allowed.includes("cloudinary")) return c.json({ error: "Provider not allowed for this API key" }, 403);
  try {
    await verifyHmacIfPresent(apiKey, c.req.raw, Buffer.alloc(0));
    await gatewayRateLimit(apiKey, c.req.path);
  } catch (e) {
    const m = String((e as Error).message || e);
    const code = m.includes("Rate") ? 429 : 401;
    return c.json({ error: m }, code);
  }
  const body = await c.req.parseBody();
  const file = body.file;
  const credentialId = String(body.credential_id || "");
  if (!(file instanceof File) || !credentialId) return c.json({ error: "file and credential_id required" }, 400);
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > config.maxUploadBytes) return c.json({ error: `Ukuran file melebihi batas ${config.maxUploadBytes / (1024 * 1024)} MB.` }, 413);
  const tid = String(apiKey.tenant_id);
  const result = await uploadToCloud({
    userId: tid,
    credentialId,
    provider: "cloudinary",
    buffer: buf,
    mimeType: file.type || "application/octet-stream",
    originalName: file.name || "upload",
  });
  if (result.error) return c.json({ error: result.error }, 400);
  await logGatewayRequest({
    apiKeyId: String(apiKey.id),
    tenantId: tid,
    provider: "cloudinary",
    method: "POST",
    statusCode: 200,
    responseTimeMs: 0,
    originDomain: originDomain(c.req.raw),
    requestPath: c.req.path,
    credentialId,
    clientAuthUsed: Boolean(apiKey.client_username),
  });
  return c.json(result);
});

gatewayRoutes.post("/imagekit/upload", async (c) => {
  let apiKey: Record<string, unknown>;
  try {
    apiKey = await resolveApiKey(c.req.raw);
  } catch (e) {
    const m = String((e as Error).message || e);
    const code = m.includes("Missing") || m.includes("Invalid") ? 401 : 403;
    return c.json({ error: m }, code);
  }
  const allowed = (apiKey.allowed_providers as string[]) || [];
  if (allowed.length && !allowed.includes("imagekit")) return c.json({ error: "Provider not allowed for this API key" }, 403);
  try {
    await verifyHmacIfPresent(apiKey, c.req.raw, Buffer.alloc(0));
    await gatewayRateLimit(apiKey, c.req.path);
  } catch (e) {
    const m = String((e as Error).message || e);
    return c.json({ error: m }, m.includes("Rate") ? 429 : 401);
  }
  const body = await c.req.parseBody();
  const file = body.file;
  const credentialId = String(body.credential_id || "");
  if (!(file instanceof File) || !credentialId) return c.json({ error: "file and credential_id required" }, 400);
  const buf = Buffer.from(await file.arrayBuffer());
  if (buf.length > config.maxUploadBytes) return c.json({ error: "File too large" }, 413);
  const tid = String(apiKey.tenant_id);
  const result = await uploadToCloud({
    userId: tid,
    credentialId,
    provider: "imagekit",
    buffer: buf,
    mimeType: file.type || "application/octet-stream",
    originalName: file.name || "upload",
  });
  if (result.error) return c.json({ error: result.error }, 400);
  await logGatewayRequest({
    apiKeyId: String(apiKey.id),
    tenantId: tid,
    provider: "imagekit",
    method: "POST",
    statusCode: 200,
    responseTimeMs: 0,
    originDomain: originDomain(c.req.raw),
    requestPath: c.req.path,
    credentialId,
    clientAuthUsed: Boolean(apiKey.client_username),
  });
  return c.json(result);
});

async function gwChat(c: import("hono").Context, provider: "gemini" | "groq") {
  let apiKey: Record<string, unknown>;
  try {
    apiKey = await resolveApiKey(c.req.raw);
  } catch (e) {
    return c.json({ error: String((e as Error).message || e) }, 401);
  }
  const allowed = (apiKey.allowed_providers as string[]) || [];
  if (allowed.length && !allowed.includes(provider)) return c.json({ error: "Provider not allowed for this API key" }, 403);
  const bodyBuf = Buffer.from(await c.req.arrayBuffer());
  try {
    await verifyHmacIfPresent(apiKey, c.req.raw, bodyBuf);
    await gatewayRateLimit(apiKey, c.req.path);
  } catch (e) {
    return c.json({ error: String((e as Error).message || e) }, 401);
  }
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(bodyBuf.toString("utf8") || "{}");
  } catch {
    /* */
  }
  const tid = String(apiKey.tenant_id);
  const cred = await findLatestActiveCredential(tid, provider);
  if (!cred) {
    return c.json(
      {
        error: `No active ${provider} credential with valid API key. Di Credentials, tambah atau edit credential ${provider} dan isi API key (sama seperti yang dipakai di Playground).`,
      },
      404
    );
  }
  const start = Date.now();
  const result = await chatWithProvider({
    userId: tid,
    credentialId: String(cred.id),
    prompt: String(data.prompt || ""),
    imageBase64: String(data.image_base64 || data.imageBase64 || ""),
    modelId: typeof data.model_id === "string" ? data.model_id : typeof data.modelId === "string" ? data.modelId : null,
  });
  const ms = Date.now() - start;
  const code = result.error ? 400 : 200;
  await logGatewayRequest({
    apiKeyId: String(apiKey.id),
    tenantId: tid,
    provider,
    method: "POST",
    statusCode: code,
    responseTimeMs: ms,
    originDomain: originDomain(c.req.raw),
    requestPath: c.req.path,
    errorMessage: result.error as string | undefined,
    credentialId: String(cred.id),
    clientAuthUsed: Boolean(apiKey.client_username),
    metadata: result.error ? {} : { model: result.model },
  });
  if (result.error) return c.json({ error: result.error }, 400);
  return c.json({ text: result.text, model: result.model });
}

gatewayRoutes.post("/gemini/chat", (c) => gwChat(c, "gemini"));
gatewayRoutes.post("/groq/chat", (c) => gwChat(c, "groq"));

gatewayRoutes.all("/:provider/*", async (c) => {
  const provider = c.req.param("provider");
  const splat = c.req.param("*") || "";
  const rest = splat;
  let apiKey: Record<string, unknown>;
  try {
    apiKey = await resolveApiKey(c.req.raw);
  } catch (e) {
    return c.json({ error: String((e as Error).message || e) }, 401);
  }
  const allowed = (apiKey.allowed_providers as string[]) || [];
  if (allowed.length && !allowed.includes(provider)) return c.json({ error: "Provider not allowed for this API key" }, 403);
  const bodyBuf = Buffer.from(await c.req.arrayBuffer());
  try {
    await verifyHmacIfPresent(apiKey, c.req.raw, bodyBuf);
    await gatewayRateLimit(apiKey, c.req.path);
  } catch (e) {
    const m = String((e as Error).message || e);
    return c.json({ error: m }, m.includes("Rate") ? 429 : 401);
  }
  if (bodyBuf.length > config.maxProxyBodyBytes) return c.json({ error: "Request body too large" }, 413);

  const upstreams = config.providerUpstreams;
  const tid = String(apiKey.tenant_id);
  const cred = await findLatestActiveCredential(tid, provider);
  const credBlob = parseCredBlob(cred as Record<string, unknown> | null);

  let subPath = "/" + rest;
  if (!subPath.startsWith("/")) subPath = "/" + subPath;
  const reqUrl = new URL(c.req.url);

  const headers: Record<string, string> = {};
  const ct = c.req.header("content-type") || "application/json";
  headers["content-type"] = ct;

  let target: string;
  const base = upstreams[provider];

  if (provider === "rapidapi") {
    if (!cred) {
      return c.json({ error: "Tidak ada credential RapidAPI aktif. Tambahkan di Credentials (api_key + rapidapi_host)." }, 404);
    }
    const host = (credBlob.rapidapi_host || credBlob.rapidapiHost || "").trim().replace(/^https?:\/\//, "").split("/")[0];
    const rkey = (credBlob.api_key || credBlob.apiKey || "").trim();
    if (!host || !rkey) return c.json({ error: "Credential RapidAPI tidak lengkap (api_key + rapidapi_host)." }, 404);
    const t = new URL(`https://${host}${subPath}`);
    reqUrl.searchParams.forEach((v, k) => t.searchParams.append(k, v));
    target = t.toString();
    headers["X-RapidAPI-Key"] = rkey;
    headers["X-RapidAPI-Host"] = host;
  } else {
    if (!base) {
      return c.json(
        {
          error:
            "No upstream untuk provider: " + provider + ". Didukung: gemini, groq, apify, cloudinary, imagekit, newsapi, gnews, mediastack, openweather, alphavantage, huggingface, rapidapi",
        },
        503
      );
    }
    const u = new URL(subPath, base.endsWith("/") ? base : base + "/");
    reqUrl.searchParams.forEach((v, k) => u.searchParams.append(k, v));
    target = u.toString();
    const providerApiKey = credBlob.api_key || credBlob.apiKey;

    if (provider === "gemini" && providerApiKey) {
      target = mergeUrlQuery(target, { key: String(providerApiKey) });
    } else if (provider === "groq" && providerApiKey) {
      headers["Authorization"] = `Bearer ${providerApiKey}`;
    } else if (DATA_PROVIDERS.has(provider)) {
      if (!cred) return c.json({ error: `Tidak ada credential ${provider} aktif. Tambahkan di Credentials.` }, 404);
      const extra: Record<string, string> = {};
      if (provider === "newsapi") extra.apiKey = String(credBlob.api_key || credBlob.apiKey || "");
      else if (provider === "gnews") extra.token = String(credBlob.token || credBlob.api_key || credBlob.apiKey || "");
      else if (provider === "mediastack") extra.access_key = String(credBlob.access_key || credBlob.accessKey || "");
      else if (provider === "openweather") extra.appid = String(credBlob.appid || credBlob.appId || "");
      else if (provider === "alphavantage") extra.apikey = String(credBlob.api_key || credBlob.apiKey || "");
      else if (provider === "huggingface") {
        const hfk = credBlob.api_key || credBlob.apiKey;
        if (hfk) headers["Authorization"] = `Bearer ${hfk}`;
      }
      if (Object.keys(extra).length) target = mergeUrlQuery(target, extra);
    }
  }

  const method = c.req.method.toUpperCase();
  const start = Date.now();
  let res: Response;
  try {
    res = await gatewayBreaker.run(`${provider}:${base || "rapidapi"}`, () =>
      fetch(target, {
        method,
        headers,
        body: method === "GET" || method === "HEAD" ? undefined : bodyBuf,
        signal: AbortSignal.timeout(config.breakerTimeoutMs),
      })
    );
  } catch {
    await logGatewayRequest({
      apiKeyId: String(apiKey.id),
      tenantId: tid,
      provider,
      method,
      statusCode: 503,
      responseTimeMs: Date.now() - start,
      originDomain: originDomain(c.req.raw),
      requestPath: subPath,
      errorMessage: "Upstream gagal",
      credentialId: cred ? String(cred.id) : null,
      clientAuthUsed: Boolean(apiKey.client_username),
      breakerOpen: true,
      upstreamStatus: 503,
    });
    return c.json({ error: "Upstream gagal" }, 503);
  }
  const ms = Date.now() - start;
  let errMsg: string | null = null;
  if (res.status >= 400) errMsg = (await res.clone().text()).slice(0, 240);
  await logGatewayRequest({
    apiKeyId: String(apiKey.id),
    tenantId: tid,
    provider,
    method,
    statusCode: res.status,
    responseTimeMs: ms,
    originDomain: originDomain(c.req.raw),
    requestPath: subPath,
    errorMessage: errMsg,
    credentialId: cred ? String(cred.id) : null,
    clientAuthUsed: Boolean(apiKey.client_username),
    upstreamStatus: res.status,
    metadata: { upstream: base },
  });
  const hop = new Set(["connection", "transfer-encoding", "keep-alive", "proxy-authenticate", "proxy-authorization", "te", "trailers", "upgrade"]);
  const outHeaders = new Headers();
  res.headers.forEach((v, k) => {
    if (!hop.has(k.toLowerCase())) outHeaders.set(k, v);
  });
  return new Response(res.body, { status: res.status, headers: outHeaders });
});
