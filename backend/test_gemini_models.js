const { neon } = require('@neondatabase/serverless');
const crypto = require('crypto');

const DATABASE_URL = 'postgresql://neondb_owner:npg_UEDwf9IoB0OJ@ep-restless-dew-a195u2ag-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
const ENCRYPTION_KEY = '16400db40c1a96c10dadd2b0218ec92bcb210d7c3c237136fc8a80797ecee5a9'; // hex of key from env

function decrypt(text) {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = Buffer.from(parts.shift(), 'hex');
  const tag = Buffer.from(parts.shift(), 'hex');
  
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    iv
  );
  decipher.setAuthTag(tag);
  
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

async function testModel(apiKey, modelId) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${apiKey}`;
  const payload = {
    contents: [{ parts: [{ text: "di mana letak indonesia" }] }]
  };
  
  const start = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    const duration = Date.now() - start;
    if (res.ok) {
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(data);
      console.log(`✅ [${modelId}] Bekerja (${duration}ms) -> ${text.trim().substring(0, 80)}...`);
      return true;
    } else {
      console.log(`❌ [${modelId}] Gagal (${duration}ms) -> Status: ${res.status}, Error: ${data.error?.message || JSON.stringify(data)}`);
      return false;
    }
  } catch (err) {
    console.log(`❌ [${modelId}] Gagal -> ${err.message}`);
    return false;
  }
}

async function run() {
  const sql = neon(DATABASE_URL);
  const rows = await sql("SELECT credentials_ciphertext FROM provider_credentials WHERE provider_name = 'gemini' AND status = 'active' LIMIT 1");
  if (rows.length === 0) {
    console.error("No active Gemini credentials found in DB");
    return;
  }
  
  const decrypted = decrypt(rows[0].credentials_ciphertext);
  const parsed = JSON.parse(Buffer.from(decrypted, 'base64').toString('utf8'));
  const apiKey = parsed.raw?.api_key || parsed.api_key;
  
  if (!apiKey) {
    console.error("Failed to extract api_key");
    return;
  }
  
  console.log("Mulai mengetes model-model Gemini...");
  
  const modelsToTest = [
    'gemini-2.5-flash',
    'gemini-3.1-flash',
    'gemini-3.1-flash-lite',
    'gemini-3.1-flash-lite-preview',
    'gemini-3.5-flash',
    'gemini-1.5-flash'
  ];
  
  for (const model of modelsToTest) {
    await testModel(apiKey, model);
  }
}

run().catch(console.error);
