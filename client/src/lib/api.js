// In dev, Vite proxies /api/* to localhost:3001 (see vite.config.js), so API_BASE stays ''.
// In production the client is a static build with no proxy, so it needs the deployed
// server's URL — set VITE_API_URL at build time (see .env.example).
const API_BASE = import.meta.env.VITE_API_URL || '';

export function apiUrl(path) {
  return `${API_BASE}${path}`;
}

export function apiFetch(path, options) {
  return fetch(apiUrl(path), options);
}
