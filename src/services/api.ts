
import axios from 'axios';

// Backend base URL (tanpa /api — backend pakai prefix /api sendiri)
export const API_URL = (import.meta.env.VITE_API_URL as string || '').replace(/\/api\/?$/, '');
export const API_BASE = API_URL;

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request Interceptor — tambah JWT Bearer token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor — handle 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Clear token dan redirect ke login
      localStorage.removeItem('jwt_token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
