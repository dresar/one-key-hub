const { neon } = require('@neondatabase/serverless');

const DATABASE_URL = 'postgresql://neondb_owner:npg_UEDwf9IoB0OJ@ep-restless-dew-a195u2ag-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function run() {
  const sql = neon(DATABASE_URL);
  
  console.log("Menghapus model Gemini lama...");
  await sql("DELETE FROM ai_models WHERE provider = 'gemini'");
  
  console.log("Memasukkan model Gemini baru...");
  const newModels = [
    { provider: 'gemini', model_id: 'gemini-2.5-flash', display_name: 'Gemini 2.5 Flash', is_default: true, supports_vision: true },
    { provider: 'gemini', model_id: 'gemini-3.5-flash', display_name: 'Gemini 3.5 Flash', is_default: false, supports_vision: true },
    { provider: 'gemini', model_id: 'gemini-3.1-flash-lite', display_name: 'Gemini 3.1 Flash Lite', is_default: false, supports_vision: true },
    { provider: 'gemini', model_id: 'gemini-3.1-flash-lite-preview', display_name: 'Gemini 3.1 Flash Lite Preview', is_default: false, supports_vision: true }
  ];
  
  for (const m of newModels) {
    await sql(
      "INSERT INTO ai_models (provider, model_id, display_name, is_default, supports_vision) VALUES ($1, $2, $3, $4, $5)",
      [m.provider, m.model_id, m.display_name, m.is_default, m.supports_vision]
    );
  }
  
  console.log("✅ Berhasil memperbarui models di database!");
}

run().catch(console.error);
