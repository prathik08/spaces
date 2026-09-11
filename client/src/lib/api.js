// In dev, Vite proxies /api/* to localhost:3001 (see vite.config.js), so API_BASE stays ''.
// In production the client is a static build with no proxy, so it needs the deployed
// server's URL — set VITE_API_URL at build time (see .env.example).
const API_BASE = import.meta.env.VITE_API_URL || '';

export function apiUrl(path) {
  return `${API_BASE}${path}`;
}

export function apiFetch(path, options) {
  // The session cookie is set by the server's GitHub OAuth callback; 'include'
  // is required for it to travel cross-origin (client and server are on
  // different domains in production).
  return fetch(apiUrl(path), { credentials: 'include', ...options });
}
