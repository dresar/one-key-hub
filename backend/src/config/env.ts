import 'dotenv/config';

// ─── Env Config — Validates all required environment variables ───────────────

function required(key: string): string {
  const val = process.env[key];
  if (!val || val.trim() === '') {
    throw new Error(`[ENV] Missing required environment variable: ${key}`);
  }
  return val.trim();
}

function optional(key: string, fallback: string): string {
  return (process.env[key] || fallback).trim();
}

export const env = {
  PORT: parseInt(optional('PORT', '3000'), 10),
  NODE_ENV: optional('NODE_ENV', 'production'),

  // Database
  DATABASE_URL: required('DATABASE_URL'),

  // Auth
  JWT_SECRET: required('JWT_SECRET'),
  JWT_EXPIRES_IN: optional('JWT_EXPIRES_IN', '7d'),

  // Encryption (AES-256-GCM — must be 64 hex chars = 32 bytes)
  ENCRYPTION_KEY: required('ENCRYPTION_KEY'),

  // Frontend CORS
  FRONTEND_URL: optional('FRONTEND_URL', 'http://localhost:5173'),

  // Dev admin seed
  ADMIN_EMAIL: optional('ADMIN_EMAIL', 'admin@example.com'),
  ADMIN_PASSWORD: optional('ADMIN_PASSWORD', 'admin123'),
  ADMIN_USERNAME: optional('ADMIN_USERNAME', 'Admin'),
} as const;

// Validate encryption key length
if (Buffer.from(env.ENCRYPTION_KEY, 'hex').length !== 32) {
  throw new Error('[ENV] ENCRYPTION_KEY must be exactly 64 hex characters (32 bytes)');
}
