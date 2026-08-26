const explicitApiBaseUrl =
  import.meta.env.NEXT_PUBLIC_API_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL;

/**
 * Resolve the API base URL used by the generated HTTP client.
 *
 * By default this is the same-origin Vite base path (e.g. `` or
 * `/proxy/3000`) so the generated client turns `/api/...` into `/api/...` or
 * `/proxy/3000/api/...`. An explicitly configured API base URL still wins.
 */
export function resolveApiBaseUrl(
  baseUrl = import.meta.env.BASE_URL,
  explicitBaseUrl = explicitApiBaseUrl,
): string {
  return (explicitBaseUrl || baseUrl).replace(/\/$/, '');
}

export const API_BASE_URL = resolveApiBaseUrl();

/** Build a WebSocket URL on the same configured origin/path as the HTTP API. */
export function apiWebSocketUrl(pathname: string, apiBaseUrl = API_BASE_URL): URL {
  const url = new URL(`${apiBaseUrl}${pathname}`, globalThis.location?.href ?? 'http://localhost/');
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  return url;
}
