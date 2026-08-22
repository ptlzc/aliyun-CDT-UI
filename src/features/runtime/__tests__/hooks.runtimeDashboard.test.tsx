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

const {useQueryCalls, useQueriesCalls, useQueriesResults} = vi.hoisted(() => ({
  useQueryCalls: [] as CapturedQueryOptions[],
  useQueriesCalls: [] as CapturedQueryOptions[][],
  useQueriesResults: [] as Array<Array<{data?: unknown; isLoading: boolean}>>,
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
      const callIndex = useQueriesCalls.length;
      useQueriesCalls.push(options.queries);
      return useQueriesResults[callIndex] ?? options.queries.map(() => ({data: undefined, isLoading: false}));
    }),
    useMutation: vi.fn(() => ({mutate: vi.fn(), mutateAsync: vi.fn()})),
    useQueryClient: vi.fn(() => ({invalidateQueries: vi.fn()})),
  };
});

describe('useRuntimeDashboard graph query refresh strategy', () => {
  beforeEach(() => {
    useQueryCalls.length = 0;
    useQueriesCalls.length = 0;
    useQueriesResults.length = 0;
  });

  it('loads the inventory graph first and enables the enriched graph after inventory arrives', () => {
    const inventoryGraph = {
      accountId: 'acc-1',
      nodes: [{
        id: 'i-1',
        kind: 'ecs',
        name: 'ecs-a',
        status: 'Running',
        regionId: 'cn-hangzhou',
        zoneId: 'cn-hangzhou-i',
        metadata: {instanceType: 'ecs.g6.large', privateIps: '10.0.0.1'},
      }],
      edges: [],
      summary: {ecsCount: 1, eipCount: 0},
    };
    useQueriesResults.push(
      [{data: inventoryGraph, isLoading: false}],
      [{data: undefined, isLoading: true}],
      [{data: [], isLoading: false}],
    );

    const {result} = renderHook(() => useRuntimeDashboard());

    const inventoryQuery = useQueriesCalls[0][0];
    const enrichedQuery = useQueriesCalls[1][0];
    expect(inventoryQuery.queryKey).toEqual(['runtime', 'graph', 'acc-1', 'inventory']);
    expect(inventoryQuery.enabled).toBe(true);
    expect(enrichedQuery.queryKey).toEqual(['runtime', 'graph', 'acc-1']);
    expect(enrichedQuery.enabled).toBe(true);
    expect(result.current.instances).toEqual([expect.objectContaining({id: 'i-1', trafficDetailsLoading: true})]);
    expect(result.current.instances[0].alerts).not.toContain('该实例的累计流量数据当前不可用。');
    expect(result.current.inventoryLoading).toBe(false);
    expect(result.current.instanceDetailsLoading).toEqual({'acc-1': true});
  });

  it('caches both graph stages for 60s', () => {
    renderHook(() => useRuntimeDashboard());

    // useRuntimeDashboard calls useQueries three times: inventory, enriched,
    // then policies. Enrichment stays disabled until inventory is available.
    const inventoryQuery = useQueriesCalls[0][0];
    const graphQuery = useQueriesCalls[1][0];

    expect(inventoryQuery.queryKey).toEqual(['runtime', 'graph', 'acc-1', 'inventory']);
    expect(inventoryQuery.staleTime).toBe(60_000);
    expect(graphQuery?.queryKey).toEqual(['runtime', 'graph', 'acc-1']);
    expect(graphQuery?.enabled).toBe(false);
    expect(graphQuery?.staleTime).toBe(60_000);
  });

  it('prefers enriched details when available and does not leave failed details loading forever', () => {
    const inventoryGraph = {
      accountId: 'acc-1',
      nodes: [{id: 'i-1', kind: 'ecs', name: 'ecs-a', status: 'Running', metadata: {instanceType: 'ecs.g6.large'}}],
      edges: [],
      summary: {ecsCount: 1, eipCount: 0},
    };
    const enrichedGraph = {
      ...inventoryGraph,
      nodes: [{
        ...inventoryGraph.nodes[0],
        metadata: {...inventoryGraph.nodes[0].metadata, trafficEffectiveMaximumGb: '200'},
        trafficUsage: {available: true, value: 125, unit: 'GB'},
      }],
    };
    useQueriesResults.push(
      [{data: inventoryGraph, isLoading: false}],
      [{data: enrichedGraph, isLoading: false}],
      [{data: [], isLoading: false}],
    );

    const {result, unmount} = renderHook(() => useRuntimeDashboard());

    expect(result.current.instances[0]).toEqual(expect.objectContaining({trafficUsage: 125, trafficLimit: 200}));
    expect(result.current.instanceDetailsLoading).toEqual({'acc-1': false});
    unmount();

    useQueryCalls.length = 0;
    useQueriesCalls.length = 0;
    useQueriesResults.length = 0;
    useQueriesResults.push(
      [{data: inventoryGraph, isLoading: false}],
      [{data: undefined, isLoading: false}],
      [{data: [], isLoading: false}],
    );

    const failed = renderHook(() => useRuntimeDashboard());
    expect(failed.result.current.instances).toEqual([expect.objectContaining({id: 'i-1', trafficDetailsLoading: false})]);
    expect(failed.result.current.instances[0].alerts).toContain('该实例的累计流量数据当前不可用。');
    expect(failed.result.current.instanceDetailsLoading).toEqual({'acc-1': false});
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
