import {AttachAddon} from '@xterm/addon-attach';
import {FitAddon} from '@xterm/addon-fit';
import {Terminal} from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import {X} from 'lucide-react';
import {useEffect, useRef, useState} from 'react';

import {apiWebSocketUrl} from '@/lib/api/baseUrl';
import type {ECSInstance} from '@/types';

interface SshModalProps {
  instance: ECSInstance;
  onClose: () => void;
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

const CONNECTION_STATUS_LABELS: Record<ConnectionStatus, string> = {
  connecting: '连接中',
  connected: '已连接',
  disconnected: '已断开',
  error: '错误',
};

function buildSshWebSocketUrl(instance: ECSInstance, rows: number, cols: number): string {
  const url = apiWebSocketUrl(
    `/api/accounts/${encodeURIComponent(instance.accountId)}/ecs/${encodeURIComponent(instance.id)}/ssh/ws`,
  );
  const params = {
    host: instance.publicIp,
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
 * Interactive xterm.js SSH terminal backed by the existing WebSocket endpoint.
 * The terminal, addons, socket, and observer form one mount-scoped session and
 * are all released together when the dialog closes.
 *
 * @when 实例卡片点击「SSH 登录」后渲染
 */
export default function SshModal({instance, onClose}: SshModalProps) {
  const terminalHostRef = useRef<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  useEffect(() => {
    const host = terminalHostRef.current;
    if (!host) return;

    setStatus('connecting');

    const terminal = new Terminal({
      cursorBlink: true,
      disableStdin: true,
      fontFamily: '"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace',
      fontSize: 13,
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
    terminal.open(host);
    fitAddon.fit();

    const ws = new WebSocket(buildSshWebSocketUrl(instance, terminal.rows, terminal.cols));
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
    resizeObserver.observe(host);

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
  }, [instance]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-primary-ink/40 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="flex h-[min(85vh,720px)] w-full max-w-5xl flex-col rounded-lg bg-surface-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-primary-ink">SSH 终端</h3>
            <p className="mt-1 text-xs text-secondary-ink">
              {instance.name} · {instance.id}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span
              aria-live="polite"
              className={`inline-flex items-center rounded border px-2 py-0.5 text-[10px] font-semibold ${
                status === 'connected'
                  ? 'border-healthy-green/30 bg-healthy-green/10 text-healthy-green'
                  : status === 'connecting'
                    ? 'border-signal-amber/30 bg-signal-amber/10 text-signal-amber'
                    : status === 'error'
                      ? 'border-recovery-red/30 bg-recovery-red/10 text-recovery-red'
                      : 'border-hairline-divider bg-emphasis-layer text-secondary-ink'
              }`}
            >
              {CONNECTION_STATUS_LABELS[status]}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="关闭 SSH 终端"
              className="cursor-pointer text-secondary-ink transition-colors hover:text-primary-ink"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-hidden rounded border border-hairline-divider bg-[#0d1117] p-3">
          <div
            ref={terminalHostRef}
            role="application"
            aria-label="SSH 交互终端"
            className="h-full w-full text-left"
          />
        </div>
      </div>
    </div>
  );
}
