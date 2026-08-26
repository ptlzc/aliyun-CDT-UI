import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {createMemoryRouter, RouterProvider} from 'react-router-dom';
import {act, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import {appRoutes} from '../router';
import {useRuntimeDashboard} from '../features/runtime/hooks';
import type {CloudAccount} from '../types';

const queryClient = new QueryClient();

const accountA: CloudAccount = {
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
};

const runtimeData = {
  isLoading: false,
  accounts: [accountA],
  rawAccounts: [],
  graphs: [],
  instances: [],
  workflows: [],
  summary: {
    accountCount: 1,
    ecsCount: 0,
    eipCount: 0,
    activeWorkflowCount: 0,
    attentionInstanceCount: 0,
    monitoredInstanceCount: 0,
  },
  platformDefaults: null,
  policiesByAccount: {},
};

vi.mock('../features/runtime/hooks', () => ({
  useRuntimeDashboard: vi.fn(() => runtimeData),
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
  useAccountsQuery: vi.fn(() => ({
    data: [{
      id: 'acc-1',
      name: 'Account A',
      siteType: 'domestic',
      regionId: 'cn-hangzhou',
      regions: ['cn-hangzhou'],
      createdAt: '2026-06-17T00:00:00Z',
      updatedAt: '2026-06-17T00:00:00Z',
      accessKeyId: 'ak',
      accessKeySecret: 'secret',
    }],
    isLoading: false,
  })),
  useJobsQuery: vi.fn(() => ({data: [], isLoading: false})),
  useRegionsQuery: vi.fn(() => ({data: [], isLoading: false})),
  useInventoryGraphQuery: vi.fn(() => ({data: undefined, isLoading: false})),
  useEnrichedGraphQuery: vi.fn(() => ({data: undefined, isLoading: false})),
  useTrafficPoliciesQuery: vi.fn(() => ({data: [], isLoading: false})),
  usePlatformTrafficGovernanceQuery: vi.fn(() => ({data: {defaults: null}, isLoading: false})),
  useWorkflowsQuery: vi.fn(() => ({data: [], isLoading: false})),
  useInventoryInstances: vi.fn(() => ({rawAccounts: [], instances: [], inventoryLoading: false})),
  runtimeKeys: {
    accounts: ['runtime', 'accounts'],
    graph: (accountId: string) => ['runtime', 'graph', accountId],
    graphInventory: (accountId: string) => ['runtime', 'graph', accountId, 'inventory'],
    graphAll: ['runtime', 'graph'],
    jobs: ['runtime', 'jobs'],
    settings: ['runtime', 'settings', 'traffic-governance'],
    policies: (accountId: string) => ['runtime', 'traffic-policies', accountId],
    audits: (accountId: string, filters: unknown) => ['runtime', 'traffic-audits', accountId, filters],
    cdtPermission: (accountId: string) => ['runtime', 'cdt-permission', accountId],
    regions: (accountId: string) => ['runtime', 'regions', accountId],
  },
  accountKeys: {
    all: ['runtime', 'accounts'],
    byId: (accountId: string) => ['runtime', 'accounts', accountId],
  },
  inventoryKeys: {
    all: ['runtime', 'graph'],
    byAccount: (accountId: string) => ['runtime', 'graph', accountId, 'inventory'],
  },
  enrichedKeys: {
    all: ['runtime', 'graph'],
    byAccount: (accountId: string) => ['runtime', 'graph', accountId],
  },
  policyKeys: {
    all: ['runtime', 'traffic-policies'],
    byAccount: (accountId: string) => ['runtime', 'traffic-policies', accountId],
  },
  useCreateOneClickDeploymentMutation: () => ({mutate: vi.fn(), isPending: false, error: null}),
  useContinueOneClickDeploymentMutation: () => ({mutate: vi.fn(), isPending: false, error: null}),
  useSaveAccountMutation: () => ({mutateAsync: vi.fn(), isPending: false}),
  useDeleteAccountMutation: () => ({mutate: vi.fn(), isPending: false}),
  useCdtPermissionQuery: () => ({data: undefined, isLoading: false}),
  useValidateAccountMutation: () => ({mutateAsync: vi.fn()}),
  useSavePlatformDefaultsMutation: () => ({mutate: vi.fn(), isPending: false}),
  useApplyPlatformDefaultsMutation: () => ({mutate: vi.fn(), isPending: false, data: null}),
  useRegionGroupsQuery: () => ({data: [], isLoading: false}),
  useCreateRegionGroupMutation: () => ({mutate: vi.fn(), isPending: false}),
  useUpdateRegionGroupMutation: () => ({mutate: vi.fn(), isPending: false}),
  useDeleteRegionGroupMutation: () => ({mutate: vi.fn(), isPending: false}),
  useSaveInstanceGovernanceMutation: () => ({mutate: vi.fn(), isPending: false}),
  useSaveTrafficPolicyMutation: () => ({mutate: vi.fn(), isPending: false}),
  useStartECSInstanceMutation: () => ({mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false}),
  useStopECSInstanceMutation: () => ({mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false}),
  useCdtFreeQuotaQuery: () => ({data: null, isLoading: false}),
  useEffectiveTrafficGovernanceQuery: () => ({data: null, isLoading: false}),
  useECSVncUrlQuery: () => ({data: null, isLoading: false}),
  useECSMetricsQuery: () => ({data: null, isLoading: false}),
}));

vi.mock('../features/runtime/events', () => ({
  useRuntimeEventBridge: () => {},
}));

function renderApp(initialPath: string) {
  const router = createMemoryRouter(appRoutes, {initialEntries: [initialPath]});
  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe('App routing', () => {
  it('renders the dashboard for / and redirects the root path', () => {
    const router = renderApp('/');
    expect(screen.getByRole('heading', {name: /控制台概览/})).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/dashboard');
  });

  it('does not call the heavy runtime dashboard hook from non-instance layout/page routes', () => {
    const dashboardSpy = vi.mocked(useRuntimeDashboard);
    for (const path of ['/settings', '/accounts', '/workflows', '/protection-records', '/deployment']) {
      dashboardSpy.mockClear();
      renderApp(path);
      expect(dashboardSpy).not.toHaveBeenCalled();
    }
  });

  it('renders each page at its own route', async () => {
    const router = renderApp('/dashboard');
    expect(screen.getByRole('heading', {name: /控制台概览/})).toBeInTheDocument();

    await act(() => router.navigate('/accounts'));
    expect(await screen.findByRole('heading', {name: /账户管理/})).toBeInTheDocument();

    await act(() => router.navigate('/instances'));
    expect(await screen.findByRole('heading', {name: /ECS 实例列表/})).toBeInTheDocument();

    await act(() => router.navigate('/workflows'));
    expect(await screen.findByRole('heading', {name: /自动化工作流中心/})).toBeInTheDocument();

    await act(() => router.navigate('/deployment'));
    expect(await screen.findByRole('heading', {name: /一键部署 ECS/})).toBeInTheDocument();

    await act(() => router.navigate('/protection-records'));
    expect(await screen.findByRole('heading', {name: /保护记录/})).toBeInTheDocument();

    await act(() => router.navigate('/settings'));
    expect(await screen.findByRole('heading', {name: /系统设置/})).toBeInTheDocument();
  });

  it('deep-links to /accounts/new and /accounts/:accountId', async () => {
    const newRouter = renderApp('/accounts/new');
    expect(newRouter.state.location.pathname).toBe('/accounts/new');
    expect(screen.getByRole('heading', {name: /添加托管云授权凭证/})).toBeInTheDocument();

    const detailRouter = renderApp('/accounts/acc-1');
    expect(detailRouter.state.location.pathname).toBe('/accounts/acc-1');
    expect(screen.getByRole('heading', {name: /凭据配置详情/})).toBeInTheDocument();
  });

  it('redirects unknown paths to the dashboard', () => {
    const router = renderApp('/does-not-exist');
    expect(router.state.location.pathname).toBe('/dashboard');
    expect(screen.getByRole('heading', {name: /控制台概览/})).toBeInTheDocument();
  });

  it('supports browser back/forward between list and detail', async () => {
    const user = userEvent.setup();
    const router = renderApp('/accounts');

    await user.click(await screen.findByText('Account A'));
    expect(router.state.location.pathname).toBe('/accounts/acc-1');
    expect(await screen.findByRole('heading', {name: /凭据配置详情/})).toBeInTheDocument();

    await act(() => router.navigate(-1));
    expect(await screen.findByRole('heading', {name: /账户管理/})).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/accounts');
  });

  it('navigates from the sidebar menu', async () => {
    const user = userEvent.setup();
    const router = renderApp('/dashboard');

    await user.click(within(screen.getByRole('navigation')).getByRole('button', {name: /系统设置/}));
    expect(router.state.location.pathname).toBe('/settings');
    expect(await screen.findByRole('heading', {name: /系统设置/})).toBeInTheDocument();

    await user.click(within(screen.getByRole('navigation')).getByRole('button', {name: /保护记录/}));
    expect(router.state.location.pathname).toBe('/protection-records');
    expect(await screen.findByRole('heading', {name: /保护记录/})).toBeInTheDocument();
  });

  it('navigates to the one-click deployment page from the sidebar menu and the deploy button', async () => {
    const user = userEvent.setup();
    const router = renderApp('/dashboard');

    await user.click(within(screen.getByRole('navigation')).getByRole('button', {name: /一键部署/}));
    expect(router.state.location.pathname).toBe('/deployment');
    expect(await screen.findByRole('heading', {name: /一键部署 ECS/})).toBeInTheDocument();

    await user.click(within(screen.getByRole('navigation')).getByRole('button', {name: /部署新资源/}));
    expect(router.state.location.pathname).toBe('/deployment');
    expect(screen.getByRole('heading', {name: /一键部署 ECS/})).toBeInTheDocument();
  });
});
