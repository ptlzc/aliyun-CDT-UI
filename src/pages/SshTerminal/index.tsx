import {AttachAddon} from '@xterm/addon-attach';
import {FitAddon} from '@xterm/addon-fit';
import {Terminal} from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import {ArrowLeft} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';
import {useNavigate, useParams, useSearchParams} from 'react-router-dom';

import {apiWebSocketUrl} from '@/lib/api/baseUrl';

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

const CONNECTION_STATUS_LABELS: Record<ConnectionStatus, string> = {
  connecting: '连接中',
  connected: '已连接',
  disconnected: '已断开',
  error: '错误',
};

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
 * Full-screen open-source xterm.js SSH terminal backed by the existing
 * control-plane WebSocket endpoint. Opened in a new tab from the ECS list.
 */
export default function SshTerminalPage() {
  const {accountId = '', instanceId = ''} = useParams();
  const [searchParams] = useSearchParams();
  const host = searchParams.get('host') || '';
  const navigate = useNavigate();
  const terminalHostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  useEffect(() => {
    const hostEl = terminalHostRef.current;
    if (!hostEl) return;

    setStatus('connecting');
    const terminal = new Terminal({
      cursorBlink: true,
      disableStdin: true,
      fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
      fontSize: 14,
      lineHeight: 1.2,
      scrollback: 5000,
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
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
      setStatus('connected');
      terminal.focus();
    };
    ws.onclose = () => {
      terminal.options.disableStdin = true;
      setStatus('disconnected');
    };
    ws.onerror = () => {
      terminal.options.disableStdin = true;
      setStatus('error');
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

  return (
    <div className="flex h-screen w-screen flex-col bg-[#0d1117] text-white">
      <header className="flex items-center justify-between border-b border-white/10 bg-[#161b22] px-4 py-2">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => window.close()}
            className="flex cursor-pointer items-center gap-1 rounded px-2 py-1 text-xs text-gray-300 hover:bg-white/10"
            title="关闭标签页"
          >
            <ArrowLeft className="h-4 w-4" />
            关闭
          </button>
          <span className="text-sm font-semibold">SSH 终端</span>
          <span className="text-xs text-gray-400">
            {accountId} / {instanceId} {host ? `@ ${host}` : ''}
          </span>
        </div>
        <span
          aria-live="polite"
          className={`rounded border px-2 py-0.5 text-[10px] font-semibold ${
            status === 'connected'
              ? 'border-green-500/30 bg-green-500/10 text-green-400'
              : status === 'connecting'
                ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-400'
                : status === 'error'
                  ? 'border-red-500/30 bg-red-500/10 text-red-400'
                  : 'border-gray-500/30 bg-gray-500/10 text-gray-400'
          }`}
        >
          {CONNECTION_STATUS_LABELS[status]}
        </span>
      </header>
      <main className="min-h-0 flex-1 p-3">
        <div ref={terminalHostRef} role="application" aria-label="SSH 交互终端" className="h-full w-full text-left" />
      </main>
      <button
        type="button"
        onClick={() => navigate('/instances')}
        className="absolute bottom-3 right-3 rounded bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20"
      >
        返回实例列表
      </button>
    </div>
  );
}
