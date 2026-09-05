import fs from 'fs';
import path from 'path';
import axios from 'axios';
import 'dotenv/config';
import { db } from './db/client';
import { aiModels } from './db/schema';
import { eq, and } from 'drizzle-orm';

const geminiCachePath = path.join(process.cwd(), 'data', 'gemini.json');

// Exact 26 target models requested by the user matched with official Google Gemini API model IDs
const targetModels = [
  { name: 'Gemini 3.1 Flash Lite', modelId: 'gemini-3.1-flash-lite-preview', category: 'Text-out models', isDefault: true, supportsVision: true },
  { name: 'Gemini 2.5 Flash', modelId: 'gemini-2.5-flash', category: 'Text-out models', isDefault: true, supportsVision: true },
  { name: 'Gemini 2.5 Flash Lite', modelId: 'gemini-2.5-flash-lite', category: 'Text-out models', isDefault: false, supportsVision: true },
  { name: 'Antigravity', modelId: 'antigravity-preview-05-2026', category: 'Agents', isDefault: false, supportsVision: true },
  { name: 'Deep Research Pro Preview', modelId: 'deep-research-pro-preview-12-2025', category: 'Agents', isDefault: false, supportsVision: false },
  { name: 'Gemini 2 Flash', modelId: 'gemini-2.0-flash', category: 'Text-out models', isDefault: false, supportsVision: true },
  { name: 'Gemini 2 Flash Lite', modelId: 'gemini-2.0-flash-lite', category: 'Text-out models', isDefault: false, supportsVision: true },
  { name: 'Computer Use Preview', modelId: 'gemini-2.5-computer-use-preview-10-2025', category: 'Other models', isDefault: false, supportsVision: true },
  { name: 'Nano Banana (Gemini 2.5 Flash Preview Image)', modelId: 'gemini-2.5-flash-image', category: 'Multi-modal generative models', isDefault: false, supportsVision: true },
  { name: 'Gemini 2.5 Flash TTS', modelId: 'gemini-2.5-flash-preview-tts', category: 'Multi-modal generative models', isDefault: false, supportsVision: false },
  { name: 'Gemini 2.5 Pro', modelId: 'gemini-2.5-pro', category: 'Text-out models', isDefault: false, supportsVision: true },
  { name: 'Gemini 2.5 Pro TTS', modelId: 'gemini-2.5-pro-preview-tts', category: 'Multi-modal generative models', isDefault: false, supportsVision: false },
  { name: 'Gemini 3 Flash', modelId: 'gemini-3-flash-preview', category: 'Text-out models', isDefault: false, supportsVision: true },
  { name: 'Nano Banana Pro (Gemini 3 Pro Image)', modelId: 'gemini-3-pro-image-preview', category: 'Multi-modal generative models', isDefault: false, supportsVision: true },
  { name: 'Gemini 3.1 Pro', modelId: 'gemini-3.1-pro-preview', category: 'Text-out models', isDefault: false, supportsVision: true },
  { name: 'Nano Banana 2 (Gemini 3.1 Flash Image)', modelId: 'gemini-3.1-flash-image-preview', category: 'Multi-modal generative models', isDefault: false, supportsVision: true },
  { name: 'Nano Banana 2 Lite (Gemini 3.1 Flash Lite Image)', modelId: 'gemini-3.1-flash-lite-image', category: 'Multi-modal generative models', isDefault: false, supportsVision: true },
  { name: 'Gemini 3.1 Flash TTS', modelId: 'gemini-3.1-flash-tts-preview', category: 'Multi-modal generative models', isDefault: false, supportsVision: false },
  { name: 'Gemini 3.5 Flash', modelId: 'gemini-3.5-flash', category: 'Text-out models', isDefault: false, supportsVision: true },
  { name: 'Gemini Embedding 1', modelId: 'gemini-embedding-001', category: 'Other models', isDefault: false, supportsVision: false },
  { name: 'Gemini Embedding 2', modelId: 'gemini-embedding-2', category: 'Other models', isDefault: false, supportsVision: false },
  { name: 'Gemini Omni Flash', modelId: 'gemini-omni-flash-preview', category: 'Multi-modal generative models', isDefault: false, supportsVision: true },
  { name: 'Gemini Robotics ER 1.5 Preview', modelId: 'gemini-robotics-er-1.5-preview', category: 'Other models', isDefault: false, supportsVision: false },
  { name: 'Gemini Robotics ER 1.6 Preview', modelId: 'gemini-robotics-er-1.6-preview', category: 'Other models', isDefault: false, supportsVision: false },
  { name: 'Gemma 4 26B', modelId: 'gemma-4-26b-a4b-it', category: 'Other models', isDefault: false, supportsVision: false },
  { name: 'Gemma 4 31B', modelId: 'gemma-4-31b-it', category: 'Other models', isDefault: false, supportsVision: false },
];

async function runTest() {
  console.log('🔍 Reading API Keys from backend/data/gemini.json...');
  const fileContent = fs.readFileSync(geminiCachePath, 'utf8');
  const items = JSON.parse(fileContent);
  const keys = items.map((i: any) => i.credentials?.api_key).filter(Boolean);

  if (keys.length === 0) {
    console.error('❌ No API keys found in backend/data/gemini.json!');
    process.exit(1);
  }

  const apiKey = keys[0];
  console.log(`🔑 Testing with key prefix: ${apiKey.substring(0, 12)}... (Total keys available: ${keys.length})`);

  // Step 1: List all models supported by API Key
  console.log('\n📋 Fetching official supported models list from Google Gemini API...');
  let availableModelsList: string[] = [];
  try {
    const listRes = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    availableModelsList = (listRes.data.models || []).map((m: any) => m.name.replace('models/', ''));
    console.log(`✅ Google API returned ${availableModelsList.length} supported models.`);
  } catch (err: any) {
    console.error('⚠️ Could not fetch models list:', err.response?.data || err.message);
  }

  console.log('\n🧪 Testing each of the 26 models against Google API...');
  const results = [];

  for (const target of targetModels) {
    const isAvailableInList = availableModelsList.includes(target.modelId);
    let working = false;
    let errorDetail: string | null = null;

    try {
      if (target.modelId.includes('embedding')) {
        const res = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${target.modelId}:embedContent?key=${apiKey}`,
          { content: { parts: [{ text: 'Hello' }] } },
          { timeout: 8000 }
        );
        if (res.data) working = true;
      } else {
        const res = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${target.modelId}:generateContent?key=${apiKey}`,
          { contents: [{ parts: [{ text: 'Halo, tes respon 1 kata "READY".' }] }] },
          { timeout: 8000 }
        );
        if (res.data?.candidates?.[0]) working = true;
      }
    } catch (err: any) {
      errorDetail = err.response?.data?.error?.message || err.message;
    }

    const status = working ? 'WORKING & ACTIVE' : isAvailableInList ? 'SUPPORTED BY GOOGLE' : 'PREVIEW / COMING SOON';

    results.push({
      ...target,
      status,
      working,
      isAvailableInList,
      error: working ? null : errorDetail,
    });

    console.log(`[${working ? '✅ READY' : isAvailableInList ? '🟡 LISTED' : '❌ UNTESTED'}] ${target.name} (ID: ${target.modelId}) -> ${status}`);
  }

  console.log('\n💾 Upserting all 26 Gemini models into database table (ai_models)...');
  for (const res of results) {
    try {
      const existing = await db
        .select()
        .from(aiModels)
        .where(and(eq(aiModels.provider, 'gemini'), eq(aiModels.modelId, res.modelId)))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(aiModels).values({
          provider: 'gemini',
          modelId: res.modelId,
          displayName: res.name,
          isDefault: res.isDefault,
          supportsVision: res.supportsVision,
        });
        console.log(`   ➕ Inserted model ${res.name} (${res.modelId}) into database.`);
      } else {
        await db
          .update(aiModels)
          .set({
            displayName: res.name,
            isDefault: res.isDefault,
            supportsVision: res.supportsVision,
            updatedAt: new Date(),
          })
          .where(and(eq(aiModels.provider, 'gemini'), eq(aiModels.modelId, res.modelId)));
        console.log(`   🔄 Updated model ${res.name} (${res.modelId}) in database.`);
      }
    } catch (dbErr: any) {
      console.error(`   ❌ Failed DB insert for ${res.name}:`, dbErr.message);
    }
  }

  console.log('\n✨ Test and Database Sync Complete!');
  process.exit(0);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
