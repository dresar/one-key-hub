import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { modelsCache } from '../lib/cache';
import { db } from '../db/client';
import { aiModels } from '../db/schema';
import { eq } from 'drizzle-orm';

const router = Router();

// ─── Provider models config ───────────────────────────────────────────────────
const MODELS_BY_PROVIDER: Record<string, { model_id: string; display_name: string; is_default?: boolean; supports_vision?: boolean }[]> = {
  gemini: [
    { model_id: 'gemini-2.0-flash-exp', display_name: 'Gemini 2.0 Flash Exp', is_default: true, supports_vision: true },
    { model_id: 'gemini-1.5-pro', display_name: 'Gemini 1.5 Pro', supports_vision: true },
    { model_id: 'gemini-1.5-flash', display_name: 'Gemini 1.5 Flash', supports_vision: true },
    { model_id: 'gemini-1.5-flash-8b', display_name: 'Gemini 1.5 Flash 8B' },
    { model_id: 'gemini-2.5-flash-preview-05-20', display_name: 'Gemini 2.5 Flash Preview' },
  ],
  groq: [
    { model_id: 'llama-3.3-70b-versatile', display_name: 'LLaMA 3.3 70B', is_default: true },
    { model_id: 'llama-3.1-8b-instant', display_name: 'LLaMA 3.1 8B Instant' },
    { model_id: 'mixtral-8x7b-32768', display_name: 'Mixtral 8x7B' },
    { model_id: 'gemma2-9b-it', display_name: 'Gemma 2 9B' },
    { model_id: 'deepseek-r1-distill-llama-70b', display_name: 'DeepSeek R1 70B' },
  ],
  openai: [
    { model_id: 'gpt-4o', display_name: 'GPT-4o', is_default: true, supports_vision: true },
    { model_id: 'gpt-4o-mini', display_name: 'GPT-4o Mini', supports_vision: true },
    { model_id: 'gpt-4-turbo', display_name: 'GPT-4 Turbo' },
    { model_id: 'gpt-3.5-turbo', display_name: 'GPT-3.5 Turbo' },
    { model_id: 'dall-e-3', display_name: 'DALL-E 3 (Image)' },
  ],
  anthropic: [
    { model_id: 'claude-opus-4-5', display_name: 'Claude Opus 4.5', is_default: true },
    { model_id: 'claude-sonnet-4-5', display_name: 'Claude Sonnet 4.5' },
    { model_id: 'claude-3-5-haiku-20241022', display_name: 'Claude 3.5 Haiku' },
    { model_id: 'claude-3-opus-20240229', display_name: 'Claude 3 Opus' },
  ],
  mistral: [
    { model_id: 'mistral-large-latest', display_name: 'Mistral Large', is_default: true },
    { model_id: 'mistral-medium-latest', display_name: 'Mistral Medium' },
    { model_id: 'mistral-small-latest', display_name: 'Mistral Small' },
    { model_id: 'codestral-latest', display_name: 'Codestral' },
  ],
  cohere: [
    { model_id: 'command-r-plus', display_name: 'Command R+', is_default: true },
    { model_id: 'command-r', display_name: 'Command R' },
    { model_id: 'command-light', display_name: 'Command Light' },
  ],
  together: [
    { model_id: 'meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo', display_name: 'LLaMA 3.1 70B Turbo', is_default: true },
    { model_id: 'mistralai/Mixtral-8x7B-Instruct-v0.1', display_name: 'Mixtral 8x7B' },
    { model_id: 'google/gemma-2-9b-it', display_name: 'Gemma 2 9B' },
  ],
  perplexity: [
    { model_id: 'llama-3.1-sonar-large-128k-online', display_name: 'Sonar Large Online', is_default: true },
    { model_id: 'llama-3.1-sonar-small-128k-online', display_name: 'Sonar Small Online' },
    { model_id: 'llama-3.1-sonar-huge-128k-online', display_name: 'Sonar Huge Online' },
  ],
  huggingface: [
    { model_id: 'mistralai/Mistral-7B-Instruct-v0.3', display_name: 'Mistral 7B', is_default: true },
    { model_id: 'HuggingFaceH4/zephyr-7b-beta', display_name: 'Zephyr 7B' },
    { model_id: 'microsoft/DialoGPT-large', display_name: 'DialoGPT Large' },
  ],
  cloudinary: [],
  imagekit: [],
  apify: [],
  newsapi: [],
  openweather: [],
  alphavantage: [],
};

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
    const mapped = dbModels.map((m, idx) => ({
      id: m.id,
      provider: m.provider,
      model_id: m.modelId,
      display_name: m.displayName,
      is_default: m.isDefault,
      supports_vision: m.supportsVision,
    }));

    modelsCache.set(cacheKey, mapped, 600_000); // 10 min TTL

    res.json({ models: mapped, provider });
  } catch (err) {
    console.error('[Playground] Models error:', err);
    res.status(500).json({ error: 'Gagal memuat model list' });
  }
});

export default router;
