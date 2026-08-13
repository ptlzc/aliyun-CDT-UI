import {describe, expect, it} from 'vitest';

import {mapGraphToInstances} from '../hooks';
import type {ApiAccount, ApiResourceGraph} from '../../../lib/api/client';

const account: ApiAccount = {
  accessKeyId: 'LTAI-test',
  createdAt: '2026-01-01T00:00:00Z',
  defaultImageKey: '',
  id: 'acc-1',
  name: 'Account A',
  ossBucket: '',
  ossEndpoint: '',
  regionId: 'cn-hangzhou',
  regions: ['cn-hangzhou'],
  siteType: 'domestic',
  updatedAt: '2026-01-01T00:00:00Z',
  zoneId: 'cn-hangzhou-i',
};

type UsageMeasurement = NonNullable<ApiResourceGraph['nodes'][number]['trafficUsage']>;
type ResourceNode = ApiResourceGraph['nodes'][number];

function usageMeasurement(source: string, available: boolean, value: number): UsageMeasurement {
  return {
    available,
    collectedAt: '2026-06-22T00:00:00Z',
    metricName: 'CdtInternetTraffic',
    scopeId: 'i-1',
    scopeType: 'instance',
    source,
    unit: 'GB',
    value,
  };
}

function ecsNode(id: string, trafficUsage: UsageMeasurement): ResourceNode {
  return {
    id,
    kind: 'ecs',
    name: `ecs-${id}`,
    status: 'Running',
    regionId: 'cn-hangzhou',
    zoneId: 'cn-hangzhou-i',
    trafficUsage,
  };
}

function graphWith(...nodes: ResourceNode[]): ApiResourceGraph {
  return {
    accountId: 'acc-1',
    edges: [],
    nodes,
    summary: {ecsCount: 0, eipCount: 0, imageCount: 0, securityGroupCount: 0, vpcCount: 0, vswitchCount: 0},
  };
}

describe('mapGraphToInstances traffic usage mapping', () => {
  it('maps a bss-no-data graph node to an unavailable usage with the billing-delay alert', () => {
    const [instance] = mapGraphToInstances(
      [graphWith(ecsNode('i-1', usageMeasurement('bss-no-data', false, 0)))],
      [account],
      {},
    );

    expect(instance.trafficUsageSource).toBe('bss-no-data');
    expect(instance.trafficUsage).toBeNull();
    expect(instance.alerts).toContain('该实例本月暂无 CDT 出账明细（出账有小时级延迟）。');
  });

  it('maps a bss-cumulative graph node to an available usage without the unavailable alert', () => {
    const [instance] = mapGraphToInstances(
      [graphWith(ecsNode('i-1', usageMeasurement('bss-cumulative', true, 180)))],
      [account],
      {},
    );

    expect(instance.trafficUsageSource).toBe('bss-cumulative');
    expect(instance.trafficUsage).toBe(180);
    expect(instance.alerts).not.toContain('该实例的累计流量数据当前不可用。');
  });

  it('keeps the generic unavailable alert for non-bss error sources', () => {
    const [instance] = mapGraphToInstances(
      [graphWith(ecsNode('i-1', usageMeasurement('cdt-network-error', false, 0)))],
      [account],
      {},
    );

    expect(instance.trafficUsageSource).toBe('cdt-network-error');
    expect(instance.alerts).toContain('该实例的累计流量数据当前不可用。');
  });
});
