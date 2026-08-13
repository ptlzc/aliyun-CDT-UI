import {useState} from 'react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import AccountsView from './AccountsView';
import type {CloudAccount} from '../types';

const accountA: CloudAccount = {
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
};

const mocks = vi.hoisted(() => ({
  saveMutate: vi.fn(),
  listRegions: vi.fn(),
}));

vi.mock('../features/runtime/hooks', () => ({
  useSaveAccountMutation: () => ({mutateAsync: mocks.saveMutate, isPending: false}),
  useCdtPermissionQuery: () => ({data: undefined, isLoading: false}),
  useValidateAccountMutation: () => ({mutateAsync: vi.fn()}),
}));

vi.mock('../lib/api/client', () => ({
  listRegions: mocks.listRegions,
}));

// Mirrors App.tsx wiring: the parent stores only the account id and re-derives
// the account from the backend-fetched accounts list.
function AccountsHarness({accounts}: {accounts: CloudAccount[]}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedAccount = accounts.find((account) => account.id === selectedId) || null;
  return (
    <AccountsView
      accounts={accounts}
      selectedAccount={selectedAccount}
      setSelectedAccount={(account) => setSelectedId(account?.id || null)}
    />
  );
}

describe('AccountsView create flow', () => {
  beforeEach(() => {
    mocks.saveMutate.mockReset();
    mocks.listRegions.mockReset();
  });

  it('opens the create form when clicking 添加账号凭证', async () => {
    const user = userEvent.setup();
    render(<AccountsHarness accounts={[accountA]} />);

    // List view is visible initially
    expect(screen.getByRole('heading', {name: /账户管理/})).toBeInTheDocument();

    await user.click(screen.getByRole('button', {name: /添加账号凭证/}));

    // Create form heading must appear (regression: the parent re-derived
    // selectedAccount as null for the local draft id, so nothing happened)
    expect(await screen.findByRole('heading', {name: /添加托管云授权凭证/})).toBeInTheDocument();
    // Create mode must not fire the CDT permission check (enabled only for
    // existing accounts) and has no 测试连接 button
    expect(screen.queryByText('账号权限')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /测试连接/})).not.toBeInTheDocument();
    // 责任人 input is removed; site type defaults to domestic
    expect(screen.queryByLabelText('责任人')).not.toBeInTheDocument();
    expect(screen.getByRole('radio', {name: /国内 \(domestic\)/})).toBeChecked();
  });

  it('saves a new account with SDK-fetched regions and returns to the listing', async () => {
    mocks.saveMutate.mockResolvedValue({id: 'acc-2'});
    mocks.listRegions.mockResolvedValue([
      {regionId: 'cn-hangzhou', localName: '华东 1（杭州）'},
      {regionId: 'cn-beijing', localName: '华北 2（北京）'},
    ]);
    const user = userEvent.setup();
    render(<AccountsHarness accounts={[accountA]} />);

    await user.click(screen.getByRole('button', {name: /添加账号凭证/}));
    await screen.findByRole('heading', {name: /添加托管云授权凭证/});

    await user.type(screen.getByPlaceholderText(/生产账号/), 'Test Account');
    await user.type(screen.getByPlaceholderText(/LTAI5t7/), 'LTAI5t7TEST');
    await user.type(screen.getByPlaceholderText('************************'), 'secret123');

    // Regions come from the generated SDK, never from hardcoded lists
    await user.click(screen.getByRole('button', {name: /获取可用地域/}));
    expect(await screen.findByText(/已加载 2 个可用地域/)).toBeInTheDocument();
    expect(mocks.listRegions).toHaveBeenCalledWith({
      accessKeyId: 'LTAI5t7TEST',
      accessKeySecret: 'secret123',
      siteType: 'domestic',
    });

    await user.selectOptions(screen.getByRole('combobox', {name: /主注册地域/}), 'cn-hangzhou');
    await user.click(screen.getByRole('checkbox', {name: /cn-hangzhou/}));
    await user.click(screen.getByRole('checkbox', {name: /cn-beijing/}));
    await user.click(screen.getByRole('button', {name: '保存'}));

    expect(mocks.saveMutate).toHaveBeenCalledWith({
      id: undefined,
      name: 'Test Account',
      siteType: 'domestic',
      accessKeyId: 'LTAI5t7TEST',
      accessKeySecret: 'secret123',
      regions: ['cn-hangzhou', 'cn-beijing'],
      regionId: 'cn-hangzhou',
      zoneId: 'cn-hangzhou',
      ossBucket: '',
      ossEndpoint: 'oss-cn-hangzhou.aliyuncs.com',
    });

    // Form closes and the listing is shown again
    expect(await screen.findByRole('heading', {name: /账户管理/})).toBeInTheDocument();
  });

  it('shows the backend error message inline when the region fetch fails', async () => {
    mocks.listRegions.mockRejectedValue(new Error('InvalidAccessKeyId: 无效的 AccessKey'));
    const user = userEvent.setup();
    render(<AccountsHarness accounts={[accountA]} />);

    await user.click(screen.getByRole('button', {name: /添加账号凭证/}));
    await screen.findByRole('heading', {name: /添加托管云授权凭证/});

    await user.type(screen.getByPlaceholderText(/LTAI5t7/), 'LTAI5t7TEST');
    await user.type(screen.getByPlaceholderText('************************'), 'secret123');
    await user.click(screen.getByRole('button', {name: /获取可用地域/}));

    expect(await screen.findByText(/InvalidAccessKeyId: 无效的 AccessKey/)).toBeInTheDocument();
    // No regions were loaded, so the checkbox group stays empty
    expect(screen.queryByRole('checkbox', {name: /cn-hangzhou/})).not.toBeInTheDocument();
  });

  it('cancelling the create form returns to the listing', async () => {
    const user = userEvent.setup();
    render(<AccountsHarness accounts={[accountA]} />);

    await user.click(screen.getByRole('button', {name: /添加账号凭证/}));
    await screen.findByRole('heading', {name: /添加托管云授权凭证/});

    await user.click(screen.getByRole('button', {name: '取消'}));

    expect(await screen.findByRole('heading', {name: /账户管理/})).toBeInTheDocument();
    expect(mocks.saveMutate).not.toHaveBeenCalled();
  });
});

describe('AccountsView edit flow', () => {
  it('backfills managed regions from the stored string and keeps no owner field', async () => {
    const user = userEvent.setup();
    render(<AccountsHarness accounts={[accountA]} />);

    await user.click(screen.getByText('Account A'));
    await screen.findByRole('heading', {name: /凭据配置详情/});

    // acc.managedRegions 'cn-hangzhou' → checked checkbox without a fetch
    expect(screen.getByRole('checkbox', {name: /cn-hangzhou/})).toBeChecked();
    // Main region select keeps the stored region visible
    expect(screen.getByRole('combobox', {name: /主注册地域/})).toHaveValue('cn-hangzhou');
    // The 责任人 input is gone from the edit form as well
    expect(screen.queryByLabelText('责任人')).not.toBeInTheDocument();
  });

  it('preserves stored regions and switches site type when the radio changes', async () => {
    mocks.listRegions.mockResolvedValue([
      {regionId: 'ap-southeast-1', localName: '新加坡'},
      {regionId: 'us-west-1', localName: '硅谷'},
    ]);
    const user = userEvent.setup();
    render(<AccountsHarness accounts={[accountA]} />);

    await user.click(screen.getByText('Account A'));
    await screen.findByRole('heading', {name: /凭据配置详情/});

    // Domestic is the default for a domestic account
    expect(screen.getByRole('radio', {name: /国内 \(domestic\)/})).toBeChecked();

    // Switching to international drops the domestic selections and requires
    // a fresh SDK fetch for the new site
    await user.click(screen.getByRole('radio', {name: /国际 \(international\)/}));
    expect(screen.getByRole('combobox', {name: /主注册地域/})).toHaveValue('');
    expect(screen.queryByRole('checkbox', {name: /cn-hangzhou/})).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', {name: /获取可用地域/}));
    expect(await screen.findByText(/已加载 2 个可用地域/)).toBeInTheDocument();
    expect(mocks.listRegions).toHaveBeenCalledWith({
      accessKeyId: 'ak',
      accessKeySecret: 'secret',
      siteType: 'international',
    });
    expect(screen.getByRole('checkbox', {name: /ap-southeast-1/})).toBeInTheDocument();
  });
});
