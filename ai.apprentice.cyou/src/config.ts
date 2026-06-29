import "dotenv/config";

const toBool = (v: string | undefined, def: boolean) => {
  if (v == null || v === "") return def;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
};

const isServerless = () =>
  Boolean(
    process.env.VERCEL ||
      process.env.AWS_LAMBDA_FUNCTION_NAME ||
      (process.env.RUNTIME || "").toLowerCase() === "serverless"
  );

export const config = {
  port: Number(process.env.PORT || 8788),
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "",
  jwtSecret: process.env.JWT_SECRET || "",
  keyEncryptionSecret: process.env.KEY_ENCRYPTION_SECRET || process.env.JWT_SECRET || "",
  exposeKeyPlaintext: toBool(process.env.EXPOSE_KEY_PLAINTEXT, true),
  corsAllowAll: toBool(process.env.CORS_ALLOW_ALL, (process.env.NODE_ENV || "development") !== "production"),
  corsOrigins: (process.env.CORS_ORIGINS || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean),
  enableSelfRegistration: toBool(process.env.ENABLE_SELF_REGISTRATION, true),
  apiKeyCacheTtlMs: Number(process.env.API_KEY_CACHE_TTL_MS || 2000),
  hmacMaxSkewMs: Number(process.env.HMAC_MAX_SKEW_MS || 30000),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS || 60000),
  rateLimitDefault: Number(process.env.RATE_LIMIT_DEFAULT || 1000),
  apiKeyGraceMs: Number(process.env.API_KEY_GRACE_MS || 60000),
  breakerTimeoutMs: Number(process.env.BREAKER_TIMEOUT_MS || 8000),
  breakerHalfOpenAfterMs: Number(process.env.BREAKER_HALF_OPEN_AFTER_MS || 2000),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_BYTES || 10 * 1024 * 1024),
  maxProxyBodyBytes: Number(process.env.MAX_PROXY_BODY_BYTES || 2 * 1024 * 1024),
  exposeMetrics: toBool(process.env.EXPOSE_METRICS, true),
  exposeOpenapi: toBool(process.env.EXPOSE_OPENAPI, true),
  allowCredentialExport: toBool(process.env.ALLOW_CREDENTIAL_EXPORT, (process.env.NODE_ENV || "development") !== "production"),
  enableInternalTestRoutes: toBool(process.env.ENABLE_INTERNAL_TEST_ROUTES, false),
  /** Logout/revoke JWT konsisten antar-instance (Neon); default aktif di serverless. */
  revokeTokensInDb: isServerless() || toBool(process.env.REVOKE_TOKENS_IN_DB, false),
  gatewayLogMode: (process.env.GATEWAY_LOG_MODE || (isServerless() ? "light" : "full")) as "light" | "full",
  isServerless: isServerless(),
  cronSecret: process.env.CRON_SECRET || "",
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramAdminIds: (process.env.TELEGRAM_ADMIN_IDS || "").split(",").map((id) => id.trim()).filter(Boolean),
  providerUpstreams: {
    gemini: "https://generativelanguage.googleapis.com",
    openclaw: "https://api.openclaw.ai/v1",
    openai: "https://api.openai.com/v1",
    groq: "https://api.groq.com/openai/v1",
    anthropic: "https://api.anthropic.com/v1",
    mistral: "https://api.mistral.ai/v1",
    cohere: "https://api.cohere.ai/v1",
    together: "https://api.together.xyz/v1",
    perplexity: "https://api.perplexity.ai",
    apify: "https://api.apify.com/v2",
    cloudinary: "https://api.cloudinary.com",
    imagekit: "https://api.imagekit.io",
    newsapi: "https://newsapi.org/v2",
    gnews: "https://gnews.io/api/v4",
    mediastack: "https://api.mediastack.com/v1",
    openweather: "https://api.openweathermap.org/data/2.5",
    alphavantage: "https://www.alphavantage.co",
    huggingface: "https://api-inference.huggingface.co",
  } as Record<string, string>,
};

export const assertConfig = () => {
  if (!config.databaseUrl) throw new Error("DATABASE_URL wajib di-set");
  if (!config.jwtSecret || config.jwtSecret.length < 16) {
    throw new Error("JWT_SECRET wajib di-set (minimal 16 karakter)");
  }
};
