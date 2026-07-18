const { neon } = require('@neondatabase/serverless');

const DATABASE_URL = 'postgresql://neondb_owner:npg_UEDwf9IoB0OJ@ep-restless-dew-a195u2ag-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

async function run() {
  const sql = neon(DATABASE_URL);
  
  console.log("Dropping tables provider_credentials and request_logs CASCADE to apply new SERIAL ID types...");
  
  await sql("DROP TABLE IF EXISTS request_logs CASCADE");
  await sql("DROP TABLE IF EXISTS provider_credentials CASCADE");
  
  console.log("✅ Tables dropped successfully! When backend starts up, it will rebuild them with the new schema.");
}

run().catch(console.error);
