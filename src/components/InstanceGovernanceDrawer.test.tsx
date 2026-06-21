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
          trafficUsed: 180,
          trafficLimit: 200,
          trafficUnit: 'GB',
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
