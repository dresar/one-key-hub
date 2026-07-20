import cors from 'cors';

// ─── CORS Configuration ───────────────────────────────────────────────────────

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Always allow any origin (reflects request origin back to support credentials: true)
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Credential-ID'],
  exposedHeaders: ['X-Request-Id'],
});
