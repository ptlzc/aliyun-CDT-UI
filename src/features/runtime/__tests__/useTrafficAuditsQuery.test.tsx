import {renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

const h = vi.hoisted(() => ({
  useQueryMock: vi.fn(),
  listTrafficAuditsMock: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: h.useQueryMock,
}));

vi.mock('@/src/lib/api/client', () => ({
  listTrafficAudits: h.listTrafficAuditsMock,
}));

import {useTrafficAuditsQuery} from '../hooks';

interface CapturedQueryOptions {
  queryKey: readonly unknown[];
  queryFn: () => unknown;
  enabled?: boolean;
}

describe('useTrafficAuditsQuery page shape', () => {
  beforeEach(() => {
    h.useQueryMock.mockReset();
    h.listTrafficAuditsMock.mockReset();
    h.listTrafficAuditsMock.mockResolvedValue({items: [], total: 0});
    h.useQueryMock.mockImplementation(() => ({data: undefined, isLoading: true}));
  });

  it('keeps offset/limit in the query key and exposes the {items, total} page as query data', async () => {
    h.listTrafficAuditsMock.mockResolvedValue({items: [{id: 'a1'}], total: 42});

    renderHook(() => useTrafficAuditsQuery('acc-1', {triggeredBy: ['traffic-governance'], offset: 20, limit: 20}));

    const options = h.useQueryMock.mock.calls[0][0] as CapturedQueryOptions;
    expect(options.queryKey).toEqual([
      'runtime',
      'traffic-audits',
      'acc-1',
      {triggeredBy: ['traffic-governance'], offset: 20, limit: 20},
    ]);
    expect(options.enabled).toBe(true);

    const data = await options.queryFn();
    expect(data).toEqual({items: [{id: 'a1'}], total: 42});
    expect(h.listTrafficAuditsMock).toHaveBeenCalledWith('acc-1', {
      triggeredBy: ['traffic-governance'],
      offset: 20,
      limit: 20,
    });
  });

  it('stays disabled for a null account', () => {
    renderHook(() => useTrafficAuditsQuery(null));

    const options = h.useQueryMock.mock.calls[0][0] as CapturedQueryOptions;
    expect(options.enabled).toBe(false);
  });
});
