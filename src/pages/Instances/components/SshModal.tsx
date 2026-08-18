import {FormEvent, useEffect, useRef, useState} from 'react';
import {X} from 'lucide-react';

import type {ECSInstance} from '../../../types';

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

function buildSshWebSocketUrl(instance: ECSInstance): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const params = new URLSearchParams({
    host: instance.publicIp,
    port: '22',
    user: 'root',
  });

  return `${protocol}//${host}/api/accounts/${encodeURIComponent(instance.accountId)}/ecs/${encodeURIComponent(instance.id)}/ssh/ws?${params.toString()}`;
}

/**
 * Lightweight SSH terminal modal backed by the backend WebSocket endpoint.
 * Keeps the UI intentionally small (no xterm dependency): stdout is rendered
 * in a <pre> block and stdin is sent line-by-line from the input.
 *
 * @when 实例卡片点击「SSH 登录」后渲染
 */
export default function SshModal({instance, onClose}: SshModalProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');
  const [output, setOutput] = useState('');
  const [command, setCommand] = useState('');

  useEffect(() => {
    const ws = new WebSocket(buildSshWebSocketUrl(instance));
    wsRef.current = ws;
    setStatus('connecting');

    ws.onopen = () => setStatus('connected');
    ws.onmessage = (event) => setOutput((prev) => prev + String(event.data));
    ws.onclose = () => setStatus('disconnected');
    ws.onerror = () => setStatus('error');

    return () => {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onclose = null;
      ws.onerror = null;
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    };
  }, [instance]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(`${command}\n`);
    }
    setCommand('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-primary-ink/40 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg bg-surface-white p-6 shadow-2xl"
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

        <pre className="mt-4 h-72 flex-1 overflow-auto whitespace-pre-wrap rounded border border-hairline-divider bg-workspace-canvas p-3 font-mono text-xs leading-relaxed text-primary-ink">
          {output || '等待 SSH 输出...'}
        </pre>

        <form onSubmit={handleSubmit} className="mt-3 flex gap-2">
          <input
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            placeholder="输入命令，回车发送"
            aria-label="SSH 命令输入"
            className="min-w-0 flex-1 rounded border border-hairline-divider bg-surface-white px-3 py-2 font-mono text-xs text-primary-ink focus:border-primary focus:outline-none"
          />
          <button
            type="submit"
            className="cursor-pointer rounded border border-primary/30 bg-primary/10 px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/20"
          >
            发送
          </button>
        </form>
      </div>
    </div>
  );
}
