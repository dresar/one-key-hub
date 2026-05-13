import { createHmac, randomBytes } from "node:crypto";
import { q } from "../db.js";

const NO_SYMBOL =
  "Aturan format jawaban: Jangan gunakan simbol asterisk (*) atau ** untuk bullet maupun bold. " +
  "Untuk daftar/poin gunakan angka saja: 1, 2, 3, 4, dst. Tulis dalam teks biasa tanpa markdown atau simbol pemformat.";

function sanitize(text: string) {
  return text.replace(/\*+|•+|\u2022+|_{3,}/g, "");
}

function parseCred(obj: unknown): Record<string, string> {
  if (obj && typeof obj === "object" && !Array.isArray(obj)) return obj as Record<string, string>;
  if (typeof obj === "string") {
    try {
      return JSON.parse(obj) as Record<string, string>;
    } catch {
      return {};
    }
  }
  return {};
}

async function getDefaultModelId(provider: string): Promise<string | null> {
  const rows = await q<{ model_id: string }>(
    "select model_id from public.ai_models where provider = $1 and is_default = true limit 1",
    [provider]
  );
  return rows[0]?.model_id ?? null;
}

async function isModelAllowed(provider: string, modelId: string): Promise<boolean> {
  const rows = await q("select 1 from public.ai_models where provider = $1 and model_id = $2 limit 1", [
    provider,
    modelId.trim(),
  ]);
  return rows.length > 0;
}

async function getVisionModelId(provider: string): Promise<string | null> {
  const rows = await q<{ model_id: string }>(
    "select model_id from public.ai_models where provider = $1 and supports_vision = true order by sort_order, model_id limit 1",
    [provider]
  );
  return rows[0]?.model_id ?? null;
}

async function getModelSupportsVision(provider: string, modelId: string): Promise<boolean> {
  const rows = await q<{ supports_vision: boolean }>(
    "select supports_vision from public.ai_models where provider = $1 and model_id = $2 limit 1",
    [provider, modelId]
  );
  return Boolean(rows[0]?.supports_vision);
}

export async function chatWithProvider(opts: {
  userId: string;
  credentialId: string;
  prompt: string;
  imageBase64?: string;
  modelId?: string | null;
}): Promise<Record<string, unknown>> {
  const rows = await q<Record<string, unknown>>(
    `select id, provider_name, credentials from public.provider_credentials
      where id = $1 and user_id = $2 and status = 'active' limit 1`,
    [opts.credentialId, opts.userId]
  );
  if (!rows.length) return { error: "Credential not found or inactive" };
  const cred = rows[0];
  const credentials = parseCred(cred.credentials);
  const provider = String(cred.provider_name || "").toLowerCase();
  let resolved = (opts.modelId || "").trim() || null;
  if (!resolved) resolved = await getDefaultModelId(provider);
  if (!resolved) return { error: "Model tidak tersedia. Pilih model dari daftar." };
  if (!(await isModelAllowed(provider, resolved))) return { error: "Model tidak tersedia. Pilih model dari daftar." };

  if (provider === "gemini") {
    const apiKey = credentials.api_key || credentials.apiKey;
    if (!apiKey) return { error: "Gemini API key not set in credential" };
    const model = resolved;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(String(apiKey))}`;
    const parts: Record<string, unknown>[] = [{ text: opts.prompt || "Hello" }];
    if (opts.imageBase64) {
      const b64 = opts.imageBase64.replace(/^data:image\/\w+;base64,/, "");
      parts.push({ inline_data: { mime_type: "image/jpeg", data: b64 } });
    }
    const body = {
      contents: [{ role: "user", parts }],
      systemInstruction: { parts: [{ text: NO_SYMBOL }] },
      generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
    };
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.status >= 400) {
      const err = data.error as Record<string, unknown> | undefined;
      return { error: (err?.message as string) || "Gemini API error", raw: data };
    }
    const candidates = data.candidates as unknown[] | undefined;
    const c0 = candidates?.[0] as Record<string, unknown> | undefined;
    const content = c0?.content as Record<string, unknown> | undefined;
    const partsOut = content?.parts as unknown[] | undefined;
    const p0 = partsOut?.[0] as Record<string, unknown> | undefined;
    const rawText = String(p0?.text ?? "");
    return { text: sanitize(rawText), model };
  }

  if (provider === "groq") {
    const apiKey = credentials.api_key || credentials.apiKey;
    if (!apiKey) return { error: "Groq API key not set in credential" };
    let groqModel = resolved;
    const hasImg = Boolean(opts.imageBase64);
    if (hasImg && !(await getModelSupportsVision("groq", groqModel))) {
      const vm = await getVisionModelId("groq");
      if (vm) groqModel = vm;
    }
    const content: Record<string, unknown>[] = [{ type: "text", text: opts.prompt || "Hello" }];
    if (hasImg) {
      const b64 = opts.imageBase64!.replace(/^data:image\/\w+;base64,/, "");
      content.push({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${b64}` } });
    }
    const body = {
      model: groqModel,
      messages: [
        { role: "system", content: NO_SYMBOL },
        { role: "user", content },
      ],
      max_tokens: 2048,
    };
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.status >= 400) {
      const err = data.error as Record<string, unknown> | undefined;
      return { error: (err?.message as string) || "Groq API error", raw: data };
    }
    const choices = data.choices as unknown[] | undefined;
    const msg = (choices?.[0] as Record<string, unknown>)?.message as Record<string, unknown> | undefined;
    const rawText = String(msg?.content || "");
    return { text: sanitize(rawText), model: data.model || groqModel };
  }

  return { error: "Unsupported provider for chat. Use Gemini or Groq." };
}

function shortCloudinaryUrl(full: string) {
  const prefix = "https://res.cloudinary.com/";
  return full.startsWith(prefix) ? full.slice(prefix.length) : full;
}

function shortPublicId() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const b = randomBytes(10);
  return Array.from(b, (x) => chars[x % chars.length]).join("");
}

export async function uploadToCloud(opts: {
  userId: string;
  credentialId: string;
  provider: string;
  buffer: Buffer;
  mimeType: string;
  originalName: string;
}): Promise<Record<string, unknown>> {
  const rows = await q<Record<string, unknown>>(
    `select id, provider_name, credentials from public.provider_credentials
      where id = $1 and user_id = $2 and status = 'active' limit 1`,
    [opts.credentialId, opts.userId]
  );
  if (!rows.length) return { error: "Credential not found or inactive" };
  const cred = rows[0];
  const credentials = parseCred(cred.credentials);
  const prov = String(cred.provider_name || "").toLowerCase();

  if (prov === "cloudinary") {
    const cloudName = String(credentials.cloud_name || credentials.cloudName || "").trim();
    const apiKey = String(credentials.api_key || credentials.apiKey || "").trim();
    const apiSecret = String(credentials.api_secret || credentials.apiSecret || "").trim();
    if (!cloudName || !apiKey || !apiSecret) {
      return { error: "Cloudinary credential incomplete (cloud_name, api_key, api_secret)" };
    }
    
    // Direct REST API Upload (No library required)
    const timestamp = Math.floor(Date.now() / 1000);
    const publicId = `playground_${shortPublicId()}`;
    const folder = "playground";
    const toSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = createHmac("sha1", apiSecret).update(toSign).digest("hex");

    const form = new FormData();
    form.append("file", new Blob([opts.buffer], { type: opts.mimeType }));
    form.append("folder", folder);
    form.append("public_id", publicId);
    form.append("timestamp", String(timestamp));
    form.append("api_key", apiKey);
    form.append("signature", signature);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
        method: "POST",
        body: form
      });
      const result = await res.json() as Record<string, any>;
      if (!res.ok) return { error: result.error?.message || "Cloudinary upload failed" };

      const shortUrl = shortCloudinaryUrl(String(result.secure_url || ""));
      return {
        url: shortUrl,
        cdn_url: shortUrl,
        width: result.width,
        height: result.height,
        bytes: result.bytes,
        format: result.format,
        external_id: result.public_id,
      };
    } catch (e) {
      return { error: String(e) || "Cloudinary upload failed" };
    }
  }

  if (prov === "imagekit") {
    const publicKey = String(credentials.public_key || "").trim();
    const privateKey = String(credentials.private_key || "").trim();
    const urlEndpoint = String(credentials.url_endpoint || "").trim();
    if (!publicKey || !privateKey || !urlEndpoint) return { error: "ImageKit credential incomplete" };
    const expire = Math.floor(Date.now() / 1000) + 30 * 60;
    const token = randomBytes(16).toString("hex");
    const toSign = token + String(expire);
    const signature = createHmac("sha1", privateKey).update(toSign).digest("hex");
    const fname = (opts.originalName || "upload").trim() || "upload";
    const form = new FormData();
    form.append(
      "file",
      new Blob([new Uint8Array(opts.buffer)], { type: opts.mimeType || "application/octet-stream" }),
      fname
    );
    form.append("fileName", fname);
    form.append("publicKey", publicKey);
    form.append("signature", signature);
    form.append("token", token);
    form.append("expire", String(expire));
    const res = await fetch("https://upload.imagekit.io/api/v1/files/upload", { method: "POST", body: form });
    let jd: Record<string, unknown> = {};
    try {
      jd = (await res.json()) as Record<string, unknown>;
    } catch {
      /* */
    }
    if (res.status >= 400) return { error: String(jd.message || "ImageKit upload failed"), raw: jd };
    const cdn =
      (jd.url as string) ||
      (urlEndpoint && jd.filePath ? `${urlEndpoint.replace(/\/$/, "")}/${jd.filePath}` : null);
    const extId = jd.fileId || jd.filePath;
    return {
      url: jd.url,
      cdn_url: cdn || jd.url,
      width: jd.width,
      height: jd.height,
      size: jd.size,
      external_id: extId,
    };
  }

  return { error: "Unsupported provider for upload. Use Cloudinary or ImageKit." };
}

export async function deleteFromCloud(opts: {
  credentialId: string;
  userId: string;
  provider: string;
  externalId: string;
}): Promise<Record<string, unknown>> {
  if (!opts.externalId) return { error: "external_id required" };
  const rows = await q<Record<string, unknown>>(
    `select id, provider_name, credentials from public.provider_credentials
      where id = $1 and user_id = $2 and status = 'active' limit 1`,
    [opts.credentialId, opts.userId]
  );
  if (!rows.length) return { error: "Credential not found" };
  const credentials = parseCred(rows[0].credentials);
  const prov = String(rows[0].provider_name || "").toLowerCase();
  
  if (prov === "cloudinary") {
    const cn = String(credentials.cloud_name || credentials.cloudName || "").trim();
    const ak = String(credentials.api_key || credentials.apiKey || "").trim();
    const asec = String(credentials.api_secret || credentials.apiSecret || "").trim();
    if (!cn || !ak || !asec) return { error: "Cloudinary credential incomplete" };
    
    // Direct REST API Delete
    const timestamp = Math.floor(Date.now() / 1000);
    const toSign = `public_id=${opts.externalId}&timestamp=${timestamp}${asec}`;
    const signature = createHmac("sha1", asec).update(toSign).digest("hex");

    const form = new FormData();
    form.append("public_id", opts.externalId);
    form.append("timestamp", String(timestamp));
    form.append("api_key", ak);
    form.append("signature", signature);

    try {
      const res = await fetch(`https://api.cloudinary.com/v1_1/${cn}/image/destroy`, {
        method: "POST",
        body: form
      });
      const result = await res.json() as Record<string, any>;
      if (res.ok) return { ok: true };
      return { error: result.error?.message || "Cloudinary delete failed" };
    } catch (e) {
      return { error: String(e) };
    }
  }
  if (prov === "imagekit") {
    const pk = credentials.private_key;
    if (!pk) return { error: "ImageKit private_key required" };
    const auth = Buffer.from(`${pk}:`).toString("base64");
    const res = await fetch(`https://api.imagekit.io/v1/files/${encodeURIComponent(opts.externalId)}`, {
      method: "DELETE",
      headers: { Authorization: `Basic ${auth}` },
    });
    if (res.status >= 400) return { error: (await res.text()) || `ImageKit delete failed: ${res.status}` };
    return { ok: true };
  }
  return { error: "Unsupported provider for delete" };
}
