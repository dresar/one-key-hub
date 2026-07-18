import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import providersList from '../providers';

const router = Router();

// Secure route with JWT authentication
router.use(authenticate);

// ─── GET /api/providers ───────────────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    res.json({ items: providersList, total: providersList.length });
  } catch (err) {
    console.error('[Providers] List error:', err);
    res.status(500).json({ error: 'Gagal memuat list provider' });
  }
});

export default router;
