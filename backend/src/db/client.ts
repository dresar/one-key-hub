import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { env } from '../config/env';
import * as schema from './schema';

// ─── Neon PostgreSQL Client via HTTP (serverless-compatible) ─────────────────
const sql = neon(env.DATABASE_URL);
export const db = drizzle(sql, { schema });

// ─── Initialize tables (push schema on startup) ──────────────────────────────
// Note: Neon serverless does NOT support multi-statement queries.
// Each statement must be executed separately.
export async function initDatabase(): Promise<void> {
  try {
    // 1. Extension
    await sql`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`;

    // 2. Users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        username TEXT NOT NULL DEFAULT '',
        role TEXT NOT NULL DEFAULT 'admin',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // 3. Provider credentials table
    await sql`
      CREATE TABLE IF NOT EXISTS provider_credentials (
        id SERIAL PRIMARY KEY,
        provider_name VARCHAR(50) NOT NULL,
        label TEXT NOT NULL DEFAULT '',
        credentials_ciphertext TEXT NOT NULL,
        key_hash VARCHAR(64) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        total_requests INT NOT NULL DEFAULT 0,
        failed_requests INT NOT NULL DEFAULT 0,
        last_error TEXT,
        cooldown_until TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `;
    await sql`ALTER TABLE provider_credentials ADD COLUMN IF NOT EXISTS last_error TEXT`;
    await sql`ALTER TABLE provider_credentials ADD COLUMN IF NOT EXISTS model_id TEXT NOT NULL DEFAULT ''`;

    // 4. Gateway keys table
    await sql`
      CREATE TABLE IF NOT EXISTS gateway_keys (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT,
        key_hash VARCHAR(64) NOT NULL UNIQUE,
        key_preview VARCHAR(100) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'active',
        quota_per_minute INT NOT NULL DEFAULT 60,
        allowed_providers JSONB,
        tenant_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
      )
    `;
    await sql`ALTER TABLE gateway_keys ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT ''`;
    await sql`ALTER TABLE gateway_keys ADD COLUMN IF NOT EXISTS model_type TEXT NOT NULL DEFAULT 'text'`;
    await sql`ALTER TABLE gateway_keys ADD COLUMN IF NOT EXISTS model_id TEXT NOT NULL DEFAULT ''`;

    // 5. Request logs table
    await sql`
      CREATE TABLE IF NOT EXISTS request_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        gateway_key_id UUID,
        credential_id INT,
        provider_name TEXT,
        model_name TEXT,
        request_path TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        status_code INT,
        error_message TEXT,
        response_time_ms INT,
        tokens_used INT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // 6. Rotation settings table
    await sql`
      CREATE TABLE IF NOT EXISTS rotation_settings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        strategy TEXT NOT NULL DEFAULT 'per_provider',
        fallback_enabled BOOLEAN NOT NULL DEFAULT true,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // 7. Seed default rotation settings if not exists
    await sql`
      INSERT INTO rotation_settings (strategy, fallback_enabled)
      SELECT 'per_provider', true
      WHERE NOT EXISTS (SELECT 1 FROM rotation_settings)
    `;

    // 8. AI Models table
    await sql`
      CREATE TABLE IF NOT EXISTS ai_models (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        provider VARCHAR(50) NOT NULL,
        model_id TEXT NOT NULL,
        display_name TEXT NOT NULL,
        is_default BOOLEAN NOT NULL DEFAULT false,
        supports_vision BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    // 9. Seed default AI models if none exist (or rebuild if it is the old set)
    const countCheck = await sql`SELECT COUNT(*)::INT as count FROM ai_models`;
    const modelCount = countCheck[0]?.count || 0;

    if (modelCount === 0 || modelCount === 36) {
      console.log('[Seed] Rebuilding default AI models list...');
      await sql`TRUNCATE TABLE ai_models`;
      
      const defaultModels = [
        {provider: 'gemini', model_id: 'gemini-2.5-flash', display_name: 'Gemini 2.5 Flash', is_default: true, supports_vision: true },
        {provider: 'gemini', model_id: 'gemini-3.5-flash', display_name: 'Gemini 3.5 Flash', is_default: false, supports_vision: true },
        {provider: 'gemini', model_id: 'gemini-3.1-flash-lite', display_name: 'Gemini 3.1 Flash Lite', is_default: false, supports_vision: true },
        {provider: 'gemini', model_id: 'gemini-3.1-flash-lite-preview', display_name: 'Gemini 3.1 Flash Lite Preview', is_default: false, supports_vision: true },
        
        { provider: 'groq', model_id: 'llama-3.3-70b-versatile', display_name: 'LLaMA 3.3 70B', is_default: true, supports_vision: false },
        { provider: 'groq', model_id: 'llama-3.1-8b-instant', display_name: 'LLaMA 3.1 8B Instant', is_default: false, supports_vision: false },
        { provider: 'groq', model_id: 'mixtral-8x7b-32768', display_name: 'Mixtral 8x7B', is_default: false, supports_vision: false },
        { provider: 'groq', model_id: 'gemma2-9b-it', display_name: 'Gemma 2 9B', is_default: false, supports_vision: false },
        { provider: 'groq', model_id: 'deepseek-r1-distill-llama-70b', display_name: 'DeepSeek R1 70B', is_default: false, supports_vision: false },
        
        { provider: 'deepseek', model_id: 'deepseek-chat', display_name: 'DeepSeek Chat', is_default: true, supports_vision: false },
        { provider: 'deepseek', model_id: 'deepseek-reasoner', display_name: 'DeepSeek Reasoner', is_default: false, supports_vision: false },
        
        { provider: 'huggingface', model_id: 'mistralai/Mistral-7B-Instruct-v0.3', display_name: 'Mistral 7B', is_default: true, supports_vision: false },
        { provider: 'huggingface', model_id: 'HuggingFaceH4/zephyr-7b-beta', display_name: 'Zephyr 7B', is_default: false, supports_vision: false },
        { provider: 'huggingface', model_id: 'microsoft/DialoGPT-large', display_name: 'DialoGPT Large', is_default: false, supports_vision: false },
        
        { provider: 'cohere', model_id: 'command-r-plus', display_name: 'Command R+', is_default: true, supports_vision: false },
        { provider: 'cohere', model_id: 'command-r', display_name: 'Command R', is_default: false, supports_vision: false },
        { provider: 'cohere', model_id: 'command-light', display_name: 'Command Light', is_default: false, supports_vision: false },
        
        { provider: 'mistral', model_id: 'mistral-large-latest', display_name: 'Mistral Large', is_default: true, supports_vision: false },
        { provider: 'mistral', model_id: 'mistral-medium-latest', display_name: 'Mistral Medium', is_default: false, supports_vision: false },
        { provider: 'mistral', model_id: 'mistral-small-latest', display_name: 'Mistral Small', is_default: false, supports_vision: false },
        { provider: 'mistral', model_id: 'codestral-latest', display_name: 'Codestral', is_default: false, supports_vision: false },
        
        { provider: 'cerebras', model_id: 'llama3.1-8b', display_name: 'Llama 3.1 8B', is_default: true, supports_vision: false },
        { provider: 'cerebras', model_id: 'llama3.1-70b', display_name: 'Llama 3.1 70B', is_default: false, supports_vision: false }
      ];

      for (const m of defaultModels) {
        await sql`
          INSERT INTO ai_models (provider, model_id, display_name, is_default, supports_vision)
          VALUES (${m.provider}, ${m.model_id}, ${m.display_name}, ${m.is_default}, ${m.supports_vision})
        `;
      }
      console.log(`[Seed] ✅ Seeded ${defaultModels.length} default AI models.`);
    } else {
      // Just in case, clean up any old residues
      await sql`DELETE FROM ai_models WHERE provider IN ('openai', 'anthropic', 'together', 'perplexity')`;
    }

    console.log('[DB] Database initialized successfully');
  } catch (err) {
    console.error('[DB] Failed to initialize database:', err);
    throw err;
  }
}

export { sql };
