import 'dotenv/config';
import { db } from './db/client';
import { providerCredentials } from './db/schema';
import { eq, isNull, and } from 'drizzle-orm';
import { decrypt } from './lib/crypto';
import axios from 'axios';
import { initializeCredentialSync } from './services/credentialSync';

async function cleanInvalidKeys() {
  console.log('🧹 Testing all Gemini credentials in database and pruning invalid/suspended keys...');

  const rows = await db
    .select()
    .from(providerCredentials)
    .where(and(eq(providerCredentials.providerName, 'gemini'), isNull(providerCredentials.deletedAt)));

  console.log(`Found ${rows.length} Gemini credentials in database.`);

  let activeCount = 0;
  let inactiveCount = 0;

  for (const r of rows) {
    try {
      const decryptedBase64 = decrypt(r.credentialsCiphertext);
      const rawJson = Buffer.from(decryptedBase64, 'base64').toString('utf8');
      const parsed = JSON.parse(rawJson);
      const apiKey = parsed.raw?.api_key || parsed.api_key;

      if (!apiKey) {
        await db.update(providerCredentials).set({ status: 'inactive', lastError: 'Missing API key' }).where(eq(providerCredentials.id, r.id));
        inactiveCount++;
        continue;
      }

      // Test with gemini-2.0-flash
      const res = await axios.post(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
        { contents: [{ parts: [{ text: 'Tes 1 kata "READY".' }] }] },
        { timeout: 4000 }
      );

      if (res.data?.candidates?.[0]) {
        await db.update(providerCredentials).set({ status: 'active', failedRequests: 0, cooldownUntil: null, lastError: null }).where(eq(providerCredentials.id, r.id));
        console.log(`  ✅ Key ID #${r.id} (${r.label}) -> VALID & ACTIVE`);
        activeCount++;
      } else {
        await db.update(providerCredentials).set({ status: 'inactive', lastError: 'Invalid response' }).where(eq(providerCredentials.id, r.id));
        inactiveCount++;
      }
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || err.message;
      await db.update(providerCredentials).set({ status: 'inactive', lastError: msg }).where(eq(providerCredentials.id, r.id));
      console.log(`  ❌ Key ID #${r.id} (${r.label}) -> INACTIVE (${msg})`);
      inactiveCount++;
    }
  }

  await initializeCredentialSync();
  console.log(`\n✨ Done! ${activeCount} keys set to ACTIVE, ${inactiveCount} keys set to INACTIVE.`);
  process.exit(0);
}

cleanInvalidKeys().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
