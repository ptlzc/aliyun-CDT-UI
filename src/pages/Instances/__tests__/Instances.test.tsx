import {createMemoryRouter, Outlet, RouterProvider} from 'react-router-dom';
import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import InstancesPage from '../index';
import CdtFreeQuotaCard from '../components/CdtFreeQuotaCard';
import {INSTANCE_STATUS_LABELS, SOURCE_LAYER_LABELS, sourceLayerBadgeClass} from '../components/instanceLabels';

let instancesData: any[] = [];
let cdtData: any = null;
let governanceData: any = null;

vi.mock('../../../features/runtime/hooks', () => ({
  useRuntimeDashboard: () => ({
    isLoading: false,
    accounts: [],
    rawAccounts: [],
    graphs: [],
    instances: instancesData,
    workflows: [],
    summary: {
      accountCount: 0,
      ecsCount: 0,
      eipCount: 0,
      activeWorkflowCount: 0,
      attentionInstanceCount: 0,
      monitoredInstanceCount: 0,
    },
    platformDefaults: null,
    policiesByAccount: {},
  }),
  useStartECSInstanceMutation: () => ({mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false}),
  useStopECSInstanceMutation: () => ({mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false}),
  useCdtFreeQuotaQuery: () => ({data: cdtData, isLoading: false}),
  useEffectiveTrafficGovernanceQuery: () => ({data: governanceData, isLoading: false}),
  useECSVncUrlQuery: () => ({data: null, isLoading: false}),
  useECSMetricsQuery: () => ({data: null, isLoading: false}),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({invalidateQueries: vi.fn().mockResolvedValue(undefined)}),
}));

// The page reads its openInstance callback from the layout Outlet context,
// mirroring the production layout shell wiring.
function renderInstances() {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <Outlet context={{openInstance: vi.fn()}} />,
        children: [{index: true, element: <InstancesPage />}],
      },
    ],
    {initialEntries: ['/']},
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('CdtFreeQuotaCard', () => {
  it('renders domestic and international progress bars with used / capacity values', () => {
    cdtData = null;

    render(
      <CdtFreeQuotaCard
        snapshot={{
          billingMonth: '2026-06',
          collectedAt: '2026-06-22T00:00:00Z',
          dataDelayHours: 2.5,
          domesticCapacityGb: 20,
          domesticRemainingGb: 7.5,
          domesticUsedGb: 12.5,
          internationalCapacityGb: 10,
          internationalRemainingGb: 10,
          internationalUsedGb: 0,
        }}
      />,
    );

    expect(screen.getByText('CDT 免费额度')).toBeInTheDocument();
    expect(screen.getByText('12.5 / 20 GB')).toBeInTheDocument();
    expect(screen.getByText('0 / 10 GB')).toBeInTheDocument();
    expect(screen.getByText('数据延迟: 2.5 小时')).toBeInTheDocument();
    expect(screen.getByText('账单月份: 2026-06')).toBeInTheDocument();
  });
});

describe('InstancesPage', () => {
  it('renders the list header without the account-level CDT card by default', () => {
    cdtData = null;
    governanceData = null;
    instancesData = [];

    renderInstances();

    expect(screen.getByRole('heading', {name: /ECS 实例列表/})).toBeInTheDocument();
    // No account scope on the top-level route → no quota card
    expect(screen.queryByText('CDT 免费额度')).not.toBeInTheDocument();
    expect(screen.queryByText('生效治理来源')).not.toBeInTheDocument();
    expect(screen.getByText('没有匹配的实例。')).toBeInTheDocument();
  });

  it('renders an instance card per filtered instance', () => {
    cdtData = null;
    governanceData = null;
    instancesData = [
      {
        id: 'i-1',
        accountId: 'acc-1',
        accountName: 'Account A',
        name: 'ecs-a',
        status: 'Running',
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
        alerts: [],
      },
    ];

    renderInstances();

    expect(screen.getByText('ecs-a')).toBeInTheDocument();
    expect(screen.getAllByText('运行中').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', {name: '停止'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /连接 VNC/})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '状态'})).toBeInTheDocument();
  });
});

describe('instanceLabels', () => {
  it('maps source layer values to Chinese labels', () => {
    expect(SOURCE_LAYER_LABELS['instance']).toBe('实例级');
    expect(SOURCE_LAYER_LABELS['region-group']).toBe('地区组');
    expect(SOURCE_LAYER_LABELS['platform-default']).toBe('全局默认');
    expect(SOURCE_LAYER_LABELS['global']).toBe('全局默认');
    expect(SOURCE_LAYER_LABELS['unknown']).toBeUndefined();
  });

  it('maps instance status values to Chinese labels', () => {
    expect(INSTANCE_STATUS_LABELS['Running']).toBe('运行中');
    expect(INSTANCE_STATUS_LABELS['Stopped']).toBe('已停止');
    expect(INSTANCE_STATUS_LABELS['Attention']).toBe('需关注');
  });

  it('assigns badge classes per source layer', () => {
    expect(sourceLayerBadgeClass('实例级')).toContain('text-[#1B5E20]');
    expect(sourceLayerBadgeClass('地区组')).toContain('text-[#F57F17]');
    expect(sourceLayerBadgeClass('全局默认')).toContain('text-secondary-ink');
  });
});
