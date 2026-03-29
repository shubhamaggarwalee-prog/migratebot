/**
 * frontend/lib/api.js
 * Centralised API client.
 *
 * Thin wrapper around fetch that:
 *   1. Automatically attaches the JWT from localStorage.
 *   2. Serialises request bodies to JSON.
 *   3. Parses response JSON and throws a structured ApiError on non-2xx.
 *   4. On 401 — clears the stored token and redirects to /login,
 *      UNLESS the request is to an auth endpoint (login/register/signup),
 *      where a 401 just means wrong credentials.
 *   5. On network failure — wraps the error with a human-friendly message.
 *
 * Usage:
 *   import api from '../lib/api';
 *
 *   // GET
 *   const { migrations } = await api.get('/api/migrations');
 *
 *   // POST
 *   const { migration } = await api.post('/api/migrations', { repourl, branch });
 *
 *   // PUT / PATCH / DELETE
 *   await api.put('/api/notifications/prefs', { migration_completed: false });
 *   await api.delete(`/api/credentials/${id}`);
 */

// ─── Base URL ────────────────────────────────────────────────────────────────
const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

// ─── Auth endpoints that should NOT trigger a session-expired redirect ────────
// A 401 on these routes means wrong credentials, not an expired session.
const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/signup', '/api/auth/login', '/api/auth/register', '/api/auth/signup'];

function isAuthPath(path) {
  return AUTH_PATHS.some((p) => path.includes(p));
}

// ─── Structured error class ─────────────────────────────────────────────────────

export class ApiError extends Error {
  /**
   * @param {string}  message     Human-readable description
   * @param {number}  status      HTTP status code
   * @param {object}  [body]      Parsed response body (may contain { error: string })
   */
  constructor(message, status, body = {}) {
    super(message);
    this.name    = 'ApiError';
    this.status  = status;
    this.body    = body;
  }
}

// ─── Token helpers ─────────────────────────────────────────────────────────

function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

function clearTokenAndRedirect() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
  // Hard redirect so stale React state is fully cleared
  window.location.href = '/login?reason=session_expired';
}

// ─── Core fetch wrapper ──────────────────────────────────────────────────────

/**
 * @param {string} path         e.g. '/api/migrations'
 * @param {object} [options]    fetch options override
 * @returns {Promise<any>}      Parsed JSON body on success
 * @throws  {ApiError}          On non-2xx or network failure
 */
async function request(path, options = {}) {
  const token = getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  // Prefix relative paths with the backend base URL
  const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      // Ensure body is JSON-encoded when provided as an object
      body: options.body && typeof options.body === 'object'
        ? JSON.stringify(options.body)
        : options.body,
    });
  } catch (networkErr) {
    // Covers CORS failures, DNS errors, timeouts, etc.
    throw new ApiError(
      'Network error — please check your connection and try again.',
      0,
      { originalError: networkErr.message }
    );
  }

  // Parse body (gracefully handle non-JSON responses)
  let body;
  const contentType = response.headers.get('Content-Type') || '';
  try {
    body = contentType.includes('application/json')
      ? await response.json()
      : await response.text();
  } catch {
    body = {};
  }

  // 401 — only redirect to session_expired for authenticated routes.
  // On auth endpoints (login/register), a 401 means wrong credentials —
  // let the error bubble up so the form can display the message.
  if (response.status === 401) {
    if (!isAuthPath(path)) {
      clearTokenAndRedirect();
      throw new ApiError('Session expired. Redirecting to login…', 401, body);
    }
    // Auth endpoint 401 — fall through to the error throw below
  }

  // Other non-2xx (and auth-endpoint 401s)
  if (!response.ok) {
    const message =
      (body && body.error) ||
      (body && body.message) ||
      `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status, body);
  }

  return body;
}

// ─── Convenience methods ─────────────────────────────────────────────────────

const api = {
  /** GET /path */
  get(path, options = {}) {
    return request(path, { method: 'GET', ...options });
  },

  /** POST /path  body: object */
  post(path, body, options = {}) {
    return request(path, { method: 'POST', body, ...options });
  },

  /** PUT /path  body: object */
  put(path, body, options = {}) {
    return request(path, { method: 'PUT', body, ...options });
  },

  /** PATCH /path  body: object */
  patch(path, body, options = {}) {
    return request(path, { method: 'PATCH', body, ...options });
  },

  /** DELETE /path */
  delete(path, options = {}) {
    return request(path, { method: 'DELETE', ...options });
  },

  /**
   * Multipart file upload. Do NOT pass Content-Type — the browser sets
   * the correct multipart boundary automatically.
   *
   * @param {string}    path
   * @param {FormData}  formData
   */
  upload(path, formData, options = {}) {
    const token = getToken();
    const url = path.startsWith('http') ? path : `${BASE_URL}${path}`;
    return request(url, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
        // Explicitly omit Content-Type so the browser can set it with boundary
      },
      body: formData,   // passed raw — NOT JSON.stringify'd
      ...options,
    });
  },
};

export default api;
