import 'dotenv/config';
import { db } from './db/client';
import { providerCredentials } from './db/schema';
import { eq, isNull, and } from 'drizzle-orm';
import { decrypt } from './lib/crypto';
import axios from 'axios';
import { initializeCredentialSync } from './services/credentialSync';

// List of verified working API Key prefixes or full keys
const verifiedWorkingPrefixes = [
  'AQ.Ab8RN6ICecdQ',
  'AQ.Ab8RN6KefbEE',
  'AQ.Ab8RN6JyayEm',
  'AQ.Ab8RN6IhnnoI',
  'AQ.Ab8RN6JFKOVw'
];

async function keepOnlyValidKeys() {
  console.log('🧹 Purging suspended/expired keys from active rotation and keeping ONLY working keys...');

  const rows = await db
    .select()
    .from(providerCredentials)
    .where(and(eq(providerCredentials.providerName, 'gemini'), isNull(providerCredentials.deletedAt)));

  let kept = 0;
  let deactivated = 0;

  for (const r of rows) {
    try {
      const decryptedBase64 = decrypt(r.credentialsCiphertext);
      const rawJson = Buffer.from(decryptedBase64, 'base64').toString('utf8');
      const parsed = JSON.parse(rawJson);
      const apiKey = parsed.raw?.api_key || parsed.api_key || '';

      const isValid = verifiedWorkingPrefixes.some(prefix => apiKey.startsWith(prefix));

      if (isValid) {
        await db.update(providerCredentials).set({
          status: 'active',
          failedRequests: 0,
          cooldownUntil: null,
          lastError: null
        }).where(eq(providerCredentials.id, r.id));
        console.log(`  ✅ KEEP ACTIVE: Key ID #${r.id} (${r.label}) -> ${apiKey.substring(0, 15)}...`);
        kept++;
      } else {
        await db.update(providerCredentials).set({
          status: 'inactive',
          lastError: 'Suspended or expired on Google'
        }).where(eq(providerCredentials.id, r.id));
        console.log(`  🚫 SET INACTIVE: Key ID #${r.id} (${r.label})`);
        deactivated++;
      }
    } catch (err: any) {
      await db.update(providerCredentials).set({
        status: 'inactive',
        lastError: err.message
      }).where(eq(providerCredentials.id, r.id));
      deactivated++;
    }
  }

  await initializeCredentialSync();
  console.log(`\n✨ Done! ${kept} Working Keys are ACTIVE. ${deactivated} Expired/Suspended Keys set to INACTIVE.`);
  process.exit(0);
}

keepOnlyValidKeys().catch(err => {
  console.error(err);
  process.exit(1);
});
