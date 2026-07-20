import fs from 'fs';
import path from 'path';
import axios from 'axios';
import 'dotenv/config';
import { db } from './src/db/client';
import { aiModels } from './src/db/schema';
import { eq, and } from 'drizzle-orm';

const geminiCachePath = path.join(process.cwd(), 'data', 'gemini.json');

// Target models from user request
const targetModels = [
  { name: 'Gemini 3.1 Flash Lite', candidates: ['gemini-3.1-flash-lite-preview', 'gemini-2.5-flash-lite', 'gemini-1.5-flash-lite'], category: 'Text-out models' },
  { name: 'Gemini 2.5 Flash', candidates: ['gemini-2.5-flash', 'gemini-1.5-flash', 'gemini-2.0-flash'], category: 'Text-out models' },
  { name: 'Gemini 2.5 Flash Lite', candidates: ['gemini-2.5-flash-lite', 'gemini-1.5-flash-8b', 'gemini-1.5-flash-lite'], category: 'Text-out models' },
  { name: 'Antigravity', candidates: ['antigravity', 'gemini-2.5-pro'], category: 'Agents' },
  { name: 'Deep Research Pro Preview', candidates: ['deep-research-pro-preview', 'gemini-2.5-pro-exp'], category: 'Agents' },
  { name: 'Gemini 2 Flash', candidates: ['gemini-2.0-flash', 'gemini-2.0-flash-exp'], category: 'Text-out models' },
  { name: 'Gemini 2 Flash Lite', candidates: ['gemini-2.0-flash-lite', 'gemini-2.0-flash-lite-preview'], category: 'Text-out models' },
  { name: 'Computer Use Preview', candidates: ['computer-use-preview', 'gemini-2.5-computer-use-preview'], category: 'Other models' },
  { name: 'Nano Banana (Gemini 2.5 Flash Preview Image)', candidates: ['nano-banana', 'gemini-2.5-flash-image-preview', 'imagen-3.0-generate-002'], category: 'Multi-modal generative models' },
  { name: 'Gemini 2.5 Flash TTS', candidates: ['gemini-2.5-flash-tts', 'gemini-2.5-flash-audio'], category: 'Multi-modal generative models' },
  { name: 'Gemini 2.5 Pro', candidates: ['gemini-2.5-pro', 'gemini-1.5-pro'], category: 'Text-out models' },
  { name: 'Gemini 2.5 Pro TTS', candidates: ['gemini-2.5-pro-tts'], category: 'Multi-modal generative models' },
  { name: 'Gemini 3 Flash', candidates: ['gemini-3-flash', 'gemini-3.0-flash-preview'], category: 'Text-out models' },
  { name: 'Nano Banana Pro (Gemini 3 Pro Image)', candidates: ['nano-banana-pro', 'imagen-3.0-generate-001'], category: 'Multi-modal generative models' },
  { name: 'Gemini 3.1 Pro', candidates: ['gemini-3.1-pro', 'gemini-3.1-pro-preview'], category: 'Text-out models' },
  { name: 'Nano Banana 2 (Gemini 3.1 Flash Image)', candidates: ['nano-banana-2', 'imagen-3.0-fast-generate-001'], category: 'Multi-modal generative models' },
  { name: 'Nano Banana 2 Lite (Gemini 3.1 Flash Lite Image)', candidates: ['nano-banana-2-lite'], category: 'Multi-modal generative models' },
  { name: 'Gemini 3.1 Flash TTS', candidates: ['gemini-3.1-flash-tts'], category: 'Multi-modal generative models' },
  { name: 'Gemini 3.5 Flash', candidates: ['gemini-3.5-flash'], category: 'Text-out models' },
  { name: 'Gemini Embedding 1', candidates: ['text-embedding-004', 'embedding-001'], category: 'Other models' },
  { name: 'Gemini Embedding 2', candidates: ['text-embedding-005', 'text-embedding-002'], category: 'Other models' },
  { name: 'Gemini Omni Flash', candidates: ['gemini-omni-flash', 'gemini-2.0-flash-thinking-exp'], category: 'Multi-modal generative models' },
  { name: 'Gemini Robotics ER 1.5 Preview', candidates: ['gemini-robotics-er-1.5-preview'], category: 'Other models' },
  { name: 'Gemini Robotics ER 1.6 Preview', candidates: ['gemini-robotics-er-1.6-preview'], category: 'Other models' },
  { name: 'Gemma 4 26B', candidates: ['gemma-2-27b-it', 'gemma-27b-it', 'gemma-2-9b-it'], category: 'Other models' },
  { name: 'Gemma 4 31B', candidates: ['gemma-2-31b-it', 'gemma-31b-it'], category: 'Other models' },
];

async function runTest() {
  console.log('🔍 Reading API Keys from backend/data/gemini.json...');
  const fileContent = fs.readFileSync(geminiCachePath, 'utf8');
  const items = JSON.parse(fileContent);
  const keys = items.map(i => i.credentials?.api_key).filter(Boolean);

  if (keys.length === 0) {
    console.error('❌ No API keys found in backend/data/gemini.json!');
    process.exit(1);
  }

  const apiKey = keys[0];
  console.log(`🔑 Testing with key prefix: ${apiKey.substring(0, 12)}... (Total keys available: ${keys.length})`);

  // Step 1: List all models supported by API Key
  console.log('\n📋 Fetching official supported models list from Google Gemini API...');
  let availableModelsList = [];
  try {
    const listRes = await axios.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    availableModelsList = (listRes.data.models || []).map(m => m.name.replace('models/', ''));
    console.log(`✅ Google API returned ${availableModelsList.length} supported models:`);
    console.log(availableModelsList.join(', '));
  } catch (err) {
    console.error('⚠️ Could not fetch models list:', err.response?.data || err.message);
  }

  console.log('\n🧪 Testing each target model with live API calls...');
  const results = [];

  for (const target of targetModels) {
    let workingModelId = null;
    let errorDetail = null;

    // Check against available list or test API call
    for (const candidate of target.candidates) {
      try {
        if (candidate.includes('embedding')) {
          const res = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:embedContent?key=${apiKey}`,
            { content: { parts: [{ text: 'Hello' }] } },
            { timeout: 8000 }
          );
          if (res.data) {
            workingModelId = candidate;
            break;
          }
        } else {
          const res = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent?key=${apiKey}`,
            { contents: [{ parts: [{ text: 'Halo, respon 1 kata "OK".' }] }] },
            { timeout: 8000 }
          );
          if (res.data?.candidates?.[0]) {
            workingModelId = candidate;
            break;
          }
        }
      } catch (err) {
        errorDetail = err.response?.data?.error?.message || err.message;
      }
    }

    const isAvailableInList = target.candidates.some(c => availableModelsList.includes(c));
    const status = workingModelId ? 'WORKING' : isAvailableInList ? 'SUPPORTED' : 'UNAVAILABLE';

    results.push({
      name: target.name,
      category: target.category,
      modelId: workingModelId || target.candidates[0],
      status,
      error: workingModelId ? null : errorDetail,
    });

    console.log(`[${status === 'WORKING' ? '✅' : status === 'SUPPORTED' ? '🟡' : '❌'}] ${target.name} -> ID: ${workingModelId || target.candidates[0]} (${status})`);
  }

  console.log('\n💾 Saving/Upserting working & supported models into database (ai_models)...');
  for (const res of results) {
    if (res.status === 'WORKING' || res.status === 'SUPPORTED') {
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
            isDefault: res.modelId === 'gemini-1.5-flash' || res.modelId === 'gemini-2.0-flash',
            supportsVision: res.modelId.includes('flash') || res.modelId.includes('pro'),
          });
          console.log(`   ➕ Inserted model ${res.name} (${res.modelId}) into database.`);
        } else {
          console.log(`   ℹ️ Model ${res.name} (${res.modelId}) already exists in database.`);
        }
      } catch (dbErr) {
        console.error(`   ❌ Failed DB insert for ${res.name}:`, dbErr.message);
      }
    }
  }

  console.log('\n✨ Test and Database Sync Complete!');
  process.exit(0);
}

runTest().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
