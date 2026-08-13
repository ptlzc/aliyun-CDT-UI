import {createMemoryRouter, RouterProvider} from 'react-router-dom';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import DashboardPage from '../index';
import type {CloudAccount, DashboardSummary, ECSInstance, WorkflowRun} from '../../../types';

const accounts: CloudAccount[] = [
  {
    id: 'acc-1',
    name: 'Account A',
    providerRegion: 'Aliyun Domestic',
    mainRegion: 'cn-hangzhou',
    lastSynced: 'Just now',
    creationDate: '2026-06-17',
    accessKeyId: 'ak',
    accessKeySecret: 'secret',
    managedRegions: 'cn-hangzhou',
    trafficDefaults: {
      maximumTrafficGb: 200,
      overflowAction: 'notify',
      monitoringEnabled: true,
    },
  },
];

const instances: ECSInstance[] = [
  {
    id: 'i-1',
    accountId: 'acc-1',
    accountName: 'Account A',
    name: 'ecs-a',
    status: 'Attention',
    type: 'ecs.g6.large',
    zone: 'cn-hangzhou-i',
    regionId: 'cn-hangzhou-i',
    publicIp: '1.1.1.1',
    privateIp: '10.0.0.1',
    trafficUsage: 180,
    trafficUsageUnit: 'GB',
    trafficRate: 22.5,
    trafficRateUnit: 'Mbps',
    trafficLimit: 200,
    monitoringEnabled: true,
    overflowAction: 'notify',
    inherited: true,
    alerts: ['累计流量使用已达配置上限的 90%。'],
  },
];

const summary: DashboardSummary = {
  accountCount: 1,
  ecsCount: 2,
  eipCount: 1,
  activeWorkflowCount: 1,
  attentionInstanceCount: 1,
  monitoredInstanceCount: 1,
};

const workflows: WorkflowRun[] = [
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
];

const runtimeData = {
  isLoading: false,
  accounts,
  rawAccounts: [],
  graphs: [],
  instances,
  workflows,
  summary,
  platformDefaults: null,
  policiesByAccount: {},
};

vi.mock('../../../features/runtime/hooks', () => ({
  useRuntimeDashboard: () => runtimeData,
}));

function renderDashboard() {
  const router = createMemoryRouter(
    [
      {path: '/', element: <DashboardPage />},
      {path: '/accounts', element: <div>accounts page</div>},
      {path: '/accounts/:accountId', element: <div>account detail page</div>},
      {path: '/instances', element: <div>instances page</div>},
      {path: '/workflows', element: <div>workflows page</div>},
      {path: '/settings', element: <div>settings page</div>},
      {path: '*', element: <div>not found</div>},
    ],
    {initialEntries: ['/']},
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('DashboardPage', () => {
  it('renders backend-derived summary metrics and account rows', async () => {
    const user = userEvent.setup();
    const router = renderDashboard();

    expect(screen.getByText('控制台概览')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Account A')).toBeInTheDocument();
    expect(screen.getByText('累计流量使用已达配置上限的 90%。')).toBeInTheDocument();
    expect(screen.getByText('当前速率 22.5 Mbps')).toBeInTheDocument();

    await user.click(screen.getByText('查看全部'));
    expect(router.state.location.pathname).toBe('/accounts');
  });

  it('navigates to the account detail when an account row is clicked', async () => {
    const user = userEvent.setup();
    const router = renderDashboard();

    await user.click(screen.getByText('Account A'));
    expect(router.state.location.pathname).toBe('/accounts/acc-1');
  });

  it('navigates to settings / instances / workflows via the shortcut buttons', async () => {
    const user = userEvent.setup();
    const router = renderDashboard();

    await user.click(screen.getByRole('button', {name: '系统设置'}));
    expect(router.state.location.pathname).toBe('/settings');

    router.navigate('/');
    await screen.findByText('控制台概览');
    await user.click(screen.getByRole('button', {name: '管理实例'}));
    expect(router.state.location.pathname).toBe('/instances');

    router.navigate('/');
    await screen.findByText('控制台概览');
    await user.click(screen.getByRole('button', {name: '打开工作流'}));
    expect(router.state.location.pathname).toBe('/workflows');
  });
});
