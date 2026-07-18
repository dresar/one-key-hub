import cors from 'cors';
import { env } from '../config/env';

// ─── CORS Configuration ───────────────────────────────────────────────────────

const parsedFrontendUrls = env.FRONTEND_URL 
  ? env.FRONTEND_URL.split(',').map(url => url.trim()) 
  : [];

const allowedOrigins = [
  ...parsedFrontendUrls,
  'http://localhost:5173',
  'http://localhost:8080',
  'http://localhost:3000',
  'http://localhost:4173',
  'https://airotation.my.id',
  'https://www.airotation.my.id',
].filter(Boolean);

export const corsMiddleware = cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. mobile apps, curl, Postman)
    if (!origin) return callback(null, true);

    const isAllowed = allowedOrigins.includes(origin) || 
                      origin.endsWith('.vercel.app');

    if (isAllowed) {
      callback(null, true);
    } else if (env.NODE_ENV === 'development') {
      // Allow all origins in dev mode
      callback(null, true);
    } else {
      callback(new Error(`CORS: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Credential-ID'],
  exposedHeaders: ['X-Request-Id'],
});
