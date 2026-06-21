import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import DashboardView from './DashboardView';

describe('DashboardView', () => {
  it('renders backend-derived summary metrics and account rows', async () => {
    const setActiveTab = vi.fn();
    const setSelectedAccount = vi.fn();
    const user = userEvent.setup();

    render(
      <DashboardView
        accounts={[
          {
            id: 'acc-1',
            name: 'Account A',
            status: 'Active',
            providerRegion: 'Aliyun Domestic',
            mainRegion: 'cn-hangzhou',
            lastSynced: 'Just now',
            creationDate: '2026-06-17',
            owner: 'domestic@aliyun.local',
            accessKeyId: 'ak',
            accessKeySecret: 'secret',
            managedRegions: 'cn-hangzhou',
            trafficDefaults: {
              maximumTrafficGb: 200,
              overflowAction: 'notify',
              monitoringEnabled: true,
            },
          },
        ]}
        instances={[
          {
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
            inherited: true,
            alerts: ['Traffic usage at 90%'],
          },
        ]}
        summary={{
          accountCount: 1,
          ecsCount: 2,
          eipCount: 1,
          activeWorkflowCount: 1,
          attentionInstanceCount: 1,
          monitoredInstanceCount: 1,
        }}
        workflows={[
          {
            id: 'job-1',
            name: 'discover - acc-1',
            status: 'Running',
            activeStepIndex: 0,
            initiatedBy: 'acc-1',
            targetRegion: 'cn-hangzhou',
            startedAt: '2026-06-17',
            duration: 'Just now',
            tasks: [],
            logs: [],
          },
        ]}
        setActiveTab={setActiveTab}
        setSelectedAccount={setSelectedAccount}
      />,
    );

    expect(screen.getByText('控制台概览')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Account A')).toBeInTheDocument();
    expect(screen.getByText('Traffic usage at 90%')).toBeInTheDocument();

    await user.click(screen.getByText('查看全部'));
    expect(setActiveTab).toHaveBeenCalledWith('accounts');
  });
});
