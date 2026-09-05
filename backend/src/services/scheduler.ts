import { recoverCooldownCredentials } from '../lib/rotate';
import { flushLocalCacheToDatabase } from './credentialSync';

// ─── Scheduler: Auto-recovery cron using setInterval ─────────────────────────
// Lightweight cron — no external library needed. cPanel-safe.

let schedulerRunning = false;

export function startScheduler(): void {
  if (schedulerRunning) return;
  schedulerRunning = true;

  console.log('[Scheduler] Starting background jobs...');

  // Auto-recover cooldown credentials every 60 seconds
  setInterval(async () => {
    try {
      await recoverCooldownCredentials();
    } catch (err) {
      console.warn('[Scheduler] Cooldown recovery error:', err);
    }
  }, 60_000);

  // Periodically flush local cache state to Neon DB every 5 minutes
  setInterval(async () => {
    try {
      await flushLocalCacheToDatabase();
    } catch (err) {
      console.warn('[Scheduler] Cache database flush error:', err);
    }
  }, 300_000);

  console.log('[Scheduler] ✅ Cooldown recovery job: every 60 seconds');
  console.log('[Scheduler] ✅ Cache database flush job: every 5 minutes');
}
