import { Router, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { rotationSettings, users } from '../db/schema';
import { authenticate, AuthRequest } from '../middleware/auth';
import bcrypt from 'bcryptjs';

const router = Router();

// ─── All routes require JWT auth ──────────────────────────────────────────────
router.use(authenticate);

// ─── GET /settings/rotation ──────────────────────────────────────────────────
router.get('/rotation', async (req: AuthRequest, res: Response) => {
  try {
    const [settings] = await db.select().from(rotationSettings).limit(1);

    if (!settings) {
      // Return defaults if not seeded yet
      res.json({
        id: 'default',
        strategy: 'per_provider',
        fallback_enabled: true,
      });
      return;
    }

    res.json({
      id: settings.id,
      strategy: settings.strategy,
      fallback_enabled: settings.fallbackEnabled,
      updated_at: settings.updatedAt,
    });
  } catch (err) {
    console.error('[Settings] Rotation get error:', err);
    res.status(500).json({ error: 'Gagal memuat pengaturan rotasi' });
  }
});

// ─── PUT /settings/rotation ──────────────────────────────────────────────────
router.put('/rotation', async (req: AuthRequest, res: Response) => {
  try {
    const { strategy, fallback_enabled } = req.body;

    const [existing] = await db.select({ id: rotationSettings.id }).from(rotationSettings).limit(1);

    if (existing) {
      const [updated] = await db
        .update(rotationSettings)
        .set({
          strategy: strategy || 'per_provider',
          fallbackEnabled: fallback_enabled !== undefined ? fallback_enabled : true,
          updatedAt: new Date(),
        })
        .where(eq(rotationSettings.id, existing.id))
        .returning();

      res.json({
        id: updated.id,
        strategy: updated.strategy,
        fallback_enabled: updated.fallbackEnabled,
        updated_at: updated.updatedAt,
      });
    } else {
      // Insert if not exists
      const [created] = await db
        .insert(rotationSettings)
        .values({
          strategy: strategy || 'per_provider',
          fallbackEnabled: fallback_enabled !== undefined ? fallback_enabled : true,
        })
        .returning();

      res.json({
        id: created.id,
        strategy: created.strategy,
        fallback_enabled: created.fallbackEnabled,
      });
    }
  } catch (err) {
    console.error('[Settings] Rotation update error:', err);
    res.status(500).json({ error: 'Gagal memperbarui pengaturan rotasi' });
  }
});

// ─── PUT /users/profile ───────────────────────────────────────────────────────
router.put('/profile', async (req: AuthRequest, res: Response) => {
  try {
    const { username, currentPassword, newPassword, avatarUrl } = req.body;

    if (!username?.trim()) {
      res.status(400).json({ error: 'Username tidak boleh kosong' });
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user!.id))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: 'User tidak ditemukan' });
      return;
    }

    const updateData: Partial<typeof users.$inferInsert> = {
      username: username.trim(),
      updatedAt: new Date(),
    };

    if (avatarUrl !== undefined) {
      updateData.avatarUrl = avatarUrl ? avatarUrl.trim() : null;
    }

    // Handle password change
    if (newPassword) {
      if (!currentPassword) {
        res.status(400).json({ error: 'Password saat ini wajib diisi untuk mengubah password' });
        return;
      }

      const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!isValid) {
        res.status(401).json({ error: 'Password saat ini salah' });
        return;
      }

      if (newPassword.length < 6) {
        res.status(400).json({ error: 'Password baru minimal 6 karakter' });
        return;
      }

      updateData.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, req.user!.id))
      .returning({ id: users.id, username: users.username, email: users.email, avatarUrl: users.avatarUrl });

    res.json({
      message: 'Profil berhasil diperbarui',
      user: updated,
    });
  } catch (err) {
    console.error('[Settings] Profile update error:', err);
    res.status(500).json({ error: 'Gagal memperbarui profil' });
  }
});

export default router;
