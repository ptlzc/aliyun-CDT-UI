import {renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {useRuntimeDashboard} from '../hooks';

interface CapturedQueryOptions {
  queryKey: readonly unknown[];
  queryFn?: unknown;
  staleTime?: number;
  refetchInterval?: number;
  enabled?: boolean;
}

const {useQueryCalls, useQueriesCalls} = vi.hoisted(() => ({
  useQueryCalls: [] as CapturedQueryOptions[],
  useQueriesCalls: [] as CapturedQueryOptions[][],
}));

vi.mock('@tanstack/react-query', () => {
  const account = {
    id: 'acc-1',
    name: 'Account A',
    siteType: 'domestic',
    regionId: 'cn-hangzhou',
    regions: ['cn-hangzhou'],
    createdAt: '2026-06-17T00:00:00Z',
    updatedAt: '2026-06-17T00:00:00Z',
    accessKeyId: 'ak',
    accessKeySecret: 'sk',
  };
  return {
    useQuery: vi.fn((options: CapturedQueryOptions) => {
      useQueryCalls.push(options);
      if ((options.queryKey as string[])[1] === 'accounts') {
        return {data: [account], isLoading: false};
      }
      return {data: [], isLoading: false};
    }),
    useQueries: vi.fn((options: {queries: CapturedQueryOptions[]}) => {
      useQueriesCalls.push(options.queries);
      return options.queries.map(() => ({data: undefined, isLoading: false}));
    }),
    useMutation: vi.fn(() => ({mutate: vi.fn(), mutateAsync: vi.fn()})),
    useQueryClient: vi.fn(() => ({invalidateQueries: vi.fn()})),
  };
});

describe('useRuntimeDashboard graph query refresh strategy', () => {
  beforeEach(() => {
    useQueryCalls.length = 0;
    useQueriesCalls.length = 0;
  });

  it('caches graph queries for 60s (graph is persisted in the store, not realtime)', () => {
    renderHook(() => useRuntimeDashboard());

    // useRuntimeDashboard calls useQueries twice: [0] graph, [1] policies.
    const graphQueries = useQueriesCalls[0];
    const graphQuery = graphQueries.find((query) => (query.queryKey as string[])[1] === 'graph');

    expect(graphQuery?.queryKey).toEqual(['runtime', 'graph', 'acc-1']);
    expect(graphQuery?.enabled).toBe(true);
    expect(graphQuery?.staleTime).toBe(60_000);
  });

  it('leaves the other runtime queries untouched (no staleTime added)', () => {
    renderHook(() => useRuntimeDashboard());

    const accountsQuery = useQueryCalls.find((query) => (query.queryKey as string[])[1] === 'accounts');
    const jobsQuery = useQueryCalls.find((query) => (query.queryKey as string[])[1] === 'jobs');
    const settingsQuery = useQueryCalls.find((query) => (query.queryKey as string[])[1] === 'settings');

    expect(accountsQuery?.staleTime).toBeUndefined();
    expect(jobsQuery?.staleTime).toBeUndefined();
    expect(jobsQuery?.refetchInterval).toBe(20_000); // existing jobs interval preserved
    expect(settingsQuery?.staleTime).toBeUndefined();
  });
});
