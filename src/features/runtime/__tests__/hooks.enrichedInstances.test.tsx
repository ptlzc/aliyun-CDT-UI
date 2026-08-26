import {renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {useEnrichedInstances} from '../hooks';

interface CapturedQueryOptions {
  queryKey: readonly unknown[];
  queryFn?: unknown;
  staleTime?: number;
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

describe('useEnrichedInstances', () => {
  beforeEach(() => {
    useQueryCalls.length = 0;
    useQueriesCalls.length = 0;
    useQueriesResults.length = 0;
  });

  it('requests enriched graph and traffic policies for every account', () => {
    const enrichedGraph = {
      accountId: 'acc-1',
      nodes: [
        {
          id: 'i-1',
          kind: 'ecs',
          name: 'ecs-a',
          status: 'Running',
          regionId: 'cn-hangzhou',
          zoneId: 'cn-hangzhou-i',
          metadata: {instanceType: 'ecs.g6.large', trafficEffectiveMaximumGb: '200'},
          trafficUsage: {available: true, value: 180, unit: 'GB', collectedAt: '2026-06-22T00:00:00Z', metricName: 'CdtInternetTraffic', scopeId: 'i-1', scopeType: 'instance', source: 'bss-cumulative'},
          trafficRate: {available: true, value: 22.5, unit: 'Mbps', collectedAt: '2026-06-22T00:00:00Z', metricName: 'EcsInternetTrafficRate', scopeId: 'i-1', scopeType: 'instance', source: 'cloudmonitor'},
        },
      ],
      edges: [],
      summary: {ecsCount: 1, eipCount: 0},
    };
    useQueriesResults.push(
      [{data: enrichedGraph, isLoading: false}],
      [{data: [], isLoading: false}],
    );

    const {result} = renderHook(() => useEnrichedInstances());

    const graphQueries = useQueriesCalls[0];
    const policyQueries = useQueriesCalls[1];
    expect(graphQueries).toHaveLength(1);
    expect(graphQueries[0].queryKey).toEqual(['runtime', 'graph', 'acc-1']);
    expect(graphQueries[0].staleTime).toBe(60_000);
    expect(policyQueries).toHaveLength(1);
    expect(policyQueries[0].queryKey).toEqual(['runtime', 'traffic-policies', 'acc-1']);

    expect(result.current.instances).toEqual([
      expect.objectContaining({
        id: 'i-1',
        accountId: 'acc-1',
        trafficUsage: 180,
        trafficUsageUnit: 'GB',
        trafficRate: 22.5,
        trafficRateUnit: 'Mbps',
        trafficLimit: 200,
      }),
    ]);
    expect(result.current.inventoryLoading).toBe(false);
  });

  it('does not request inventory graph in the enriched list hook', () => {
    useQueriesResults.push([], []);

    renderHook(() => useEnrichedInstances());

    const allQueryKeys = useQueriesCalls.flat().map((query) => query.queryKey);
    expect(allQueryKeys.some((key) => (key as string[]).includes('inventory'))).toBe(false);
    expect(allQueryKeys).toContainEqual(['runtime', 'graph', 'acc-1']);
  });
});
