import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, 'local.db');
const db = new Database(dbPath);

console.log('Seeding database at:', dbPath);

const providers = [
  {
    name: 'Google',
    base_url: 'https://generativelanguage.googleapis.com/v1beta',
    models: [
      { name: 'Gemini 2.5 Flash', model_id: 'gemini-2.5-flash' },
      { name: 'Gemini 2.5 Pro', model_id: 'gemini-2.5-pro' },
      { name: 'Gemini 1.5 Pro Vision', model_id: 'gemini-1.5-pro-vision' }
    ]
  },
  {
    name: 'Groq',
    base_url: 'https://api.groq.com/openai/v1',
    models: [
      { name: 'Llama 3.2 3B Instant', model_id: 'llama-3.2-3b-instant' },
      { name: 'Llama 3.1 8B Instant', model_id: 'llama-3.1-8b-instant' },
      { name: 'Mixtral 8x7B', model_id: 'mixtral-8x7b-32768' }
    ]
  },
  {
    name: 'OpenAI',
    base_url: 'https://api.openai.com/v1',
    models: [
      { name: 'GPT-4o', model_id: 'gpt-4o-2025-preview' },
      { name: 'GPT-4o Mini', model_id: 'gpt-4o-mini' },
      { name: 'o1 Preview', model_id: 'o1-preview' }
    ]
  },
  {
    name: 'Anthropic',
    base_url: 'https://api.anthropic.com/v1',
    models: [
      { name: 'Claude 3.5 Sonnet', model_id: 'claude-3-5-sonnet-20241022' },
      { name: 'Claude 3 Opus', model_id: 'claude-3-opus-20240229' }
    ]
  }
];

const generateApiKey = (providerName) => {
  const prefix = providerName.toLowerCase().slice(0, 3);
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let key = `${prefix}_`;
  for (let i = 0; i < 48; i++) {
    key += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return key;
};

const seed = () => {
  try {
    // Clean existing data (optional, be careful in prod)
    db.prepare('DELETE FROM provider_api_keys').run();
    db.prepare('DELETE FROM provider_models').run();
    db.prepare('DELETE FROM providers').run();
    
    console.log('Cleared existing data.');

    const insertProvider = db.prepare('INSERT INTO providers (id, name, base_url, is_active, priority) VALUES (?, ?, ?, ?, ?)');
    const insertModel = db.prepare('INSERT INTO provider_models (id, provider_id, name, model_id, is_active) VALUES (?, ?, ?, ?, ?)');
    const insertKey = db.prepare('INSERT INTO provider_api_keys (id, provider_id, model_id, api_key, name, is_active, priority, total_requests, failed_requests) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');

    let providerPriority = 100;

    for (const p of providers) {
      const providerId = uuidv4();
      console.log(`Inserting provider: ${p.name}`);
      insertProvider.run(providerId, p.name, p.base_url, 1, providerPriority);
      providerPriority -= 10;

      const modelIds = [];
      for (const m of p.models) {
        const pModelId = uuidv4();
        insertModel.run(pModelId, providerId, m.name, m.model_id, 1);
        modelIds.push(pModelId);
      }

      // Generate 5 API keys per provider
      for (let i = 0; i < 5; i++) {
        const keyId = uuidv4();
        const apiKey = generateApiKey(p.name);
        // Randomly assign a specific model preference to some keys, or null for all
        const modelId = Math.random() > 0.7 ? modelIds[Math.floor(Math.random() * modelIds.length)] : null;
        
        insertKey.run(
          keyId,
          providerId,
          modelId,
          apiKey,
          `${p.name} Key ${i + 1}`,
          1, // is_active
          5 - i, // priority
          Math.floor(Math.random() * 1000), // total_requests
          Math.random() > 0.8 ? Math.floor(Math.random() * 50) : 0 // failed_requests
        );

        // Generate Dummy Logs for this key
        const numLogs = Math.floor(Math.random() * 10) + 1; // 1-10 logs per key
        for (let j = 0; j < numLogs; j++) {
            const isSuccess = Math.random() > 0.1;
            const logStatus = isSuccess ? 'success' : 'error';
            const logCode = isSuccess ? 200 : (Math.random() > 0.5 ? 429 : 500);
            
            let modelName = 'unknown-model';
            if (modelId) {
                 const idx = modelIds.indexOf(modelId);
                 if (idx !== -1) modelName = p.models[idx].name;
            } else {
                 // Random model from provider
                 modelName = p.models[Math.floor(Math.random() * p.models.length)].name;
            }

            db.prepare(`
                INSERT INTO api_usage_logs (
                    id, provider_key_id, provider_id, model_name, request_path, 
                    status, status_code, error_message, response_time_ms, tokens_used, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' hours'))
            `).run(
                uuidv4(),
                keyId,
                providerId,
                modelName,
                '/v1/chat/completions',
                logStatus,
                logCode,
                isSuccess ? null : 'Simulated Error',
                Math.floor(Math.random() * 500) + 50,
                isSuccess ? Math.floor(Math.random() * 1000) : 0,
                Math.floor(Math.random() * 24 * 7) // Random time in last 7 days
            );
        }
      }
    }
    
    // Clean up Logs table if it gets too big (optional)
    // db.prepare('DELETE FROM api_usage_logs').run(); // Wait, we just inserted them. Remove this if copied.
    
    console.log('Seeding completed successfully!');
  } catch (error) {
    console.error('Seeding failed:', error);
  }
};

seed();
