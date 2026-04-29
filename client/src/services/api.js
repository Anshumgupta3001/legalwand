import axios from 'axios';
import { API_ORIGIN } from '../utils/apiConfig';

/*
 * axios instance — baseURL is the bare origin (e.g. 'http://localhost:5000' in
 * dev, '' in production).  Every route path already includes the /api prefix,
 * so the full request URL becomes: origin + '/api/route'.
 *
 * Do NOT set VITE_API_URL in .env for normal local dev — the runtime detection
 * in apiConfig.js handles it automatically.  Set it only when you need to
 * point a local build at a remote backend (e.g. staging).
 */
const api = axios.create({
  baseURL: API_ORIGIN,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// Request interceptor — attach token if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('gstwand_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('gstwand_token');
      localStorage.removeItem('gstwand_user');
      // Optionally redirect to login
    }
    return Promise.reject(error);
  }
);

// Auth API calls
export const authAPI = {
  register: (data) => api.post('/api/auth/register', data),
  login: (data) => api.post('/api/auth/login', data),
  forgotPassword: (data) => api.post('/api/auth/forgot-password', data),
  verifyOTP: (data) => api.post('/api/auth/verify-otp', data),
  resendOTP: (data) => api.post('/api/auth/resend-otp', data),
  googleLogin: (credential) => api.post('/api/auth/google', { credential }),
  getMe: () => api.get('/api/auth/me'),
};

// Chat API calls (legacy — kept for backward compat)
export const chatAPI = {
  sendMessage: (message) => api.post('/api/chat/message', { message }),
};

// Chat history API
export const chatHistoryAPI = {
  createChat: (message) => api.post('/api/chat', { message }, { timeout: 90000 }),
  getChats: () => api.get('/api/chat'),
  getChatById: (id) => api.get(`/api/chat/${id}`),
  addMessage: (id, message) => api.post(`/api/chat/${id}/message`, { message }, { timeout: 90000 }),
  deleteChat: (id) => api.delete(`/api/chat/${id}`),
  regenerateMessage: (id, data) => api.post(`/api/chat/${id}/regenerate`, data, { timeout: 90000 }),
  getRelatedFiles: (query, excludeUrls) =>
    api.post('/api/chat/related-files', { query, excludeUrls }),
};

// News API calls (free — no credit deduction)
export const newsAPI = {
  getNews     : (query = '') => api.get('/api/news', { params: query ? { q: query } : {} }),
  summarize   : (url)        => api.post('/api/news/summarize', { url }, { timeout: 90000 }),
};

// Analytics dashboard API
export const analyticsAPI = {
  getDashboard: () => api.get('/api/dashboard'),
};

// Admin API
export const adminAPI = {
  getOverview: () => api.get('/api/admin/overview'),
  uploadFile: (file, adminKey) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/admin/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'x-admin-key': adminKey,
      },
      timeout: 120000, // 2 min — embedding can be slow for large files
    });
  },
};

// Multi-file disk upload API
export const uploadAPI = {
  uploadFiles: (files, onProgress) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    return api.post('/api/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0, // no timeout for large files
      onUploadProgress: onProgress,
    });
  },
  uploadFilesWithUrl: (files, url, onProgress) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file));
    formData.append('url', url);
    return api.post('/api/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0,
      onUploadProgress: onProgress,
    });
  },
  listFiles: () => api.get('/api/upload/files'),
  downloadFile: (filename) => api.get(`/api/upload/files/${encodeURIComponent(filename)}`, { responseType: 'blob' }),
  submitPdfUrl: (url) => api.post('/api/upload/url', { url }),
  previewFile: (file, url) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('url', url);
    return api.post('/api/upload/preview', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    });
  },
  previewUrl: (url) => api.post('/api/upload/preview-url', { url }, { timeout: 60000 }),
  confirmUpload: (previewId) => api.post('/api/upload/confirm', { previewId }, { timeout: 120000 }),
  // Multi-URL scrape: fetch all sequentially server-side, return preview cards
  previewUrls: (urls) => api.post('/api/upload/preview-urls', { urls }, { timeout: 120000 }),
  // Confirm-batch: store all sequentially server-side, return per-URL result
  confirmBatch: (items) => api.post('/api/upload/confirm-batch', { items }, { timeout: 300000 }),
  getJobStatus: (jobId) => api.get(`/api/upload/jobs/${jobId}`),
};

// File upload API (chat AI context — keeps existing behaviour)
export const fileAPI = {
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/file/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
  clearContext: () => api.delete('/api/file/context'),
  getContext: () => api.get('/api/file/context'),
  chatWithFile: (message) => api.post('/api/file/chat', { message }, { timeout: 60000 }),
};

// Document Library — AI-powered upload + retrieval
export const documentAPI = {
  uploadAI: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/api/documents/upload-ai', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 180000,
    });
  },
  getDocuments:     (params = {}) => api.get('/api/documents', { params }),
  getFilterOptions: ()            => api.get('/api/documents/filter-options'),
  getPresignedUrl:  (id)          => api.get(`/api/documents/${id}/presigned-url`),
  updateDocument:   (id, data)    => api.put(`/api/documents/${id}`, data),
  toggleVerify:     (id)          => api.patch(`/api/documents/${id}/verify`),
  bulkVerify:       (ids, verify) => api.patch('/api/documents/bulk-verify', { ids, verify }),
  getAuditLog:      (id)          => api.get(`/api/documents/${id}/audit`),

  /* Hybrid smart search */
  hybridSearch: (query, page = 1, limit = 20) =>
    api.post('/api/documents/search', { query, page, limit }, { timeout: 30000 }),

  /* CSV export — returns raw CSV, caller sets responseType: 'blob' */
  exportCSV: (params = {}) =>
    api.get('/api/documents/export', { params, responseType: 'blob', timeout: 60000 }),
};

// Analytics — MongoDB aggregation
export const analyticsDataAPI = {
  getAnalytics: () => api.get('/api/analytics', { timeout: 30000 }),
};

// AI Chat (Updated) — GST case law RAG search + answer
export const aiChatUpdatedAPI = {
  query: (query) => api.post('/api/ai-chat', { query }, { timeout: 60000 }),
};

// PDF export (puppeteer — returns PDF blob)
export const pdfAPI = {
  export: (messages, userName) =>
    api.post('/api/pdf/export', { messages, userName }, { responseType: 'blob', timeout: 60000 }),
};

export default api;
