import axios from 'axios';

const apiKey = 'AR_f2b7c86c_24869ddabff3f86c10c7c2c8a253d730';
const model = 'gemini-3.5-flash';

console.log(`🧪 Testing API Key: ${apiKey}`);
console.log(`🤖 Target Model: ${model}`);

async function testApiKey() {
  const prompt = 'Siapa kamu dan apa keahlian utamamu? Jawab singkat dalam 2 kalimat.';
  console.log(`💬 Sending Question: "${prompt}"\n`);

  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      },
      { timeout: 10000 }
    );

    const reply = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('✅ API KEY SUCCESS & RESPONDED!');
    console.log('--------------------------------------------------');
    console.log(`🤖 Gemini Answer:\n${reply}`);
    console.log('--------------------------------------------------');
  } catch (err) {
    console.error('❌ Request failed with target model:', err.response?.data || err.message);
    
    // Try fallback models if 3.5 flash returns error
    console.log('\n🔄 Testing key with fallback models (gemini-3.1-flash-lite-preview, gemini-2.5-flash, gemini-2.0-flash)...');
    const fallbacks = ['gemini-3.1-flash-lite-preview', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];
    for (const fb of fallbacks) {
      try {
        const resFb = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${fb}:generateContent?key=${apiKey}`,
          { contents: [{ parts: [{ text: prompt }] }] },
          { timeout: 8000 }
        );
        const replyFb = resFb.data?.candidates?.[0]?.content?.parts?.[0]?.text;
        console.log(`✅ SUCCESS with fallback model [${fb}]!\n🤖 Answer:\n${replyFb}`);
        break;
      } catch (errFb) {
        console.log(`❌ Model [${fb}] failed:`, errFb.response?.data?.error?.message || errFb.message);
      }
    }
  }
}

testApiKey();
