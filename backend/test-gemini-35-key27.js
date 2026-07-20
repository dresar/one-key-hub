import axios from 'axios';

const activeKey = 'AQ.Ab8RN6ICecdQiZ7Vha-S5ob-TC6bWX3nevxkZGNF3_M7WNIgXA';
const model = 'gemini-3.5-flash';

console.log(`🔑 Key ID #27 Active API Key: ${activeKey.substring(0, 15)}...`);
console.log(`🤖 Testing model: ${model}\n`);

async function testInteractive() {
  const prompt = 'Halo! Ceritakan 1 fakta unik dan menarik tentang alam semesta dalam 2 kalimat.';
  console.log(`❓ Pertanyaan dikirim: "${prompt}"\n`);

  try {
    const res = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${activeKey}`,
      {
        contents: [
          {
            parts: [{ text: prompt }]
          }
        ]
      }
    );

    const reply = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
    console.log('✅ GEMINI 3.5 FLASH BERHASIL MENJAWAB!');
    console.log('===============================================================');
    console.log(`💬 Respon Jawaban Gemini:\n${reply}`);
    console.log('===============================================================');
  } catch (err) {
    console.error('❌ Error pada model 3.5 Flash:', err.response?.data?.error?.message || err.message);
    
    // Fallback to gemini-3.1-flash-lite-preview or gemini-2.0-flash
    const altModels = ['gemini-3.1-flash-lite-preview', 'gemini-2.0-flash'];
    for (const alt of altModels) {
      try {
        console.log(`\n🔄 Mencoba dengan model ${alt}...`);
        const resAlt = await axios.post(
          `https://generativelanguage.googleapis.com/v1beta/models/${alt}:generateContent?key=${activeKey}`,
          { contents: [{ parts: [{ text: prompt }] }] }
        );
        console.log(`✅ BERHASIL DIJAWAB OLEH MODEL ${alt}:`);
        console.log('===============================================================');
        console.log(resAlt.data?.candidates?.[0]?.content?.parts?.[0]?.text);
        console.log('===============================================================');
        break;
      } catch (errAlt) {
        console.error(`❌ Model ${alt} error:`, errAlt.response?.data?.error?.message || errAlt.message);
      }
    }
  }
}

testInteractive();
