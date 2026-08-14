import {createMemoryRouter, RouterProvider} from 'react-router-dom';
import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';

import AccountsPage from '../index';
import type {CloudAccount} from '../../../types';
import type {ApiAccountRegion} from '../../../lib/api/client';

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

const mocks = vi.hoisted(() => ({
  saveMutate: vi.fn(),
  listRegions: vi.fn(),
  deleteMutate: vi.fn(),
}));

let runtimeAccounts: CloudAccount[] = [];
let auditLogs: unknown[] = [];

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
  useDeleteAccountMutation: () => ({mutate: mocks.deleteMutate, isPending: false}),
  useCdtPermissionQuery: () => ({data: undefined, isLoading: false}),
  useValidateAccountMutation: () => ({mutateAsync: vi.fn()}),
  useTrafficAuditsQuery: () => ({data: auditLogs, isLoading: false, isError: false, error: null}),
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
    auditLogs = [];
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
    // No real createdAt exists for a draft — the metadata card must not show
    // a fabricated import date row (the mock today-based date was removed)
    expect(screen.queryByText('关联导入日期')).not.toBeInTheDocument();
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
    auditLogs = [];
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
    auditLogs = [];
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
    auditLogs = [];
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
    // Metadata card shows only real fields: no fake sync status / owner rows,
    // but the real import date from backend createdAt stays visible
    expect(screen.queryByText('数据同步状态')).not.toBeInTheDocument();
    expect(screen.queryByText('项目安全所有者')).not.toBeInTheDocument();
    expect(screen.getByText('关联导入日期')).toBeInTheDocument();
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

  it('opens the audit log modal backed by real listTrafficAudits data', async () => {
    auditLogs = [
      {
        id: 'a1',
        accountId: 'acc-1',
        action: 'stop-instance',
        targetId: 'i-001',
        status: 'succeeded',
        message: '实例已停止',
        triggeredBy: 'traffic-governance',
        triggeredAt: '2026-06-16T10:14:15Z',
      },
      {
        id: 'a2',
        accountId: 'acc-1',
        action: 'start-instance',
        targetId: 'i-002',
        status: 'failed',
        message: 'IncorrectInstanceStatus',
        triggeredBy: 'manual-power',
        triggeredAt: '2026-06-16T09:00:00Z',
      },
    ];
    const user = userEvent.setup();
    renderAccounts();

    await user.click(screen.getByText('Account A'));
    await screen.findByRole('heading', {name: /凭据配置详情/});
    await user.click(screen.getByRole('button', {name: /查看操作日志/}));

    expect(await screen.findByText('实例已停止')).toBeInTheDocument();
    expect(screen.getByText('停止实例')).toBeInTheDocument();
    expect(screen.getByText('启动实例')).toBeInTheDocument();
    expect(screen.getByText('i-001')).toBeInTheDocument();
    expect(screen.getByText('成功')).toBeInTheDocument();
    expect(screen.getByText('失败')).toBeInTheDocument();
    expect(screen.getByText('IncorrectInstanceStatus')).toBeInTheDocument();
  });
});

describe('AccountsPage delete account flow', () => {
  beforeEach(() => {
    mocks.saveMutate.mockReset();
    mocks.listRegions.mockReset();
    mocks.deleteMutate.mockReset();
    runtimeAccounts = [accountA];
    auditLogs = [];
  });

  // The delete mutation mock emulates the backend refetch: on success the
  // account disappears from the runtime list, mirroring what
  // invalidateQueries(['runtime', 'accounts']) produces in production. It also
  // invokes the per-call onSuccess like real React Query mutations do, so the
  // page closes the dialog and runs its post-delete navigation.
  function mockDeleteRefreshesList() {
    mocks.deleteMutate.mockImplementation((_accountId: string, options?: {onSuccess?: () => void}) => {
      runtimeAccounts = runtimeAccounts.filter((acc) => acc.id !== accountA.id);
      options?.onSuccess?.();
      return Promise.resolve();
    });
  }

  it('opens the confirm dialog with the account name when the delete button is clicked', async () => {
    const user = userEvent.setup();
    renderAccounts();

    await user.click(screen.getByRole('button', {name: '删除账户'}));

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/确认删除账户/)).toBeInTheDocument();
    expect(within(dialog).getByText('Account A')).toBeInTheDocument();
    // Matching the name is mandatory: the confirm action starts disabled
    expect(within(dialog).getByRole('button', {name: '确认删除'})).toBeDisabled();
  });

  it('keeps confirm disabled until the typed name matches the account name', async () => {
    const user = userEvent.setup();
    renderAccounts();

    await user.click(screen.getByRole('button', {name: '删除账户'}));
    const input = screen.getByPlaceholderText(/请输入账户名/);

    // A mismatched name must not arm the destructive action
    await user.type(input, 'Account B');
    expect(screen.getByRole('button', {name: '确认删除'})).toBeDisabled();

    // Exact match arms it; trailing whitespace still counts as a mismatch
    await user.clear(input);
    await user.type(input, 'Account A ');
    expect(screen.getByRole('button', {name: '确认删除'})).toBeDisabled();

    await user.clear(input);
    await user.type(input, 'Account A');
    expect(screen.getByRole('button', {name: '确认删除'})).toBeEnabled();
  });

  it('deletes the account and refreshes the list when the matching name is confirmed', async () => {
    mockDeleteRefreshesList();
    const user = userEvent.setup();
    const router = renderAccounts();

    await user.click(screen.getByRole('button', {name: '删除账户'}));
    await user.type(screen.getByPlaceholderText(/请输入账户名/), 'Account A');
    await user.click(screen.getByRole('button', {name: '确认删除'}));

    expect(mocks.deleteMutate).toHaveBeenCalledTimes(1);
    // React Query passes the per-call options (onSuccess) alongside the id
    expect(mocks.deleteMutate).toHaveBeenCalledWith('acc-1', expect.objectContaining({onSuccess: expect.any(Function)}));
    // Dialog closes and the refreshed list no longer contains the account
    expect(screen.queryByRole('button', {name: '确认删除'})).not.toBeInTheDocument();
    expect(await screen.findByRole('heading', {name: /账户管理/})).toBeInTheDocument();
    expect(screen.queryByText('Account A')).not.toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/accounts');
  });

  it('issues no delete request when the dialog is cancelled', async () => {
    const user = userEvent.setup();
    renderAccounts();

    await user.click(screen.getByRole('button', {name: '删除账户'}));
    await user.click(screen.getByRole('button', {name: '取消'}));

    expect(mocks.deleteMutate).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', {name: '确认删除'})).not.toBeInTheDocument();
    expect(screen.getByText('Account A')).toBeInTheDocument();
  });
});
