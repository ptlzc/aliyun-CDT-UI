import {createMemoryRouter, RouterProvider} from 'react-router-dom';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import AccountsPage from '../index';
import type {CloudAccount} from '../../../types';
import type {ApiAccountRegion} from '../../../lib/api/client';

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

let runtimeAccounts: CloudAccount[] = [];

vi.mock('../../../features/runtime/hooks', () => ({
  useRuntimeDashboard: () => ({
    isLoading: false,
    accounts: runtimeAccounts,
    rawAccounts: [],
    graphs: [],
    instances: [],
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
  useSaveAccountMutation: () => ({mutateAsync: mocks.saveMutate, isPending: false}),
  useCdtPermissionQuery: () => ({data: undefined, isLoading: false}),
  useValidateAccountMutation: () => ({mutateAsync: vi.fn()}),
}));

vi.mock('../../../lib/api/client', () => ({
  listRegions: mocks.listRegions,
}));

// Mirrors production routing: the accounts page is URL-driven, so the harness
// renders the page through a memory router with the accounts route set.
function renderAccounts(initialPath = '/accounts') {
  const router = createMemoryRouter(
    [
      {path: '/accounts', element: <AccountsPage />},
      {path: '/accounts/:accountId', element: <AccountsPage />},
      {path: '*', element: <div>not found</div>},
    ],
    {initialEntries: [initialPath]},
  );
  render(<RouterProvider router={router} />);
  return router;
}

describe('AccountsPage create flow', () => {
  beforeEach(() => {
    mocks.saveMutate.mockReset();
    mocks.listRegions.mockReset();
    runtimeAccounts = [accountA];
  });

  it('opens the create form when clicking 添加账号凭证', async () => {
    const user = userEvent.setup();
    const router = renderAccounts();

    // List view is visible initially
    expect(screen.getByRole('heading', {name: /账户管理/})).toBeInTheDocument();

    await user.click(screen.getByRole('button', {name: /添加账号凭证/}));

    // URL moves to the static create segment and the form renders
    expect(router.state.location.pathname).toBe('/accounts/new');
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
    const router = renderAccounts();

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
    expect(router.state.location.pathname).toBe('/accounts');
    expect(await screen.findByRole('heading', {name: /账户管理/})).toBeInTheDocument();
  });

  it('shows the backend error message inline when the region fetch fails', async () => {
    mocks.listRegions.mockRejectedValue(new Error('InvalidAccessKeyId: 无效的 AccessKey'));
    const user = userEvent.setup();
    renderAccounts();

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
    const router = renderAccounts();

    await user.click(screen.getByRole('button', {name: /添加账号凭证/}));
    await screen.findByRole('heading', {name: /添加托管云授权凭证/});

    await user.click(screen.getByRole('button', {name: '取消'}));

    expect(router.state.location.pathname).toBe('/accounts');
    expect(await screen.findByRole('heading', {name: /账户管理/})).toBeInTheDocument();
    expect(mocks.saveMutate).not.toHaveBeenCalled();
  });
});

describe('AccountsPage required-field validation', () => {
  // Opens the create form only; fields are filled per-test so each case
  // controls exactly what state the save handler sees.
  async function openCreateForm() {
    const user = userEvent.setup();
    renderAccounts();
    await user.click(screen.getByRole('button', {name: /添加账号凭证/}));
    await screen.findByRole('heading', {name: /添加托管云授权凭证/});
    return user;
  }

  beforeEach(() => {
    mocks.saveMutate.mockReset();
    mocks.listRegions.mockReset();
    runtimeAccounts = [accountA];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('never shows the required-field alert when all three fields are filled', async () => {
    // Regression: browser autofill fills the DOM without firing React
    // onChange, so the save handler must not trust visually filled inputs;
    // state-backed values typed via userEvent must save without the alert.
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    mocks.saveMutate.mockResolvedValue({id: 'acc-2'});
    const user = await openCreateForm();

    await user.type(screen.getByPlaceholderText(/生产账号/), 'Test Account');
    await user.type(screen.getByPlaceholderText(/LTAI5t7/), 'LTAI5t7TEST');
    await user.type(screen.getByPlaceholderText('************************'), 'secret123');
    await user.click(screen.getByRole('button', {name: '保存'}));

    expect(alertSpy).not.toHaveBeenCalled();
    expect(mocks.saveMutate).toHaveBeenCalledTimes(1);
  });

  it('shows the required-field alert when only part of the fields are filled', async () => {
    // Existing behavior guard: partial input must keep blocking the save.
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const user = await openCreateForm();

    await user.type(screen.getByPlaceholderText(/生产账号/), 'Test Account');
    await user.click(screen.getByRole('button', {name: '保存'}));

    expect(alertSpy).toHaveBeenCalledWith('请输入必填字段：账户名称、Access Key ID、Access Key Secret');
    expect(mocks.saveMutate).not.toHaveBeenCalled();
  });

  it('rejects whitespace-only values with the required-field alert', async () => {
    // Trim hardening: all-blank/whitespace-pasted input must count as empty
    // and must not reach the backend.
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const user = await openCreateForm();

    await user.type(screen.getByPlaceholderText(/生产账号/), '   ');
    await user.type(screen.getByPlaceholderText(/LTAI5t7/), '   ');
    await user.type(screen.getByPlaceholderText('************************'), '   ');
    await user.click(screen.getByRole('button', {name: '保存'}));

    expect(alertSpy).toHaveBeenCalledWith('请输入必填字段：账户名称、Access Key ID、Access Key Secret');
    expect(mocks.saveMutate).not.toHaveBeenCalled();
  });
});

describe('AccountsPage managed region select-all and instance counts', () => {
  // Opens the create form with credentials and loads the SDK-fetched regions,
  // mirroring the existing create-flow tests.
  async function openCreateWithRegions(regions: ApiAccountRegion[]) {
    mocks.listRegions.mockResolvedValue(regions);
    const user = userEvent.setup();
    renderAccounts();
    await user.click(screen.getByRole('button', {name: /添加账号凭证/}));
    await screen.findByRole('heading', {name: /添加托管云授权凭证/});
    await user.type(screen.getByPlaceholderText(/生产账号/), 'Test Account');
    await user.type(screen.getByPlaceholderText(/LTAI5t7/), 'LTAI5t7TEST');
    await user.type(screen.getByPlaceholderText('************************'), 'secret123');
    await user.click(screen.getByRole('button', {name: /获取可用地域/}));
    await screen.findByText(new RegExp(`已加载 ${regions.length} 个可用地域`));
    return user;
  }

  beforeEach(() => {
    mocks.saveMutate.mockReset();
    mocks.listRegions.mockReset();
    runtimeAccounts = [accountA];
  });

  it('selects and clears every SDK-fetched region via the 全选 checkbox', async () => {
    mocks.saveMutate.mockResolvedValue({id: 'acc-2'});
    const user = await openCreateWithRegions([
      {regionId: 'cn-hangzhou', localName: '华东 1（杭州）'},
      {regionId: 'cn-beijing', localName: '华北 2（北京）'},
    ]);

    await user.click(screen.getByRole('checkbox', {name: /全选/}));
    expect(screen.getByRole('checkbox', {name: /cn-hangzhou/})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: /cn-beijing/})).toBeChecked();

    // Second click clears the whole SDK list again
    await user.click(screen.getByRole('checkbox', {name: /全选/}));
    expect(screen.getByRole('checkbox', {name: /cn-hangzhou/})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: /cn-beijing/})).not.toBeChecked();

    // Select all once more and persist: the payload contains every SDK region
    await user.click(screen.getByRole('checkbox', {name: /全选/}));
    await user.click(screen.getByRole('button', {name: '保存'}));
    expect(mocks.saveMutate).toHaveBeenCalledWith(
      expect.objectContaining({regions: ['cn-hangzhou', 'cn-beijing']}),
    );
  });

  it('select-all never touches edit-flow fallback options outside the SDK list', async () => {
    mocks.saveMutate.mockResolvedValue({id: 'acc-2'});
    const user = userEvent.setup();
    renderAccounts();
    await user.click(screen.getByText('Account A'));
    await screen.findByRole('heading', {name: /凭据配置详情/});

    // Edit flow backfills the stored cn-hangzhou without any SDK fetch
    expect(screen.getByRole('checkbox', {name: /cn-hangzhou/})).toBeChecked();
    // No SDK list → no select-all control at all
    expect(screen.queryByRole('checkbox', {name: /全选/})).not.toBeInTheDocument();

    // SDK fetch returns only cn-beijing; stored cn-hangzhou stays a fallback option
    mocks.listRegions.mockResolvedValue([{regionId: 'cn-beijing', localName: '华北 2（北京）'}]);
    await user.click(screen.getByRole('button', {name: /获取可用地域/}));
    await screen.findByText(/已加载 1 个可用地域/);

    await user.click(screen.getByRole('checkbox', {name: /全选/}));
    expect(screen.getByRole('checkbox', {name: /cn-beijing/})).toBeChecked();
    // The fallback keeps its pre-existing selection, untouched by select-all
    expect(screen.getByRole('checkbox', {name: /cn-hangzhou/})).toBeChecked();

    await user.click(screen.getByRole('checkbox', {name: /全选/}));
    expect(screen.getByRole('checkbox', {name: /cn-beijing/})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: /cn-hangzhou/})).toBeChecked();
  });

  it('marks the 全选 checkbox indeterminate when only some SDK regions are selected', async () => {
    const user = await openCreateWithRegions([
      {regionId: 'cn-hangzhou', localName: '华东 1（杭州）'},
      {regionId: 'cn-beijing', localName: '华北 2（北京）'},
    ]);

    await user.click(screen.getByRole('checkbox', {name: /cn-hangzhou/}));
    expect((screen.getByRole('checkbox', {name: /全选/}) as HTMLInputElement).indeterminate).toBe(true);

    // Both selected → fully checked, no longer indeterminate
    await user.click(screen.getByRole('checkbox', {name: /cn-beijing/}));
    const selectAll = screen.getByRole('checkbox', {name: /全选/}) as HTMLInputElement;
    expect(selectAll.checked).toBe(true);
    expect(selectAll.indeterminate).toBe(false);

    // One deselected → back to indeterminate
    await user.click(screen.getByRole('checkbox', {name: /cn-hangzhou/}));
    expect((screen.getByRole('checkbox', {name: /全选/}) as HTMLInputElement).indeterminate).toBe(true);
  });

  it('renders the per-region ECS instance count badge from the SDK payload', async () => {
    await openCreateWithRegions([
      {regionId: 'cn-hangzhou', localName: '华东 1（杭州）', instanceCount: 42},
      {regionId: 'cn-beijing', localName: '华北 2（北京）', instanceCount: 7},
    ]);

    expect(screen.getByText('42 台')).toBeInTheDocument();
    expect(screen.getByText('7 台')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: /cn-hangzhou/})).toBeInTheDocument();
  });

  it('shows an em dash when a region has no instance count', async () => {
    await openCreateWithRegions([
      {regionId: 'cn-hangzhou', localName: '华东 1（杭州）'}, // no instanceCount → undefined
    ]);

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText(/台/)).not.toBeInTheDocument();
  });
});

describe('AccountsPage edit flow', () => {
  beforeEach(() => {
    mocks.saveMutate.mockReset();
    mocks.listRegions.mockReset();
    runtimeAccounts = [accountA];
  });

  it('backfills managed regions from the stored string and keeps no owner field', async () => {
    const user = userEvent.setup();
    const router = renderAccounts();

    await user.click(screen.getByText('Account A'));
    await screen.findByRole('heading', {name: /凭据配置详情/});

    // URL reflects the selected account id
    expect(router.state.location.pathname).toBe('/accounts/acc-1');
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
    renderAccounts();

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

  it('redirects an unknown account id back to the listing', async () => {
    const router = renderAccounts('/accounts/does-not-exist');
    expect(router.state.location.pathname).toBe('/accounts');
    expect(await screen.findByRole('heading', {name: /账户管理/})).toBeInTheDocument();
  });
});
