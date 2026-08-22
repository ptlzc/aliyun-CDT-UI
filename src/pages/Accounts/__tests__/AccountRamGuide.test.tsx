import {createMemoryRouter, RouterProvider} from 'react-router-dom';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import AccountsPage from '../index';
import type {CloudAccount} from '../../../types';

const account: CloudAccount = {
  id: 'acc-1',
  name: 'Account A',
  providerRegion: 'Aliyun Domestic',
  mainRegion: 'cn-hangzhou',
  lastSynced: 'Just now',
  creationDate: '2026-06-17',
  accessKeyId: 'ak',
  accessKeySecret: 'secret',
  managedRegions: 'cn-hangzhou',
  trafficDefaults: {maximumTrafficGb: 200, overflowAction: 'notify', monitoringEnabled: true},
};

const mocks = vi.hoisted(() => ({
  listRegions: vi.fn(),
  validateMutate: vi.fn(),
  permissionResult: undefined as undefined | {permitted: boolean; errorType?: 'permission' | 'credential' | 'network'; error?: string},
}));

vi.mock('../../../features/runtime/hooks', () => ({
  useRuntimeDashboard: () => ({
    isLoading: false,
    accounts: [account],
    rawAccounts: [],
    graphs: [],
    instances: [],
    workflows: [],
    summary: {accountCount: 1, ecsCount: 0, eipCount: 0, activeWorkflowCount: 0, attentionInstanceCount: 0, monitoredInstanceCount: 0},
    platformDefaults: null,
    policiesByAccount: {},
  }),
  useSaveAccountMutation: () => ({mutateAsync: vi.fn(), isPending: false}),
  useDeleteAccountMutation: () => ({mutate: vi.fn(), isPending: false}),
  useCdtPermissionQuery: () => ({data: mocks.permissionResult, isLoading: false}),
  useValidateAccountMutation: () => ({mutateAsync: mocks.validateMutate}),
  useTrafficAuditsQuery: () => ({data: {items: [], total: 0}, isLoading: false, isError: false, error: null}),
}));

vi.mock('../../../lib/api/client', () => ({listRegions: mocks.listRegions}));

function renderAccounts(path: '/accounts/new' | '/accounts/acc-1') {
  const router = createMemoryRouter(
    [
      {path: '/accounts', element: <AccountsPage />},
      {path: '/accounts/:accountId', element: <AccountsPage />},
    ],
    {initialEntries: [path]},
  );
  render(<RouterProvider router={router} />);
}

describe('account RAM authorization guide', () => {
  beforeEach(() => {
    mocks.listRegions.mockReset();
    mocks.validateMutate.mockReset();
    mocks.permissionResult = undefined;
  });

  it('shows the full policy and RAM-user guidance in the create sidebar', async () => {
    renderAccounts('/accounts/new');

    expect(await screen.findByText('平台 RAM 最小权限')).toBeInTheDocument();
    expect(screen.getByTestId('account-policy-json')).toHaveTextContent('bssapi:QueryInstanceBill');
    expect(screen.getAllByText(/不要使用阿里云主账号 AccessKey/)).toHaveLength(2);
    expect(screen.getByText(/RAM 用户默认没有任何权限/)).toBeInTheDocument();
  });

  it('updates the RAM console link when the create form switches site', async () => {
    const user = userEvent.setup();
    renderAccounts('/accounts/new');

    expect(await screen.findByRole('link', {name: /前往阿里云 RAM 控制台/})).toHaveAttribute(
      'href',
      'https://ram.console.aliyun.com/users',
    );
    await user.click(screen.getByRole('radio', {name: /国际 \(international\)/}));
    expect(screen.getByRole('link', {name: /前往阿里云国际 RAM 控制台/})).toHaveAttribute(
      'href',
      'https://ram.console.alibabacloud.com/users',
    );
  });

  it('opens the policy modal from a permission-shaped region error', async () => {
    mocks.listRegions.mockRejectedValue(new Error('NoPermission: ecs:DescribeRegions'));
    const user = userEvent.setup();
    renderAccounts('/accounts/new');

    await user.type(screen.getByPlaceholderText(/LTAI5t7/), 'LTAI5t7TEST');
    await user.type(screen.getByPlaceholderText('************************'), 'secret123');
    await user.click(screen.getByRole('button', {name: /获取可用地域/}));
    await user.click(await screen.findByRole('button', {name: '查看所需权限 JSON'}));

    expect(screen.getByRole('dialog', {name: /账号 RAM 授权策略 — 新账号/})).toBeInTheDocument();
  });

  it('does not offer RAM repair for a credential-shaped region error', async () => {
    mocks.listRegions.mockRejectedValue(new Error('InvalidAccessKeyId: invalid credential'));
    const user = userEvent.setup();
    renderAccounts('/accounts/new');

    await user.type(screen.getByPlaceholderText(/LTAI5t7/), 'LTAI5t7TEST');
    await user.type(screen.getByPlaceholderText('************************'), 'secret123');
    await user.click(screen.getByRole('button', {name: /获取可用地域/}));

    expect(await screen.findByText(/InvalidAccessKeyId/)).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: '查看所需权限 JSON'})).not.toBeInTheDocument();
  });

  it('shows the sidebar and opens the modal from an account permission warning', async () => {
    mocks.permissionResult = {permitted: false, errorType: 'permission', error: 'NoPermission'};
    const user = userEvent.setup();
    renderAccounts('/accounts/acc-1');

    expect(await screen.findByText('平台 RAM 最小权限')).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: '查看所需权限 JSON'}));

    expect(screen.getByRole('dialog', {name: /账号 RAM 授权策略 — Account A/})).toBeInTheDocument();
    expect(screen.getAllByTestId('account-policy-json')).toHaveLength(2);
  });

  it('opens the policy modal when connection validation reports a permission warning', async () => {
    mocks.validateMutate.mockResolvedValue({valid: true, warning: 'VPC DescribeVpcs: Forbidden', errorType: 'permission'});
    const user = userEvent.setup();
    renderAccounts('/accounts/acc-1');

    await user.click(await screen.findByRole('button', {name: /测试连接/}));
    await user.click(await screen.findByRole('button', {name: '查看连接测试所需权限 JSON'}));

    expect(screen.getByRole('dialog', {name: /账号 RAM 授权策略 — Account A/})).toBeInTheDocument();
  });
});
