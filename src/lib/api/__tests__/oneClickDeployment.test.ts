import {beforeEach, describe, expect, it, vi} from 'vitest';

const h = vi.hoisted(() => ({
  createOneClickDeploymentMock: vi.fn(),
  listRegionsForAccountMock: vi.fn(),
}));

vi.mock('../generated/provision/sdk.gen', () => ({
  createOneClickDeployment: h.createOneClickDeploymentMock,
}));

vi.mock('../generated/accounts/sdk.gen', () => ({
  listRegionsForAccount: h.listRegionsForAccountMock,
}));

import {createOneClickDeployment, listRegionsForAccount} from '../client';

const job = {
  id: 'job-9',
  accountId: 'acc-1',
  type: 'one-click-deployment',
  status: 'running',
  startedAt: '2026-06-17T10:00:00Z',
  updatedAt: '2026-06-17T10:00:01Z',
  steps: [],
};

describe('createOneClickDeployment client wrapper', () => {
  beforeEach(() => {
    h.createOneClickDeploymentMock.mockReset();
    h.listRegionsForAccountMock.mockReset();
  });

  it('passes the accountId path and the full body to the generated request and returns {job, password}', async () => {
    h.createOneClickDeploymentMock.mockResolvedValue({
      data: {job, password: 's3cr3tPw'},
    });

    const body = {
      regionId: 'us-west-1',
      zoneId: 'us-west-1a',
      instanceType: 'ecs.e-c4m1.large',
      installSingBox: true,
      singBoxConfig: '{"log":{"level":"info"}}',
      installTailscale: true,
      tailscaleAuthKey: 'tskey-auth-abc',
      spotPriceLimit: 0.1,
      attachGovernance: true,
    };

    const response = await createOneClickDeployment('acc-1', body);

    expect(response).toEqual({job, password: 's3cr3tPw'});
    expect(h.createOneClickDeploymentMock).toHaveBeenCalledWith({
      path: {accountId: 'acc-1'},
      body,
    });
  });

  it('omits optional software fields when the switches are off', async () => {
    h.createOneClickDeploymentMock.mockResolvedValue({data: {job, password: 'pw'}});

    await createOneClickDeployment('acc-1', {
      regionId: 'cn-hangzhou',
      attachGovernance: false,
    });

    expect(h.createOneClickDeploymentMock).toHaveBeenCalledWith({
      path: {accountId: 'acc-1'},
      body: {regionId: 'cn-hangzhou', attachGovernance: false},
    });
  });
});

describe('listRegionsForAccount client wrapper', () => {
  beforeEach(() => {
    h.listRegionsForAccountMock.mockReset();
  });

  it('passes the accountId path and returns the region items', async () => {
    h.listRegionsForAccountMock.mockResolvedValue({
      data: {
        items: [
          {regionId: 'us-west-1', localName: '美国 (硅谷)'},
          {regionId: 'cn-hangzhou', localName: '华东 1 (杭州)'},
        ],
      },
    });

    const regions = await listRegionsForAccount('acc-1');

    expect(regions).toEqual([
      {regionId: 'us-west-1', localName: '美国 (硅谷)'},
      {regionId: 'cn-hangzhou', localName: '华东 1 (杭州)'},
    ]);
    expect(h.listRegionsForAccountMock).toHaveBeenCalledWith({path: {accountId: 'acc-1'}});
  });

  it('returns an empty array when the backend returns null items', async () => {
    h.listRegionsForAccountMock.mockResolvedValue({data: {items: null}});

    const regions = await listRegionsForAccount('acc-1');

    expect(regions).toEqual([]);
  });
});
