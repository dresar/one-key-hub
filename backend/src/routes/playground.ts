import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { modelsCache } from '../lib/cache';
import { db } from '../db/client';
import { aiModels, providerCredentials } from '../db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { decrypt } from '../lib/crypto';
import { getBestCachedCredential } from '../services/credentialSync';

const router = Router();

// ─── NOTE: Models are managed via the Models page in the UI ─────────────────
// No hardcoded fallback — all models come from the ai_models database table.

// ─── Helper: load credential from DB (for JWT playground use) ─────────────────
async function loadCredential(providerName: string, credentialId?: string | number): Promise<{ id: string; credentials: Record<string, string> } | null> {
  if (credentialId) {
    const rows = await db
      .select()
      .from(providerCredentials)
      .where(
        and(
          eq(providerCredentials.id, Number(credentialId)),
          eq(providerCredentials.providerName, providerName),
          eq(providerCredentials.status, 'active'),
          isNull(providerCredentials.deletedAt),
        )
      )
      .limit(1);

    if (rows.length === 0) return null;

    try {
      const decryptedBase64 = decrypt(rows[0].credentialsCiphertext);
      const rawJson = Buffer.from(decryptedBase64, 'base64').toString('utf8');
      const parsed = JSON.parse(rawJson);
      return { id: String(rows[0].id), credentials: parsed.raw || parsed || {} };
    } catch {
      return null;
    }
  }

  // Auto: get best active credential
  const cached = getBestCachedCredential(providerName);
  if (cached) return { id: String(cached.id), credentials: cached.credentials };

  // DB fallback
  const rows = await db
    .select()
    .from(providerCredentials)
    .where(
      and(
        eq(providerCredentials.providerName, providerName),
        eq(providerCredentials.status, 'active'),
        isNull(providerCredentials.deletedAt),
      )
    )
    .limit(1);

  if (rows.length === 0) return null;

  try {
    const decryptedBase64 = decrypt(rows[0].credentialsCiphertext);
    const rawJson = Buffer.from(decryptedBase64, 'base64').toString('utf8');
    const parsed = JSON.parse(rawJson);
    return { id: String(rows[0].id), credentials: parsed.raw || parsed || {} };
  } catch {
    return null;
  }
}

// ─── GET /api/playground/models?provider=xxx ──────────────────────────────────
router.get('/models', authenticate, async (req: Request, res: Response) => {
  try {
    const provider = (req.query.provider as string || '').toLowerCase();

    if (!provider) {
      res.status(400).json({ error: 'provider parameter wajib diisi' });
      return;
    }

    const cacheKey = `models:${provider}`;
    const cached = modelsCache.get(cacheKey);
    if (cached) {
      res.json({ models: cached, provider });
      return;
    }

    const dbModels = await db
      .select()
      .from(aiModels)
      .where(eq(aiModels.provider, provider));

    // Map to expected frontend format
    const result = dbModels.map((m) => ({
      id: m.id,
      provider: m.provider,
      model_id: m.modelId,
      display_name: m.displayName,
      is_default: m.isDefault,
      supports_vision: m.supportsVision,
    }));

    modelsCache.set(cacheKey, result, 600_000); // 10 min TTL

    res.json({ models: result, provider });
  } catch (err) {
    console.error('[Playground] Models error:', err);
    res.status(500).json({ error: 'Gagal memuat model list' });
  }
});

// ─── GET /api/playground/providers-with-credentials ──────────────────────────
// Returns list of providers that have active credentials (for Playground UI)
router.get('/providers-with-credentials', authenticate, async (req: Request, res: Response) => {
  try {
    const rows = await db
      .select({
        id: providerCredentials.id,
        providerName: providerCredentials.providerName,
        label: providerCredentials.label,
        status: providerCredentials.status,
      })
      .from(providerCredentials)
      .where(
        and(
          eq(providerCredentials.status, 'active'),
          isNull(providerCredentials.deletedAt),
        )
      );

    res.json({ credentials: rows.map(r => ({
      id: r.id,
      provider_name: r.providerName,
      label: r.label,
      status: r.status,
    })) });
  } catch (err) {
    console.error('[Playground] Providers with credentials error:', err);
    res.status(500).json({ error: 'Gagal memuat daftar provider credentials' });
  }
});

// ─── POST /api/playground/chat ────────────────────────────────────────────────
// JWT-auth playground chat: uses provider credentials directly (no gateway key needed)
router.post('/chat', authenticate, async (req: Request, res: Response) => {
  const startTime = Date.now();
  const {
    provider,
    model_id,
    prompt,
    system_prompt,
    image_base64,
    video_base64,
    credential_id,
  } = req.body;

  if (!provider) {
    res.status(400).json({ error: 'provider wajib diisi' });
    return;
  }

  const cred = await loadCredential(provider, credential_id);
  if (!cred) {
    res.status(503).json({ error: `Tidak ada credential aktif untuk provider: ${provider}. Tambahkan credential di halaman Providers.` });
    return;
  }

  const apiKey = cred.credentials.api_key;
  if (!apiKey) {
    res.status(503).json({ error: `Credential untuk provider ${provider} tidak memiliki api_key` });
    return;
  }

  try {
    let url = '';
    let headers: Record<string, string> = { 'Content-Type': 'application/json' };
    let payload: any = {};

    if (provider === 'gemini') {
      const model = model_id || 'gemini-2.5-flash';
      url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const parts: any[] = [];
      if (image_base64) {
        const raw = image_base64 as string;
        const commaIdx = raw.indexOf(',');
        const header = commaIdx > -1 ? raw.substring(0, commaIdx) : '';
        const base64Data = commaIdx > -1 ? raw.substring(commaIdx + 1) : raw;
        const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
        parts.push({ inlineData: { mimeType, data: base64Data } });
      }
      if (video_base64) {
        const raw = video_base64 as string;
        const commaIdx = raw.indexOf(',');
        const header = commaIdx > -1 ? raw.substring(0, commaIdx) : '';
        const base64Data = commaIdx > -1 ? raw.substring(commaIdx + 1) : raw;
        const mimeType = header.match(/data:([^;]+)/)?.[1] || 'video/mp4';
        parts.push({ inlineData: { mimeType, data: base64Data } });
      }
      if (prompt) parts.push({ text: prompt });
      payload = { contents: [{ role: 'user', parts }] };
      if (system_prompt) payload.systemInstruction = { parts: [{ text: system_prompt }] };

    } else if (provider === 'groq') {
      url = 'https://api.groq.com/openai/v1/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
      let userContent: any = prompt || '';
      if (image_base64) {
        userContent = [
          { type: 'text', text: prompt || 'Analyze this image.' },
          { type: 'image_url', image_url: { url: image_base64 } },
        ];
      }
      const messages: any[] = [];
      if (system_prompt) messages.push({ role: 'system', content: system_prompt });
      messages.push({ role: 'user', content: userContent });
      payload = { model: model_id || 'llama-3.3-70b-versatile', messages, temperature: 0.7, max_tokens: 2048 };

    } else if (provider === 'openai') {
      url = 'https://api.openai.com/v1/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
      let userContent: any = prompt || '';
      if (image_base64) {
        userContent = [
          { type: 'text', text: prompt || 'What is in this image?' },
          { type: 'image_url', image_url: { url: image_base64, detail: 'auto' } },
        ];
      }
      const messages: any[] = [];
      if (system_prompt) messages.push({ role: 'system', content: system_prompt });
      messages.push({ role: 'user', content: userContent });
      payload = { model: model_id || 'gpt-4o-mini', messages, max_tokens: 2048 };

    } else if (provider === 'anthropic') {
      url = 'https://api.anthropic.com/v1/messages';
      headers['x-api-key'] = apiKey;
      headers['anthropic-version'] = '2023-06-01';
      let userContent: any = prompt || '';
      if (image_base64) {
        const raw = image_base64 as string;
        const commaIdx = raw.indexOf(',');
        const header = commaIdx > -1 ? raw.substring(0, commaIdx) : '';
        const base64Data = commaIdx > -1 ? raw.substring(commaIdx + 1) : raw;
        const mediaType = (header.match(/data:([^;]+)/)?.[1] || 'image/jpeg') as any;
        userContent = [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64Data } },
          { type: 'text', text: prompt || 'What is in this image?' },
        ];
      }
      payload = {
        model: model_id || 'claude-3-5-haiku-20241022',
        max_tokens: 2048,
        messages: [{ role: 'user', content: userContent }],
      };
      if (system_prompt) payload.system = system_prompt;

    } else if (provider === 'mistral') {
      url = 'https://api.mistral.ai/v1/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
      const messages: any[] = [];
      if (system_prompt) messages.push({ role: 'system', content: system_prompt });
      messages.push({ role: 'user', content: prompt || '' });
      payload = { model: model_id || 'mistral-small-latest', messages, max_tokens: 2048 };

    } else if (provider === 'cohere') {
      url = 'https://api.cohere.ai/v1/chat';
      headers['Authorization'] = `Bearer ${apiKey}`;
      payload = { model: model_id || 'command-r-08-2024', message: prompt || '', max_tokens: 2048 };

    } else if (provider === 'together') {
      url = 'https://api.together.xyz/v1/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
      const messages: any[] = [];
      if (system_prompt) messages.push({ role: 'system', content: system_prompt });
      messages.push({ role: 'user', content: prompt || '' });
      payload = { model: model_id || 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo', messages, max_tokens: 2048 };

    } else if (provider === 'perplexity') {
      url = 'https://api.perplexity.ai/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
      const messages: any[] = [];
      if (system_prompt) messages.push({ role: 'system', content: system_prompt });
      messages.push({ role: 'user', content: prompt || '' });
      payload = { model: model_id || 'llama-3.1-sonar-small-128k-online', messages, max_tokens: 2048 };

    } else if (provider === 'huggingface') {
      const model = model_id || 'mistralai/Mistral-7B-Instruct-v0.3';
      url = `https://api-inference.huggingface.co/models/${model}`;
      headers['Authorization'] = `Bearer ${apiKey}`;
      payload = { inputs: prompt || '', parameters: { max_new_tokens: 512, return_full_text: false } };

    } else if (provider === 'deepseek') {
      url = 'https://api.deepseek.com/v1/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
      const messages: any[] = [];
      if (system_prompt) messages.push({ role: 'system', content: system_prompt });
      messages.push({ role: 'user', content: prompt || '' });
      payload = { model: model_id || 'deepseek-chat', messages, max_tokens: 2048 };

    } else {
      res.status(400).json({ error: `Provider tidak didukung di Playground: ${provider}` });
      return;
    }

    const upstreamRes = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
    });

    const responseData = await upstreamRes.json() as any;
    const responseTimeMs = Date.now() - startTime;

    if (!upstreamRes.ok) {
      // Extract error message from upstream provider response
      const upstreamError =
        responseData?.error?.message ||
        responseData?.error?.details ||
        responseData?.message ||
        responseData?.detail ||
        `HTTP ${upstreamRes.status} dari ${provider}`;

      console.error(`[Playground] Upstream error from ${provider} (${upstreamRes.status}):`, JSON.stringify(responseData));

      // Give a clear, actionable message for common error codes
      let userMessage = upstreamError;
      if (upstreamRes.status === 403) {
        userMessage = `API key tidak diizinkan oleh ${provider} (403). Kemungkinan: API key tidak aktif, belum punya billing, atau model ini tidak tersedia di plan Anda. Detail: ${upstreamError}`;
      } else if (upstreamRes.status === 401) {
        userMessage = `API key tidak valid untuk ${provider} (401). Silakan cek credential di halaman Providers. Detail: ${upstreamError}`;
      } else if (upstreamRes.status === 429) {
        userMessage = `Quota habis untuk ${provider} (429). Coba ganti credential atau tunggu beberapa saat. Detail: ${upstreamError}`;
      } else if (upstreamRes.status === 400) {
        userMessage = `Request tidak valid ke ${provider} (400). Detail: ${upstreamError}`;
      }

      // Return 200 to frontend with error field — so axios doesn't throw, and UI can show message
      res.status(200).json({
        error: userMessage,
        upstream_status: upstreamRes.status,
        provider,
        model: model_id,
        response_time_ms: responseTimeMs,
      });
      return;
    }

    // Parse response text based on provider
    let text = '';
    if (provider === 'gemini') {
      text = responseData?.candidates?.[0]?.content?.parts?.[0]?.text
        || responseData?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('')
        || JSON.stringify(responseData);
    } else if (provider === 'anthropic') {
      text = responseData?.content?.[0]?.text || JSON.stringify(responseData);
    } else if (provider === 'cohere') {
      text = responseData?.text || responseData?.message || JSON.stringify(responseData);
    } else if (provider === 'huggingface') {
      if (Array.isArray(responseData)) text = responseData[0]?.generated_text || JSON.stringify(responseData);
      else text = responseData?.generated_text || JSON.stringify(responseData);
    } else {
      // OpenAI-compatible
      text = responseData?.choices?.[0]?.message?.content || JSON.stringify(responseData);
    }

    const tokensUsed = responseData?.usage?.total_tokens
      || responseData?.usageMetadata?.totalTokenCount
      || null;

    res.json({ text, model: model_id, provider, tokens_used: tokensUsed, response_time_ms: responseTimeMs });

  } catch (err: any) {
    console.error('[Playground] Chat error:', err);
    res.status(500).json({ error: 'Playground chat error', message: err.message });
  }
});

// ─── POST /api/playground/image ───────────────────────────────────────────────
// JWT-auth image generation for Playground
router.post('/image', authenticate, async (req: Request, res: Response) => {
  const { provider, model_id, prompt, size, credential_id } = req.body;

  if (!provider || !prompt) {
    res.status(400).json({ error: 'provider dan prompt wajib diisi' });
    return;
  }

  const cred = await loadCredential(provider, credential_id);
  if (!cred) {
    res.status(503).json({ error: `Tidak ada credential aktif untuk provider: ${provider}` });
    return;
  }

  const apiKey = cred.credentials.api_key;

  try {
    let url = '';
    let headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    };
    let payload: any = {};

    if (provider === 'openai') {
      url = 'https://api.openai.com/v1/images/generations';
      payload = { model: model_id || 'dall-e-3', prompt, size: size || '1024x1024', n: 1 };
    } else {
      res.status(400).json({ error: `Provider ${provider} tidak mendukung image generation` });
      return;
    }

    const upstreamRes = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(90_000),
    });

    const responseData = await upstreamRes.json() as any;

    if (!upstreamRes.ok) {
      const errorMsg = responseData?.error?.message || `HTTP ${upstreamRes.status}`;
      res.status(upstreamRes.status).json({ error: errorMsg });
      return;
    }

    res.json(responseData);
  } catch (err: any) {
    console.error('[Playground] Image gen error:', err);
    res.status(500).json({ error: 'Image generation failed', message: err.message });
  }
});

export default router;
