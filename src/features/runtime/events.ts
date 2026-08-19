import {useEffect, useRef} from 'react';
import type {QueryClient} from '@tanstack/react-query';

import {runtimeWebSocketUrl, type RuntimeEvent} from '@/lib/api/client';
import {runtimeKeys} from './hooks';

// Graph data is persisted in the backend store and only changes when a
// discovery run finishes. A discovery run emits a storm of
// discovery.progress events (one per region/task), so graph invalidation is
// debounced per account: the storm collapses into at most one refetch 30s
// after the last progress event instead of refetching the slow /graph
// endpoint (enrich does live RPCs per node) on every tick.
const GRAPH_INVALIDATE_DEBOUNCE_MS = 30_000;

function patchJobs(queryClient: QueryClient, event: RuntimeEvent) {
  if (event.job) {
    queryClient.setQueryData(runtimeKeys.jobs, (previous: unknown) => {
      const items = Array.isArray(previous) ? previous : [];
      const next = items.filter((item: { id: string }) => item.id !== event.job?.id);
      return [event.job, ...next];
    });
    return;
  }

  if (event.type === 'job.log.appended' && event.jobId && event.log) {
    queryClient.setQueryData(runtimeKeys.jobs, (previous: unknown) => {
      const items = Array.isArray(previous) ? previous : [];
      return items.map((item: any) => {
        if (item.id !== event.jobId) {
          return item;
        }
        return {
          ...item,
          logs: [...(item.logs || []), event.log],
        };
      });
    });
  }
}

// Cheap runtime lists — safe to refresh on every event.
function invalidateJobsAndAccounts(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: runtimeKeys.jobs });
  void queryClient.invalidateQueries({ queryKey: runtimeKeys.accounts });
}

function invalidateRuntime(queryClient: QueryClient, accountId?: string) {
  invalidateJobsAndAccounts(queryClient);
  if (accountId) {
    void queryClient.invalidateQueries({ queryKey: runtimeKeys.policies(accountId) });
  }
}

/**
 * Bridges backend runtime WS events into the query cache. discovery.progress
 * storms are collapsed per account (30s trailing-edge debounce) before the
 * expensive graph query is invalidated; socket close only refreshes the cheap
 * jobs/accounts lists and never touches the graph.
 *
 * @when App 布局 mount 时订阅 runtime WS 事件
 */
export function useRuntimeEventBridge(queryClient: QueryClient) {
  const graphInvalidateTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    const timers = graphInvalidateTimers.current;
    const clearGraphInvalidates = () => {
      for (const timer of timers.values()) {
        clearTimeout(timer);
      }
      timers.clear();
    };
    const scheduleGraphInvalidate = (accountId: string) => {
      const existing = timers.get(accountId);
      if (existing !== undefined) {
        clearTimeout(existing);
      }
      timers.set(
        accountId,
        setTimeout(() => {
          timers.delete(accountId);
          void queryClient.invalidateQueries({ queryKey: runtimeKeys.graph(accountId) });
        }, GRAPH_INVALIDATE_DEBOUNCE_MS),
      );
    };

    const socket = new WebSocket(runtimeWebSocketUrl());
    socket.onmessage = (message) => {
      const event = JSON.parse(message.data) as RuntimeEvent;
      if (event.type === 'job.updated' || event.type === 'job.log.appended') {
        patchJobs(queryClient, event);
      }
      if (event.type === 'discovery.progress') {
        invalidateRuntime(queryClient, event.accountId);
        scheduleGraphInvalidate(event.accountId);
      }
    };
    socket.onclose = () => {
      // Socket gone: cancel pending graph debounces and refresh only the
      // cheap lists — the persisted graph is left untouched.
      clearGraphInvalidates();
      invalidateJobsAndAccounts(queryClient);
    };

    return () => {
      clearGraphInvalidates();
      socket.close();
    };
  }, [queryClient]);
}
