import 'dotenv/config';
import express from 'express';
import { env } from './config/env';
import { initDatabase, sql } from './db/client';
import { users } from './db/schema';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/neon-http';

// Middleware
import { corsMiddleware } from './middleware/cors';
import { apiRateLimiter } from './middleware/rateLimiter';

// Routes
import authRoutes from './routes/auth';
import keysRoutes from './routes/keys';
import credentialsRoutes from './routes/credentials';
import statsRoutes from './routes/stats';
import logsRoutes from './routes/logs';
import playgroundRoutes from './routes/playground';
import settingsRoutes from './routes/settings';
import internalKeysRoutes from './routes/internalKeys';
import gatewayRoutes from './routes/gateway';
import modelsRoutes from './routes/models';
import providersRoutes from './routes/providers';
import { initializeCredentialSync } from './services/credentialSync';
import { reindexAllCredentials } from './routes/credentials';

// Services
import { startScheduler } from './services/scheduler';

// ─── App Setup ────────────────────────────────────────────────────────────────
const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(corsMiddleware);
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(apiRateLimiter);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    env: env.NODE_ENV,
  });
});

app.get('/', (_req, res) => {
  res.json({
    name: 'One Key Hub API',
    version: '1.0.0',
    docs: '/health',
    gateway: '/gateway/:provider/chat',
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/keys', keysRoutes);
app.use('/api/credentials', credentialsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/playground', playgroundRoutes);
app.use('/api/models', modelsRoutes);
app.use('/api/providers', providersRoutes);
app.use('/api/v1', internalKeysRoutes);

// Settings routes (no /api prefix — matches frontend calls)
app.use('/settings', settingsRoutes);
app.use('/users', settingsRoutes);

// ─── Gateway Routes (no auth — uses X-API-Key or Authorization Bearer) ──────
app.use('/gateway', gatewayRoutes);
app.use('/v1', gatewayRoutes);

// ─── 404 Handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[App] Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── Auto-seed Admin User ─────────────────────────────────────────────────────
async function seedAdminIfNeeded(): Promise<void> {
  try {
    const db = drizzle(sql, { schema: { users } });
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, env.ADMIN_EMAIL))
      .limit(1);

    if (existing.length === 0) {
      const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 10);
      await db.insert(users).values({
        email: env.ADMIN_EMAIL,
        passwordHash,
        username: env.ADMIN_USERNAME,
        role: 'admin',
      });
      console.log(`[Seed] ✅ Admin user created: ${env.ADMIN_EMAIL} / ${env.ADMIN_PASSWORD}`);
    } else {
      console.log(`[Seed] Admin user already exists: ${env.ADMIN_EMAIL}`);
    }
  } catch (err) {
    console.warn('[Seed] Could not seed admin user:', err);
  }
}

// ─── Start Server ─────────────────────────────────────────────────────────────
async function start(): Promise<void> {
  console.log('');
  console.log('╔══════════════════════════════════════╗');
  console.log('║       One Key Hub — Backend           ║');
  console.log('║  Unified AI Gateway — airotation.my.id║');
  console.log('╚══════════════════════════════════════╝');
  console.log('');

  // 1. Initialize database (create tables if not exist)
  await initDatabase();

  // 2. Seed admin user
  await seedAdminIfNeeded();

  // 3. Auto re-index IDs to clean 1, 2, 3...
  try {
    await reindexAllCredentials();
  } catch (reindexErr) {
    console.warn('[Startup] Reindex warning:', reindexErr);
  }

  // 4. Initialize local JSON credentials cache
  await initializeCredentialSync();

  // 4. Start background scheduler
  startScheduler();

  // 4. Start HTTP server
  app.listen(env.PORT, () => {
    console.log('');
    console.log(`[Server] ✅ Running on port ${env.PORT}`);
    console.log(`[Server] Environment: ${env.NODE_ENV}`);
    console.log(`[Server] CORS: ${env.FRONTEND_URL}`);
    console.log(`[Server] Gateway ready: POST /gateway/:provider/chat`);
    console.log('');
    console.log('Dev Login:');
    console.log(`  Email   : ${env.ADMIN_EMAIL}`);
    console.log(`  Password: ${env.ADMIN_PASSWORD}`);
    console.log('');
  });
}

start().catch((err) => {
  console.error('[App] Fatal startup error:', err);
  process.exit(1);
});

export default app;
