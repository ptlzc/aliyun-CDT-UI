import {beforeEach, describe, expect, it, vi} from 'vitest';

const h = vi.hoisted(() => ({
  requestMock: vi.fn(),
}));

vi.mock('../generated/jobs/sdk.gen', () => ({
  listTrafficAudits: h.requestMock,
}));

import {listTrafficAudits} from '../client';

describe('listTrafficAudits client page shape', () => {
  beforeEach(() => {
    h.requestMock.mockReset();
  });

  it('returns {items, total} and passes offset/limit through the query', async () => {
    h.requestMock.mockResolvedValue({data: {items: [{id: 'a1'}], total: 42}});

    const page = await listTrafficAudits('acc-1', {triggeredBy: ['traffic-governance'], offset: 20, limit: 20});

    expect(page).toEqual({items: [{id: 'a1'}], total: 42});
    expect(h.requestMock).toHaveBeenCalledWith({
      path: {accountId: 'acc-1'},
      query: {triggeredBy: 'traffic-governance', offset: 20, limit: 20},
    });
  });

  it('omits offset from the query when it is not provided', async () => {
    h.requestMock.mockResolvedValue({data: {items: [], total: 0}});

    await listTrafficAudits('acc-1');

    expect(h.requestMock).toHaveBeenCalledWith({path: {accountId: 'acc-1'}, query: {}});
  });

  it('falls back to an empty items array but preserves total when the backend returns null items', async () => {
    h.requestMock.mockResolvedValue({data: {items: null, total: 7}});

    const page = await listTrafficAudits('acc-1');

    expect(page).toEqual({items: [], total: 7});
  });
});
