import fs from 'fs';
import path from 'path';
import axios from 'axios';

const geminiCachePath = path.join(process.cwd(), 'data', 'gemini.json');
const items = JSON.parse(fs.readFileSync(geminiCachePath, 'utf8'));

console.log(`🔍 Checking ${items.length} Gemini API Keys from backend/data/gemini.json...\n`);

async function testAllKeys() {
  let activeCount = 0;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const apiKey = item.credentials?.api_key;
    if (!apiKey) continue;

    try {
      const res = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        { contents: [{ parts: [{ text: 'Tes 1 kata "READY".' }] }] },
        { timeout: 5000 }
      );

      const reply = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      console.log(`[✅ ACTIVE] Key ID #${item.id} (${apiKey.substring(0, 15)}...): Respon = "${reply}"`);
      activeCount++;
    } catch (err) {
      const msg = err.response?.data?.error?.message || err.message;
      console.log(`[❌ INVALID/DENIED] Key ID #${item.id} (${apiKey.substring(0, 15)}...): ${msg}`);
    }
  }

  console.log(`\n📊 Hasil: ${activeCount} dari ${items.length} API key aktif & bisa menjawab.`);
}

testAllKeys();
