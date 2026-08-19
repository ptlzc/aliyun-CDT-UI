export const API_BASE_URL = (
  import.meta.env.NEXT_PUBLIC_API_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:8080'
).replace(/\/$/, '');

/** Build a WebSocket URL on the same configured origin as the HTTP API. */
export function apiWebSocketUrl(pathname: string): URL {
  const url = new URL(pathname, `${API_BASE_URL}/`);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url;
}
