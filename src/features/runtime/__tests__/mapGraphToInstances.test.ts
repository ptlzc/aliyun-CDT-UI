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
type RateMeasurement = NonNullable<ApiResourceGraph['nodes'][number]['trafficRate']>;
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

function rateMeasurement(available: boolean, source: string, errorReason?: string): RateMeasurement {
  return {
    available,
    collectedAt: '2026-06-22T00:00:00Z',
    metricName: 'EcsInternetTrafficRate',
    scopeId: 'i-1',
    scopeType: 'instance',
    source,
    unit: 'Mbps',
    value: 0,
    ...(errorReason ? {errorReason} : {}),
  };
}

function ecsNode(id: string, trafficUsage: UsageMeasurement, trafficRate?: RateMeasurement): ResourceNode {
  return {
    id,
    kind: 'ecs',
    name: `ecs-${id}`,
    status: 'Running',
    regionId: 'cn-hangzhou',
    zoneId: 'cn-hangzhou-i',
    trafficUsage,
    trafficRate,
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

  it('maps a bss-api-error graph node to the API-unavailable alert', () => {
    const [instance] = mapGraphToInstances(
      [graphWith(ecsNode('i-1', usageMeasurement('bss-api-error', false, 0)))],
      [account],
      {},
    );

    expect(instance.trafficUsageSource).toBe('bss-api-error');
    expect(instance.trafficUsage).toBeNull();
    expect(instance.alerts).toContain('BSS 账单接口不可用，请联系管理员升级到 DescribeInstanceBill。');
  });

  it('maps a cdt-region-shared graph node to the general region-shared alert (not permission/network)', () => {
    const [instance] = mapGraphToInstances(
      [graphWith(ecsNode('i-1', usageMeasurement('cdt-region-shared', false, 0)))],
      [account],
      {},
    );

    expect(instance.trafficUsageSource).toBe('cdt-region-shared');
    expect(instance.trafficUsage).toBeNull();
    expect(instance.alerts).toContain('该地域多个 EIP 共用流量, 无法按实例拆分。');
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

  it('does not generate the unavailable alert while details are loading', () => {
    const [instance] = mapGraphToInstances(
      [graphWith(ecsNode('i-1', usageMeasurement('cdt-network-error', false, 0)))],
      [account],
      {},
      {'acc-1': true},
    );

    expect(instance.trafficDetailsLoading).toBe(true);
    expect(instance.trafficUsage).toBeNull();
    expect(instance.alerts).not.toContain('该实例的累计流量数据当前不可用。');
  });

  it('still generates the unavailable alert when details are not loading', () => {
    const [instance] = mapGraphToInstances(
      [graphWith(ecsNode('i-1', usageMeasurement('cdt-network-error', false, 0)))],
      [account],
      {},
      {'acc-1': false},
    );

    expect(instance.trafficDetailsLoading).toBe(false);
    expect(instance.trafficUsage).toBeNull();
    expect(instance.alerts).toContain('该实例的累计流量数据当前不可用。');
  });

  it('passes through the traffic rate error reason while keeping trafficRate null', () => {
    const errorReason = 'cloudmonitor: ...; eip_fallback: ...';
    const [instance] = mapGraphToInstances(
      [graphWith(ecsNode('i-1', usageMeasurement('bss-cumulative', true, 10), rateMeasurement(false, 'cdt-rate-unavailable', errorReason)))],
      [account],
      {},
    );

    expect(instance.trafficRate).toBeNull();
    expect(instance.trafficRateErrorReason).toBe(errorReason);
  });
});
