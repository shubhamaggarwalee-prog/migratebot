/**
 * frontend/lib/api.js
 * HTTP client with JWT auth headers + named API helpers
 */
import { getToken } from './auth';

const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

async function request(method, path, body) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export const get = (path) => request('GET', path);
export const post = (path, body) => request('POST', path, body);
export const put = (path, body) => request('PUT', path, body);
export const del = (path) => request('DELETE', path);

export const apiClient = { get, post, put, delete: del };

export const migrations = {
  list: () => get('/api/migrations'),
  get: (id) => get(`/api/migrations/${id}`),
  create: (repoUrl, platforms, plan, branch) =>
    post('/api/migrations', { repoUrl, platforms, plan, branch }),
  start: (id) => post(`/api/migrations/${id}/start`),
  createPaymentIntent: (id) => post(`/api/migrations/${id}/payment-intent`),
};

export const credentials = {
  list: () => get('/api/credentials'),
  save: (platform, token) => post('/api/credentials', { platform, token }),
  delete: (platform) => del(`/api/credentials/${platform}`),
};

export const token = {
  get: getToken,
};
