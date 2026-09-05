import { Router, Request, Response } from 'express';
import { and, count, eq, gte, isNull, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { providerCredentials, gatewayKeys, requestLogs } from '../db/schema';
import { authenticate } from '../middleware/auth';
import { statsCache } from '../lib/cache';

const router = Router();

// ─── GET /api/stats ───────────────────────────────────────────────────────────
router.get('/', authenticate, async (req: Request, res: Response) => {
  const cacheKey = 'dashboard_stats';
  const cached = statsCache.get(cacheKey);
  if (cached) {
    res.json(cached);
    return;
  }

  try {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      totalCredentials,
      activeCredentials,
      cooldownCredentials,
      totalClients,
      totalRequests,
      recentErrors,
    ] = await Promise.all([
      // Total provider credentials (not deleted)
      db
        .select({ count: count() })
        .from(providerCredentials)
        .where(isNull(providerCredentials.deletedAt))
        .then((r) => r[0]?.count ?? 0),

      // Active credentials
      db
        .select({ count: count() })
        .from(providerCredentials)
        .where(
          and(
            eq(providerCredentials.status, 'active'),
            isNull(providerCredentials.deletedAt),
          ),
        )
        .then((r) => r[0]?.count ?? 0),

      // Cooldown credentials
      db
        .select({ count: count() })
        .from(providerCredentials)
        .where(
          and(
            eq(providerCredentials.status, 'cooldown'),
            isNull(providerCredentials.deletedAt),
          ),
        )
        .then((r) => r[0]?.count ?? 0),

      // Total gateway keys (clients)
      db
        .select({ count: count() })
        .from(gatewayKeys)
        .where(and(eq(gatewayKeys.status, 'active'), isNull(gatewayKeys.deletedAt)))
        .then((r) => r[0]?.count ?? 0),

      // Total requests today
      db
        .select({ count: count() })
        .from(requestLogs)
        .where(gte(requestLogs.createdAt, yesterday))
        .then((r) => r[0]?.count ?? 0),

      // Recent errors (24h)
      db
        .select({ count: count() })
        .from(requestLogs)
        .where(
          and(
            eq(requestLogs.status, 'error'),
            gte(requestLogs.createdAt, yesterday),
          ),
        )
        .then((r) => r[0]?.count ?? 0),
    ]);

    const stats = {
      totalCredentials: Number(totalCredentials),
      activeCredentials: Number(activeCredentials),
      cooldownCredentials: Number(cooldownCredentials),
      totalClients: Number(totalClients),
      totalRequests: Number(totalRequests),
      recentErrors: Number(recentErrors),
      // Aliases for Dashboard.tsx
      totalProviders: Number(totalCredentials),
      totalActiveKeys: Number(activeCredentials),
      requestsToday: Number(totalRequests),
      failedKeys: Number(cooldownCredentials),
    };

    statsCache.set(cacheKey, stats, 30_000);
    res.json(stats);
  } catch (err) {
    console.error('[Stats] Error:', err);
    res.status(500).json({ error: 'Gagal memuat statistik' });
  }
});

// ─── GET /api/stats/usage ─────────────────────────────────────────────────────
router.get('/usage', authenticate, async (req: Request, res: Response) => {
  try {
    const days = Math.min(90, Math.max(1, parseInt(req.query.days as string) || 7));
    
    // Calculate start date
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    startDate.setHours(0, 0, 0, 0);

    // Group logs by day
    const results = await db
      .select({
        date: sql<string>`DATE_TRUNC('day', ${requestLogs.createdAt})`,
        requests: count(),
        errors: sql<number>`SUM(CASE WHEN ${requestLogs.status} = 'error' THEN 1 ELSE 0 END)::int`,
      })
      .from(requestLogs)
      .where(gte(requestLogs.createdAt, startDate))
      .groupBy(sql`DATE_TRUNC('day', ${requestLogs.createdAt})`)
      .orderBy(sql`DATE_TRUNC('day', ${requestLogs.createdAt}) ASC`);

    const dailyMap = new Map<string, { requests: number; errors: number }>();
    results.forEach((r: any) => {
      if (r.date) {
        const dateStr = new Date(r.date).toISOString().split('T')[0];
        dailyMap.set(dateStr, { requests: r.requests || 0, errors: r.errors || 0 });
      }
    });

    // Populate missing days with zero requests
    const daily = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const dateStr = d.toISOString().split('T')[0];
      const entry = dailyMap.get(dateStr) || { requests: 0, errors: 0 };
      daily.push({
        date: dateStr,
        requests: entry.requests,
        errors: entry.errors,
      });
    }

    res.json({ daily });
  } catch (err) {
    console.error('[Stats] Usage chart error:', err);
    res.status(500).json({ error: 'Gagal memuat grafik statistik harian' });
  }
});

export default router;
