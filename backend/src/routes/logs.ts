import { Router, Request, Response } from 'express';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client';
import { requestLogs } from '../db/schema';
import { authenticate } from '../middleware/auth';

const router = Router();

// ─── GET /api/logs ────────────────────────────────────────────────────────────
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
    const status = req.query.status as string | undefined;
    const offset = (page - 1) * limit;

    const conditions = [];
    if (status && status !== 'all') {
      conditions.push(eq(requestLogs.status, status));
    }

    const rows = await db
      .select({
        id: requestLogs.id,
        gatewayKeyId: requestLogs.gatewayKeyId,
        credentialId: requestLogs.credentialId,
        providerName: requestLogs.providerName,
        modelName: requestLogs.modelName,
        requestPath: requestLogs.requestPath,
        status: requestLogs.status,
        statusCode: requestLogs.statusCode,
        errorMessage: requestLogs.errorMessage,
        responseTimeMs: requestLogs.responseTimeMs,
        tokensUsed: requestLogs.tokensUsed,
        createdAt: requestLogs.createdAt,
      })
      .from(requestLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(requestLogs.createdAt))
      .limit(limit)
      .offset(offset);

    const items = rows.map((r) => ({
      id: r.id,
      gateway_key_id: r.gatewayKeyId,
      credential_id: r.credentialId,
      provider_name: r.providerName,
      model_name: r.modelName,
      request_path: r.requestPath,
      status: r.status,
      status_code: r.statusCode,
      error_message: r.errorMessage,
      response_time_ms: r.responseTimeMs,
      tokens_used: r.tokensUsed,
      created_at: r.createdAt,
    }));

    res.json({ items, page, limit });
  } catch (err) {
    console.error('[Logs] Error:', err);
    res.status(500).json({ error: 'Gagal memuat logs' });
  }
});

export default router;
