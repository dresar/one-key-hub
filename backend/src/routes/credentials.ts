import { Router, Response } from 'express';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { providerCredentials, aiModels } from '../db/schema';
import { authenticate, AuthRequest } from '../middleware/auth';
import { encrypt, decrypt, hashValue } from '../lib/crypto';
import { credentialCache, statsCache } from '../lib/cache';
import { syncDbCache } from '../services/credentialSync';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

export async function getLowestAvailableId(): Promise<number> {
  const rows = await db
    .select({ id: providerCredentials.id })
    .from(providerCredentials)
    .where(isNull(providerCredentials.deletedAt));

  const activeIds = new Set(rows.map(r => r.id));
  let candidate = 1;
  while (activeIds.has(candidate)) {
    candidate++;
  }
  return candidate;
}

export async function syncProviderCredentialsSequence(): Promise<void> {
  try {
    await db.execute(
      sql`SELECT setval('provider_credentials_id_seq', COALESCE((SELECT GREATEST(MAX(id), 1) FROM provider_credentials), 1), true);`
    );
    console.log('[Sequence] provider_credentials_id_seq synced successfully.');
  } catch (err) {
    console.error('[Sequence] Failed to sync provider_credentials_id_seq:', err);
  }
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

export async function reindexAllCredentials(): Promise<{ updatedCount: number }> {
  try {
    // 1. Purge all soft-deleted rows from table so primary key IDs 1, 2, 3... are completely free!
    await db.execute(sql`DELETE FROM provider_credentials WHERE deleted_at IS NOT NULL;`);

    // 2. Select all remaining active rows sorted by current ID
    const rows = await db
      .select({ id: providerCredentials.id })
      .from(providerCredentials)
      .where(isNull(providerCredentials.deletedAt))
      .orderBy(providerCredentials.id);

    if (rows.length === 0) {
      await syncProviderCredentialsSequence();
      return { updatedCount: 0 };
    }

    // 3. Dynamic safe offset higher than any existing ID to prevent unique constraint collisions
    const maxCurrentId = Math.max(...rows.map(r => r.id), 0);
    const safeOffset = Math.max(maxCurrentId, 2000000) + 1000;

    // Shift all active rows to high temporary offset IDs
    for (let i = 0; i < rows.length; i++) {
      const oldId = rows[i].id;
      const tempId = safeOffset + i + 1;
      await db.execute(sql`UPDATE provider_credentials SET id = ${tempId} WHERE id = ${oldId}`);
    }

    // 4. Assign clean sequential IDs 1, 2, 3...
    for (let i = 0; i < rows.length; i++) {
      const tempId = safeOffset + i + 1;
      const newId = i + 1;
      await db.execute(sql`UPDATE provider_credentials SET id = ${newId} WHERE id = ${tempId}`);
    }

    await syncProviderCredentialsSequence();
    credentialCache.clear();
    statsCache.clear();
    await syncDbCache();

    console.log(`[Reindex] ✅ Reindexed ${rows.length} credentials to IDs 1..${rows.length}`);
    return { updatedCount: rows.length };
  } catch (err) {
    console.error('[Reindex] Error reindexing credentials:', err);
    throw err;
  }
}

// ─── All routes require JWT auth ──────────────────────────────────────────────
router.use(authenticate);

// ─── POST /api/credentials/reindex-ids ───────────────────────────────────────
router.post('/reindex-ids', async (req: AuthRequest, res: Response) => {
  try {
    const result = await reindexAllCredentials();
    res.json({
      success: true,
      message: `Berhasil mereset dan mengurutkan ulang ${result.updatedCount} ID credential menjadi 1, 2, 3...`,
      count: result.updatedCount,
    });
  } catch (err) {
    console.error('[Credentials] Reindex error:', err);
    res.status(500).json({ error: 'Gagal mengurutkan ulang ID credentials' });
  }
});

// ─── GET /api/credentials/next-id ─────────────────────────────────────────────
router.get('/next-id', async (req: AuthRequest, res: Response) => {
  try {
    const nextId = await getLowestAvailableId();
    res.json({ next_id: nextId });
  } catch (err) {
    console.error('[Credentials] Next ID error:', err);
    res.status(500).json({ error: 'Gagal mengambil next ID' });
  }
});

// ─── GET /api/credentials ─────────────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const rows = await db
      .select({
        id: providerCredentials.id,
        providerName: providerCredentials.providerName,
        label: providerCredentials.label,
        modelId: providerCredentials.modelId,
        status: providerCredentials.status,
        totalRequests: providerCredentials.totalRequests,
        failedRequests: providerCredentials.failedRequests,
        lastError: providerCredentials.lastError,
        cooldownUntil: providerCredentials.cooldownUntil,
        createdAt: providerCredentials.createdAt,
      })
      .from(providerCredentials)
      .where(isNull(providerCredentials.deletedAt))
      .orderBy(providerCredentials.id);

    const statusOrder: Record<string, number> = { active: 1, cooldown: 2, inactive: 3 };
    const items = rows
      .map((r) => ({
        id: r.id,
        provider_name: r.providerName,
        label: r.label,
        model_id: r.modelId,
        status: r.status,
        total_requests: r.totalRequests,
        failed_requests: r.failedRequests,
        last_error: r.lastError,
        cooldown_until: r.cooldownUntil,
        created_at: r.createdAt,
      }))
      .sort((a, b) => {
        if (statusOrder[a.status] !== statusOrder[b.status]) {
          return statusOrder[a.status] - statusOrder[b.status];
        }
        return a.id - b.id;
      });

    res.json({ items, total: items.length });
  } catch (err) {
    console.error('[Credentials] List error:', err);
    res.status(500).json({ error: 'Gagal memuat credentials' });
  }
});

// ─── GET /api/credentials/:id/reveal ──────────────────────────────────────────
router.get('/:id/reveal', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const rows = await db
      .select()
      .from(providerCredentials)
      .where(and(eq(providerCredentials.id, Number(id)), isNull(providerCredentials.deletedAt)))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ error: 'Credential tidak ditemukan' });
      return;
    }

    const cred = rows[0];
    let decrypted: Record<string, string> = {};

    try {
      const decryptedBase64 = decrypt(cred.credentialsCiphertext);
      const rawJson = Buffer.from(decryptedBase64, 'base64').toString('utf8');
      const parsed = JSON.parse(rawJson);
      decrypted = parsed.raw || parsed || {};
    } catch (decryptErr: any) {
      res.status(500).json({ error: 'Gagal mendekripsi credential', details: decryptErr.message });
      return;
    }

    res.json({
      id: cred.id,
      provider_name: cred.providerName,
      label: cred.label,
      credentials: decrypted,
    });
  } catch (err) {
    console.error('[Credentials] Reveal error:', err);
    res.status(500).json({ error: 'Gagal memuat detail credential' });
  }
});

// ─── POST /api/credentials/sync ───────────────────────────────────────────────
router.post('/sync', async (req: AuthRequest, res: Response) => {
  try {
    await syncDbCache();
    res.json({ success: true, message: 'Cache berhasil disinkronisasi dengan database' });
  } catch (err) {
    console.error('[Credentials] Sync error:', err);
    res.status(500).json({ error: 'Gagal menyinkronkan database dengan local cache' });
  }
});

// ─── POST /api/credentials ────────────────────────────────────────────────────
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { provider_name, label, credentials, model_id, custom_id } = req.body;

    if (!provider_name || !credentials || typeof credentials !== 'object') {
      res.status(400).json({ error: 'provider_name dan credentials wajib diisi' });
      return;
    }

    let targetId: number;

    if (custom_id !== undefined && custom_id !== null && custom_id !== '') {
      targetId = Number(custom_id);
      if (isNaN(targetId) || targetId < 1) {
        res.status(400).json({ error: 'ID / Prioritas harus berupa angka positif (>= 1)' });
        return;
      }

      // Check if targetId is already used by an active credential
      const existingActive = await db
        .select({ id: providerCredentials.id, label: providerCredentials.label })
        .from(providerCredentials)
        .where(and(eq(providerCredentials.id, targetId), isNull(providerCredentials.deletedAt)))
        .limit(1);

      if (existingActive.length > 0) {
        res.status(409).json({
          error: `⚠️ ID ${targetId} sudah digunakan oleh credential "${existingActive[0].label || 'Credential'}"! Harap gunakan ID lain yang belum ada.`
        });
        return;
      }
    } else {
      // Auto-assign lowest available GAP ID starting from 1!
      targetId = await getLowestAvailableId();
    }

    // Extract main key string if available (api_key, secret_key, private_key)
    const mainKeyStr = (credentials.api_key || credentials.secret_key || credentials.private_key || '').trim();

    // Hashes for duplicate detection
    const kHashFull = hashValue(JSON.stringify(credentials));
    const kHashKeyOnly = mainKeyStr ? hashValue(mainKeyStr) : null;

    // Check for duplicates in database
    const existing = await db
      .select({ id: providerCredentials.id, label: providerCredentials.label })
      .from(providerCredentials)
      .where(
        and(
          isNull(providerCredentials.deletedAt),
          kHashKeyOnly
            ? sql`${providerCredentials.keyHash} IN (${kHashFull}, ${kHashKeyOnly})`
            : eq(providerCredentials.keyHash, kHashFull)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      res.status(409).json({
        error: `⚠️ API Key ini sudah ada di database! (Sudah terdaftar dengan nama "${existing[0].label || 'Credential'}"). Silakan gunakan API Key yang berbeda.`
      });
      return;
    }

    const kHash = kHashKeyOnly || kHashFull;

    // Encrypt credentials
    const credentialsCiphertext = encrypt(
      Buffer.from(JSON.stringify({ raw: credentials })).toString('base64'),
    );

    // Purge any soft-deleted row with targetId to avoid primary key collision
    await db.delete(providerCredentials).where(eq(providerCredentials.id, targetId));

    const [created] = await db
      .insert(providerCredentials)
      .values({
        id: targetId,
        providerName: provider_name,
        label: label || `${provider_name.toUpperCase()} Key ${targetId}`,
        modelId: model_id || '',
        credentialsCiphertext,
        keyHash: kHash,
        status: 'active',
      })
      .returning({
        id: providerCredentials.id,
        providerName: providerCredentials.providerName,
        label: providerCredentials.label,
        modelId: providerCredentials.modelId,
        status: providerCredentials.status,
        createdAt: providerCredentials.createdAt,
      });

    await syncProviderCredentialsSequence();

    // Invalidate cache
    credentialCache.invalidate(provider_name);
    statsCache.clear();
    await syncDbCache();

    res.status(201).json({
      id: created.id,
      provider_name: created.providerName,
      label: created.label,
      model_id: created.modelId,
      status: created.status,
      created_at: created.createdAt,
    });
  } catch (err) {
    console.error('[Credentials] Create error:', err);
    res.status(500).json({ error: 'Gagal menyimpan credential' });
  }
});

// ─── PATCH /api/credentials/:id ───────────────────────────────────────────────
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const currentId = Number(id);
    const { label, credentials, status, model_id, custom_id, new_id } = req.body;

    const updateData: Partial<typeof providerCredentials.$inferInsert> = {
      updatedAt: new Date(),
    };

    let effectiveId = currentId;
    const targetNewId = custom_id !== undefined ? Number(custom_id) : new_id !== undefined ? Number(new_id) : null;

    if (targetNewId !== null && !isNaN(targetNewId) && targetNewId > 0 && targetNewId !== currentId) {
      // Check if targetNewId is used by another active credential
      const existingActive = await db
        .select({ id: providerCredentials.id, label: providerCredentials.label })
        .from(providerCredentials)
        .where(and(eq(providerCredentials.id, targetNewId), isNull(providerCredentials.deletedAt)))
        .limit(1);

      if (existingActive.length > 0) {
        res.status(409).json({
          error: `⚠️ ID ${targetNewId} sudah digunakan oleh credential "${existingActive[0].label}"! Harap gunakan ID lain.`
        });
        return;
      }

      // Purge soft-deleted row with targetNewId
      await db.delete(providerCredentials).where(eq(providerCredentials.id, targetNewId));

      // Execute raw SQL update to change Primary Key id
      await db.execute(sql`UPDATE provider_credentials SET id = ${targetNewId} WHERE id = ${currentId}`);
      effectiveId = targetNewId;
    }

    if (label !== undefined) updateData.label = label;
    if (status !== undefined) updateData.status = status;
    if (model_id !== undefined) updateData.modelId = model_id;

    // Update credentials if provided (non-empty)
    if (credentials && typeof credentials === 'object') {
      const rawCredentials = JSON.stringify(credentials);
      const kHash = hashValue(rawCredentials);
      updateData.credentialsCiphertext = encrypt(
        Buffer.from(JSON.stringify({ raw: credentials })).toString('base64'),
      );
      updateData.keyHash = kHash;
    }

    const [updated] = await db
      .update(providerCredentials)
      .set(updateData)
      .where(and(eq(providerCredentials.id, effectiveId), isNull(providerCredentials.deletedAt)))
      .returning({ id: providerCredentials.id, providerName: providerCredentials.providerName });

    if (!updated) {
      res.status(404).json({ error: 'Credential tidak ditemukan' });
      return;
    }

    await syncProviderCredentialsSequence();
    credentialCache.invalidate(updated.providerName);
    statsCache.clear();
    await syncDbCache();

    res.json({ message: `Credential ID #${effectiveId} berhasil diperbarui`, id: effectiveId });
  } catch (err) {
    console.error('[Credentials] Update error:', err);
    res.status(500).json({ error: 'Gagal memperbarui credential' });
  }
});

// ─── POST /api/credentials/bulk-delete ────────────────────────────────────────
router.post('/bulk-delete', async (req: AuthRequest, res: Response) => {
  try {
    const { ids, provider_name, status } = req.body;

    let targetIds: number[] = [];

    if (Array.isArray(ids) && ids.length > 0) {
      targetIds = ids.map(Number).filter(id => !isNaN(id));
    } else if (provider_name) {
      // Bulk delete by provider and optional status filter
      const conditions = [
        eq(providerCredentials.providerName, provider_name),
        isNull(providerCredentials.deletedAt),
      ];
      if (status) {
        conditions.push(eq(providerCredentials.status, status));
      }

      const rows = await db
        .select({ id: providerCredentials.id })
        .from(providerCredentials)
        .where(and(...conditions));

      targetIds = rows.map(r => r.id);
    }

    if (targetIds.length === 0) {
      res.status(400).json({ error: 'Tidak ada credential yang dipilih untuk dihapus' });
      return;
    }

    // Bulk soft-delete
    await db
      .update(providerCredentials)
      .set({ deletedAt: new Date(), status: 'inactive', updatedAt: new Date() })
      .where(sql`${providerCredentials.id} IN ${targetIds}`);

    credentialCache.clear();
    statsCache.clear();
    await syncDbCache();

    res.json({
      message: `${targetIds.length} credential berhasil dihapus`,
      deleted_count: targetIds.length,
      deleted_ids: targetIds,
    });
  } catch (err) {
    console.error('[Credentials] Bulk delete error:', err);
    res.status(500).json({ error: 'Gagal melakukan hapus massal credential' });
  }
});

// ─── DELETE /api/credentials/:id ──────────────────────────────────────────────
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const [deleted] = await db
      .update(providerCredentials)
      .set({ deletedAt: new Date(), status: 'inactive', updatedAt: new Date() })
      .where(and(eq(providerCredentials.id, Number(id)), isNull(providerCredentials.deletedAt)))
      .returning({ id: providerCredentials.id, providerName: providerCredentials.providerName });

    if (!deleted) {
      res.status(404).json({ error: 'Credential tidak ditemukan' });
      return;
    }

    credentialCache.invalidate(deleted.providerName);
    statsCache.clear();
    await syncDbCache();

    res.json({ message: 'Credential berhasil dihapus' });
  } catch (err) {
    console.error('[Credentials] Delete error:', err);
    res.status(500).json({ error: 'Gagal menghapus credential' });
  }
});

// ─── POST /api/credentials/:id/test ──────────────────────────────────────────
router.post('/:id/test', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const rows = await db
      .select()
      .from(providerCredentials)
      .where(and(eq(providerCredentials.id, Number(id)), isNull(providerCredentials.deletedAt)))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ error: 'Credential tidak ditemukan' });
      return;
    }

    const cred = rows[0];
    let decryptedCreds: Record<string, string> = {};

    try {
      const decryptedBase64 = decrypt(cred.credentialsCiphertext);
      const rawJson = Buffer.from(decryptedBase64, 'base64').toString('utf8');
      const parsed = JSON.parse(rawJson);
      decryptedCreds = parsed.raw || parsed || {};
    } catch (decryptErr: any) {
      res.status(500).json({ error: 'Gagal mendekripsi credential', details: decryptErr.message });
      return;
    }

    const provider = cred.providerName.toLowerCase();
    
    // Find the default model for this provider in the database to avoid hardcoding
    let defaultModelId = '';
    try {
      const dbModels = await db
        .select({ modelId: aiModels.modelId, isDefault: aiModels.isDefault })
        .from(aiModels)
        .where(eq(aiModels.provider, provider));
      
      const defaultMatch = dbModels.find(m => m.isDefault) || dbModels[0];
      defaultModelId = defaultMatch?.modelId || '';
    } catch (dbErr) {
      console.error('[Credentials Test] Error fetching model from DB:', dbErr);
    }

    const prompt = 'di mana letak indonesia';
    let testSuccess = false;
    let answerText = '';
    let errorDetail = '';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      if (provider === 'gemini') {
        const apiKey = decryptedCreds.api_key;
        const geminiModel = defaultModelId || 'gemini-2.5-flash';
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
            }),
            signal: controller.signal,
          }
        );
        const data = await response.json();
        if (response.ok) {
          testSuccess = true;
          answerText = data?.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(data);
        } else {
          errorDetail = data?.error?.message || `HTTP ${response.status}`;
        }
      } else if (provider === 'groq') {
        const apiKey = decryptedCreds.api_key;
        const groqModel = defaultModelId || 'llama-3.3-70b-versatile';
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: groqModel,
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: controller.signal,
        });
        const data = await response.json();
        if (response.ok) {
          testSuccess = true;
          answerText = data?.choices?.[0]?.message?.content || JSON.stringify(data);
        } else {
          errorDetail = data?.error?.message || `HTTP ${response.status}`;
        }
      } else if (provider === 'openai') {
        const apiKey = decryptedCreds.api_key;
        const openaiModel = defaultModelId || 'gpt-4o-mini';
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: openaiModel,
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: controller.signal,
        });
        const data = await response.json();
        if (response.ok) {
          testSuccess = true;
          answerText = data?.choices?.[0]?.message?.content || JSON.stringify(data);
        } else {
          errorDetail = data?.error?.message || `HTTP ${response.status}`;
        }
      } else if (provider === 'anthropic') {
        const apiKey = decryptedCreds.api_key;
        const anthropicModel = defaultModelId || 'claude-3-5-haiku-20241022';
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: anthropicModel,
            max_tokens: 1024,
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: controller.signal,
        });
        const data = await response.json();
        if (response.ok) {
          testSuccess = true;
          answerText = data?.content?.[0]?.text || JSON.stringify(data);
        } else {
          errorDetail = data?.error?.message || `HTTP ${response.status}`;
        }
      } else if (provider === 'mistral') {
        const apiKey = decryptedCreds.api_key;
        const mistralModel = defaultModelId || 'mistral-large-latest';
        const response = await fetch('https://api.mistral.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: mistralModel,
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: controller.signal,
        });
        const data = await response.json();
        if (response.ok) {
          testSuccess = true;
          answerText = data?.choices?.[0]?.message?.content || JSON.stringify(data);
        } else {
          errorDetail = data?.error?.message || `HTTP ${response.status}`;
        }
      } else if (provider === 'cohere') {
        const apiKey = decryptedCreds.api_key;
        const cohereModel = defaultModelId || 'command-r-plus-08-2024';
        const response = await fetch('https://api.cohere.ai/v1/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: cohereModel,
            message: prompt,
          }),
          signal: controller.signal,
        });
        const data = await response.json();
        if (response.ok) {
          testSuccess = true;
          answerText = data?.text || JSON.stringify(data);
        } else {
          errorDetail = data?.message || `HTTP ${response.status}`;
        }
      } else if (provider === 'together') {
        const apiKey = decryptedCreds.api_key;
        const togetherModel = defaultModelId || 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo';
        const response = await fetch('https://api.together.xyz/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: togetherModel,
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: controller.signal,
        });
        const data = await response.json();
        if (response.ok) {
          testSuccess = true;
          answerText = data?.choices?.[0]?.message?.content || JSON.stringify(data);
        } else {
          errorDetail = data?.error?.message || `HTTP ${response.status}`;
        }
      } else if (provider === 'perplexity') {
        const apiKey = decryptedCreds.api_key;
        const perplexityModel = defaultModelId || 'llama-3.1-sonar-small-128k-online';
        const response = await fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: perplexityModel,
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: controller.signal,
        });
        const data = await response.json();
        if (response.ok) {
          testSuccess = true;
          answerText = data?.choices?.[0]?.message?.content || JSON.stringify(data);
        } else {
          errorDetail = data?.error?.message || `HTTP ${response.status}`;
        }
      } else if (provider === 'deepseek') {
        const apiKey = decryptedCreds.api_key;
        const deepseekModel = defaultModelId || 'deepseek-chat';
        const response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: deepseekModel,
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: controller.signal,
        });
        const data = await response.json();
        if (response.ok) {
          testSuccess = true;
          answerText = data?.choices?.[0]?.message?.content || JSON.stringify(data);
        } else {
          errorDetail = data?.error?.message || `HTTP ${response.status}`;
        }
      } else if (provider === 'cerebras') {
        const apiKey = decryptedCreds.api_key;
        const cerebrasModel = defaultModelId || 'llama3.1-8b';
        const response = await fetch('https://api.cerebras.ai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: cerebrasModel,
            messages: [{ role: 'user', content: prompt }],
          }),
          signal: controller.signal,
        });
        const data = await response.json();
        if (response.ok) {
          testSuccess = true;
          answerText = data?.choices?.[0]?.message?.content || JSON.stringify(data);
        } else {
          errorDetail = data?.error?.message || `HTTP ${response.status}`;
        }
      } else if (provider === 'huggingface') {
        const apiKey = decryptedCreds.api_key;
        const hfModel = defaultModelId || 'mistralai/Mistral-7B-Instruct-v0.3';
        const response = await fetch(
          `https://api-inference.huggingface.co/models/${hfModel}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ inputs: prompt }),
            signal: controller.signal,
          }
        );
        const data = await response.json();
        if (response.ok) {
          testSuccess = true;
          answerText = Array.isArray(data)
            ? data[0]?.generated_text || JSON.stringify(data)
            : data?.generated_text || JSON.stringify(data);
        } else {
          errorDetail = data?.error || `HTTP ${response.status}`;
        }
      } else if (provider === 'openweather') {
        const apiKey = decryptedCreds.api_key;
        const response = await fetch(
          `https://api.openweathermap.org/data/2.5/weather?q=Jakarta&appid=${apiKey}`,
          { signal: controller.signal }
        );
        const data = await response.json();
        if (response.ok) {
          testSuccess = true;
          answerText = `Weather OK: Temp ${data?.main?.temp}K, Jakarta`;
        } else {
          errorDetail = data?.message || `HTTP ${response.status}`;
        }
      } else if (provider === 'newsapi') {
        const apiKey = decryptedCreds.api_key;
        const response = await fetch(
          `https://newsapi.org/v2/top-headlines?country=id&apiKey=${apiKey}`,
          { signal: controller.signal }
        );
        const data = await response.json();
        if (response.ok) {
          testSuccess = true;
          answerText = `News OK: Found ${data?.totalResults} articles`;
        } else {
          errorDetail = data?.message || `HTTP ${response.status}`;
        }
      } else if (provider === 'apify') {
        const token = decryptedCreds.api_token || decryptedCreds.api_key;
        const response = await fetch(`https://api.apify.com/v2/users/me?token=${token}`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (response.ok) {
          testSuccess = true;
          answerText = `Apify OK: User ${data?.data?.username || data?.data?.email}`;
        } else {
          errorDetail = data?.error?.message || `HTTP ${response.status}`;
        }
      } else if (provider === 'imagekit') {
        const publicKey = decryptedCreds.public_key;
        const privateKey = decryptedCreds.private_key;
        const urlEndpoint = decryptedCreds.url_endpoint;
        const authString = Buffer.from(`${privateKey}:`).toString('base64');
        const response = await fetch(`https://api.imagekit.io/v1/metadata?url=${urlEndpoint}/default-image.jpg`, {
          headers: { Authorization: `Basic ${authString}` },
          signal: controller.signal,
        });
        if (response.ok || response.status === 404) {
          testSuccess = true;
          answerText = `ImageKit OK: Connected (HTTP ${response.status})`;
        } else {
          const text = await response.text();
          errorDetail = `HTTP ${response.status}: ${text}`;
        }
      } else if (provider === 'cloudinary') {
        const cloudName = decryptedCreds.cloud_name;
        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/ping`, {
          signal: controller.signal,
        });
        if (response.ok) {
          testSuccess = true;
          answerText = 'Cloudinary OK: Ping successful';
        } else {
          errorDetail = `HTTP ${response.status}`;
        }
      } else if (provider === 'rapidapi') {
        const apiKey = decryptedCreds.api_key;
        const host = decryptedCreds.rapidapi_host;
        const response = await fetch(`https://${host}`, {
          headers: { 'x-rapidapi-key': apiKey, 'x-rapidapi-host': host },
          signal: controller.signal,
        });
        if (response.ok || response.status < 500) {
          testSuccess = true;
          answerText = `RapidAPI OK: Server responded with HTTP ${response.status}`;
        } else {
          errorDetail = `RapidAPI host unreachable: HTTP ${response.status}`;
        }
      } else if (provider === 'uploadcare') {
        const publicKey = decryptedCreds.public_key;
        const secretKey = decryptedCreds.secret_key;
        const response = await fetch('https://api.uploadcare.com/project/', {
          headers: {
            Authorization: `Uploadcare.Simple ${publicKey}:${secretKey}`,
          },
          signal: controller.signal,
        });
        const data = await response.json();
        if (response.ok) {
          testSuccess = true;
          answerText = `Uploadcare OK: Connected to project "${data?.name || 'Unnamed'}"`;
        } else {
          errorDetail = data?.detail || `HTTP ${response.status}`;
        }
      } else if (provider === 'removebg') {
        const apiKey = decryptedCreds.api_key;
        const response = await fetch('https://api.remove.bg/v1.0/account', {
          headers: { 'X-Api-Key': apiKey },
          signal: controller.signal,
        });
        const data = await response.json();
        if (response.ok) {
          testSuccess = true;
          const credits = data?.data?.attributes?.credits || {};
          const total = credits.total !== undefined ? credits.total : 'unknown';
          answerText = `Remove.bg OK: Connected successfully. Credits balance: ${total}`;
        } else {
          errorDetail = data?.errors?.[0]?.title || `HTTP ${response.status}`;
        }
      } else if (provider === 'pexels') {
        const apiKey = decryptedCreds.api_key;
        const response = await fetch('https://api.pexels.com/v1/curated?per_page=1', {
          headers: { Authorization: apiKey },
          signal: controller.signal,
        });
        if (response.ok) {
          testSuccess = true;
          answerText = 'Pexels OK: Connected successfully. Curated list accessed.';
        } else {
          errorDetail = `HTTP ${response.status}`;
        }
      } else if (provider === 'pixabay') {
        const apiKey = decryptedCreds.api_key;
        const response = await fetch(`https://pixabay.com/api/?key=${apiKey}&per_page=3`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (response.ok && Array.isArray(data?.hits)) {
          testSuccess = true;
          answerText = 'Pixabay OK: Connected successfully.';
        } else {
          errorDetail = data?.error || `HTTP ${response.status}`;
        }
      } else if (provider === 'unsplash') {
        const apiKey = decryptedCreds.api_key;
        const response = await fetch('https://api.unsplash.com/photos?per_page=1', {
          headers: { Authorization: `Client-ID ${apiKey}` },
          signal: controller.signal,
        });
        if (response.ok) {
          testSuccess = true;
          answerText = 'Unsplash OK: Connected successfully.';
        } else {
          errorDetail = `HTTP ${response.status}`;
        }
      } else if (provider === 'giphy') {
        const apiKey = decryptedCreds.api_key;
        const response = await fetch(`https://api.giphy.com/v1/gifs/trending?api_key=${apiKey}&limit=1`, {
          signal: controller.signal,
        });
        const data = await response.json();
        if (response.ok && data?.meta?.status === 200) {
          testSuccess = true;
          answerText = 'Giphy OK: Connected successfully.';
        } else {
          errorDetail = data?.meta?.msg || `HTTP ${response.status}`;
        }
      } else {
        errorDetail = `Provider ${provider} tidak memiliki konfigurasi testing otomatis`;
      }
    } catch (err: any) {
      errorDetail = err.message || 'Koneksi gagal atau timeout';
    } finally {
      clearTimeout(timeoutId);
    }

    if (errorDetail) {
      errorDetail = errorDetail
        .replace(/AIzaSy[A-Za-z0-9_-]+/g, '[API_KEY]')
        .replace(/gsk_[A-Za-z0-9_-]+/g, '[API_KEY]')
        .replace(/key:\s*[A-Za-z0-9_-]+/g, 'key: [API_KEY]');
    }

    if (testSuccess) {
      // If manual test succeeds, reset failedRequests to 0, clear lastError, and set status to active
      await db
        .update(providerCredentials)
        .set({
          status: 'active',
          failedRequests: 0,
          lastError: null,
          updatedAt: new Date()
        })
        .where(eq(providerCredentials.id, Number(id)));

      credentialCache.invalidate(cred.providerName);
      statsCache.clear();
      await syncDbCache();

      res.json({ success: true, text: answerText });
    } else {
      // If manual test fails, increment failedRequests
      const newFailedCount = (cred.failedRequests || 0) + 1;
      const targetId = Number(id) < 100 ? await pushIdToErrorRange(Number(id)) : Number(id);

      if (newFailedCount >= 100) {
        // Soft delete the credential and update its id/lastError
        await db
          .update(providerCredentials)
          .set({
            id: targetId,
            failedRequests: newFailedCount,
            status: 'inactive',
            lastError: errorDetail,
            deletedAt: new Date(),
            updatedAt: new Date()
          })
          .where(eq(providerCredentials.id, Number(id)));

        if (targetId !== Number(id)) {
          await syncProviderCredentialsSequence();
        }

        credentialCache.invalidate(cred.providerName);
        statsCache.clear();
        await syncDbCache();

        res.status(400).json({ 
          success: false, 
          error: `${errorDetail}. API Key telah mencapai 100 kali error dan otomatis dihapus.`
        });
      } else {
        // Set status to inactive, update id/lastError and increment failure counter
        await db
          .update(providerCredentials)
          .set({
            id: targetId,
            failedRequests: newFailedCount,
            status: 'inactive',
            lastError: errorDetail,
            updatedAt: new Date()
          })
          .where(eq(providerCredentials.id, Number(id)));

        if (targetId !== Number(id)) {
          await syncProviderCredentialsSequence();
        }

        credentialCache.invalidate(cred.providerName);
        statsCache.clear();
        await syncDbCache();

        res.status(400).json({ success: false, error: errorDetail });
      }
    }
  } catch (err) {
    console.error('[Credentials] Test error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan sistem saat mengetes key' });
  }
});

export default router;
