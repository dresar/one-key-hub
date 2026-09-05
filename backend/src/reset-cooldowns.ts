import 'dotenv/config';
import { db } from './db/client';
import { providerCredentials } from './db/schema';
import { sql } from 'drizzle-orm';
import { initializeCredentialSync } from './services/credentialSync';

async function resetAllToActive() {
  console.log('🔄 Resetting all provider credentials to "active" status...');
  await db.execute(sql`UPDATE provider_credentials SET status = 'active', failed_requests = 0, cooldown_until = NULL, last_error = NULL WHERE deleted_at IS NULL;`);
  await initializeCredentialSync();
  console.log('✅ All credentials reset to active status!');
  process.exit(0);
}

resetAllToActive().catch(err => {
  console.error(err);
  process.exit(1);
});
