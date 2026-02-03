import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../../local.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// Initialize Database Schema
const initDb = async () => {
  console.log('Initializing Database...');
  
  // Users
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed Admin User if not exists
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get('admin');
  if (!user) {
      console.log('Seeding admin user...');
      const passwordHash = await bcrypt.hash('admin', 10);
      db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(uuidv4(), 'admin', passwordHash);
      console.log('Admin user created (username: admin, password: admin)');
  }

  // Providers
  db.exec(`
    CREATE TABLE IF NOT EXISTS providers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      priority INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Provider Models
  db.exec(`
    CREATE TABLE IF NOT EXISTS provider_models (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      name TEXT NOT NULL,
      model_id TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(provider_id) REFERENCES providers(id) ON DELETE CASCADE
    );
  `);

  // Provider API Keys
  db.exec(`
    CREATE TABLE IF NOT EXISTS provider_api_keys (
      id TEXT PRIMARY KEY,
      provider_id TEXT NOT NULL,
      model_id TEXT,
      api_key TEXT NOT NULL,
      name TEXT,
      is_active INTEGER DEFAULT 1,
      priority INTEGER DEFAULT 0,
      total_requests INTEGER DEFAULT 0,
      failed_requests INTEGER DEFAULT 0,
      last_used_at DATETIME,
      last_error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(provider_id) REFERENCES providers(id) ON DELETE CASCADE,
      FOREIGN KEY(model_id) REFERENCES provider_models(id) ON DELETE SET NULL
    );
  `);

  // Unified API Keys
  db.exec(`
    CREATE TABLE IF NOT EXISTS unified_api_keys (
      id TEXT PRIMARY KEY,
      api_key TEXT UNIQUE NOT NULL,
      name TEXT,
      is_active INTEGER DEFAULT 1,
      total_requests INTEGER DEFAULT 0,
      failed_requests INTEGER DEFAULT 0,
      last_used_at DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration to add last_used_at to unified_api_keys if it doesn't exist
  try {
      const columns = db.pragma('table_info(unified_api_keys)');
      const hasLastUsedAt = columns.some(col => col.name === 'last_used_at');
      if (!hasLastUsedAt) {
          db.prepare('ALTER TABLE unified_api_keys ADD COLUMN last_used_at DATETIME').run();
          console.log('Migrated unified_api_keys: added last_used_at column');
      }
      
      const hasFailedRequests = columns.some(col => col.name === 'failed_requests');
      if (!hasFailedRequests) {
          db.prepare('ALTER TABLE unified_api_keys ADD COLUMN failed_requests INTEGER DEFAULT 0').run();
          console.log('Migrated unified_api_keys: added failed_requests column');
      }
  } catch (err) {
      console.error('Migration error:', err);
  }

  // API Usage Logs
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_usage_logs (
      id TEXT PRIMARY KEY,
      unified_key_id TEXT,
      provider_id TEXT,
      provider_key_id TEXT,
      model_name TEXT,
      request_path TEXT,
      status TEXT NOT NULL,
      status_code INTEGER,
      error_message TEXT,
      response_time_ms INTEGER,
      tokens_used INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(unified_key_id) REFERENCES unified_api_keys(id) ON DELETE SET NULL,
      FOREIGN KEY(provider_id) REFERENCES providers(id) ON DELETE SET NULL,
      FOREIGN KEY(provider_key_id) REFERENCES provider_api_keys(id) ON DELETE SET NULL
    );
  `);

  // Rotation Settings
  db.exec(`
    CREATE TABLE IF NOT EXISTS rotation_settings (
      id TEXT PRIMARY KEY,
      strategy TEXT DEFAULT 'per_provider' CHECK (strategy IN ('per_provider', 'global')),
      fallback_enabled INTEGER DEFAULT 1,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Seed rotation settings if empty
  const settings = db.prepare('SELECT * FROM rotation_settings LIMIT 1').get();
  if (!settings) {
      db.prepare('INSERT INTO rotation_settings (id, strategy, fallback_enabled) VALUES (?, ?, ?)').run(uuidv4(), 'per_provider', 1);
  }

  console.log('Database initialized successfully.');
};

initDb().catch(console.error);

export default db;