import crypto from 'crypto';
import { env } from '../config/env';

// ─── AES-256-GCM Encryption / Decryption ─────────────────────────────────────
// Key stored as 64 hex chars in env (32 bytes)

const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypts a plain text value.
 * Returns format: "<iv_hex>:<ciphertext_hex>:<authTag_hex>"
 */
export function encrypt(plaintext: string): string {
  const masterKey = Buffer.from(env.ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${encrypted}:${authTag}`;
}

/**
 * Decrypts a ciphertext in format "<iv_hex>:<ciphertext_hex>:<authTag_hex>"
 */
export function decrypt(ciphertext: string): string {
  const masterKey = Buffer.from(env.ENCRYPTION_KEY, 'hex');
  const parts = ciphertext.split(':');

  if (parts.length !== 3) {
    throw new Error('Invalid ciphertext format');
  }

  const [ivHex, encryptedHex, authTagHex] = parts;
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, undefined, 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}

/**
 * SHA-256 hash of a value (for duplicate detection without decryption)
 */
export function hashValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Generates a secure random gateway key in format: AR_<tenantId>_<secret>
 * tenantId: 8 random hex chars
 * secret: 32 random hex chars
 */
export function generateGatewayKey(): { plaintext: string; tenantId: string } {
  const tenantId = crypto.randomBytes(4).toString('hex'); // 8 chars
  const secret = crypto.randomBytes(16).toString('hex'); // 32 chars
  const plaintext = `AR_${tenantId}_${secret}`;
  return { plaintext, tenantId };
}

/**
 * Creates a masked preview of a key for safe display
 * e.g. "AR_abc12345_..." → "AR_abc12...3def"
 */
export function keyPreview(key: string): string {
  if (key.length <= 16) return key;
  return `${key.substring(0, 12)}...${key.substring(key.length - 4)}`;
}
