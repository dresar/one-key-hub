import db from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import axios from 'axios';

// Helper to emit changes
const emitChange = (io, table, action, data) => {
  const eventMap = {
    'providers': 'providers:update',
    'provider_api_keys': 'apikeys:update',
    'unified_api_keys': 'unified-keys:update',
    'api_usage_logs': 'logs:insert'
  };
  
  const event = eventMap[table];
  if (event) {
    io.emit(event, data);
  }
};

// --- Providers ---
export const getProviders = (req, res) => {
  try {
    const providers = db.prepare('SELECT * FROM providers ORDER BY priority DESC').all();
    providers.forEach(p => p.is_active = !!p.is_active);
    res.json(providers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createProvider = (req, res) => {
  try {
    const { name, base_url, is_active } = req.body;
    const id = uuidv4();
    db.prepare('INSERT INTO providers (id, name, base_url, is_active) VALUES (?, ?, ?, ?)').run(id, name, base_url, is_active ? 1 : 0);
    const newProvider = { id, name, base_url, is_active };
    emitChange(req.io, 'providers', 'INSERT', newProvider);
    res.json(newProvider);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateProvider = (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const sets = [];
    const values = [];
    
    Object.keys(updates).forEach(key => {
      if (['name', 'base_url', 'is_active'].includes(key)) {
        sets.push(`${key} = ?`);
        values.push(typeof updates[key] === 'boolean' ? (updates[key] ? 1 : 0) : updates[key]);
      }
    });
    
    if (sets.length > 0) {
      values.push(id);
      db.prepare(`UPDATE providers SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      emitChange(req.io, 'providers', 'UPDATE', { id, ...updates });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteProvider = (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM providers WHERE id = ?').run(id);
    emitChange(req.io, 'providers', 'DELETE', { id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getProviderModels = (req, res) => {
  try {
    const { id } = req.params;
    const models = db.prepare('SELECT * FROM provider_models WHERE provider_id = ?').all(id);
    res.json(models);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- API Keys ---
export const getApiKeys = (req, res) => {
  try {
    const { provider_id } = req.query;
    let query = 'SELECT * FROM provider_api_keys';
    let params = [];
    
    if (provider_id) {
      query += ' WHERE provider_id = ?';
      params.push(provider_id);
    }
    query += ' ORDER BY priority DESC';
    
    const keys = db.prepare(query).all(...params);
    const models = db.prepare('SELECT id, name, model_id FROM provider_models').all();
    
    keys.forEach(k => {
      k.is_active = !!k.is_active;
      if (k.model_id) {
        const m = models.find(mod => mod.id === k.model_id);
        k.provider_models = m || null;
      }
    });
    
    res.json(keys);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createApiKey = (req, res) => {
  try {
    const data = req.body;
    const id = uuidv4();
    db.prepare(`
      INSERT INTO provider_api_keys (id, provider_id, api_key, name, model_id, is_active, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id, data.provider_id, data.api_key, data.name || null, 
      data.model_id || null, data.is_active !== false ? 1 : 0, data.priority || 0
    );
    const newKey = { id, ...data };
    emitChange(req.io, 'provider_api_keys', 'INSERT', newKey);
    res.json(newKey);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateApiKey = (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const sets = [];
    const values = [];
    
    Object.keys(updates).forEach(key => {
      if (['api_key', 'name', 'model_id', 'is_active', 'priority', 'last_error'].includes(key)) {
        sets.push(`${key} = ?`);
        let val = updates[key];
        if (typeof val === 'boolean') val = val ? 1 : 0;
        values.push(val);
      }
    });
    
    if (sets.length > 0) {
      values.push(id);
      db.prepare(`UPDATE provider_api_keys SET ${sets.join(', ')} WHERE id = ?`).run(...values);
      emitChange(req.io, 'provider_api_keys', 'UPDATE', { id, ...updates });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteApiKey = (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM provider_api_keys WHERE id = ?').run(id);
    emitChange(req.io, 'provider_api_keys', 'DELETE', { id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const bulkDeleteApiKeys = (req, res) => {
  const { ids } = req.body; // Array of IDs
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'No IDs provided' });
  }

  try {
    const deleteStmt = db.prepare('DELETE FROM provider_api_keys WHERE id = ?');
    const transaction = db.transaction((keyIds) => {
      for (const id of keyIds) {
        deleteStmt.run(id);
      }
    });

    transaction(ids);
    
    // Emit change for each ID or just a general refresh? 
    // Emitting individual events might be spammy but safe for now.
    // Ideally client re-fetches.
    ids.forEach(id => emitChange(req.io, 'provider_api_keys', 'DELETE', { id }));

    res.json({ success: true, count: ids.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const reorderApiKeys = (req, res) => {
  try {
    const { updates } = req.body;
    const stmt = db.prepare('UPDATE provider_api_keys SET priority = ? WHERE id = ?');
    const transaction = db.transaction((items) => {
      for (const item of items) stmt.run(item.priority, item.id);
    });
    transaction(updates);
    emitChange(req.io, 'provider_api_keys', 'UPDATE', { reordered: true });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const setPrimaryKey = (req, res) => {
  try {
    const { id } = req.params;
    const key = db.prepare('SELECT provider_id FROM provider_api_keys WHERE id = ?').get(id);
    if (!key) return res.status(404).json({ error: 'Key not found' });
    
    db.prepare('UPDATE provider_api_keys SET priority = 0 WHERE provider_id = ?').run(key.provider_id);
    db.prepare('UPDATE provider_api_keys SET priority = 100 WHERE id = ?').run(id);
    
    emitChange(req.io, 'provider_api_keys', 'UPDATE', { id, priority: 100 });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const testApiKey = async (req, res) => {
  try {
    const { api_key_id, model_id, provider_id, message } = req.body;
    
    // 1. Get Provider and API Key details
    const provider = db.prepare('SELECT * FROM providers WHERE id = ?').get(provider_id);
    const apiKeyData = db.prepare('SELECT api_key, name FROM provider_api_keys WHERE id = ?').get(api_key_id);
    
    if (!provider || !apiKeyData) {
        return res.status(404).json({ success: false, status: 'error', error: 'Provider or API Key not found' });
    }

    const apiKey = apiKeyData.api_key;
    const userMessage = message || "Hello, are you working?";
    const targetModel = model_id || 'gpt-3.5-turbo'; // Default fallback

    let responseData = null;
    let errorMessage = null;
    let status = 'active';
    let statusCode = 200;
    const startTime = Date.now();
    let tokensUsed = 0;

    // 2. Make the actual API Call
    try {
        if (provider.name.toLowerCase().includes('google')) {
            // Google Gemini
            const url = `${provider.base_url}/models/${targetModel}:generateContent?key=${apiKey}`;
            const response = await axios.post(url, {
                contents: [{ parts: [{ text: userMessage }] }]
            }, { timeout: 30000 });
            
            responseData = response.data.candidates?.[0]?.content?.parts?.[0]?.text || "No response text";
            tokensUsed = response.data.usageMetadata?.totalTokenCount || 0;

        } else if (provider.name.toLowerCase().includes('anthropic')) {
            // Anthropic Claude
            const response = await axios.post(`${provider.base_url}/messages`, {
                model: targetModel,
                max_tokens: 1024,
                messages: [{ role: 'user', content: userMessage }]
            }, {
                headers: {
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'content-type': 'application/json'
                },
                timeout: 30000
            });

            responseData = response.data.content?.[0]?.text || "No response text";
            tokensUsed = response.data.usage?.output_tokens + response.data.usage?.input_tokens || 0;

        } else {
            // OpenAI, Groq, and others (OpenAI compatible)
            // Fix base_url if it doesn't end with /v1 (though seed data has /v1)
            let baseUrl = provider.base_url;
            if (provider.name.toLowerCase().includes('openai') && !baseUrl.includes('chat/completions')) {
                 baseUrl = `${baseUrl}/chat/completions`;
            } else if (provider.name.toLowerCase().includes('groq') && !baseUrl.includes('chat/completions')) {
                 baseUrl = `${baseUrl}/chat/completions`;
            } else if (!baseUrl.endsWith('/chat/completions')) {
                 // Fallback for custom providers usually pointing to /v1
                 baseUrl = `${baseUrl}/chat/completions`;
            }

            // Correction: seed.js has base_url like 'https://api.openai.com/v1'
            // So we just need to ensure we append /chat/completions if not present, but avoid double slash
            if (!provider.base_url.endsWith('/chat/completions')) {
                // If base_url is '.../v1', we add '/chat/completions'
                 baseUrl = `${provider.base_url}/chat/completions`.replace('v1//', 'v1/'); 
            } else {
                 baseUrl = provider.base_url;
            }

            const response = await axios.post(baseUrl, {
                model: targetModel,
                messages: [{ role: 'user', content: userMessage }]
            }, {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            });

            responseData = response.data.choices?.[0]?.message?.content || "No response text";
            tokensUsed = response.data.usage?.total_tokens || 0;
        }

    } catch (error) {
        console.error('API Call Error:', error.response?.data || error.message);
        status = 'error';
        statusCode = error.response?.status || 500;
        errorMessage = JSON.stringify(error.response?.data || error.message);
        
        // Map common errors
        if (statusCode === 429) {
            errorMessage = 'Quota Exceeded or Rate Limit';
            status = 'warning';
        } else if (statusCode === 401) {
            errorMessage = 'Invalid API Key';
            status = 'error';
        }
    }

    const latency = Date.now() - startTime;

    // 3. Log to Database
    const logId = uuidv4();
    const logEntry = {
        id: logId,
        provider_key_id: api_key_id,
        provider_id: provider_id, 
        model_name: targetModel,
        request_path: '/v1/chat/completions', // Normalized path for logging
        status: status === 'active' ? 'success' : 'error',
        status_code: statusCode,
        error_message: errorMessage,
        response_time_ms: latency,
        tokens_used: tokensUsed,
        created_at: new Date().toISOString()
    };

    db.prepare(`
        INSERT INTO api_usage_logs (
            id, provider_key_id, provider_id, model_name, request_path, 
            status, status_code, error_message, response_time_ms, tokens_used, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        logEntry.id, logEntry.provider_key_id, logEntry.provider_id, logEntry.model_name, logEntry.request_path,
        logEntry.status, logEntry.status_code, logEntry.error_message, logEntry.response_time_ms, logEntry.tokens_used, logEntry.created_at
    );

    // Update key status/last error if failed
    if (status !== 'active') {
         db.prepare('UPDATE provider_api_keys SET last_error = ?, failed_requests = failed_requests + 1 WHERE id = ?')
           .run(errorMessage, api_key_id);
    } else {
         // Reset error if success
         db.prepare('UPDATE provider_api_keys SET last_error = NULL WHERE id = ?')
           .run(api_key_id);
    }

    const enrichedLog = {
        ...logEntry,
        provider_name: provider.name,
        api_key_name: apiKeyData.name
    };

    emitChange(req.io, 'api_usage_logs', 'INSERT', enrichedLog);

    // 4. Return Response
    if (status === 'active' || status === 'success') {
        res.json({
            success: true,
            response_time_ms: latency,
            status: 'active',
            message: {
                role: 'assistant',
                content: responseData
            }
        });
    } else {
        res.json({ 
            success: false, 
            status: status === 'warning' ? 'quota_exceeded' : 'invalid', // Map to frontend expected status codes
            error: errorMessage 
        });
    }

  } catch (error) {
    console.error('Test API Key General Error:', error);
    res.json({ success: false, status: 'error', error: error.message });
  }
};

// --- Logs ---
export const getLogs = (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;
    
    let query = 'SELECT * FROM api_usage_logs';
    let params = [];
    
    if (status) {
      query += ' WHERE status = ?';
      params.push(status);
    }
    
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    const data = db.prepare(query).all(...params);
    
    let countQuery = 'SELECT COUNT(*) as count FROM api_usage_logs';
    let countParams = [];
    if (status) {
        countQuery += ' WHERE status = ?';
        countParams.push(status);
    }
    const total = db.prepare(countQuery).get(...countParams).count;

    const providers = db.prepare('SELECT id, name FROM providers').all();
    const keys = db.prepare('SELECT id, name FROM provider_api_keys').all();
    
    const enrichedData = data.map(log => ({
        ...log,
        provider: providers.find(p => p.id === log.provider_id) || null,
        api_key: keys.find(k => k.id === log.provider_key_id) || null
    }));

    res.json({ data: enrichedData, total });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- Unified Keys ---
export const getUnifiedKeys = (req, res) => {
  try {
    const keys = db.prepare('SELECT * FROM unified_api_keys ORDER BY created_at DESC').all();
    keys.forEach(k => k.is_active = !!k.is_active);
    res.json(keys);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const createUnifiedKey = (req, res) => {
  try {
    const { name } = req.body;
    const id = uuidv4();
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let api_key = 'ok_';
    for (let i = 0; i < 32; i++) api_key += chars.charAt(Math.floor(Math.random() * chars.length));

    db.prepare('INSERT INTO unified_api_keys (id, api_key, name) VALUES (?, ?, ?)').run(id, api_key, name);
    const newKey = { id, api_key, name, is_active: true, total_requests: 0, created_at: new Date().toISOString() };
    emitChange(req.io, 'unified_api_keys', 'INSERT', newKey);
    res.json(newKey);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getUnifiedStats = (req, res) => {
  try {
    const totalProviders = db.prepare('SELECT COUNT(*) as c FROM providers WHERE is_active = 1').get().c;
    const totalActiveKeys = db.prepare('SELECT COUNT(*) as c FROM provider_api_keys WHERE is_active = 1').get().c;
    const totalRequests = db.prepare('SELECT SUM(total_requests) as s FROM unified_api_keys').get().s || 0;
    
    res.json({ totalProviders, totalActiveKeys, totalRequests });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- Analytics ---
export const getAnalytics = (req, res) => {
  try {
    const { period = 'weekly' } = req.query;
    const days = period === 'monthly' ? 30 : 7;
    
    // Chart Data
    const chartQuery = `
        SELECT 
          date(created_at) as date,
          COUNT(*) as total,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error,
          SUM(tokens_used) as tokens
        FROM api_usage_logs
        WHERE created_at >= date('now', '-' || ? || ' days')
        GROUP BY date(created_at)
        ORDER BY date ASC
    `;
    
    const rawData = db.prepare(chartQuery).all(days);
    
    // Fill in missing dates
    const data = [];
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        
        const existing = rawData.find(r => r.date === dateStr);
        if (existing) {
            data.push(existing);
        } else {
            data.push({ date: dateStr, total: 0, success: 0, error: 0, tokens: 0 });
        }
    }

    // Summary Data (All time or matching period? Usually dashboard summary is all time or huge period)
    // Let's make it match the period for relevance, or all time if requested. 
    // Usually "Analytics" header implies the viewed period.
    
    const summaryQuery = `
        SELECT
          COUNT(*) as total_requests,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success_requests,
          SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as error_requests,
          SUM(tokens_used) as total_tokens
        FROM api_usage_logs
        WHERE created_at >= date('now', '-' || ? || ' days')
    `;
    
    const summary = db.prepare(summaryQuery).get(days);
    
    // Calculate success rate
    const success_rate = summary.total_requests > 0 
        ? Math.round((summary.success_requests / summary.total_requests) * 100) 
        : 0;

    res.json({ 
        data, 
        summary: {
            ...summary,
            success_rate
        }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- Settings ---
export const getRotationSettings = (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM rotation_settings LIMIT 1').get();
    if (settings) {
        settings.fallback_enabled = !!settings.fallback_enabled;
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateRotationSettings = (req, res) => {
  try {
    const { strategy, fallback_enabled } = req.body;
    db.prepare('UPDATE rotation_settings SET strategy = ?, fallback_enabled = ?').run(strategy, fallback_enabled ? 1 : 0);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    
    if (newPassword) {
        if (!currentPassword) return res.status(400).json({ error: 'Current password required' });
        const valid = await bcrypt.compare(currentPassword, user.password_hash);
        if (!valid) return res.status(400).json({ error: 'Invalid current password' });
        
        const newHash = await bcrypt.hash(newPassword, 10);
        db.prepare('UPDATE users SET username = ?, password_hash = ? WHERE id = ?').run(username, newHash, userId);
    } else {
        db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, userId);
    }
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// --- Dashboard ---
export const getDashboardStats = (req, res) => {
  try {
    const totalProviders = db.prepare('SELECT COUNT(*) as c FROM providers').get().c;
    const totalActiveKeys = db.prepare('SELECT COUNT(*) as c FROM provider_api_keys WHERE is_active = 1').get().c;
    const failedKeys = db.prepare('SELECT COUNT(*) as c FROM provider_api_keys WHERE failed_requests > 0').get().c;
    const requestsToday = db.prepare("SELECT COUNT(*) as c FROM api_usage_logs WHERE created_at >= date('now')").get().c;
    
    res.json({ totalProviders, totalActiveKeys, failedKeys, requestsToday });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
