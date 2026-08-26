import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

function resolveBase(): string {
  const proxyUri = process.env.VSCODE_PROXY_URI;
  if (proxyUri) {
    const port = process.env.WEB_PORT || '3000';
    const withPort = proxyUri.replaceAll('{{port}}', port);
    try {
      const url = new URL(withPort);
      const base = url.pathname.endsWith('/') ? url.pathname : `${url.pathname}/`;
      if (base && base !== '/') return base;
    } catch {
      // fall through to '/'
    }
  }
  return '/';
}

export default defineConfig(() => {
  const base = resolveBase();
  const backendProxyTarget = process.env.BACKEND_PROXY_TARGET || 'http://backend:8080';
  const baseApiPath = `${base}api`;
  const proxy = {
    '/api': {
      target: backendProxyTarget,
      changeOrigin: true,
      ws: true,
    },
    ...(base !== '/' ? {
      [baseApiPath]: {
        target: backendProxyTarget,
        changeOrigin: true,
        ws: true,
        rewrite: (path: string) => path.startsWith(baseApiPath) ? `/api${path.slice(baseApiPath.length)}` : path,
      },
    } : {}),
  };

  return {
    base,
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    server: {
      allowedHosts: ['code.3900x-wsl.hs'],
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy,
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/test/setup.ts',
      globals: true,
      include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      exclude: ['scripts/**/*.test.mjs'],
    },
  };
});
