import { Router, Request, Response } from 'express';
import { and, eq, isNull, desc, like, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { gatewayKeys, cdnFiles } from '../db/schema';
import { hashValue } from '../lib/crypto';
import { gatewayKeyCache } from '../lib/cache';
import { gatewayRateLimiter } from '../middleware/rateLimiter';
import { uploadWithFailover } from '../services/storageService';

const router = Router();
router.use(gatewayRateLimiter);

// ─── Helper: Validate Gateway Key ─────────────────────────────────────────────
function getGatewayApiKey(req: Request): string | undefined {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7).trim();
  }
  return (req.headers['x-api-key'] || req.headers['x-api-key']) as string | undefined;
}

async function validateGatewayKey(rawKey: string) {
  const cached = gatewayKeyCache.get(rawKey);
  if (cached === null) return null;
  if (cached) return cached;

  const kHash = hashValue(rawKey);
  let rows = await db
    .select()
    .from(gatewayKeys)
    .where(and(eq(gatewayKeys.keyHash, kHash), eq(gatewayKeys.status, 'active'), isNull(gatewayKeys.deletedAt)))
    .limit(1);

  if (rows.length === 0) {
    const cleanKey = rawKey.replace(/\s+/g, '');
    rows = await db
      .select()
      .from(gatewayKeys)
      .where(and(eq(gatewayKeys.keyPreview, cleanKey), eq(gatewayKeys.status, 'active'), isNull(gatewayKeys.deletedAt)))
      .limit(1);
  }

  if (rows.length === 0) {
    gatewayKeyCache.set(rawKey, null, 30_000);
    return null;
  }

  gatewayKeyCache.set(rawKey, rows[0], 120_000);
  return rows[0];
}

// ─── POST /upload & /v1/storage/upload ───────────────────────────────────────
router.post('/upload', async (req: Request, res: Response) => {
  try {
    const rawApiKey = getGatewayApiKey(req);
    if (!rawApiKey) {
      res.status(401).json({ error: { message: 'Invalid or missing API key', type: 'invalid_request_error' } });
      return;
    }

    const gatewayKey = await validateGatewayKey(rawApiKey);
    if (!gatewayKey) {
      res.status(401).json({ error: { message: 'Invalid API key', type: 'invalid_request_error' } });
      return;
    }

    const { file, file_name, fileName, auto_rotate, provider } = req.body;
    if (!file || typeof file !== 'string') {
      res.status(400).json({ error: { message: 'Parameter "file" (Base64 atau URL) wajib diisi', type: 'invalid_request_error' } });
      return;
    }

    const uploadResult = await uploadWithFailover({
      gatewayKeyId: gatewayKey.id,
      file,
      fileName: file_name || fileName,
      autoRotate: auto_rotate !== false,
      targetProvider: provider,
    });

    res.status(201).json({
      success: true,
      file: {
        id: uploadResult.id,
        provider: uploadResult.provider,
        url: uploadResult.url,
        file_id: uploadResult.fileId,
        file_name: uploadResult.fileName,
        file_size: uploadResult.fileSize,
        mime_type: uploadResult.mimeType,
        width: uploadResult.width,
        height: uploadResult.height,
        auto_rotated: uploadResult.autoRotated,
        created_at: uploadResult.createdAt,
      },
    });
  } catch (err: any) {
    console.error('[StorageGateway] Upload error:', err);
    res.status(500).json({
      error: {
        message: err.message || 'Gagal mengunggah file ke CDN',
        type: 'api_error',
      },
    });
  }
});

// ─── GET /list & /v1/storage/list ───────────────────────────────────────────
router.get('/list', async (req: Request, res: Response) => {
  try {
    const rawApiKey = getGatewayApiKey(req);
    if (!rawApiKey) {
      res.status(401).json({ error: { message: 'Invalid or missing API key', type: 'invalid_request_error' } });
      return;
    }

    const gatewayKey = await validateGatewayKey(rawApiKey);
    if (!gatewayKey) {
      res.status(401).json({ error: { message: 'Invalid API key', type: 'invalid_request_error' } });
      return;
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    const providerFilter = req.query.provider as string;
    const searchFilter = req.query.search as string;

    const conditions = [
      eq(cdnFiles.gatewayKeyId, gatewayKey.id),
      isNull(cdnFiles.deletedAt),
    ];

    if (providerFilter) {
      conditions.push(eq(cdnFiles.provider, providerFilter.toLowerCase()));
    }
    if (searchFilter) {
      conditions.push(like(cdnFiles.fileName, `%${searchFilter}%`));
    }

    const rows = await db
      .select()
      .from(cdnFiles)
      .where(and(...conditions))
      .orderBy(desc(cdnFiles.createdAt))
      .limit(limit)
      .offset(offset);

    // Count total items
    const countResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(cdnFiles)
      .where(and(...conditions));

    const total = countResult[0]?.count || 0;

    const items = rows.map((r) => ({
      id: r.id,
      provider: r.provider,
      url: r.url,
      file_id: r.fileId,
      file_name: r.fileName,
      file_size: r.fileSize,
      mime_type: r.mimeType,
      width: r.width,
      height: r.height,
      auto_rotated: r.autoRotated,
      created_at: r.createdAt,
    }));

    res.json({
      object: 'list',
      items,
      pagination: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (err: any) {
    console.error('[StorageGateway] List error:', err);
    res.status(500).json({ error: { message: 'Gagal mengambil daftar file CDN', type: 'api_error' } });
  }
});

// ─── GET /files/:id ───────────────────────────────────────────────────────────
router.get('/files/:id', async (req: Request, res: Response) => {
  try {
    const rawApiKey = getGatewayApiKey(req);
    if (!rawApiKey) {
      res.status(401).json({ error: { message: 'Invalid API key', type: 'invalid_request_error' } });
      return;
    }

    const gatewayKey = await validateGatewayKey(rawApiKey);
    if (!gatewayKey) {
      res.status(401).json({ error: { message: 'Invalid API key', type: 'invalid_request_error' } });
      return;
    }

    const { id } = req.params;

    const rows = await db
      .select()
      .from(cdnFiles)
      .where(and(eq(cdnFiles.id, id), eq(cdnFiles.gatewayKeyId, gatewayKey.id), isNull(cdnFiles.deletedAt)))
      .limit(1);

    if (rows.length === 0) {
      res.status(404).json({ error: { message: 'File tidak ditemukan', type: 'invalid_request_error' } });
      return;
    }

    const r = rows[0];
    res.json({
      id: r.id,
      provider: r.provider,
      url: r.url,
      file_id: r.fileId,
      file_name: r.fileName,
      file_size: r.fileSize,
      mime_type: r.mimeType,
      width: r.width,
      height: r.height,
      auto_rotated: r.autoRotated,
      created_at: r.createdAt,
    });
  } catch (err: any) {
    console.error('[StorageGateway] Get file error:', err);
    res.status(500).json({ error: { message: 'Gagal mengambil detail file', type: 'api_error' } });
  }
});

// ─── DELETE /files/:id ────────────────────────────────────────────────────────
router.delete('/files/:id', async (req: Request, res: Response) => {
  try {
    const rawApiKey = getGatewayApiKey(req);
    if (!rawApiKey) {
      res.status(401).json({ error: { message: 'Invalid API key', type: 'invalid_request_error' } });
      return;
    }

    const gatewayKey = await validateGatewayKey(rawApiKey);
    if (!gatewayKey) {
      res.status(401).json({ error: { message: 'Invalid API key', type: 'invalid_request_error' } });
      return;
    }

    const { id } = req.params;

    const [deleted] = await db
      .update(cdnFiles)
      .set({ deletedAt: new Date() })
      .where(and(eq(cdnFiles.id, id), eq(cdnFiles.gatewayKeyId, gatewayKey.id), isNull(cdnFiles.deletedAt)))
      .returning({ id: cdnFiles.id, fileId: cdnFiles.fileId, provider: cdnFiles.provider });

    if (!deleted) {
      res.status(404).json({ error: { message: 'File tidak ditemukan atau sudah dihapus', type: 'invalid_request_error' } });
      return;
    }

    res.json({
      success: true,
      message: `File ID ${id} berhasil dihapus dari database CDN`,
    });
  } catch (err: any) {
    console.error('[StorageGateway] Delete error:', err);
    res.status(500).json({ error: { message: 'Gagal menghapus file', type: 'api_error' } });
  }
});

export default router;
