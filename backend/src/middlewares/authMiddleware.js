
import jwt from 'jsonwebtoken';
import db from '../config/database.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-it-in-production';

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access token required' });

  // 1. Check if it's a Unified API Key (for external tools like n8n)
  if (token.startsWith('ok_')) {
    const key = db.prepare('SELECT * FROM unified_api_keys WHERE api_key = ? AND is_active = 1').get(token);
    
    if (key) {
      req.user = { type: 'unified_api_key', id: key.id, name: key.name };
      
      // Update usage stats for this key
      db.prepare('UPDATE unified_api_keys SET total_requests = total_requests + 1, last_used_at = ? WHERE id = ?')
        .run(new Date().toISOString(), key.id);
        
      return next();
    }
    // If starts with ok_ but not found, it's invalid
    return res.status(403).json({ error: 'Token tidak valid' });
  }

  // 2. Fallback to JWT (for Dashboard)
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};
