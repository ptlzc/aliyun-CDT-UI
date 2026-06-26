import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import InstanceGovernanceDrawer from './InstanceGovernanceDrawer';

const governanceMutate = vi.fn();
const policyMutate = vi.fn();

vi.mock('../features/runtime/hooks', () => ({
  useSaveInstanceGovernanceMutation: () => ({
    mutate: governanceMutate,
    isPending: false,
  }),
  useSaveTrafficPolicyMutation: () => ({
    mutate: policyMutate,
    isPending: false,
  }),
}));

describe('InstanceGovernanceDrawer', () => {
  it('submits governance override and traffic policy', async () => {
    const user = userEvent.setup();
    render(
      <InstanceGovernanceDrawer
        instance={{
          id: 'i-1',
          accountId: 'acc-1',
          accountName: 'Account A',
          name: 'ecs-a',
          status: 'Attention',
          type: 'ecs.g6.large',
          zone: 'cn-hangzhou-i',
          publicIp: '1.1.1.1',
          privateIp: '10.0.0.1',
          trafficUsage: 180,
          trafficUsageUnit: 'GB',
          trafficRate: 22.5,
          trafficRateUnit: 'Mbps',
          trafficLimit: 200,
          monitoringEnabled: true,
          overflowAction: 'notify',
          inherited: false,
          alerts: [],
          trafficPolicy: {
            id: 'policy-1',
            name: 'ecs-a-keepalive',
            thresholdValue: 80,
            thresholdType: 'gte',
            action: 'keepalive-job',
            cooldownMinutes: 30,
            enabled: true,
          },
        }}
        onClose={() => {}}
      />,
    );

    expect(screen.getByText('阈值仅针对累计流量。留空表示继续继承账号默认值。')).toBeInTheDocument();
    expect(screen.getByText('当前累计流量: 180 GB')).toBeInTheDocument();
    expect(screen.getByText('当前实时速率: 22.5 Mbps')).toBeInTheDocument();

    const spinbuttons = screen.getAllByRole('spinbutton');
    await user.clear(spinbuttons[0]);
    await user.type(spinbuttons[0], '250');
    await user.click(screen.getByText('保存治理设置'));
    await user.click(screen.getByText('保存策略'));

    expect(governanceMutate).toHaveBeenCalledWith({
      accountId: 'acc-1',
      instanceId: 'i-1',
      payload: {
        maximumTrafficGb: 250,
        overflowAction: 'notify',
        monitoringEnabled: true,
      },
    });
    expect(policyMutate).toHaveBeenCalledWith({
      accountId: 'acc-1',
      payload: {
        id: 'policy-1',
        name: 'ecs-a-keepalive',
        scopeType: 'instance',
        scopeId: 'i-1',
        metricName: 'traffic_usage_ratio',
        thresholdType: 'gte',
        thresholdValue: 80,
        action: 'keepalive-job',
        cooldownMinutes: 30,
        enabled: true,
      },
    });
  });
});
