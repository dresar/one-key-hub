import rateLimit from 'express-rate-limit';

// ─── Rate Limiters ────────────────────────────────────────────────────────────

/** General API rate limiter: 200 req/min per IP */
export const apiRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in a minute.' },
});

/** Auth rate limiter: 10 login attempts per 15 min */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60_000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 15 minutes.' },
});

/** Gateway rate limiter: 300 req/min (higher for proxy traffic) */
export const gatewayRateLimiter = rateLimit({
  windowMs: 60_000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Gateway rate limit exceeded.' },
});
