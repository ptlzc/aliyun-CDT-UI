import { useEffect } from 'react';
import type { QueryClient } from '@tanstack/react-query';

import { runtimeWebSocketUrl, type RuntimeEvent } from '@/src/lib/api/client';
import { runtimeKeys } from './hooks';

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

function invalidateRuntime(queryClient: QueryClient, accountId?: string) {
  void queryClient.invalidateQueries({ queryKey: runtimeKeys.jobs });
  void queryClient.invalidateQueries({ queryKey: runtimeKeys.accounts });
  if (accountId) {
    void queryClient.invalidateQueries({ queryKey: runtimeKeys.graph(accountId) });
    void queryClient.invalidateQueries({ queryKey: runtimeKeys.policies(accountId) });
  }
}

export function useRuntimeEventBridge(queryClient: QueryClient) {
  useEffect(() => {
    const socket = new WebSocket(runtimeWebSocketUrl());
    socket.onmessage = (message) => {
      const event = JSON.parse(message.data) as RuntimeEvent;
      if (event.type === 'job.updated' || event.type === 'job.log.appended') {
        patchJobs(queryClient, event);
      }
      if (event.type === 'discovery.progress') {
        invalidateRuntime(queryClient, event.accountId);
      }
    };
    socket.onclose = () => {
      invalidateRuntime(queryClient);
    };

    return () => {
      socket.close();
    };
  }, [queryClient]);
}
