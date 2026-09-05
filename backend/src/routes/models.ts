import { Router, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { aiModels } from '../db/schema';
import { authenticate, AuthRequest } from '../middleware/auth';
import { modelsCache } from '../lib/cache';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// All routes require JWT authentication
router.use(authenticate);

// ─── GET /api/models ──────────────────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const provider = req.query.provider as string;
    
    let query = db.select().from(aiModels);
    
    if (provider) {
      // @ts-ignore
      query = query.where(eq(aiModels.provider, provider.toLowerCase()));
    }
    
    // @ts-ignore
    const rows = await query.orderBy(aiModels.provider, aiModels.displayName);
    
    const items = rows.map(r => ({
      id: r.id,
      provider: r.provider,
      model_id: r.modelId,
      display_name: r.displayName,
      is_default: r.isDefault,
      supports_vision: r.supportsVision,
      created_at: r.createdAt,
      updated_at: r.updatedAt,
    }));
    
    res.json({ items, total: items.length });
  } catch (err) {
    console.error('[Models] List error:', err);
    res.status(500).json({ error: 'Gagal memuat list model AI' });
  }
});

// ─── POST /api/models ─────────────────────────────────────────────────────────
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const { provider, model_id, display_name, is_default, supports_vision } = req.body;
    
    if (!provider || !model_id || !display_name) {
      res.status(400).json({ error: 'provider, model_id, dan display_name wajib diisi' });
      return;
    }
    
    // If setting as default, unset others for this provider
    if (is_default) {
      await db
        .update(aiModels)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(aiModels.provider, provider.toLowerCase()));
    }
    
    const [created] = await db
      .insert(aiModels)
      .values({
        id: uuidv4(),
        provider: provider.toLowerCase(),
        modelId: model_id,
        displayName: display_name,
        isDefault: !!is_default,
        supportsVision: !!supports_vision,
      })
      .returning();
      
    // Invalidate models cache for this provider
    modelsCache.invalidate(`models:${provider.toLowerCase()}`);
    
    res.status(201).json({
      id: created.id,
      provider: created.provider,
      model_id: created.modelId,
      display_name: created.displayName,
      is_default: created.isDefault,
      supports_vision: created.supportsVision,
      created_at: created.createdAt,
    });
  } catch (err) {
    console.error('[Models] Create error:', err);
    res.status(500).json({ error: 'Gagal menambahkan model AI' });
  }
});

// ─── PATCH /api/models/:id ───────────────────────────────────────────────────
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { provider, model_id, display_name, is_default, supports_vision } = req.body;
    
    const updateData: Partial<typeof aiModels.$inferInsert> = {
      updatedAt: new Date(),
    };
    
    if (provider !== undefined) updateData.provider = provider.toLowerCase();
    if (model_id !== undefined) updateData.modelId = model_id;
    if (display_name !== undefined) updateData.displayName = display_name;
    if (supports_vision !== undefined) updateData.supportsVision = !!supports_vision;
    if (is_default !== undefined) updateData.isDefault = !!is_default;
    
    // Get existing to know its provider
    const existing = await db
      .select()
      .from(aiModels)
      .where(eq(aiModels.id, id))
      .limit(1);
      
    if (existing.length === 0) {
      res.status(404).json({ error: 'Model tidak ditemukan' });
      return;
    }
    
    const targetProvider = provider ? provider.toLowerCase() : existing[0].provider;
    
    // If setting as default, unset others for this provider
    if (is_default) {
      await db
        .update(aiModels)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(aiModels.provider, targetProvider));
    }
    
    const [updated] = await db
      .update(aiModels)
      .set(updateData)
      .where(eq(aiModels.id, id))
      .returning();
      
    // Invalidate cache
    modelsCache.invalidate(`models:${existing[0].provider}`);
    if (provider && provider.toLowerCase() !== existing[0].provider) {
      modelsCache.invalidate(`models:${provider.toLowerCase()}`);
    }
    
    res.json({
      message: 'Model AI berhasil diperbarui',
      item: {
        id: updated.id,
        provider: updated.provider,
        model_id: updated.modelId,
        display_name: updated.displayName,
        is_default: updated.isDefault,
        supports_vision: updated.supportsVision,
        created_at: updated.createdAt,
      }
    });
  } catch (err) {
    console.error('[Models] Update error:', err);
    res.status(500).json({ error: 'Gagal memperbarui model AI' });
  }
});

// ─── DELETE /api/models/:id ──────────────────────────────────────────────────
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const existing = await db
      .select()
      .from(aiModels)
      .where(eq(aiModels.id, id))
      .limit(1);
      
    if (existing.length === 0) {
      res.status(404).json({ error: 'Model tidak ditemukan' });
      return;
    }
    
    await db
      .delete(aiModels)
      .where(eq(aiModels.id, id));
      
    // Invalidate cache
    modelsCache.invalidate(`models:${existing[0].provider}`);
    
    res.json({ message: 'Model AI berhasil dihapus' });
  } catch (err) {
    console.error('[Models] Delete error:', err);
    res.status(500).json({ error: 'Gagal menghapus model AI' });
  }
});

export default router;
