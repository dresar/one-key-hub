import axios from 'axios';
import db from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

// Helper to emit changes
const emitChange = (io, table, action, data) => {
  const eventMap = {
    'providers': 'providers:update',
    'provider_api_keys': 'apikeys:update',
    'api_usage_logs': 'logs:insert'
  };
  const event = eventMap[table];
  if (event) {
    io.emit(event, data);
  }
};

const getAllCandidates = (targetModel) => {
    // 1. Get Active Providers Sorted by Priority
    // User requested: "dimulai dari provider dengan ID paling atas" -> priority DESC, id ASC
    const providers = db.prepare(`
        SELECT * FROM providers 
        WHERE is_active = 1 
        ORDER BY priority DESC, id ASC
    `).all();

    const candidates = [];

    for (const provider of providers) {
        // Check model support
        if (targetModel) {
            const supportsModel = db.prepare('SELECT 1 FROM provider_models WHERE provider_id = ? AND model_id = ?').get(provider.id, targetModel);
            if (!supportsModel) continue;
        }

        // Get active keys for this provider
        const keys = db.prepare(`
            SELECT * FROM provider_api_keys 
            WHERE provider_id = ? AND is_active = 1 
            ORDER BY priority DESC, id ASC
        `).all(provider.id);

        for (const key of keys) {
            candidates.push({ key, provider });
        }
    }
    
    return candidates;
};

const handleFailure = (req, key, provider, error) => {
    console.error(`Request failed for Key ${key.id} (Provider: ${provider.name}):`, error.message);
    if (error.response?.data) {
        console.error('Provider Error Details:', JSON.stringify(error.response.data, null, 2));
    }
    
    // 1. Update Key Stats
    // We deprioritize the key so future requests try others first (Circuit Breaker)
    db.prepare(`
        UPDATE provider_api_keys 
        SET failed_requests = failed_requests + 1, 
            last_error = ?,
            priority = CASE WHEN priority > 0 THEN priority - 1 ELSE 0 END
        WHERE id = ?
    `).run(error.message, key.id);
    
    emitChange(req.io, 'provider_api_keys', 'UPDATE', { id: key.id }); // Trigger UI update

    // 2. Check if Provider should be deprioritized (if all keys failed)
    const goodKeys = db.prepare(`
        SELECT count(*) as c FROM provider_api_keys 
        WHERE provider_id = ? AND is_active = 1 AND priority > 0
    `).get(provider.id).c;
    
    if (goodKeys === 0) {
        // Deprioritize Provider if no good keys left
        db.prepare('UPDATE providers SET priority = CASE WHEN priority > 0 THEN priority - 1 ELSE 0 END WHERE id = ?').run(provider.id);
        emitChange(req.io, 'providers', 'UPDATE', { id: provider.id });
    }
};

export const chatCompletions = async (req, res) => {
    const { model, messages, stream } = req.body;
    const targetModel = model; 
    
    // Get all potential candidates (Provider + Key) sorted by priority
    const candidates = getAllCandidates(targetModel);

    if (candidates.length === 0) {
        return res.status(503).json({ error: `Tidak ada provider aktif untuk model: ${targetModel}` });
    }

    let lastError = null;
    const errors = [];
    
    // Try each candidate sequentially
    for (const candidate of candidates) {
        const { key, provider } = candidate;
        
        // Skip if key/provider was just deprioritized in this same loop (optimization)?
        // No, getAllCandidates is a snapshot. We try them all.
        
        const logId = uuidv4();
        const startTime = Date.now();
        
        try {
            // Map request to provider URL and Format
            let url = provider.base_url;
            let headers = {
                'Authorization': `Bearer ${key.api_key}`,
                'Content-Type': 'application/json'
            };
            let data = req.body; 

            // Provider Specific Handling
            if (provider.name.toLowerCase().includes('google')) {
                const contents = messages.map(m => ({
                    role: m.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: m.content }]
                }));
                url = `${provider.base_url}/models/${targetModel}:generateContent?key=${key.api_key}`;
                delete headers['Authorization']; 
                data = { contents };

            } else if (provider.name.toLowerCase().includes('anthropic')) {
                url = `${provider.base_url}/messages`;
                headers['x-api-key'] = key.api_key;
                headers['anthropic-version'] = '2023-06-01';
                delete headers['Authorization']; 
                data = {
                    model: targetModel,
                    messages: messages.filter(m => m.role !== 'system'), 
                    max_tokens: req.body.max_tokens || 1024
                };
                const systemMsg = messages.find(m => m.role === 'system');
                if (systemMsg) data.system = systemMsg.content;

            } else {
                 if (!url.endsWith('/chat/completions')) {
                    url = `${url.replace(/\/+$/, '')}/chat/completions`;
                }
            }
            
            const response = await axios.post(url, data, {
                headers,
                timeout: 30000 // 30s timeout
            });

            // Log Success
            const responseTime = Date.now() - startTime;
            
            // Normalize Response
            let clientResponse = response.data;
            let tokensUsed = 0;

            if (provider.name.toLowerCase().includes('google')) {
                 const text = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "";
                 tokensUsed = response.data.usageMetadata?.totalTokenCount || 0;
                 clientResponse = {
                     id: "chatcmpl-" + uuidv4(),
                     object: "chat.completion",
                     created: Math.floor(Date.now() / 1000),
                     model: targetModel,
                     choices: [{
                         index: 0,
                         message: { role: "assistant", content: text },
                         finish_reason: "stop"
                     }],
                     usage: { total_tokens: tokensUsed }
                 };
            } else if (provider.name.toLowerCase().includes('anthropic')) {
                 const text = response.data.content?.[0]?.text || "";
                 tokensUsed = (response.data.usage?.input_tokens || 0) + (response.data.usage?.output_tokens || 0);
                 clientResponse = {
                     id: response.data.id,
                     object: "chat.completion",
                     created: Math.floor(Date.now() / 1000),
                     model: targetModel,
                     choices: [{
                         index: 0,
                         message: { role: "assistant", content: text },
                         finish_reason: response.data.stop_reason
                     }],
                     usage: { total_tokens: tokensUsed }
                 };
            } else {
                tokensUsed = response.data.usage?.total_tokens || 0;
            }

            db.prepare(`
                INSERT INTO api_usage_logs (
                    id, provider_key_id, provider_id, model_name, request_path, 
                    status, status_code, response_time_ms, tokens_used
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                logId, key.id, provider.id, model, '/v1/chat/completions',
                'success', response.status, responseTime, 
                tokensUsed
            );
            
            db.prepare('UPDATE provider_api_keys SET total_requests = total_requests + 1 WHERE id = ?').run(key.id);
            
            const logEntry = db.prepare('SELECT * FROM api_usage_logs WHERE id = ?').get(logId);
            const enrichedLog = { ...logEntry, provider_name: provider.name, api_key_name: key.name };
            emitChange(req.io, 'api_usage_logs', 'INSERT', enrichedLog);

            return res.json(clientResponse);

        } catch (error) {
            lastError = error;
            const responseTime = Date.now() - startTime;
            const statusCode = error.response?.status || 500;
            
            // Log Failure
            db.prepare(`
                INSERT INTO api_usage_logs (
                    id, provider_key_id, provider_id, model_name, request_path, 
                    status, status_code, error_message, response_time_ms
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
                logId, key.id, provider.id, model, '/v1/chat/completions',
                'error', statusCode, error.message, responseTime
            );
            
            const logEntry = db.prepare('SELECT * FROM api_usage_logs WHERE id = ?').get(logId);
            const enrichedLog = { ...logEntry, provider_name: provider.name, api_key_name: key.name };
            emitChange(req.io, 'api_usage_logs', 'INSERT', enrichedLog);

            // Handle Rotation Logic
            handleFailure(req, key, provider, error);
            
            errors.push({
                provider: provider.name,
                key: key.name,
                status: statusCode,
                message: error.message
            });
            
            // Continue to next candidate...
        }
    }

    // All attempts failed
    if (req.user?.type === 'unified_api_key') {
        db.prepare('UPDATE unified_api_keys SET failed_requests = failed_requests + 1 WHERE id = ?').run(req.user.id);
        emitChange(req.io, 'unified_api_keys', 'UPDATE', { id: req.user.id });
    }

    // Determine user-friendly error message
    const allRateLimited = errors.length > 0 && errors.every(e => e.status === 429);
    const finalMessage = allRateLimited 
        ? 'Semua API key terkena limit.' 
        : 'Semua provider gagal memproses permintaan.';

    res.status(502).json({ 
        error: finalMessage, 
        last_error: lastError?.message,
        details: errors
    });
};
