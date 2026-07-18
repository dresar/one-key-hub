const { neon } = require('@neondatabase/serverless');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL is not set in backend/.env!");
  process.exit(1);
}

const sql = neon(dbUrl);

async function run() {
  try {
    const res = await sql`SELECT setval('provider_credentials_id_seq', COALESCE((SELECT MAX(id) FROM provider_credentials), 1), true);`;
    console.log("Success! Reset provider_credentials_id_seq sequence. Result:", res);
  } catch (err) {
    console.error("Error resetting sequence:", err);
  }
}

run();
