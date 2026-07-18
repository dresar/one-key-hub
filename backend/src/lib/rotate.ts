import { eq, and, isNull, asc } from 'drizzle-orm';
import { db } from '../db/client';
import { providerCredentials } from '../db/schema';
import { decrypt } from './crypto';
import { credentialCache, statsCache } from './cache';
import { getCachedCredentials, updateLocalCredentialStats, syncDbCache, recoverLocalCooldownCredentials } from '../services/credentialSync';
import { syncProviderCredentialsSequence } from '../routes/credentials';

// ─── Credential Rotation Engine ──────────────────────────────────────────────

const COOLDOWN_DURATION_MS = 5 * 60 * 1000; // 5 minutes default cooldown
const MAX_FAILED_REQUESTS = 1; // Auto-cooldown after 1 failure (instant rotation)

/**
 * Get the best active credential for a given provider.
 * Uses cache first, then DB. Falls back across providers if fallback_enabled.
 */
export async function getActiveCredential(
  providerName: string,
): Promise<{ id: string; credentials: Record<string, string> } | null> {
  const cacheKey = `active:${providerName}`;
  const cached = credentialCache.get(cacheKey);

  if (cached) return cached[0] || null;

  const list = getCachedCredentials(providerName);
  const mapped = list
    .filter(c => c.status === 'active')
    .map(c => ({ id: String(c.id), credentials: c.credentials }));

  if (mapped.length === 0) return null;

  credentialCache.set(cacheKey, mapped, 60_000);
  return mapped[0] || null;
}

async function pushIdToErrorRange(currentId: number): Promise<number> {
  if (currentId >= 100) return currentId;
  const allCreds = await db.select({ id: providerCredentials.id }).from(providerCredentials);
  const existingIds = allCreds.map((c) => c.id);
  let targetId = 100;
  while (existingIds.includes(targetId)) {
    targetId++;
  }
  return targetId;
}

/**
 * Mark a credential as failed. Auto-cooldown if failures exceed threshold.
 */
export async function reportCredentialFailure(
  credentialId: string,
  errorMessage?: string,
): Promise<void> {
  const cachedItems = getCachedCredentials();
  const cred = cachedItems.find(c => String(c.id) === String(credentialId));
  if (!cred) return;

  if (errorMessage) {
    errorMessage = errorMessage
      .replace(/AIzaSy[A-Za-z0-9_-]+/g, '[API_KEY]')
      .replace(/gsk_[A-Za-z0-9_-]+/g, '[API_KEY]')
      .replace(/key:\s*[A-Za-z0-9_-]+/g, 'key: [API_KEY]');
  }

  const newFailedCount = (cred.failed_requests || 0) + 1;
  const currentNumericId = Number(cred.id);
  const targetId = currentNumericId < 100 ? await pushIdToErrorRange(currentNumericId) : currentNumericId;

  if (newFailedCount >= 100) {
    // Soft delete locally and in DB
    await updateLocalCredentialStats(cred.id, cred.provider_name, {
      id: targetId,
      failed_requests: newFailedCount,
      status: 'inactive',
      last_error: errorMessage || 'Error count reached 100',
    });
    
    // Perform database soft delete updates and change ID to error range immediately (soft-deletes are permanent)
    await db
      .update(providerCredentials)
      .set({
        id: targetId,
        lastError: errorMessage || 'Error count reached 100',
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(providerCredentials.id, currentNumericId));

    if (targetId !== currentNumericId) {
      await syncProviderCredentialsSequence();
    }

    // Force full cache reload
    await syncDbCache();

    console.log(
      `[Rotate] Credential ${cred.id} (${cred.provider_name}) automatically DELETED because error count reached 100`,
    );
  } else if (newFailedCount >= MAX_FAILED_REQUESTS) {
    // Put into cooldown locally only (write-behind DB flush will sync this)
    const cooldownUntil = new Date(Date.now() + COOLDOWN_DURATION_MS);

    await updateLocalCredentialStats(cred.id, cred.provider_name, {
      id: targetId,
      failed_requests: newFailedCount,
      status: 'cooldown',
      cooldown_until: cooldownUntil.toISOString(),
      last_error: errorMessage || 'Cooldown recovery',
    });

    console.log(
      `[Rotate] Credential ${cred.id} (${cred.provider_name}) put in cooldown locally until ${cooldownUntil.toISOString()}`,
    );
  } else {
    // Increment failure count locally only (write-behind DB flush will sync this)
    await updateLocalCredentialStats(cred.id, cred.provider_name, {
      id: targetId,
      failed_requests: newFailedCount,
    });
  }
}

/**
 * Increment usage counter for a credential (non-blocking).
 */
export function incrementCredentialUsage(credentialId: string, providerName: string): void {
  const cachedItems = getCachedCredentials(providerName);
  const targetItem = cachedItems.find(c => String(c.id) === String(credentialId));
  if (targetItem) {
    const newTotal = (targetItem.total_requests || 0) + 1;
    updateLocalCredentialStats(credentialId, providerName, { total_requests: newTotal });
  }
}

/**
 * Auto-recover credentials from cooldown locally. Run every 60 seconds via scheduler.
 */
export async function recoverCooldownCredentials(): Promise<void> {
  recoverLocalCooldownCredentials();
}
