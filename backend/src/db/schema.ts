import { pgTable, uuid, text, varchar, integer, boolean, timestamp, jsonb, serial } from 'drizzle-orm/pg-core';

// ─── Users Table ─────────────────────────────────────────────────────────────
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  username: text('username').notNull().default(''),
  role: text('role').notNull().default('admin'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Provider Credentials Table ──────────────────────────────────────────────
export const providerCredentials = pgTable('provider_credentials', {
  id: serial('id').primaryKey(),
  providerName: varchar('provider_name', { length: 50 }).notNull(),
  label: text('label').notNull().default(''),
  modelId: text('model_id').notNull().default(''), // Custom model associated with this key/credential
  credentialsCiphertext: text('credentials_ciphertext').notNull(),
  keyHash: varchar('key_hash', { length: 64 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'), // active | cooldown | inactive
  totalRequests: integer('total_requests').notNull().default(0),
  failedRequests: integer('failed_requests').notNull().default(0),
  lastError: text('last_error'),
  cooldownUntil: timestamp('cooldown_until', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// ─── Gateway Keys Table (Unified keys for API clients) ───────────────────────
export const gatewayKeys = pgTable('gateway_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  keyHash: varchar('key_hash', { length: 64 }).notNull().unique(),
  keyPreview: varchar('key_preview', { length: 100 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('active'), // active | inactive | suspended
  quotaPerMinute: integer('quota_per_minute').notNull().default(60),
  allowedProviders: jsonb('allowed_providers').$type<string[]>(),
  provider: text('provider').notNull().default(''), // Target provider (e.g. gemini, groq)
  modelType: text('model_type').notNull().default('text'), // Model capability: text | vision
  modelId: text('model_id').notNull().default(''), // Specific model choice bound to this gateway key
  tenantId: text('tenant_id').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
});

// ─── Request Logs Table ───────────────────────────────────────────────────────
export const requestLogs = pgTable('request_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  gatewayKeyId: uuid('gateway_key_id'),
  credentialId: integer('credential_id'),
  providerName: text('provider_name'),
  modelName: text('model_name'),
  requestPath: text('request_path'),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // success | error | pending
  statusCode: integer('status_code'),
  errorMessage: text('error_message'),
  responseTimeMs: integer('response_time_ms'),
  tokensUsed: integer('tokens_used'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Rotation Settings Table ──────────────────────────────────────────────────
export const rotationSettings = pgTable('rotation_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  strategy: text('strategy').notNull().default('per_provider'), // per_provider | global
  fallbackEnabled: boolean('fallback_enabled').notNull().default(true),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── AI Models Table ─────────────────────────────────────────────────────────
export const aiModels = pgTable('ai_models', {
  id: uuid('id').primaryKey().defaultRandom(),
  provider: varchar('provider', { length: 50 }).notNull(),
  modelId: text('model_id').notNull(),
  displayName: text('display_name').notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  supportsVision: boolean('supports_vision').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ─── Types ────────────────────────────────────────────────────────────────────
export type User = typeof users.$inferSelect;
export type ProviderCredential = typeof providerCredentials.$inferSelect;
export type GatewayKey = typeof gatewayKeys.$inferSelect;
export type RequestLog = typeof requestLogs.$inferSelect;
export type RotationSetting = typeof rotationSettings.$inferSelect;
export type AiModel = typeof aiModels.$inferSelect;

