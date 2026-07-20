import fs from 'fs';
import path from 'path';
import axios from 'axios';

const geminiCachePath = path.join(process.cwd(), 'data', 'gemini.json');
const items = JSON.parse(fs.readFileSync(geminiCachePath, 'utf8'));
const validKeyItem = items.find(i => i.credentials?.api_key);

if (!validKeyItem) {
  console.error('No key found in gemini.json');
  process.exit(1);
}

const apiKey = validKeyItem.credentials.api_key;
const model = 'gemini-3.5-flash';

console.log(`🔑 Testing valid Gemini Key from database/data cache: ${apiKey.substring(0, 15)}...`);
console.log(`🤖 Model: ${model}`);

async function askQuestion() {
  const prompt = 'Halo! Sebutkan 3 fitur unggulan dari Gemini 3.5 Flash secara singkat.';
  console.log(`💬 Tanya: "${prompt}"\n`);

  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      }
    );

    const reply = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('✅ BERHASIL DIJAWAB OLEH GEMINI 3.5 FLASH!');
    console.log('==================================================');
    console.log(reply);
    console.log('==================================================');
  } catch (err) {
    console.error('❌ Model 3.5 Error:', err.response?.data?.error?.message || err.message);
    
    // Try gemini-1.5-flash or gemini-2.0-flash
    try {
      console.log('\n🔄 Mencoba dengan model gemini-1.5-flash...');
      const res2 = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
        { contents: [{ parts: [{ text: prompt }] }] }
      );
      console.log('✅ BERHASIL DIJAWAB OLEH GEMINI 1.5 FLASH:');
      console.log(res2.data?.candidates?.[0]?.content?.parts?.[0]?.text);
    } catch (err2) {
      console.error('❌ Error:', err2.response?.data?.error?.message || err2.message);
    }
  }
}

askQuestion();
