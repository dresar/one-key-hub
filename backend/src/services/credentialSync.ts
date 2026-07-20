import fs from 'fs';
import path from 'path';
import { db } from '../db/client';
import { providerCredentials } from '../db/schema';
import { isNull, eq, sql } from 'drizzle-orm';
import { decrypt } from '../lib/crypto';

async function syncProviderCredentialsSequence(): Promise<void> {
  try {
    await db.execute(
      sql`SELECT setval('provider_credentials_id_seq', COALESCE((SELECT MAX(id) FROM provider_credentials), 1), true);`
    );
  } catch (err) {
    console.error('[Sequence] Failed to sync provider_credentials_id_seq:', err);
  }
}

export interface CachedCredential {
  id: string | number;
  provider_name: string;
  label: string;
  status: 'active' | 'cooldown' | 'inactive';
  credentials: Record<string, string>;
  total_requests: number;
  failed_requests: number;
  last_error: string | null;
  cooldown_until: string | null;
}

const DATA_DIR = path.join(process.cwd(), 'data');

// Cache grouped by provider name in lowercase (e.g. { gemini: [...], groq: [...] })
let memoryCache: Record<string, CachedCredential[]> = {};

// Ensure local directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

/**
 * Save provider cache to its dedicated JSON file (e.g., data/gemini.json)
 */
function writeProviderCacheToFile(providerName: string): void {
  try {
    const key = providerName.toLowerCase();
    const filePath = path.join(DATA_DIR, `${key}.json`);
    const data = memoryCache[key] || [];
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`[Sync] Failed to write cache file for provider ${providerName}:`, err);
  }
}

/**
 * Load credentials from database, group by provider, write to individual JSON files, and save to memory.
 */
export async function initializeCredentialSync(): Promise<void> {
  try {
    console.log('[Sync] Loading credentials from database into provider JSON files...');
    const rows = await db
      .select()
      .from(providerCredentials)
      .where(isNull(providerCredentials.deletedAt));

    // Clear memory cache before populating
    const newCache: Record<string, CachedCredential[]> = {};

    for (const r of rows) {
      try {
        const decryptedBase64 = decrypt(r.credentialsCiphertext);
        const rawJson = Buffer.from(decryptedBase64, 'base64').toString('utf8');
        const parsed = JSON.parse(rawJson);

        const key = r.providerName.toLowerCase();
        if (!newCache[key]) {
          newCache[key] = [];
        }

        newCache[key].push({
          id: r.id,
          provider_name: r.providerName,
          label: r.label,
          status: r.status as any,
          credentials: parsed.raw || parsed || {},
          total_requests: r.totalRequests || 0,
          failed_requests: r.failedRequests || 0,
          last_error: r.lastError || null,
          cooldown_until: r.cooldownUntil ? new Date(r.cooldownUntil).toISOString() : null,
        });
      } catch (decErr) {
        console.error(`[Sync] Failed to decrypt key ID ${r.id}:`, decErr);
      }
    }

    memoryCache = newCache;

    // Write all to file system
    // Clear old JSON files that might have been completely deleted
    const existingFiles = fs.readdirSync(DATA_DIR);
    existingFiles.forEach(file => {
      if (file.endsWith('.json')) {
        const provName = path.basename(file, '.json');
        if (!newCache[provName]) {
          // If no active keys left for this provider, write an empty array to its json
          fs.writeFileSync(path.join(DATA_DIR, file), JSON.stringify([], null, 2), 'utf8');
        }
      }
    });

    Object.keys(newCache).forEach((prov) => {
      writeProviderCacheToFile(prov);
    });

    console.log(`[Sync] ✅ Local cache populated for providers: ${Object.keys(newCache).join(', ')}`);
  } catch (err) {
    console.error('[Sync] Neon database unreachable on initialization, falling back to local JSON files:', err);
    loadCacheFromLocalFiles();
  }
}

/**
 * Fallback to reading JSON files locally if Neon database is down.
 */
function loadCacheFromLocalFiles(): void {
  try {
    const files = fs.readdirSync(DATA_DIR);
    const newCache: Record<string, CachedCredential[]> = {};

    files.forEach((file) => {
      if (file.endsWith('.json')) {
        const providerName = path.basename(file, '.json').toLowerCase();
        try {
          const content = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
          newCache[providerName] = JSON.parse(content);
        } catch (readErr) {
          console.error(`[Sync] Failed to read fallback cache for ${file}:`, readErr);
        }
      }
    });

    memoryCache = newCache;
    console.log(`[Sync] ⚠️ Fallback loaded provider files: ${Object.keys(newCache).join(', ')}`);
  } catch (dirErr) {
    console.error('[Sync] Failed to read fallback local data directory:', dirErr);
  }
}

/**
 * Retrieve cached credentials list for a provider.
 */
export function getCachedCredentials(providerName?: string): CachedCredential[] {
  if (providerName) {
    return memoryCache[providerName.toLowerCase()] || [];
  }
  return Object.values(memoryCache).flat();
}

/**
 * Get the best active credential for a provider using load balancing (least requests).
 */
export function getBestCachedCredential(
  providerName: string, 
  targetModelId?: string,
  excludeIds: (string | number)[] = []
): CachedCredential | null {
  const key = providerName.toLowerCase();
  const providerList = memoryCache[key] || [];

  const excludedStr = excludeIds.map(id => String(id));

  // 1. Try to find active keys matching the specific modelId (or unbound keys)
  let candidates = providerList.filter(
    c => c.status === 'active' 
      && !excludedStr.includes(String(c.id))
      && (!targetModelId || !c.credentials.model_id || c.credentials.model_id === targetModelId)
  );

  // 2. Fallback to any active key for this provider not in excludeIds
  if (candidates.length === 0) {
    candidates = providerList.filter(
      c => c.status === 'active' && !excludedStr.includes(String(c.id))
    );
  }

  if (candidates.length === 0) return null;

  // Sort by total_requests ascending (least used first)
  candidates.sort((a, b) => a.total_requests - b.total_requests);

  return candidates[0] || null;
}

/**
 * Force full cache refresh (calls database).
 */
export async function syncDbCache(): Promise<void> {
  await initializeCredentialSync();
}

/**
 * Instantly updates stats/status locally in memory/JSON (no database call).
 */
export async function updateLocalCredentialStats(
  id: string | number,
  providerName: string,
  updates: Partial<Pick<CachedCredential, 'status' | 'total_requests' | 'failed_requests' | 'cooldown_until' | 'last_error'>>
): Promise<void> {
  const key = providerName.toLowerCase();
  const providerList = memoryCache[key] || [];

  const idx = providerList.findIndex(c => c.id === id || String(c.id) === String(id));
  if (idx !== -1) {
    providerList[idx] = { ...providerList[idx], ...updates };
    memoryCache[key] = providerList;
    writeProviderCacheToFile(key);
  }
}

/**
 * Local cooldown recovery running entirely in memory without database latency.
 */
export function recoverLocalCooldownCredentials(): void {
  const now = new Date();
  let updatedAny = false;

  Object.keys(memoryCache).forEach((providerName) => {
    const list = memoryCache[providerName] || [];
    list.forEach((cred) => {
      if (cred.status === 'cooldown' && cred.cooldown_until) {
        const cooldownTime = new Date(cred.cooldown_until);
        if (now >= cooldownTime) {
          cred.status = 'active';
          cred.cooldown_until = null;
          cred.failed_requests = 0;
          cred.last_error = null;
          updatedAny = true;

          console.log(`[Sync] Credential ${cred.id} (${cred.provider_name}) recovered from cooldown locally.`);
        }
      }
    });

    if (updatedAny) {
      writeProviderCacheToFile(providerName);
    }
  });
}

/**
 * Flush all in-memory stats/status modifications to Neon database.
 * Reduces Neon database load and consolidates write calls.
 */
export async function flushLocalCacheToDatabase(): Promise<void> {
  try {
    console.log('[Sync] Flushing memory/JSON stats and rotation state to Neon database...');
    
    // Fetch all current database records to compare
    const dbRows = await db
      .select()
      .from(providerCredentials);

    for (const cachedCred of Object.values(memoryCache).flat()) {
      // Find matching row in DB
      // We check by target key hash or previous id
      const dbRow = dbRows.find(
        (r) => r.keyHash === cachedCred.credentials.keyHash || r.id === Number(cachedCred.id)
      );

      if (dbRow) {
        // Compare stats
        const hasChanges =
          dbRow.status !== cachedCred.status ||
          dbRow.totalRequests !== cachedCred.total_requests ||
          dbRow.failedRequests !== cachedCred.failed_requests ||
          dbRow.lastError !== cachedCred.last_error ||
          (dbRow.cooldownUntil ? new Date(dbRow.cooldownUntil).toISOString() : null) !== cachedCred.cooldown_until ||
          dbRow.id !== Number(cachedCred.id);

        if (hasChanges) {
          const dbUpdates: any = {
            status: cachedCred.status,
            totalRequests: cachedCred.total_requests,
            failedRequests: cachedCred.failed_requests,
            lastError: cachedCred.last_error,
            cooldownUntil: cachedCred.cooldown_until ? new Date(cachedCred.cooldown_until) : null,
            updatedAt: new Date(),
          };

          // If id was shifted to error range (>= 100), we also update the primary key ID!
          if (dbRow.id !== Number(cachedCred.id)) {
            dbUpdates.id = Number(cachedCred.id);
          }

          await db
            .update(providerCredentials)
            .set(dbUpdates)
            .where(eq(providerCredentials.id, dbRow.id));

          if (dbRow.id !== Number(cachedCred.id)) {
            await syncProviderCredentialsSequence();
          }
            
          console.log(`[Sync] Synced stats for key ID ${cachedCred.id} (${cachedCred.provider_name}) to Neon.`);
        }
      }
    }
    console.log('[Sync] ✅ Local cache flush complete.');
  } catch (err) {
    console.error('[Sync] Error flushing local cache to database:', err);
  }
}
