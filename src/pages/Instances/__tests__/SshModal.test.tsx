import {act, render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';

import type {ECSInstance} from '../../../types';
import SshModal from '../components/SshModal';

/**
 * Minimal WebSocket double used to assert the SSH modal's connection lifecycle
 * without relying on jsdom's missing WebSocket implementation.
 */
class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  url: string;
  readyState: number = FakeWebSocket.CONNECTING;
  sent: string[] = [];
  closed = false;
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: Event) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.closed = true;
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.(new Event('close'));
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  receive(data: string) {
    this.onmessage?.({data} as MessageEvent);
  }

  fail() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onerror?.(new Event('error'));
  }
}

const defaultInstance: ECSInstance = {
  id: 'i-1',
  accountId: 'acc-1',
  accountName: 'Account A',
  name: 'ecs-a',
  status: 'Running',
  type: 'ecs.g6.large',
  zone: 'cn-hangzhou-i',
  regionId: 'cn-hangzhou-i',
  publicIp: '1.1.1.1',
  privateIp: '10.0.0.1',
  trafficUsage: null,
  trafficUsageUnit: 'GB',
  trafficRate: 22.5,
  trafficRateUnit: 'Mbps',
  trafficLimit: 200,
  monitoringEnabled: true,
  overflowAction: 'notify',
  inherited: true,
  alerts: [],
};

function renderSsh(instance: ECSInstance = defaultInstance) {
  const onClose = vi.fn();
  const utils = render(<SshModal instance={instance} onClose={onClose} />);
  const ws = FakeWebSocket.instances[FakeWebSocket.instances.length - 1];
  return {onClose, ws, ...utils};
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeWebSocket.instances = [];
});

describe('SshModal', () => {
  it('opens a WebSocket to the SSH endpoint and starts in connecting state', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);

    renderSsh();

    const ws = FakeWebSocket.instances[0];
    const parsed = new URL(ws.url);
    expect(parsed.protocol).toBe('ws:');
    expect(parsed.pathname).toBe('/api/accounts/acc-1/ecs/i-1/ssh/ws');
    expect(parsed.searchParams.get('host')).toBe('1.1.1.1');
    expect(parsed.searchParams.get('port')).toBe('22');
    expect(parsed.searchParams.get('user')).toBe('root');
    expect(screen.getByText('连接中')).toBeInTheDocument();
  });

  it('sends the typed command with a trailing newline and clears the input', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('WebSocket', FakeWebSocket);

    renderSsh();
    const ws = FakeWebSocket.instances[0];
    await act(async () => ws.open());

    const input = screen.getByPlaceholderText(/输入命令/);
    await user.type(input, 'ls -la{enter}');

    expect(ws.sent).toEqual(['ls -la\n']);
    expect(input).toHaveValue('');
  });

  it('appends server stdout messages to the terminal output', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);

    renderSsh();
    const ws = FakeWebSocket.instances[0];
    await act(async () => ws.open());

    act(() => ws.receive('hello\r\n'));
    act(() => ws.receive('world'));

    expect(screen.getByText(/hello/)).toBeInTheDocument();
    expect(screen.getByText(/world/)).toBeInTheDocument();
  });

  it('closes the WebSocket when the modal is unmounted', () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);

    const {unmount} = renderSsh();
    const ws = FakeWebSocket.instances[0];

    unmount();

    expect(ws.closed).toBe(true);
  });

  it('shows connected after the socket opens and disconnected after it closes', async () => {
    vi.stubGlobal('WebSocket', FakeWebSocket);

    renderSsh();
    const ws = FakeWebSocket.instances[0];

    await act(async () => ws.open());
    expect(screen.getByText('已连接')).toBeInTheDocument();

    act(() => ws.close());
    expect(screen.getByText('已断开')).toBeInTheDocument();
  });
});
