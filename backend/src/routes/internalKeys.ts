import { Router, Request, Response } from 'express';
import { and, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import { providerCredentials } from '../db/schema';
import { decrypt } from '../lib/crypto';
import { reportCredentialFailure } from '../lib/rotate';

const router = Router();

// ─── GET /api/v1/keys/active?provider=GOOGLE ─────────────────────────────────
// Internal endpoint: Returns decrypted credentials for active provider key
router.get('/keys/active', async (req: Request, res: Response) => {
  try {
    const provider = (req.query.provider as string || '').toLowerCase();

    if (!provider) {
      res.status(400).json({ error: 'provider query parameter wajib diisi' });
      return;
    }

    const rows = await db
      .select()
      .from(providerCredentials)
      .where(
        and(
          eq(providerCredentials.providerName, provider),
          eq(providerCredentials.status, 'active'),
          isNull(providerCredentials.deletedAt),
        ),
      )
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ error: `No active credentials for provider: ${provider}` });
      return;
    }

    const cred = rows[0];

    // Decrypt credentials
    let rawCredentials: Record<string, string> = {};
    try {
      const decrypted = decrypt(cred.credentialsCiphertext);
      const parsed = JSON.parse(Buffer.from(decrypted, 'base64').toString('utf8'));
      rawCredentials = parsed.raw || parsed;
    } catch (decryptErr) {
      console.error('[InternalKeys] Decrypt error:', decryptErr);
      res.status(500).json({ error: 'Gagal mendekripsi credentials' });
      return;
    }

    res.json({
      id: cred.id,
      provider_name: cred.providerName,
      credentials: rawCredentials,
      status: cred.status,
    });
  } catch (err) {
    console.error('[InternalKeys] active error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /api/v1/keys/report-error ──────────────────────────────────────────
// Internal endpoint: Report credential failure → triggers rotation
router.post('/keys/report-error', async (req: Request, res: Response) => {
  try {
    const { credential_id, error_message } = req.body;

    if (!credential_id) {
      res.status(400).json({ error: 'credential_id wajib diisi' });
      return;
    }

    await reportCredentialFailure(credential_id, error_message);

    res.json({ message: 'Error dilaporkan. Rotasi otomatis dijalankan jika perlu.' });
  } catch (err) {
    console.error('[InternalKeys] report-error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /api/v1/keys/stats ───────────────────────────────────────────────────
router.get('/keys/stats', async (req: Request, res: Response) => {
  try {
    const provider = (req.query.provider as string || '').toLowerCase();

    const conditions = [isNull(providerCredentials.deletedAt)];
    if (provider) {
      conditions.push(eq(providerCredentials.providerName, provider));
    }

    const rows = await db
      .select({
        provider_name: providerCredentials.providerName,
        status: providerCredentials.status,
      })
      .from(providerCredentials)
      .where(and(...conditions));

    // Aggregate by provider
    const byProvider: Record<string, { active: number; cooldown: number; inactive: number }> = {};

    for (const row of rows) {
      if (!byProvider[row.provider_name]) {
        byProvider[row.provider_name] = { active: 0, cooldown: 0, inactive: 0 };
      }
      const st = row.status as 'active' | 'cooldown' | 'inactive';
      if (byProvider[row.provider_name][st] !== undefined) {
        byProvider[row.provider_name][st]++;
      }
    }

    res.json({ stats: byProvider });
  } catch (err) {
    console.error('[InternalKeys] stats error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
