import {act, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {API_BASE_URL} from '@/lib/api/baseUrl';
import type {ECSInstance} from '@/types';
import SshModal from '@/pages/Instances/components/SshModal';

interface TerminalAddonDouble {
  activate?: (terminal: any) => void;
  dispose: () => void;
}

const terminalDoubles = vi.hoisted(() => {
  const terminals: FakeTerminal[] = [];
  const attachAddons: FakeAttachAddon[] = [];
  const fitAddons: FakeFitAddon[] = [];

  class FakeTerminal {
    options: Record<string, unknown>;
    rows = 32;
    cols = 120;
    loadedAddons: TerminalAddonDouble[] = [];
    writes: string[] = [];
    dataListeners = new Set<(data: string) => void>();
    open = vi.fn();
    focus = vi.fn();
    dispose = vi.fn();

    constructor(options: Record<string, unknown> = {}) {
      this.options = {...options};
      terminals.push(this);
    }

    loadAddon(addon: TerminalAddonDouble) {
      this.loadedAddons.push(addon);
      addon.activate?.(this);
    }

    write(data: string) {
      this.writes.push(data);
    }

    onData(listener: (data: string) => void) {
      this.dataListeners.add(listener);
      return {dispose: () => this.dataListeners.delete(listener)};
    }

    emitData(data: string) {
      for (const listener of this.dataListeners) listener(data);
    }
  }

  class FakeAttachAddon implements TerminalAddonDouble {
    socket: FakeWebSocket;
    disposed = false;
    messageHandler?: (event: MessageEvent) => void;
    dataDisposable?: {dispose: () => void};

    constructor(socket: FakeWebSocket) {
      this.socket = socket;
      attachAddons.push(this);
    }

    activate(terminal: FakeTerminal) {
      this.messageHandler = (event) => terminal.write(String(event.data));
      this.socket.addEventListener('message', this.messageHandler);
      this.dataDisposable = terminal.onData((data) => {
        if (this.socket.readyState === FakeWebSocket.OPEN) this.socket.send(data);
      });
    }

    dispose = vi.fn(() => {
      this.disposed = true;
      if (this.messageHandler) this.socket.removeEventListener('message', this.messageHandler);
      this.dataDisposable?.dispose();
    });
  }

  class FakeFitAddon implements TerminalAddonDouble {
    fit = vi.fn();
    dispose = vi.fn();

    constructor() {
      fitAddons.push(this);
    }
  }

  return {terminals, attachAddons, fitAddons, FakeTerminal, FakeAttachAddon, FakeFitAddon};
});

vi.mock('@xterm/xterm', () => ({Terminal: terminalDoubles.FakeTerminal}));
vi.mock('@xterm/addon-attach', () => ({AttachAddon: terminalDoubles.FakeAttachAddon}));
vi.mock('@xterm/addon-fit', () => ({FitAddon: terminalDoubles.FakeFitAddon}));

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
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  private listeners = new Map<string, Set<(event: MessageEvent) => void>>();

  constructor(url: string) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    this.listeners.get(type)?.delete(listener);
  }

  send(data: string) {
    this.sent.push(data);
  }

  close() {
    this.closed = true;
    this.readyState = FakeWebSocket.CLOSED;
    this.onclose?.(new CloseEvent('close'));
  }

  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  receive(data: string) {
    const event = {data} as MessageEvent;
    for (const listener of this.listeners.get('message') ?? []) listener(event);
  }

  fail() {
    this.readyState = FakeWebSocket.CLOSED;
    this.onerror?.(new Event('error'));
  }
}

class FakeResizeObserver {
  static instances: FakeResizeObserver[] = [];
  callback: ResizeObserverCallback;
  observe = vi.fn();
  disconnect = vi.fn();

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    FakeResizeObserver.instances.push(this);
  }

  trigger() {
    this.callback([], this as unknown as ResizeObserver);
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
  const ws = FakeWebSocket.instances.at(-1)!;
  const terminal = terminalDoubles.terminals.at(-1)!;
  const attachAddon = terminalDoubles.attachAddons.at(-1)!;
  const fitAddon = terminalDoubles.fitAddons.at(-1)!;
  const resizeObserver = FakeResizeObserver.instances.at(-1)!;
  return {onClose, ws, terminal, attachAddon, fitAddon, resizeObserver, ...utils};
}

beforeEach(() => {
  vi.stubGlobal('WebSocket', FakeWebSocket);
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  FakeWebSocket.instances = [];
  FakeResizeObserver.instances = [];
  terminalDoubles.terminals.length = 0;
  terminalDoubles.attachAddons.length = 0;
  terminalDoubles.fitAddons.length = 0;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SshModal', () => {
  it('opens a fitted xterm terminal and connects with its initial PTY dimensions', () => {
    const {ws, terminal, attachAddon, fitAddon, resizeObserver} = renderSsh();

    const host = screen.getByRole('application', {name: 'SSH 交互终端'});
    expect(terminal.open).toHaveBeenCalledWith(host);
    expect(fitAddon.fit).toHaveBeenCalledOnce();
    expect(resizeObserver.observe).toHaveBeenCalledWith(host);
    expect(terminal.loadedAddons).toEqual([fitAddon, attachAddon]);

    const parsed = new URL(ws.url);
    expect(parsed.protocol).toBe('ws:');
    expect(parsed.host).toBe(new URL(API_BASE_URL).host);
    expect(parsed.pathname).toBe('/api/accounts/acc-1/ecs/i-1/ssh/ws');
    expect(parsed.searchParams.get('host')).toBe('1.1.1.1');
    expect(parsed.searchParams.get('port')).toBe('22');
    expect(parsed.searchParams.get('user')).toBe('root');
    expect(parsed.searchParams.get('term')).toBe('xterm-256color');
    expect(parsed.searchParams.get('rows')).toBe('32');
    expect(parsed.searchParams.get('cols')).toBe('120');
    expect(screen.getByText('连接中')).toBeInTheDocument();
  });

  it('bridges raw terminal input and ANSI server output through the attach addon', () => {
    const {ws, terminal} = renderSsh();
    act(() => ws.open());

    act(() => terminal.emitData('ls\t'));
    act(() => ws.receive('\u001b[31merror\u001b[0m\r\n'));

    expect(ws.sent).toEqual(['ls\t']);
    expect(terminal.writes).toEqual(['\u001b[31merror\u001b[0m\r\n']);
    expect(screen.queryByRole('textbox', {name: 'SSH 命令输入'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: '发送'})).not.toBeInTheDocument();
  });

  it('enables and focuses terminal input only after the socket opens', () => {
    const {ws, terminal} = renderSsh();
    expect(terminal.options.disableStdin).toBe(true);

    act(() => ws.open());

    expect(terminal.options.disableStdin).toBe(false);
    expect(terminal.focus).toHaveBeenCalledOnce();
    expect(screen.getByText('已连接')).toBeInTheDocument();
  });

  it('refits when the terminal container changes size', () => {
    const {fitAddon, resizeObserver} = renderSsh();
    fitAddon.fit.mockClear();

    act(() => resizeObserver.trigger());

    expect(fitAddon.fit).toHaveBeenCalledOnce();
  });

  it('shows disconnected and error connection states', () => {
    const disconnected = renderSsh();
    act(() => disconnected.ws.open());
    act(() => disconnected.ws.close());
    expect(screen.getByText('已断开')).toBeInTheDocument();

    disconnected.unmount();
    const failed = renderSsh();
    act(() => failed.ws.fail());
    expect(screen.getByText('错误')).toBeInTheDocument();
  });

  it('closes the socket and disposes terminal resources on unmount', () => {
    const {unmount, ws, terminal, attachAddon, fitAddon, resizeObserver} = renderSsh();

    unmount();

    expect(ws.closed).toBe(true);
    expect(resizeObserver.disconnect).toHaveBeenCalledOnce();
    expect(attachAddon.dispose).toHaveBeenCalledOnce();
    expect(fitAddon.dispose).toHaveBeenCalledOnce();
    expect(terminal.dispose).toHaveBeenCalledOnce();
  });
});
