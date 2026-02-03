import express from 'express';
import { login, refreshToken, getMe } from '../controllers/authController.js';
import { authenticateToken } from '../middlewares/authMiddleware.js';
import { 
    getProviders, createProvider, updateProvider, deleteProvider,
    getProviderModels,
    getApiKeys, createApiKey, updateApiKey, deleteApiKey, bulkDeleteApiKeys,
    reorderApiKeys, setPrimaryKey, testApiKey,
    getLogs,
    getUnifiedKeys, createUnifiedKey, getUnifiedStats,
    getAnalytics,
    getRotationSettings, updateRotationSettings,
    updateUserProfile,
    getDashboardStats
} from '../controllers/dataController.js';

const router = express.Router();

// Auth Routes
router.post('/auth/login', login);
router.post('/auth/refresh', refreshToken);
router.get('/auth/me', authenticateToken, getMe);

// Provider Routes
router.get('/providers', authenticateToken, getProviders);
router.post('/providers', authenticateToken, createProvider);
router.put('/providers/:id', authenticateToken, updateProvider);
router.delete('/providers/:id', authenticateToken, deleteProvider);
router.get('/providers/:id/models', authenticateToken, getProviderModels);

// API Key Routes
router.get('/api-keys', authenticateToken, getApiKeys);
router.post('/api-keys', authenticateToken, createApiKey);
router.put('/api-keys/:id', authenticateToken, updateApiKey);
router.delete('/api-keys/:id', authenticateToken, deleteApiKey);
router.post('/api-keys/bulk-delete', authenticateToken, bulkDeleteApiKeys);
router.post('/api-keys/reorder', authenticateToken, reorderApiKeys);
router.put('/api-keys/:id/primary', authenticateToken, setPrimaryKey);
router.post('/api-keys/test', authenticateToken, testApiKey);

// Unified Key Routes
router.get('/unified/keys', authenticateToken, getUnifiedKeys);
router.post('/unified/keys', authenticateToken, createUnifiedKey);
router.get('/unified/stats', authenticateToken, getUnifiedStats);

// Logs
router.get('/logs', authenticateToken, getLogs);

// Analytics
router.get('/analytics', authenticateToken, getAnalytics);

// Settings & Profile
router.get('/settings/rotation', authenticateToken, getRotationSettings);
router.put('/settings/rotation', authenticateToken, updateRotationSettings);
router.put('/users/profile', authenticateToken, updateUserProfile);

// Dashboard
router.get('/dashboard/stats', authenticateToken, getDashboardStats);

// Gateway (Unified Chat)
import { chatCompletions } from '../controllers/gatewayController.js';
router.post('/v1/chat/completions', authenticateToken, chatCompletions);

export default router;