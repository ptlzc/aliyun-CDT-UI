import {QueryClient} from '@tanstack/react-query';
import {renderHook} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import {useRuntimeEventBridge} from '../events';
import {runtimeKeys} from '../hooks';

class FakeWebSocket {
  static instances: FakeWebSocket[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  close = vi.fn();

  constructor(_url: string) {
    FakeWebSocket.instances.push(this);
  }

  dispatch(payload: Record<string, unknown>) {
    this.onmessage?.({data: JSON.stringify(payload)} as MessageEvent);
  }

  disconnect() {
    this.onclose?.({} as CloseEvent);
  }
}

function progressEvent(accountId: string): Record<string, unknown> {
  return {type: 'discovery.progress', accountId, timestamp: '2026-06-22T00:00:00Z'};
}

function countGraphInvalidates(invalidateSpy: {mock: {calls: unknown[][]}}, accountId: string): number {
  return invalidateSpy.mock.calls.filter((call) => {
    const filters = call[0] as {queryKey?: readonly unknown[]} | undefined;
    const key = filters?.queryKey;
    return key?.[0] === 'runtime' && key?.[1] === 'graph' && key?.[2] === accountId;
  }).length;
}

describe('useRuntimeEventBridge graph invalidation strategy', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeWebSocket.instances = [];
    vi.stubGlobal('WebSocket', FakeWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function setup() {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const {unmount} = renderHook(() => useRuntimeEventBridge(queryClient));
    const socket = FakeWebSocket.instances[0];
    expect(socket).toBeDefined();
    return {invalidateSpy, socket, unmount};
  }

  it('collapses a discovery.progress storm into one graph invalidate after the 30s window', () => {
    const {invalidateSpy, socket} = setup();

    socket.dispatch(progressEvent('acc-1'));
    socket.dispatch(progressEvent('acc-1'));
    socket.dispatch(progressEvent('acc-1'));

    // Jobs/accounts/policies refresh immediately; the graph refetch is deferred.
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: runtimeKeys.jobs});
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: runtimeKeys.accounts});
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: runtimeKeys.policies('acc-1')});
    expect(countGraphInvalidates(invalidateSpy, 'acc-1')).toBe(0);

    // The 30s window has not elapsed yet: still no graph invalidate.
    vi.advanceTimersByTime(29_999);
    expect(countGraphInvalidates(invalidateSpy, 'acc-1')).toBe(0);

    // Trailing edge fires exactly once when the window elapses.
    vi.advanceTimersByTime(1);
    expect(countGraphInvalidates(invalidateSpy, 'acc-1')).toBe(1);
  });

  it('resets the debounce window while progress events keep arriving (trailing edge)', () => {
    const {invalidateSpy, socket} = setup();

    socket.dispatch(progressEvent('acc-1'));
    vi.advanceTimersByTime(20_000);
    socket.dispatch(progressEvent('acc-1')); // later event resets the window
    vi.advanceTimersByTime(20_000);
    expect(countGraphInvalidates(invalidateSpy, 'acc-1')).toBe(0);
    vi.advanceTimersByTime(10_000);
    expect(countGraphInvalidates(invalidateSpy, 'acc-1')).toBe(1);
  });

  it('keeps a separate debounce window per account', () => {
    const {invalidateSpy, socket} = setup();

    socket.dispatch(progressEvent('acc-1'));
    socket.dispatch(progressEvent('acc-2'));
    vi.advanceTimersByTime(30_000);
    expect(countGraphInvalidates(invalidateSpy, 'acc-1')).toBe(1);
    expect(countGraphInvalidates(invalidateSpy, 'acc-2')).toBe(1);
  });

  it('onclose invalidates jobs/accounts only and never touches the graph', () => {
    const {invalidateSpy, socket} = setup();

    socket.dispatch(progressEvent('acc-1'));
    socket.disconnect();

    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: runtimeKeys.jobs});
    expect(invalidateSpy).toHaveBeenCalledWith({queryKey: runtimeKeys.accounts});
    expect(countGraphInvalidates(invalidateSpy, 'acc-1')).toBe(0);

    // The debounce pending from the pre-close progress event is cancelled.
    vi.advanceTimersByTime(60_000);
    expect(countGraphInvalidates(invalidateSpy, 'acc-1')).toBe(0);
  });

  it('clears pending graph debounce timers on unmount', () => {
    const {invalidateSpy, socket, unmount} = setup();

    socket.dispatch(progressEvent('acc-1'));
    unmount();
    vi.advanceTimersByTime(60_000);
    expect(countGraphInvalidates(invalidateSpy, 'acc-1')).toBe(0);
  });
});
