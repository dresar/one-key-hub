import { Router, Request, Response } from 'express';
import { and, eq, isNull, asc } from 'drizzle-orm';
import { db } from '../db/client';
import { gatewayKeys, providerCredentials, requestLogs, aiModels } from '../db/schema';
import { decrypt, hashValue } from '../lib/crypto';
import { gatewayKeyCache, credentialCache } from '../lib/cache';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { reportCredentialFailure } from '../lib/rotate';
import { emitSocketEvent } from '../socket/events';
import { gatewayRateLimiter } from '../middleware/rateLimiter';
import { v4 as uuidv4 } from 'uuid';
import { getBestCachedCredential, getCachedCredentials, updateLocalCredentialStats } from '../services/credentialSync';
const router = Router();
router.use(gatewayRateLimiter);

// ─── Provider API configurations ──────────────────────────────────────────────
interface ProviderConfig {
  baseUrl: string;
  chatEndpoint?: string;
  imageEndpoint?: string;
  buildChatRequest: (creds: Record<string, string>, body: any) => { url: string; headers: Record<string, string>; payload: any };
  buildImageRequest?: (creds: Record<string, string>, body: any) => { url: string; headers: Record<string, string>; payload: any };
  parseChatResponse: (data: any) => string;
  parseImageResponse?: (data: any) => string;
}

const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com',
    buildChatRequest: (creds, body) => {
      const model = body.model_id || 'gemini-2.5-flash';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${creds.api_key}`;

      const parts: any[] = [];

      // Support image_base64 (photo analysis)
      if (body.image_base64) {
        const raw = body.image_base64 as string;
        const commaIdx = raw.indexOf(',');
        const header = commaIdx > -1 ? raw.substring(0, commaIdx) : '';
        const base64Data = commaIdx > -1 ? raw.substring(commaIdx + 1) : raw;
        const mimeType = header.match(/data:([^;]+)/)?.[1] || 'image/jpeg';
        parts.push({
          inlineData: { mimeType, data: base64Data },
        });
      }

      // Support video_base64 (video analysis — Gemini 2.0+ supports inline video)
      if (body.video_base64) {
        const raw = body.video_base64 as string;
        const commaIdx = raw.indexOf(',');
        const header = commaIdx > -1 ? raw.substring(0, commaIdx) : '';
        const base64Data = commaIdx > -1 ? raw.substring(commaIdx + 1) : raw;
        const mimeType = header.match(/data:([^;]+)/)?.[1] || 'video/mp4';
        parts.push({
          inlineData: { mimeType, data: base64Data },
        });
      }

      if (body.prompt) {
        parts.push({ text: body.prompt });
      }

      // System instruction support
      const payload: any = {
        contents: [{ role: 'user', parts }],
      };
      if (body.system_prompt) {
        payload.systemInstruction = { parts: [{ text: body.system_prompt }] };
      }

      return {
        url,
        headers: { 'Content-Type': 'application/json' },
        payload,
      };
    },
    parseChatResponse: (data) => {
      return data?.candidates?.[0]?.content?.parts?.[0]?.text
        || data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('')
        || JSON.stringify(data);
    },
  },

  groq: {
    baseUrl: 'https://api.groq.com',
    buildChatRequest: (creds, body) => {
      // Groq supports OpenAI-compatible vision format for vision models
      let userContent: any = body.prompt || '';

      if (body.image_base64) {
        // Groq vision models (llama-3.2-11b-vision-preview, etc.) use OpenAI content array format
        userContent = [
          { type: 'text', text: body.prompt || 'Analyze this image and describe what you see.' },
          { type: 'image_url', image_url: { url: body.image_base64 } },
        ];
      }

      const messages: any[] = [];
      if (body.system_prompt) {
        messages.push({ role: 'system', content: body.system_prompt });
      }
      messages.push({ role: 'user', content: userContent });

      return {
        url: 'https://api.groq.com/openai/v1/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${creds.api_key}`,
        },
        payload: {
          model: body.model_id || 'llama-3.3-70b-versatile',
          messages,
          temperature: 0.7,
          max_tokens: 2048,
        },
      };
    },
    parseChatResponse: (data) =>
      data?.choices?.[0]?.message?.content || JSON.stringify(data),
  },

  openai: {
    baseUrl: 'https://api.openai.com',
    buildChatRequest: (creds, body) => {
      // OpenAI vision format: content array with text + image_url
      let userContent: any = body.prompt || '';

      if (body.image_base64) {
        userContent = [
          { type: 'text', text: body.prompt || 'What is in this image?' },
          { type: 'image_url', image_url: { url: body.image_base64, detail: 'auto' } },
        ];
      }

      const messages: any[] = [];
      if (body.system_prompt) {
        messages.push({ role: 'system', content: body.system_prompt });
      }
      messages.push({ role: 'user', content: userContent });

      return {
        url: 'https://api.openai.com/v1/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${creds.api_key}`,
        },
        payload: {
          model: body.model_id || 'gpt-4o-mini',
          messages,
          max_tokens: 2048,
        },
      };
    },
    buildImageRequest: (creds, body) => ({
      url: 'https://api.openai.com/v1/images/generations',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creds.api_key}`,
      },
      payload: {
        model: body.model || 'dall-e-3',
        prompt: body.prompt || '',
        size: body.size || '1024x1024',
        n: 1,
      },
    }),
    parseChatResponse: (data) =>
      data?.choices?.[0]?.message?.content || JSON.stringify(data),
    parseImageResponse: (data) =>
      data?.data?.[0]?.url || JSON.stringify(data),
  },

  anthropic: {
    baseUrl: 'https://api.anthropic.com',
    buildChatRequest: (creds, body) => {
      // Anthropic vision format: content array with text + image source
      let userContent: any = body.prompt || '';

      if (body.image_base64) {
        const raw = body.image_base64 as string;
        const commaIdx = raw.indexOf(',');
        const header = commaIdx > -1 ? raw.substring(0, commaIdx) : '';
        const base64Data = commaIdx > -1 ? raw.substring(commaIdx + 1) : raw;
        const mediaType = (header.match(/data:([^;]+)/)?.[1] || 'image/jpeg') as
          'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

        userContent = [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64Data },
          },
          { type: 'text', text: body.prompt || 'What is in this image?' },
        ];
      }

      const payload: any = {
        model: body.model_id || 'claude-3-5-haiku-20241022',
        max_tokens: 2048,
        messages: [{ role: 'user', content: userContent }],
      };

      if (body.system_prompt) {
        payload.system = body.system_prompt;
      }

      return {
        url: 'https://api.anthropic.com/v1/messages',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': creds.api_key,
          'anthropic-version': '2023-06-01',
        },
        payload,
      };
    },
    parseChatResponse: (data) =>
      data?.content?.[0]?.text || JSON.stringify(data),
  },

  mistral: {
    baseUrl: 'https://api.mistral.ai',
    buildChatRequest: (creds, body) => {
      const messages: any[] = [];
      if (body.system_prompt) messages.push({ role: 'system', content: body.system_prompt });
      messages.push({ role: 'user', content: body.prompt || '' });
      return {
        url: 'https://api.mistral.ai/v1/chat/completions',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${creds.api_key}`,
        },
        payload: {
          model: body.model_id || 'mistral-small-latest',
          messages,
          max_tokens: 2048,
        },
      };
    },
    parseChatResponse: (data) =>
      data?.choices?.[0]?.message?.content || JSON.stringify(data),
  },

  cohere: {
    baseUrl: 'https://api.cohere.ai',
    buildChatRequest: (creds, body) => ({
      url: 'https://api.cohere.ai/v1/chat',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creds.api_key}`,
      },
      payload: {
        model: body.model_id || 'command-r-08-2024',
        message: body.prompt || '',
        max_tokens: 2048,
      },
    }),
    parseChatResponse: (data) =>
      data?.text || data?.message || JSON.stringify(data),
  },

  together: {
    baseUrl: 'https://api.together.xyz',
    buildChatRequest: (creds, body) => ({
      url: 'https://api.together.xyz/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creds.api_key}`,
      },
      payload: {
        model: body.model_id || 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
        messages: [{ role: 'user', content: body.prompt || '' }],
        max_tokens: 2048,
      },
    }),
    parseChatResponse: (data) =>
      data?.choices?.[0]?.message?.content || JSON.stringify(data),
  },

  perplexity: {
    baseUrl: 'https://api.perplexity.ai',
    buildChatRequest: (creds, body) => ({
      url: 'https://api.perplexity.ai/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${creds.api_key}`,
      },
      payload: {
        model: body.model_id || 'llama-3.1-sonar-small-128k-online',
        messages: [{ role: 'user', content: body.prompt || '' }],
        max_tokens: 2048,
      },
    }),
    parseChatResponse: (data) =>
      data?.choices?.[0]?.message?.content || JSON.stringify(data),
  },

  huggingface: {
    baseUrl: 'https://api-inference.huggingface.co',
    buildChatRequest: (creds, body) => {
      const model = body.model_id || 'mistralai/Mistral-7B-Instruct-v0.3';
      return {
        url: `https://api-inference.huggingface.co/models/${model}`,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${creds.api_key}`,
        },
        payload: {
          inputs: body.prompt || '',
          parameters: { max_new_tokens: 512, return_full_text: false },
        },
      };
    },
    parseChatResponse: (data) => {
      if (Array.isArray(data)) return data[0]?.generated_text || JSON.stringify(data);
      return data?.generated_text || JSON.stringify(data);
    },
  },
};

// ─── Helper: Validate gateway key and retrieve it ─────────────────────────────
async function validateGatewayKey(rawKey: string): Promise<typeof gatewayKeys.$inferSelect | null> {
  // Check cache first
  const cached = gatewayKeyCache.get(rawKey);
  if (cached === null) return null; // Explicitly invalid
  if (cached) return cached;

  const kHash = hashValue(rawKey);

  const rows = await db
    .select()
    .from(gatewayKeys)
    .where(
      and(
        eq(gatewayKeys.keyHash, kHash),
        eq(gatewayKeys.status, 'active'),
        isNull(gatewayKeys.deletedAt),
      ),
    )
    .limit(1);

  if (rows.length === 0) {
    gatewayKeyCache.set(rawKey, null, 30_000); // Cache miss for 30s
    return null;
  }

  gatewayKeyCache.set(rawKey, rows[0], 120_000);
  return rows[0];
}

async function getProviderCredential(
  providerName: string, 
  targetModelId?: string,
  specificId?: string
): Promise<{ id: string; credentials: Record<string, string> } | null> {
  if (specificId) {
    const list = getCachedCredentials(providerName);
    const matched = list.find(c => String(c.id) === String(specificId));
    if (matched && matched.status === 'active') {
      return { id: String(matched.id), credentials: matched.credentials };
    }
    
    // DB Fallback
    const rows = await db
      .select()
      .from(providerCredentials)
      .where(
        and(
          eq(providerCredentials.id, Number(specificId)),
          eq(providerCredentials.status, 'active'),
          isNull(providerCredentials.deletedAt)
        )
      )
      .limit(1);

    if (rows.length > 0) {
      try {
        const decryptedBase64 = decrypt(rows[0].credentialsCiphertext);
        const rawJson = Buffer.from(decryptedBase64, 'base64').toString('utf8');
        const parsed = JSON.parse(rawJson);
        return {
          id: String(rows[0].id),
          credentials: parsed.raw || parsed || {},
        };
      } catch (err) {
        console.error('[Gateway] Failed to decrypt specific credential:', err);
      }
    }
    return null;
  }

  const cachedCred = getBestCachedCredential(providerName, targetModelId);
  if (!cachedCred) return null;
  return {
    id: cachedCred.id,
    credentials: cachedCred.credentials
  };
}

// ─── Helper: Write request log ────────────────────────────────────────────────
async function writeLog(data: {
  gatewayKeyId?: string;
  credentialId?: string;
  providerName: string;
  modelName?: string;
  requestPath: string;
  status: 'success' | 'error' | 'pending';
  statusCode?: number;
  errorMessage?: string;
  responseTimeMs?: number;
  tokensUsed?: number;
}) {
  try {
    const [log] = await db.insert(requestLogs).values({
      id: uuidv4(),
      ...data,
    }).returning();

    // Emit realtime event
    emitSocketEvent('logs:insert', {
      id: log.id,
      provider_name: data.providerName,
      model_name: data.modelName,
      status: data.status,
      status_code: data.statusCode,
      error_message: data.errorMessage,
      response_time_ms: data.responseTimeMs,
      created_at: log.createdAt,
    });
  } catch (err) {
    console.warn('[Gateway] Failed to write log:', err);
  }
}

// ─── POST /gateway/:provider/chat ─────────────────────────────────────────────
router.post('/:provider/chat', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const providerName = req.params.provider.toLowerCase();
  const rawApiKey = req.headers['x-api-key'] as string | undefined;

  // 1. Validate gateway key
  if (!rawApiKey) {
    res.status(401).json({ error: 'X-API-Key header is required' });
    return;
  }

  const gatewayKey = await validateGatewayKey(rawApiKey);
  if (!gatewayKey) {
    res.status(401).json({ error: 'Invalid or expired API key' });
    return;
  }

  // 2. Check provider restriction
  if (gatewayKey.provider && gatewayKey.provider !== '' && gatewayKey.provider !== providerName) {
    res.status(403).json({
      error: `Key ini khusus untuk provider ${gatewayKey.provider} saja.`,
    });
    return;
  }

  if (gatewayKey.allowedProviders && Array.isArray(gatewayKey.allowedProviders)) {
    if (!(gatewayKey.allowedProviders as string[]).includes(providerName)) {
      res.status(403).json({
        error: `Provider "${providerName}" not allowed for this key. Allowed: ${(gatewayKey.allowedProviders as string[]).join(', ')}`,
      });
      return;
    }
  }

  // 3. Determine specific model to route
  // 3. Determine specific model to route
  let targetModelId = req.body.model_id;
  if (gatewayKey.modelId && gatewayKey.modelId !== '') {
    targetModelId = gatewayKey.modelId;
  } else {
    // Query database for this provider's default model
    const dbModels = await db
      .select({ modelId: aiModels.modelId, isDefault: aiModels.isDefault, supportsVision: aiModels.supportsVision })
      .from(aiModels)
      .where(eq(aiModels.provider, providerName));

    if (dbModels.length > 0) {
      if (gatewayKey.modelType) {
        const isVision = gatewayKey.modelType === 'vision';
        // Find a matching default model for vision or normal
        const match = isVision 
          ? dbModels.find(m => m.supportsVision && m.isDefault) || dbModels.find(m => m.supportsVision)
          : dbModels.find(m => !m.supportsVision && m.isDefault) || dbModels.find(m => m.isDefault);
        
        targetModelId = match?.modelId || dbModels[0]?.modelId;
      } else {
        // Just find default or first
        const match = dbModels.find(m => m.isDefault) || dbModels[0];
        targetModelId = match?.modelId;
      }
    }

    // Fallbacks if no model found in DB
    if (!targetModelId) {
      if (gatewayKey.modelType) {
        const isVision = gatewayKey.modelType === 'vision';
        if (providerName === 'gemini') {
          targetModelId = 'gemini-2.5-flash';
        } else if (providerName === 'groq') {
          targetModelId = isVision ? 'llama-3.2-11b-vision-preview' : 'llama-3.3-70b-versatile';
        } else if (providerName === 'deepseek') {
          targetModelId = 'deepseek-chat';
        } else {
          targetModelId = 'gemini-2.5-flash';
        }
      } else {
        if (providerName === 'gemini') targetModelId = 'gemini-2.5-flash';
        else if (providerName === 'groq') targetModelId = 'llama-3.3-70b-versatile';
        else if (providerName === 'deepseek') targetModelId = 'deepseek-chat';
        else targetModelId = 'gemini-2.5-flash';
      }
    }
  }

  // Enforce selected model_id on body
  if (targetModelId) {
    req.body.model_id = targetModelId;
  }

  // 4. Get provider config
  const config = PROVIDER_CONFIGS[providerName];
  if (!config) {
    res.status(400).json({ error: `Unsupported provider: ${providerName}` });
    return;
  }

  // 5. Get active credential matching targetModelId if available
  const cred = await getProviderCredential(providerName, targetModelId);
  if (!cred) {
    await writeLog({
      gatewayKeyId: gatewayKey.id,
      providerName,
      modelName: targetModelId,
      requestPath: `/gateway/${providerName}/chat`,
      status: 'error',
      statusCode: 503,
      errorMessage: `No active credentials for provider: ${providerName} (model: ${targetModelId || 'default'})`,
    });
    res.status(503).json({ error: `No active credentials available for ${providerName} (model: ${targetModelId || 'default'})` });
    return;
  }

  // 6. Build and proxy request
  try {
    const { url, headers: reqHeaders, payload } = config.buildChatRequest(cred.credentials, req.body);

    const upstreamRes = await fetch(url, {
      method: 'POST',
      headers: reqHeaders,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30_000),
    });

    const responseData = await upstreamRes.json();
    const responseTimeMs = Date.now() - startTime;

    if (!upstreamRes.ok) {
      const errorMsg = responseData?.error?.message || responseData?.message || `HTTP ${upstreamRes.status}`;

      // Report error to rotation engine
      await reportCredentialFailure(cred.id, errorMsg);

      await writeLog({
        gatewayKeyId: gatewayKey.id,
        credentialId: cred.id,
        providerName,
        modelName: req.body.model_id,
        requestPath: `/gateway/${providerName}/chat`,
        status: 'error',
        statusCode: upstreamRes.status,
        errorMessage: errorMsg,
        responseTimeMs,
      });

      res.status(upstreamRes.status).json({ error: errorMsg });
      return;
    }

    // Parse response
    const text = config.parseChatResponse(responseData);
    const tokensUsed = responseData?.usage?.total_tokens || responseData?.usageMetadata?.totalTokenCount || null;

    await writeLog({
      gatewayKeyId: gatewayKey.id,
      credentialId: cred.id,
      providerName,
      modelName: req.body.model_id,
      requestPath: `/gateway/${providerName}/chat`,
      status: 'success',
      statusCode: 200,
      responseTimeMs,
      tokensUsed,
    });

    // Update usage counter locally (and background sync to Neon)
    const cachedItems = getCachedCredentials(providerName);
    const targetItem = cachedItems.find(c => c.id === cred.id);
    if (targetItem) {
      const newTotal = (targetItem.total_requests || 0) + 1;
      updateLocalCredentialStats(cred.id, providerName, { total_requests: newTotal });
    }

    res.json({ text, model: req.body.model_id, provider: providerName, tokens_used: tokensUsed });
  } catch (err: any) {
    const responseTimeMs = Date.now() - startTime;
    const errorMsg = err.message || 'Gateway proxy error';

    await writeLog({
      gatewayKeyId: gatewayKey.id,
      credentialId: cred.id,
      providerName,
      requestPath: `/gateway/${providerName}/chat`,
      status: 'error',
      errorMessage: errorMsg,
      responseTimeMs,
    });

    console.error('[Gateway] Chat proxy error:', err);
    res.status(500).json({ error: 'Gateway proxy error', message: errorMsg });
  }
});

// ─── POST /gateway/:provider/images/generations ───────────────────────────────
router.post('/:provider/images/generations', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const providerName = req.params.provider.toLowerCase();
  const rawApiKey = req.headers['x-api-key'] as string | undefined;

  if (!rawApiKey) {
    res.status(401).json({ error: 'X-API-Key header is required' });
    return;
  }

  const gatewayKey = await validateGatewayKey(rawApiKey);
  if (!gatewayKey) {
    res.status(401).json({ error: 'Invalid or expired API key' });
    return;
  }

  const config = PROVIDER_CONFIGS[providerName];
  if (!config?.buildImageRequest || !config?.parseImageResponse) {
    res.status(400).json({ error: `Provider "${providerName}" does not support image generation` });
    return;
  }

  const cred = await getProviderCredential(providerName);
  if (!cred) {
    res.status(503).json({ error: `No active credentials for ${providerName}` });
    return;
  }

  try {
    const { url, headers: reqHeaders, payload } = config.buildImageRequest(cred.credentials, req.body);

    const upstreamRes = await fetch(url, {
      method: 'POST',
      headers: reqHeaders,
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(60_000),
    });

    const responseData = await upstreamRes.json();

    if (!upstreamRes.ok) {
      const errorMsg = responseData?.error?.message || `HTTP ${upstreamRes.status}`;
      res.status(upstreamRes.status).json({ error: errorMsg });
      return;
    }

    // Return raw response for image (frontend handles data.data[0].url)
    await writeLog({
      gatewayKeyId: gatewayKey.id,
      credentialId: cred.id,
      providerName,
      requestPath: `/gateway/${providerName}/images/generations`,
      status: 'success',
      statusCode: 200,
      responseTimeMs: Date.now() - startTime,
    });

    res.json(responseData);
  } catch (err: any) {
    console.error('[Gateway] Image gen error:', err);
    res.status(500).json({ error: 'Image generation failed', message: err.message });
  }
});

// ─── ALL /gateway/:provider/proxy ─────────────────────────────────────────────
// Dynamic universal proxy supporting non-AI/utility APIs (Cloudinary, ImageKit, Apify, NewsAPI, etc.)
router.all('/:provider/proxy', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const providerName = req.params.provider.toLowerCase();
  const rawApiKey = req.headers['x-api-key'] as string | undefined;

  let gatewayKey: any = null;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const decoded = jwt.verify(token, env.JWT_SECRET) as any;
      if (decoded && decoded.id) {
        // Logged-in admin has unrestricted access to the proxy
        gatewayKey = {
          id: null,
          provider: '',
          allowedProviders: null,
        };
      } else {
        res.status(401).json({ error: 'Invalid or expired Authorization token' });
        return;
      }
    } catch (err) {
      res.status(401).json({ error: 'Invalid or expired Authorization token' });
      return;
    }
  } else {
    if (!rawApiKey) {
      res.status(401).json({ error: 'X-API-Key header is required' });
      return;
    }

    gatewayKey = await validateGatewayKey(rawApiKey);
    if (!gatewayKey) {
      res.status(401).json({ error: 'Invalid or expired API key' });
      return;
    }
  }

  // Check restrictions
  if (gatewayKey.allowedProviders && Array.isArray(gatewayKey.allowedProviders)) {
    if (!(gatewayKey.allowedProviders as string[]).includes(providerName)) {
      res.status(403).json({
        error: `Provider "${providerName}" not allowed for this key.`,
      });
      return;
    }
  }

  const specificId = req.headers['x-credential-id'] as string | undefined;
  const cred = await getProviderCredential(providerName, undefined, specificId);
  if (!cred) {
    res.status(503).json({ error: `No active credentials for ${providerName}` });
    return;
  }

  // Extract proxy request options
  const method = (req.body?.method || req.method || 'GET').toUpperCase();
  const pathTarget = req.body?.path || req.query?.path || '';
  const bodyPayload = req.body?.body || (method !== 'GET' && method !== 'HEAD' ? req.body : undefined);
  const customHeaders = req.body?.headers || {};
  const queryParams = { ...req.query, ...req.body?.queryParams };
  delete queryParams.path; // Remove path param from target query

  let baseUrl = '';
  let targetHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...customHeaders,
  };

  const creds = cred.credentials;

  // Injection logic per utility/API provider
  if (providerName === 'newsapi') {
    baseUrl = 'https://newsapi.org';
    queryParams.apiKey = creds.api_key;
  } else if (providerName === 'openweather') {
    baseUrl = 'https://api.openweathermap.org';
    queryParams.appid = creds.api_key;
  } else if (providerName === 'apify') {
    baseUrl = 'https://api.apify.com';
    targetHeaders['Authorization'] = `Bearer ${creds.api_token || creds.api_key}`;
  } else if (providerName === 'cloudinary') {
    baseUrl = `https://api.cloudinary.com/v1_1/${creds.cloud_name || ''}`;
    if (bodyPayload && typeof bodyPayload === 'object') {
      bodyPayload.api_key = creds.api_key;
    }
    queryParams.api_key = creds.api_key;

    if (pathTarget.includes('/upload')) {
      // Cloudinary upload API does not accept Basic Auth. Perform a signed upload automatically using secret.
      if (creds.api_key && creds.api_secret && bodyPayload && typeof bodyPayload === 'object') {
        const timestamp = Math.floor(Date.now() / 1000);
        bodyPayload.timestamp = timestamp;
        
        // Delete upload_preset as it is only used for unsigned uploads
        delete bodyPayload.upload_preset;

        const keys = Object.keys(bodyPayload).filter(k => k !== 'file' && k !== 'api_key' && k !== 'signature').sort();
        const signParts = keys.map(k => `${k}=${bodyPayload[k]}`).join('&');
        const signatureStr = `${signParts}${creds.api_secret}`;
        
        const crypto = require('crypto');
        bodyPayload.signature = crypto.createHash('sha1').update(signatureStr).digest('hex');
      }
    } else {
      // Cloudinary admin/management endpoints require Basic Auth
      if (creds.api_key && creds.api_secret) {
        const authString = Buffer.from(`${creds.api_key}:${creds.api_secret}`).toString('base64');
        targetHeaders['Authorization'] = `Basic ${authString}`;
      }
    }
  } else if (providerName === 'imagekit') {
    baseUrl = 'https://api.imagekit.io';
    const authString = Buffer.from(`${creds.private_key || ''}:`).toString('base64');
    targetHeaders['Authorization'] = `Basic ${authString}`;

    if (method === 'POST' && pathTarget === '/v1/files/upload' && bodyPayload?.file) {
      // ImageKit upload strictly requires multipart/form-data
      baseUrl = 'https://upload.imagekit.io';
      const base64Data = bodyPayload.file.replace(/^data:image\/\w+;base64,/, '');
      const fileBuffer = Buffer.from(base64Data, 'base64');
      const filename = bodyPayload.fileName || 'file.png';
      
      const boundary = '----Boundary' + Math.random().toString(16);
      const parts = [
        `--${boundary}\r\nContent-Disposition: form-data; name="fileName"\r\n\r\n${filename}\r\n`,
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: application/octet-stream\r\n\r\n`
      ];

      const payloadBuffer = Buffer.concat([
        Buffer.from(parts[0], 'utf-8'),
        Buffer.from(parts[1], 'utf-8'),
        fileBuffer,
        Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8')
      ]);

      targetHeaders['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
      
      const finalUrl = `https://upload.imagekit.io/api/v1/files/upload`;
      try {
        const response = await fetch(finalUrl, {
          method: 'POST',
          headers: targetHeaders,
          body: payloadBuffer,
          signal: AbortSignal.timeout(60_000)
        });

        const data = await response.json();
        res.status(response.status).json(data);
        return;
      } catch (err: any) {
        res.status(500).json({ error: `ImageKit proxy upload failed: ${err.message}` });
        return;
      }
    }
  } else if (providerName === 'uploadcare') {
    if (pathTarget.startsWith('/base') || pathTarget.startsWith('/from_url') || pathTarget.startsWith('/info')) {
      baseUrl = 'https://upload.uploadcare.com';
      if (pathTarget === '/base' && method === 'POST' && bodyPayload?.file) {
        const matches = bodyPayload.file.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        let fileBuffer: Buffer;
        let filename = bodyPayload.fileName || 'file';
        let mimeType = 'application/octet-stream';
        
        if (matches && matches.length === 3) {
          mimeType = matches[1];
          fileBuffer = Buffer.from(matches[2], 'base64');
        } else {
          fileBuffer = Buffer.from(bodyPayload.file, 'base64');
        }

        const boundary = '----AntigravityBoundary' + Math.random().toString(16);
        const parts = [
          `--${boundary}\r\nContent-Disposition: form-data; name="UPLOADCARE_PUB_KEY"\r\n\r\n${creds.public_key || ''}\r\n`,
          `--${boundary}\r\nContent-Disposition: form-data; name="UPLOADCARE_STORE"\r\n\r\n1\r\n`,
          `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`
        ];

        const payloadBuffer = Buffer.concat([
          Buffer.from(parts[0], 'utf-8'),
          Buffer.from(parts[1], 'utf-8'),
          Buffer.from(parts[2], 'utf-8'),
          fileBuffer,
          Buffer.from(`\r\n--${boundary}--\r\n`, 'utf-8')
        ]);

        targetHeaders['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
        
        const finalUrl = `${baseUrl}${pathTarget}`;
        try {
          const response = await fetch(finalUrl, {
            method: 'POST',
            headers: targetHeaders,
            body: payloadBuffer,
            signal: AbortSignal.timeout(60_000)
          });
          const responseData = await response.json();
          res.status(response.status).json(responseData);
          return;
        } catch (err: any) {
          res.status(500).json({ error: `Uploadcare proxy upload failed: ${err.message}` });
          return;
        }
      }
    } else {
      baseUrl = 'https://api.uploadcare.com';
      targetHeaders['Authorization'] = `Uploadcare.Simple ${creds.public_key || ''}:${creds.secret_key || ''}`;
      targetHeaders['Accept'] = 'application/vnd.uploadcare-v0.7+json';
    }
  } else if (providerName === 'rapidapi') {
    const host = creds.rapidapi_host || '';
    baseUrl = `https://${host}`;
    targetHeaders['x-rapidapi-key'] = creds.api_key;
    targetHeaders['x-rapidapi-host'] = host;
  } else if (providerName === 'alphavantage') {
    baseUrl = 'https://www.alphavantage.co';
    queryParams.apikey = creds.api_key;
  } else if (providerName === 'pexels') {
    baseUrl = 'https://api.pexels.com';
    targetHeaders['Authorization'] = creds.api_key;
  } else if (providerName === 'pixabay') {
    baseUrl = 'https://pixabay.com';
    queryParams.key = creds.api_key;
  } else if (providerName === 'giphy') {
    baseUrl = 'https://api.giphy.com';
    queryParams.api_key = creds.api_key;
  } else if (providerName === 'removebg') {
    baseUrl = 'https://api.remove.bg';
    targetHeaders['X-Api-Key'] = creds.api_key;

    if (method === 'POST' && pathTarget === '/v1.0/removebg' && bodyPayload?.image_file_b64) {
      const base64Data = bodyPayload.image_file_b64.replace(/^data:image\/\w+;base64,/, '');
      const fileBuffer = Buffer.from(base64Data, 'base64');
      const boundary = '----Boundary' + Math.random().toString(16);

      const parts = [
        `--${boundary}\r\nContent-Disposition: form-data; name="image_file"; filename="image.png"\r\nContent-Type: image/png\r\n\r\n`,
        `\r\n--${boundary}\r\nContent-Disposition: form-data; name="size"\r\n\r\n${bodyPayload.size || 'auto'}`,
        `\r\n--${boundary}--\r\n`
      ];

      const payloadBuffer = Buffer.concat([
        Buffer.from(parts[0], 'utf-8'),
        fileBuffer,
        Buffer.from(parts[1], 'utf-8'),
        Buffer.from(parts[2], 'utf-8')
      ]);

      targetHeaders['Content-Type'] = `multipart/form-data; boundary=${boundary}`;
      
      const finalUrl = `https://api.remove.bg/v1.0/removebg`;
      try {
        const response = await fetch(finalUrl, {
          method: 'POST',
          headers: targetHeaders,
          body: payloadBuffer,
          signal: AbortSignal.timeout(60_000)
        });

        if (!response.ok) {
          const errText = await response.text();
          res.status(response.status).send(errText);
          return;
        }

        const imageBuffer = Buffer.from(await response.arrayBuffer());
        res.setHeader('Content-Type', 'image/png');
        res.send(imageBuffer);
        return;
      } catch (err) {
        res.status(500).json({ error: `Remove.bg proxy failed: ${err.message}` });
        return;
      }
    }
  } else {
    // For other AI providers that client wants to proxy directly
    const config = PROVIDER_CONFIGS[providerName];
    if (config) {
      baseUrl = config.baseUrl;
      if (['openai', 'groq', 'mistral', 'cohere', 'together', 'perplexity', 'huggingface'].includes(providerName)) {
        targetHeaders['Authorization'] = `Bearer ${creds.api_key}`;
      } else if (providerName === 'anthropic') {
        targetHeaders['x-api-key'] = creds.api_key;
        targetHeaders['anthropic-version'] = '2023-06-01';
      }
    } else {
      res.status(400).json({ error: `Provider "${providerName}" has no proxy configuration` });
      return;
    }
  }

  // Construct final URL
  const queryString = new URLSearchParams(queryParams as any).toString();
  const finalUrl = `${baseUrl}${pathTarget}${queryString ? '?' + queryString : ''}`;

  try {
    const response = await fetch(finalUrl, {
      method,
      headers: targetHeaders,
      body: bodyPayload && method !== 'GET' && method !== 'HEAD' ? JSON.stringify(bodyPayload) : undefined,
      signal: AbortSignal.timeout(60_000),
    });

    const contentType = response.headers.get('content-type') || '';

    if (response.ok && (contentType.includes('image/') || contentType.includes('audio/') || contentType.includes('application/octet-stream'))) {
      const buffer = Buffer.from(await response.arrayBuffer());
      const responseTimeMs = Date.now() - startTime;

      await writeLog({
        gatewayKeyId: gatewayKey.id,
        credentialId: cred.id,
        providerName,
        requestPath: `/gateway/${providerName}/proxy${pathTarget}`,
        status: 'success',
        statusCode: response.status,
        responseTimeMs,
      });

      const cachedItems = getCachedCredentials(providerName);
      const targetItem = cachedItems.find(c => c.id === cred.id);
      if (targetItem) {
        const newTotal = (targetItem.total_requests || 0) + 1;
        updateLocalCredentialStats(cred.id, providerName, { total_requests: newTotal });
      }

      res.setHeader('Content-Type', contentType);
      res.status(response.status).send(buffer);
      return;
    }

    let responseData;
    if (contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
      try {
        responseData = JSON.parse(responseData);
      } catch {
        // Keep as string
      }
    }

    const responseTimeMs = Date.now() - startTime;

    await writeLog({
      gatewayKeyId: gatewayKey.id,
      credentialId: cred.id,
      providerName,
      requestPath: `/gateway/${providerName}/proxy${pathTarget}`,
      status: response.ok ? 'success' : 'error',
      statusCode: response.status,
      errorMessage: response.ok ? undefined : `HTTP ${response.status}`,
      responseTimeMs,
    });

    // Update usage count locally (and background sync to Neon)
    const cachedItems = getCachedCredentials(providerName);
    const targetItem = cachedItems.find(c => c.id === cred.id);
    if (targetItem) {
      const newTotal = (targetItem.total_requests || 0) + 1;
      updateLocalCredentialStats(cred.id, providerName, { total_requests: newTotal });
    }

    res.status(response.status).json(responseData);
  } catch (err: any) {
    console.error(`[Gateway] Generic proxy error for ${providerName}:`, err);
    res.status(500).json({ error: 'Proxy request failed', message: err.message });
  }
});

export default router;
