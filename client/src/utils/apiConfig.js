/*
 * API configuration — single source of truth for backend URLs.
 *
 * Resolution order (first match wins):
 *   1. VITE_API_URL   — set at build time in .env / CI pipeline
 *   2. Runtime check  — localhost dev server gets full URL so requests
 *                       bypass the Vite proxy and hit the backend directly;
 *                       any other host (production) uses '' so Nginx's
 *                       /api → backend proxy handles routing without CORS.
 *
 * Vite proxy (vite.config.js /api → localhost:5000) also works in dev when
 * VITE_API_URL is unset AND you prefer the empty-origin approach — both paths
 * are valid; the runtime check below is the explicit fallback.
 */

const _isLocalhost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
   window.location.hostname === '127.0.0.1');

/*
 * API_ORIGIN — the host portion used as axios baseURL.
 * Paths in api.js already include the /api prefix (e.g. '/api/auth/login'),
 * so this is the bare origin only, never ending with '/api'.
 *
 *   Local dev   →  'http://localhost:5000'  (direct to backend; CORS allowed)
 *   Production  →  ''                       (relative; Nginx proxies /api)
 */
export const API_ORIGIN =
  import.meta.env.VITE_API_URL?.trim() ??
  (_isLocalhost ? 'http://localhost:5000' : '');

/*
 * API_BASE — full prefix including /api, used for apiFetch below.
 * e.g.  'http://localhost:5000/api'  or  '/api'
 */
export const API_BASE = `${API_ORIGIN}/api`;

/*
 * apiFetch — lightweight native-fetch wrapper.
 * Auth token is read from localStorage on every call so it is always
 * fresh (no stale closure).
 *
 * Usage:
 *   const data = await apiFetch('/auth/login', {
 *     method: 'POST',
 *     body: JSON.stringify({ email, password }),
 *   });
 */
export const apiFetch = async (path, options = {}) => {
  const token = localStorage.getItem('gstwand_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  /* Remove Content-Type for FormData — browser sets it with the boundary */
  if (options.body instanceof FormData) {
    delete headers['Content-Type'];
  }

  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    ...options,
    headers,
  });

  if (!res.ok) {
    /* Surface a readable error; callers can check err.status */
    const err = new Error(`API ${res.status}: ${res.statusText}`);
    err.status = res.status;
    try { err.data = await res.json(); } catch (_) { /* non-JSON body */ }

    /* Auto-logout on 401 */
    if (res.status === 401) {
      localStorage.removeItem('gstwand_token');
      localStorage.removeItem('gstwand_user');
    }

    throw err;
  }

  /* Return raw Response for blob/text endpoints; JSON for everything else */
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) return res.json();
  return res;
};
