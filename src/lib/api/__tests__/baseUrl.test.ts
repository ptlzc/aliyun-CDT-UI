import {describe, expect, it} from 'vitest';

import {API_BASE_URL, apiWebSocketUrl, resolveApiBaseUrl} from '../baseUrl';

describe('API_BASE_URL same-origin resolution', () => {
  it('defaults to the Vite base path without a trailing slash', () => {
    expect(API_BASE_URL).toBe(import.meta.env.BASE_URL.replace(/\/$/, ''));
  });

  it('resolves a root base to an empty string so generated clients prepend /api', () => {
    expect(resolveApiBaseUrl('/')).toBe('');
  });

  it('resolves a prefixed Vite base to /proxy/3000', () => {
    expect(resolveApiBaseUrl('/proxy/3000/')).toBe('/proxy/3000');
    expect(resolveApiBaseUrl('/proxy/3000')).toBe('/proxy/3000');
  });

  it('keeps an explicit API base override', () => {
    expect(resolveApiBaseUrl('/', 'http://localhost:18081')).toBe('http://localhost:18081');
    expect(resolveApiBaseUrl('/proxy/3000/', 'http://localhost:18081/')).toBe('http://localhost:18081');
  });

  it('builds WebSocket URLs on the same origin and API base path', () => {
    const url = apiWebSocketUrl('/api/runtime/ws');
    const expectedPath = `${API_BASE_URL}/api/runtime/ws`;
    expect(url.pathname).toBe(expectedPath);
    expect(url.protocol).toBe(window.location.protocol === 'https:' ? 'wss:' : 'ws:');
    expect(url.host).toBe(window.location.host);
  });

  it('preserves a prefixed Vite base in WebSocket paths', () => {
    const url = apiWebSocketUrl('/api/runtime/ws', '/proxy/3000');
    expect(url.pathname).toBe('/proxy/3000/api/runtime/ws');
  });
});
