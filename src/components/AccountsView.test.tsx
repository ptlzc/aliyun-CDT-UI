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
}));

vi.mock('../features/runtime/hooks', () => ({
  useSaveAccountMutation: () => ({mutateAsync: mocks.saveMutate, isPending: false}),
  useCdtPermissionQuery: () => ({data: undefined, isLoading: false}),
  useValidateAccountMutation: () => ({mutateAsync: vi.fn()}),
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
  });

  it('opens the create form when clicking 添加账号 Credential', async () => {
    const user = userEvent.setup();
    render(<AccountsHarness accounts={[accountA]} />);

    // List view is visible initially
    expect(screen.getByRole('heading', {name: /账户管理/})).toBeInTheDocument();

    await user.click(screen.getByRole('button', {name: /添加账号 Credential/}));

    // Create form heading must appear (regression: the parent re-derived
    // selectedAccount as null for the local draft id, so nothing happened)
    expect(await screen.findByRole('heading', {name: /添加托管云授权凭证/})).toBeInTheDocument();
    // Create mode must not fire the CDT permission check (enabled only for
    // existing accounts) and has no 测试连接 button
    expect(screen.queryByText('账号权限')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: /测试连接/})).not.toBeInTheDocument();
  });

  it('saves a new account with the full payload and returns to the listing', async () => {
    mocks.saveMutate.mockResolvedValue({id: 'acc-2'});
    const user = userEvent.setup();
    render(<AccountsHarness accounts={[accountA]} />);

    await user.click(screen.getByRole('button', {name: /添加账号 Credential/}));
    await screen.findByRole('heading', {name: /添加托管云授权凭证/});

    await user.type(screen.getByPlaceholderText(/Production Core/), 'Test Account');
    await user.type(screen.getByPlaceholderText(/LTAI5t7/), 'LTAI5t7TEST');
    await user.type(screen.getByPlaceholderText('************************'), 'secret123');
    await user.click(screen.getByRole('button', {name: '保存'}));

    expect(mocks.saveMutate).toHaveBeenCalledWith({
      id: undefined,
      name: 'Test Account',
      siteType: 'domestic',
      accessKeyId: 'LTAI5t7TEST',
      accessKeySecret: 'secret123',
      regions: ['cn-hangzhou', 'cn-beijing', 'cn-shanghai'],
      regionId: 'cn-hangzhou',
      zoneId: 'cn-hangzhou (华东 1)',
      ossBucket: '',
      ossEndpoint: 'oss-cn-hangzhou.aliyuncs.com',
    });

    // Form closes and the listing is shown again
    expect(await screen.findByRole('heading', {name: /账户管理/})).toBeInTheDocument();
  });

  it('cancelling the create form returns to the listing', async () => {
    const user = userEvent.setup();
    render(<AccountsHarness accounts={[accountA]} />);

    await user.click(screen.getByRole('button', {name: /添加账号 Credential/}));
    await screen.findByRole('heading', {name: /添加托管云授权凭证/});

    await user.click(screen.getByRole('button', {name: '取消'}));

    expect(await screen.findByRole('heading', {name: /账户管理/})).toBeInTheDocument();
    expect(mocks.saveMutate).not.toHaveBeenCalled();
  });
});
