import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { users } from './schema';
import { eq } from 'drizzle-orm';

// ─── Seed Script: Creates admin user if not exists ────────────────────────────
// Usage: npx ts-node src/db/seed.ts
// Or triggered automatically on first startup if ADMIN_EMAIL env is set

const DATABASE_URL = process.env.DATABASE_URL || '';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@example.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'Admin';

async function seed() {
  if (!DATABASE_URL) {
    throw new Error('DATABASE_URL is required for seeding');
  }

  const sql = neon(DATABASE_URL);
  const db = drizzle(sql, { schema: { users } });

  console.log('[Seed] Checking for existing admin user...');

  const existing = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL))
    .limit(1);

  if (existing.length > 0) {
    console.log(`[Seed] Admin user already exists: ${ADMIN_EMAIL}`);
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);

  const [created] = await db.insert(users).values({
    email: ADMIN_EMAIL,
    passwordHash,
    username: ADMIN_USERNAME,
    role: 'admin',
  }).returning({ id: users.id, email: users.email });

  console.log(`[Seed] ✅ Admin user created:`);
  console.log(`  Email   : ${created.email}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log(`  ID      : ${created.id}`);
}

// Run if called directly
seed()
  .then(() => {
    console.log('[Seed] Done.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('[Seed] Error:', err);
    process.exit(1);
  });
