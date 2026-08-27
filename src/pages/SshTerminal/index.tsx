import {AttachAddon} from '@xterm/addon-attach';
import {FitAddon} from '@xterm/addon-fit';
import {Terminal} from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import {useEffect, useRef} from 'react';
import {useParams, useSearchParams} from 'react-router-dom';

import {apiWebSocketUrl} from '@/lib/api/baseUrl';

function buildSshWebSocketUrl(accountId: string, instanceId: string, host: string, rows: number, cols: number): string {
  const url = apiWebSocketUrl(`/api/accounts/${encodeURIComponent(accountId)}/ecs/${encodeURIComponent(instanceId)}/ssh/ws`);
  const params = {
    host,
    port: '22',
    user: 'root',
    term: 'xterm-256color',
    rows: String(rows),
    cols: String(cols),
  };
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

/**
 * Minimal full-screen SSH terminal. No extra chrome — just the xterm.js
 * terminal filling the browser viewport.
 */
export default function SshTerminalPage() {
  const {accountId = '', instanceId = ''} = useParams();
  const [searchParams] = useSearchParams();
  const host = searchParams.get('host') || '';
  const terminalHostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const hostEl = terminalHostRef.current;
    if (!hostEl) return;

    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
      fontSize: 14,
      lineHeight: 1.2,
      scrollback: 5000,
      theme: {
        background: '#000000',
        foreground: '#cccccc',
        cursor: '#cccccc',
        selectionBackground: '#264f78',
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(hostEl);
    fitAddon.fit();

    const ws = new WebSocket(buildSshWebSocketUrl(accountId, instanceId, host, terminal.rows, terminal.cols));
    const attachAddon = new AttachAddon(ws);
    terminal.loadAddon(attachAddon);

    ws.onopen = () => {
      terminal.options.disableStdin = false;
      terminal.focus();
    };
    ws.onclose = () => {
      terminal.options.disableStdin = true;
    };
    ws.onerror = () => {
      terminal.options.disableStdin = true;
    };

    const resizeObserver = new ResizeObserver(() => fitAddon.fit());
    resizeObserver.observe(hostEl);

    return () => {
      resizeObserver.disconnect();
      ws.onopen = null;
      ws.onclose = null;
      ws.onerror = null;
      attachAddon.dispose();
      fitAddon.dispose();
      terminal.dispose();
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [accountId, host, instanceId]);

  return <div ref={terminalHostRef} className="h-screen w-screen bg-black" />;
}
