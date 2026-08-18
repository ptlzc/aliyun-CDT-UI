import {createMemoryRouter, Outlet, RouterProvider} from 'react-router-dom';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, describe, expect, it, vi} from 'vitest';

import InstancesPage from '../index';
import CdtFreeQuotaCard from '../components/CdtFreeQuotaCard';
import {INSTANCE_STATUS_LABELS, SOURCE_LAYER_LABELS, sourceLayerBadgeClass} from '../components/instanceLabels';

let instancesData: any[] = [];
let rawAccountsData: any[] = [];
let cdtData: any = null;
let governanceData: any = null;

vi.mock('../../../features/runtime/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../features/runtime/hooks')>();
  return {
    ...actual,
    useRuntimeDashboard: () => ({
      isLoading: false,
      accounts: [],
      rawAccounts: rawAccountsData,
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
    mapAccountToViewModel: (account: any) => ({
      id: account.id,
      name: account.name,
      providerRegion: account.siteType === 'domestic' ? 'Aliyun Domestic' : 'Aliyun International',
      mainRegion: account.regionId,
      lastSynced: 'Just now',
      creationDate: '2026-06-17',
      accessKeyId: account.accessKeyId,
      accessKeySecret: account.accessKeySecret ?? '************************',
      managedRegions: (account.regions || []).join(', '),
      roleArn: '',
      trafficDefaults: account.trafficGovernanceDefaults ?? {
        maximumTrafficGb: 200,
        overflowAction: 'notify',
        monitoringEnabled: true,
      },
    }),
    useStartECSInstanceMutation: () => ({mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false}),
    useStopECSInstanceMutation: () => ({mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false}),
    useCdtFreeQuotaQuery: () => ({data: cdtData, isLoading: false}),
    useEffectiveTrafficGovernanceQuery: () => ({data: governanceData, isLoading: false}),
    useECSVncUrlQuery: () => ({data: null, isLoading: false}),
    useECSMetricsQuery: () => ({data: null, isLoading: false}),
  };
});

const {invalidateQueriesMock} = vi.hoisted(() => ({
  invalidateQueriesMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({invalidateQueries: invalidateQueriesMock}),
}));

// The page reads its openInstance callback from the layout Outlet context,
// mirroring the production layout shell wiring.
afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it('sync button invalidates graph/jobs/accounts only (targeted, no full invalidate)', async () => {
    const user = userEvent.setup();
    cdtData = null;
    governanceData = null;
    instancesData = [];
    invalidateQueriesMock.mockClear();

    renderInstances();

    await user.click(screen.getByRole('button', {name: '同步'}));

    await waitFor(() => expect(invalidateQueriesMock).toHaveBeenCalled());
    const filters = invalidateQueriesMock.mock.calls.map(([arg]) => arg as {queryKey: readonly unknown[]} | undefined);
    expect(filters).toHaveLength(3);
    const keys = filters.map((filter) => filter?.queryKey);
    expect(keys).toEqual(
      expect.arrayContaining([
        ['runtime', 'graph'],
        ['runtime', 'jobs'],
        ['runtime', 'accounts'],
      ]),
    );
    // Every call is targeted — the previous argument-less full invalidate is gone.
    for (const filter of filters) {
      expect(filter?.queryKey).toBeDefined();
    }
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

    // Card title shows the region instead of the instance name (lightweight title).
    expect(screen.getByRole('heading', {name: 'cn-hangzhou-i'})).toBeInTheDocument();
    expect(screen.queryByText('ecs-a')).not.toBeInTheDocument();
    expect(screen.getAllByText('运行中').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', {name: '停止'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /连接 VNC/})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '状态'})).toBeInTheDocument();
  });

  it('opens the SSH terminal modal when SSH login is clicked', async () => {
    const user = userEvent.setup();
    class FakeWebSocket {
      static instances: FakeWebSocket[] = [];
      readyState = 0;
      url: string;
      onopen: (() => void) | null = null;
      onmessage: (() => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;

      constructor(url: string) {
        this.url = url;
        FakeWebSocket.instances.push(this);
      }

      send() {}
      close() {}
    }
    vi.stubGlobal('WebSocket', FakeWebSocket);
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

    await user.click(screen.getByRole('button', {name: /SSH 登录/}));

    expect(screen.getByText('连接中')).toBeInTheDocument();
    expect(FakeWebSocket.instances).toHaveLength(1);
  });

  it('opens the shared auth policy modal when a permission notice is clicked', async () => {
    const user = userEvent.setup();
    cdtData = null;
    governanceData = null;
    rawAccountsData = [
      {
        id: 'acc-1',
        name: 'Account A',
        siteType: 'domestic',
        regionId: 'cn-hangzhou',
        accessKeyId: 'ak',
        accessKeySecret: 'secret',
        regions: ['cn-hangzhou'],
        createdAt: '2026-06-17T00:00:00Z',
        updatedAt: '2026-06-17T00:00:00Z',
        defaultImageKey: 'img-1',
        ossBucket: 'bucket',
        ossEndpoint: 'oss-cn-hangzhou.aliyuncs.com',
        zoneId: 'cn-hangzhou-i',
      },
    ];
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
        trafficUsage: null,
        trafficUsageUnit: 'GB',
        trafficRate: 22.5,
        trafficRateUnit: 'Mbps',
        trafficLimit: 200,
        trafficUsageSource: 'bss-permission-error',
        monitoringEnabled: true,
        overflowAction: 'notify',
        inherited: true,
        alerts: [],
      },
    ];

    renderInstances();

    await user.click(screen.getByRole('button', {name: /点击查看授权脚本/}));

    // Shared auth policy modal opens with the resolved account and the full
    // RAM policy JSON (paragraph + <pre> both contain the action names).
    expect(screen.getByText(/账号 RAM 授权策略/)).toBeInTheDocument();
    expect(screen.getAllByText(/cdt:ListCdtInternetTraffic/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/bss:QueryInstanceBill/).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', {name: '关闭'})).toBeInTheDocument();
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
