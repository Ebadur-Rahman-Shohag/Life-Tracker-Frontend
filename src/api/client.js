import axios from 'axios';
import { dedupedFetch, invalidateCache, cacheKey } from '../lib/apiCache.js';

const PROJECTS_CACHE_TTL = 60_000;
const PROJECT_DETAIL_CACHE_TTL = 30_000;

export function invalidateProjectsCache() {
  invalidateCache('projects:');
}

// Use environment variable for API URL, fallback to '/api' for local development
const API_URL = import.meta.env.VITE_API_URL || '/api';

const client = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  
  // Prevent caching for GET requests by appending a timestamp query param.
  // Cache-control is handled by backend response headers — no need to send
  // Cache-Control/Pragma/Expires as *request* headers (they trigger CORS
  // preflight issues in production).
  if (config.method === 'get' || config.method === 'GET') {
    config.params = { ...config.params, _t: Date.now() };
  }
  
  return config;
});

client.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('auth-expired'));
    }
    return Promise.reject(err);
  }
);

export const auth = {
  register: (name, email, password) => client.post('/auth/register', { name, email, password }),
  login: (email, password) => client.post('/auth/login', { email, password }),
};

export const activities = {
  list: (params) => client.get('/activities', { params }),
  create: (data) => client.post('/activities', data),
  update: (id, data) => client.put(`/activities/${id}`, data),
  delete: (id) => client.delete(`/activities/${id}`),
};

export const projects = {
  list: (params) => client.get('/projects', { params }),
  listCached: (params) =>
    dedupedFetch(cacheKey(['projects', 'list', JSON.stringify(params || {})]), PROJECTS_CACHE_TTL, async () => {
      const { data } = await client.get('/projects', { params });
      return data;
    }),
  get: (id) => client.get(`/projects/${id}`),
  getCached: (id) =>
    dedupedFetch(cacheKey(['projects', 'get', id]), PROJECT_DETAIL_CACHE_TTL, async () => {
      const { data } = await client.get(`/projects/${id}`);
      return data;
    }),
  create: (data) => {
    invalidateProjectsCache();
    return client.post('/projects', data);
  },
  update: (id, data) => {
    invalidateProjectsCache();
    return client.put(`/projects/${id}`, data);
  },
  delete: (id) => {
    invalidateProjectsCache();
    return client.delete(`/projects/${id}`);
  },
  reorder: (projectIds) => client.put('/projects/reorder', { projectIds }),
  getNotes: (id, params) => client.get(`/projects/${id}/notes`, { params }),
  getReferences: (id, params) => client.get(`/projects/${id}/references`, { params }),
};

export const tasks = {
  list: (params) => client.get('/tasks', { params }),
  create: (data) => {
    if (data?.projectId) invalidateProjectsCache();
    return client.post('/tasks', data);
  },
  update: (id, data, config) => client.put(`/tasks/${id}`, data, config),
  toggle: (id, date) => client.post(`/tasks/${id}/toggle`, date ? { date } : {}),
  delete: (id) => client.delete(`/tasks/${id}`),
  reorder: (taskIds) => client.put('/tasks/reorder', { taskIds }),
};

export const habits = {
  list: (params) => client.get('/habits', { params }),
  create: (data) => client.post('/habits', data),
  update: (id, data) => client.put(`/habits/${id}`, data),
  delete: (id) => client.delete(`/habits/${id}`),
  reorder: (habitIds) => client.put('/habits/reorder', { habitIds }),
  getEntries: (startDate, endDate) => client.get('/habits/entries', { params: { startDate, endDate } }),
  toggleEntry: (habitId, date) => client.post('/habits/entries/toggle', { habitId, date }),
  getDailyStats: (startDate, endDate) => client.get('/habits/stats/daily', { params: { startDate, endDate } }),
  getMonthlyStats: (year) => client.get('/habits/stats/monthly', { params: { year } }),
  getStreakStats: () => client.get('/habits/stats/streak'),
  getHabitStreaks: () => client.get('/habits/stats/habit-streaks'),
  updateMilestone: (milestone, data) => client.put(`/habits/streaks/${milestone}`, data),
};

export const prayers = {
  getEntries: (startDate, endDate) => client.get('/prayers/entries', { params: { startDate, endDate } }),
  toggle: (prayerType, date) => client.post('/prayers/toggle', { prayerType, date }),
  getDailyStats: (startDate, endDate) => client.get('/prayers/stats/daily', { params: { startDate, endDate } }),
  getMonthlyStats: (year) => client.get('/prayers/stats/monthly', { params: { year } }),
  getStreakStats: () => client.get('/prayers/stats/streak'),
};

export const budget = {
  // Categories
  getCategories: (params) => client.get('/budget/categories', { params }),
  createCategory: (data) => client.post('/budget/categories', data),
  updateCategory: (id, data) => client.put(`/budget/categories/${id}`, data),
  deleteCategory: (id) => client.delete(`/budget/categories/${id}`),
  
  // Transactions
  getTransactions: (params) => client.get('/budget/transactions', { params }),
  createTransaction: (data) => client.post('/budget/transactions', data),
  updateTransaction: (id, data) => client.put(`/budget/transactions/${id}`, data),
  deleteTransaction: (id) => client.delete(`/budget/transactions/${id}`),
  
  // Summary & Aggregations
  getSummary: (params) => client.get('/budget/summary', { params }),
  getMonthly: (year) => client.get('/budget/monthly', { params: { year } }),
};

export const references = {
  list: (params) => client.get('/references', { params }),
  stats: () => client.get('/references/stats'),
  get: (id) => client.get(`/references/${id}`),
  create: (data) => client.post('/references', data),
  update: (id, data) => client.put(`/references/${id}`, data),
  delete: (id) => client.delete(`/references/${id}`),
};

export const notes = {
  list: (params) => client.get('/notes', { params }),
  stats: () => client.get('/notes/stats'),
  get: (id) => client.get(`/notes/${id}`),
  create: (data) => client.post('/notes', data),
  update: (id, data) => client.put(`/notes/${id}`, data),
  delete: (id) => client.delete(`/notes/${id}`),
  toggleFavorite: (id) => client.put(`/notes/${id}/favorite`),
  toggleArchive: (id) => client.put(`/notes/${id}/archive`),
  getByProject: (projectId, params) => client.get(`/notes/by-project/${projectId}`, { params }),
  // Categories
  getCategories: (params) => client.get('/notes/categories', { params }),
  createCategory: (data) => client.post('/notes/categories', data),
  updateCategory: (id, data) => client.put(`/notes/categories/${id}`, data),
  deleteCategory: (id) => client.delete(`/notes/categories/${id}`),
  reorderCategories: (categoryIds) => client.put('/notes/categories/reorder', { categoryIds }),
};

export const dashboard = {
  getSummary: () =>
    dedupedFetch(cacheKey(['dashboard', 'summary']), 30_000, async () => {
      const { data } = await client.get('/dashboard');
      return data;
    }),
  invalidateSummary: () => invalidateCache('dashboard:'),
};

export default client;
