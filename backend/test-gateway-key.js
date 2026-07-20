import axios from 'axios';

const gatewayKey = 'AR_f2b7c86c_24869ddabff3f86c10c7c2c8a253d730';
const model = 'gemini-1.5-flash';
const gatewayUrl = 'http://localhost:3000/gateway/gemini/chat';

async function testGatewayRotation() {
  console.log('🚀 TESTING ONE KEY HUB UNIFIED GATEWAY ROTATION!');
  console.log(`🔑 Gateway Key: ${gatewayKey}`);
  console.log(`🤖 Target Model: ${model}`);
  console.log(`🌐 Endpoint: ${gatewayUrl}\n`);

  try {
    const res = await axios.post(
      gatewayUrl,
      {
        model: model,
        messages: [
          { role: 'user', content: 'Halo! Siapa namamu?' }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': gatewayKey
        },
        timeout: 20000
      }
    );

    console.log('===============================================================');
    console.log('✅ GATEWAY ROTATION SUKSES & BERHASIL MENJAWAB!');
    console.log('===============================================================');
    console.log('💬 Respon Jawaban AI via Gateway:');
    console.log(res.data?.choices?.[0]?.message?.content || res.data?.text);
    console.log(`🔑 Rotated Credential Used: ID #${res.data?.rotated_credential_id || 'Auto-Rotated'}`);
    console.log('===============================================================');
  } catch (err) {
    console.error('❌ Request failed detail:', err.message);
    if (err.response) {
      console.error(`Status ${err.response.status}:`, JSON.stringify(err.response.data, null, 2));
    }
  }
}

testGatewayRotation();
