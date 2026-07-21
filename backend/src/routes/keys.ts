import { Router, Response } from 'express';
import { eq, and, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import { gatewayKeys, cdnFiles } from '../db/schema';
import { authenticate, AuthRequest } from '../middleware/auth';
import { generateGatewayKey, hashValue, keyPreview } from '../lib/crypto';
import { gatewayKeyCache, statsCache } from '../lib/cache';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// ─── All routes require JWT auth ──────────────────────────────────────────────
router.use(authenticate);

// ─── GET /api/keys ────────────────────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const rows = await db
      .select({
        id: gatewayKeys.id,
        name: gatewayKeys.name,
        status: gatewayKeys.status,
        quotaPerMinute: gatewayKeys.quotaPerMinute,
        allowedProviders: gatewayKeys.allowedProviders,
        provider: gatewayKeys.provider,
        modelType: gatewayKeys.modelType,
        modelId: gatewayKeys.modelId,
        tenantId: gatewayKeys.tenantId,
        keyPreview: gatewayKeys.keyPreview,
        createdAt: gatewayKeys.createdAt,
      })
      .from(gatewayKeys)
      .where(isNull(gatewayKeys.deletedAt))
      .orderBy(gatewayKeys.createdAt);

    const items = rows.map((r) => ({
      id: r.id,
      name: r.name,
      status: r.status,
      quota_per_minute: r.quotaPerMinute,
      allowed_providers: r.allowedProviders,
      provider: r.provider,
      model_type: r.modelType,
      model_id: r.modelId,
      tenant_id: r.tenantId,
      key_preview: r.keyPreview,
      created_at: r.createdAt,
      health: null,
    }));

    res.json({ items, total: items.length });
  } catch (err) {
    console.error('[Keys] List error:', err);
    res.status(500).json({ error: 'Gagal memuat gateway keys' });
  }
});

// ─── POST /api/keys ───────────────────────────────────────────────────────────
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { name, quota_per_minute, allowed_providers, provider, model_type, model_id } = req.body;

    const { plaintext, tenantId } = generateGatewayKey();
    const kHash = hashValue(plaintext);
    const kPreview = plaintext; // Store full plaintext key instead of masked preview

    const [created] = await db
      .insert(gatewayKeys)
      .values({
        id: uuidv4(),
        name: name || null,
        keyHash: kHash,
        keyPreview: kPreview,
        status: 'active',
        quotaPerMinute: quota_per_minute || 60,
        allowedProviders: allowed_providers && allowed_providers.length > 0 ? allowed_providers : null,
        provider: provider || '',
        modelType: model_type || 'text',
        modelId: model_id || '',
        tenantId,
      })
      .returning();

    statsCache.clear();

    res.status(201).json({
      id: created.id,
      name: created.name,
      status: created.status,
      quota_per_minute: created.quotaPerMinute,
      allowed_providers: created.allowedProviders,
      provider: created.provider,
      model_type: created.modelType,
      model_id: created.modelId,
      tenant_id: created.tenantId,
      key_preview: created.keyPreview,
      created_at: created.createdAt,
      // Shown ONLY once
      plaintext_key: plaintext,
    });
  } catch (err) {
    console.error('[Keys] Create error:', err);
    res.status(500).json({ error: 'Gagal membuat gateway key' });
  }
});

// ─── PATCH /api/keys/:id ──────────────────────────────────────────────────────
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, quota_per_minute, allowed_providers, provider, model_type, model_id, status } = req.body;

    const updateData: Partial<typeof gatewayKeys.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (quota_per_minute !== undefined) updateData.quotaPerMinute = quota_per_minute;
    if (allowed_providers !== undefined) {
      updateData.allowedProviders = allowed_providers.length > 0 ? allowed_providers : null;
    }
    if (provider !== undefined) updateData.provider = provider;
    if (model_type !== undefined) updateData.modelType = model_type;
    if (model_id !== undefined) updateData.modelId = model_id;
    if (status !== undefined) updateData.status = status;

    const [updated] = await db
      .update(gatewayKeys)
      .set(updateData)
      .where(and(eq(gatewayKeys.id, id), isNull(gatewayKeys.deletedAt)))
      .returning({ id: gatewayKeys.id });

    if (!updated) {
      res.status(404).json({ error: 'Gateway key tidak ditemukan' });
      return;
    }

    // Invalidate cache
    gatewayKeyCache.delete(id);

    res.json({ message: 'Gateway key berhasil diperbarui', id });
  } catch (err) {
    console.error('[Keys] Update error:', err);
    res.status(500).json({ error: 'Gagal memperbarui gateway key' });
  }
});

// ─── DELETE /api/keys/:id ─────────────────────────────────────────────────────
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Soft delete
    const [deleted] = await db
      .update(gatewayKeys)
      .set({ deletedAt: new Date(), status: 'inactive', updatedAt: new Date() })
      .where(and(eq(gatewayKeys.id, id), isNull(gatewayKeys.deletedAt)))
      .returning({ id: gatewayKeys.id });

    if (!deleted) {
      res.status(404).json({ error: 'Gateway key tidak ditemukan' });
      return;
    }

    // Cascade soft-delete all CDN files uploaded by this gateway key
    await db
      .update(cdnFiles)
      .set({ deletedAt: new Date() })
      .where(and(eq(cdnFiles.gatewayKeyId, id), isNull(cdnFiles.deletedAt)));

    gatewayKeyCache.delete(id);
    statsCache.clear();

    res.json({ message: 'Gateway key dan semua record CDN gambar miliknya berhasil dihapus dari database' });
  } catch (err) {
    console.error('[Keys] Delete error:', err);
    res.status(500).json({ error: 'Gagal menghapus gateway key' });
  }
});

// ─── POST /api/keys/:id/rotate ────────────────────────────────────────────────
router.post('/:id/rotate', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const existing = await db
      .select()
      .from(gatewayKeys)
      .where(and(eq(gatewayKeys.id, id), isNull(gatewayKeys.deletedAt)))
      .limit(1);

    if (existing.length === 0) {
      res.status(404).json({ error: 'Gateway key tidak ditemukan' });
      return;
    }

    const { plaintext, tenantId } = generateGatewayKey();
    const kHash = hashValue(plaintext);
    const kPreview = plaintext; // Store full plaintext key instead of masked preview

    const [updated] = await db
      .update(gatewayKeys)
      .set({
        keyHash: kHash,
        keyPreview: kPreview,
        tenantId,
        status: 'active',
        updatedAt: new Date(),
      })
      .where(eq(gatewayKeys.id, id))
      .returning();

    gatewayKeyCache.delete(id);

    res.json({
      id: updated.id,
      name: updated.name,
      status: updated.status,
      key_preview: updated.keyPreview,
      // Shown ONLY once
      plaintext_key: plaintext,
      message: 'Key berhasil dirotasi. Simpan key baru dengan aman!',
    });
  } catch (err) {
    console.error('[Keys] Rotate error:', err);
    res.status(500).json({ error: 'Gagal merotasi gateway key' });
  }
});

export default router;
