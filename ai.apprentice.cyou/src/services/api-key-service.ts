import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { q } from "../db.js";
import { cacheDel, cacheGet, cacheSet } from "../lib/cache.js";
import { config } from "../config.js";

const LABELS: Record<string, string> = {
  gemini: "Gemini",
  groq: "Groq",
  cloudinary: "Cloudinary",
  imagekit: "ImageKit",
  apify: "Apify",
};

export const hashApiKey = (plain: string) => createHash("sha256").update(plain, "utf8").digest("hex");

export function generateApiKey(tenantId: string, prefix = "eka") {
  const tenantPart = tenantId.replace(/-/g, "").slice(0, 6);
  const secret = randomBytes(24).toString("base64url").replace(/=/g, "").slice(0, 11);
  return `${prefix}_${tenantPart}_${secret}`;
}

const encKey = () => createHash("sha256").update(config.keyEncryptionSecret, "utf8").digest();

export const encryptApiKeyPlain = (plain: string) => {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(Buffer.from(plain, "utf8")), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
};

export const decryptApiKeyPlain = (ciphertext: string) => {
  const parts = String(ciphertext || "").split(":");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  const iv = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  const data = Buffer.from(parts[3], "base64");
  const decipher = createDecipheriv("aes-256-gcm", encKey(), iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  return plain;
};

async function nextName(tenantId: string, allowedProviders: string[]) {
  let base = "API Key";
  if (allowedProviders.length === 1) {
    const p = (allowedProviders[0] || "").trim().toLowerCase();
    if (LABELS[p]) base = LABELS[p];
  }
  const names = await q<{ name: string | null }>(
    "select name from public.api_keys where tenant_id = $1 and name is not null",
    [tenantId]
  );
  const pat = new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+(\\d+)$`, "i");
  let maxN = 0;
  for (const row of names) {
    const m = pat.exec(String(row.name || "").trim());
    if (m) maxN = Math.max(maxN, Number(m[1]));
  }
  return `${base} ${maxN + 1}`;
}

export async function createApiKeyRow(opts: {
  tenantId: string;
  quota_per_minute?: number;
  allowed_providers?: string[];
  name?: string | null;
  client_username?: string | null;
  client_password?: string | null;
}) {
  const plain = generateApiKey(opts.tenantId);
  const keyHash = hashApiKey(plain);
  const keyCiphertext = encryptApiKeyPlain(plain);
  const providers = opts.allowed_providers ?? [];
  const rawName = opts.name != null ? String(opts.name).trim() : "";
  const keyName = rawName || (await nextName(opts.tenantId, providers));
  let clientUser: string | null = null;
  let clientHash: string | null = null;
  if (opts.client_username?.trim() && opts.client_password) {
    clientUser = opts.client_username.trim();
    clientHash = await bcrypt.hash(String(opts.client_password), 10);
  }
  const rows = await q<Record<string, unknown>>(
    `insert into public.api_keys
      (tenant_id, key_hash, key_ciphertext, quota_per_minute, allowed_providers, name, client_username, client_password_hash)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning id, tenant_id, status, quota_per_minute, allowed_providers, name, created_at, client_username`,
    [opts.tenantId, keyHash, keyCiphertext, opts.quota_per_minute ?? 1000, providers, keyName, clientUser, clientHash]
  );
  return { ...rows[0], api_key: plain, api_key_plain: plain } as Record<string, unknown>;
}

const CACHE_TTL = 5 * 60 * 1000;
const NEG_TTL = 30 * 1000;
const MISS = { __cacheMiss: true };

export async function getApiKeyByHash(keyHash: string): Promise<Record<string, unknown> | null> {
  const l1Key = `apikey:${keyHash}`;
  const hit = cacheGet<Record<string, unknown> | typeof MISS>(l1Key);
  if (hit) {
    if ("__cacheMiss" in hit && hit.__cacheMiss) return null;
    return hit as Record<string, unknown>;
  }
  const rows = await q<Record<string, unknown>>(
    `select id, tenant_id, key_hash, status, grace_until, rotated_from, quota_per_minute, allowed_providers, name, client_username, client_password_hash
       from public.api_keys where key_hash = $1 limit 1`,
    [keyHash]
  );
  const apiKey = rows[0] ?? null;
  if (apiKey) cacheSet(l1Key, apiKey, CACHE_TTL);
  else cacheSet(l1Key, MISS, NEG_TTL);
  return apiKey;
}

export function invalidateApiKeyCache(keyHash: string) {
  cacheDel(`apikey:${keyHash}`);
}

export async function rotateApiKey(
  tenantId: string,
  apiKeyId: string,
  oldKeyHash: string | null
): Promise<Record<string, unknown>> {
  const graceUntil = new Date(Date.now() + config.apiKeyGraceMs).toISOString();
  const old = await q<{ allowed_providers: string[] | null; name: string | null; quota_per_minute: number }>(
    "select allowed_providers, name, quota_per_minute from public.api_keys where id = $1 and tenant_id = $2",
    [apiKeyId, tenantId]
  );
  if (!old[0]) throw new Error("not found");
  const allowed = old[0].allowed_providers ?? [];
  const nm = old[0].name;
  const quota = old[0].quota_per_minute;
  await q("update public.api_keys set status = 'disabled', grace_until = $1 where id = $2 and tenant_id = $3", [
    graceUntil,
    apiKeyId,
    tenantId,
  ]);
  const created = await createApiKeyRow({
    tenantId,
    allowed_providers: Array.isArray(allowed) ? allowed : [],
    name: nm,
    quota_per_minute: quota,
  });
  await q("update public.api_keys set rotated_from = $1 where id = $2", [apiKeyId, created.id]);
  if (oldKeyHash) invalidateApiKeyCache(oldKeyHash);
  return { ...created, grace_until: graceUntil };
}
