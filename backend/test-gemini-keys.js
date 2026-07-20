import fs from 'fs';
import path from 'path';

const MODEL_NAME = 'gemini-3.1-flash-lite-preview';
const FILE_PATH = path.join(process.cwd(), 'data', 'gemini.json');

async function testGeminiKeys() {
  console.log('====================================================');
  console.log(`🔍 MEMULAI PENGUJIAN OTOMATIS GEMINI API KEYS`);
  console.log(`📌 Model Wajib: ${MODEL_NAME}`);
  console.log('====================================================\n');

  if (!fs.existsSync(FILE_PATH)) {
    console.error(`❌ File ${FILE_PATH} tidak ditemukan!`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(FILE_PATH, 'utf8');
  let keys = [];
  try {
    keys = JSON.parse(rawData);
  } catch (e) {
    console.error('❌ Gagal membaca file gemini.json:', e.message);
    process.exit(1);
  }

  console.log(`📦 Total API Key ditemukan di gemini.json: ${keys.length} keys\n`);

  const results = {
    working: [],
    failed: [],
  };

  for (let i = 0; i < keys.length; i++) {
    const item = keys[i];
    const id = item.id;
    const label = item.label || `Key #${id}`;
    const apiKey = item.credentials?.api_key || item.credentials?.raw?.api_key;

    if (!apiKey) {
      console.log(`[${i + 1}/${keys.length}] ID: ${id} (${label}) -> ❌ GAGAL: API Key string tidak ada`);
      results.failed.push({ id, label, reason: 'API Key string tidak ada' });
      continue;
    }

    const maskedKey = apiKey.length > 10 ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}` : apiKey;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

    const payload = {
      contents: [{ role: 'user', parts: [{ text: 'Di mana letak Indonesia? Jawab singkat saja.' }] }],
    };

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(12000), // 12 second timeout per key
      });

      const data = await res.json();

      if (res.ok && data?.candidates?.[0]?.content?.parts?.[0]?.text) {
        const answer = data.candidates[0].content.parts[0].text.trim().replace(/\n/g, ' ');
        console.log(`[${i + 1}/${keys.length}] ID: ${id} (${label}) [${maskedKey}] -> ✅ BERFUNGSI!`);
        console.log(`    💬 Response: "${answer.slice(0, 100)}..."\n`);
        results.working.push({ id, label, apiKey: maskedKey, answer });
      } else {
        const errorMsg = data?.error?.message || data?.error?.status || `HTTP ${res.status}`;
        console.log(`[${i + 1}/${keys.length}] ID: ${id} (${label}) [${maskedKey}] -> ❌ GAGAL (${res.status}): ${errorMsg}`);
        results.failed.push({ id, label, apiKey: maskedKey, status: res.status, reason: errorMsg });
      }
    } catch (err) {
      console.log(`[${i + 1}/${keys.length}] ID: ${id} (${label}) [${maskedKey}] -> ❌ ERROR: ${err.message}`);
      results.failed.push({ id, label, apiKey: maskedKey, reason: err.message });
    }
  }

  console.log('\n====================================================');
  console.log('📊 HASIL AKHIR PENGUJIAN GEMINI API KEYS');
  console.log('====================================================');
  console.log(`✅ BERFUNGSI  : ${results.working.length} keys`);
  console.log(`❌ GAGAL      : ${results.failed.length} keys`);
  console.log('====================================================\n');

  if (results.working.length > 0) {
    console.log('🎉 DAFTAR API KEY YANG BERFUNGSI:');
    results.working.forEach(w => {
      console.log(`  - ID: ${w.id} | Label: "${w.label}" | Key: ${w.apiKey}`);
    });
  } else {
    console.log('⚠️ Tidak ada API key Gemini yang berfungsi dengan model ini.');
  }

  // Save report to JSON file
  const reportPath = path.join(process.cwd(), 'data', 'gemini_test_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log(`\n📁 Laporan lengkap telah disimpan ke: ${reportPath}`);
}

testGeminiKeys();
