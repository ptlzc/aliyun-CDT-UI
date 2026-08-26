import {createMemoryRouter, RouterProvider} from 'react-router-dom';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import SettingsPage from '../index';

const saveMutate = vi.fn();
const applyMutate = vi.fn();
const createMutate = vi.fn();
const updateMutate = vi.fn();
const deleteMutate = vi.fn();

let regionGroupsReturnValue: any[] = [];
let platformDefaultsValue: any = null;

vi.mock('../../../features/runtime/hooks', () => ({
  usePlatformTrafficGovernanceQuery: () => ({
    data: {defaults: platformDefaultsValue},
    isLoading: false,
  }),
  useSavePlatformDefaultsMutation: () => ({
    mutate: saveMutate,
    isPending: false,
  }),
  useApplyPlatformDefaultsMutation: () => ({
    mutate: applyMutate,
    isPending: false,
    data: null,
  }),
  useRegionGroupsQuery: () => ({data: regionGroupsReturnValue, isLoading: false}),
  useCreateRegionGroupMutation: () => ({mutate: createMutate, isPending: false}),
  useUpdateRegionGroupMutation: () => ({mutate: updateMutate, isPending: false}),
  useDeleteRegionGroupMutation: () => ({mutate: deleteMutate, isPending: false}),
}));

function renderSettings() {
  const router = createMemoryRouter([{path: '/', element: <SettingsPage />}], {initialEntries: ['/']});
  render(<RouterProvider router={router} />);
  return router;
}

describe('SettingsPage', () => {
  it('submits platform defaults and rollout action', async () => {
    platformDefaultsValue = {
      maximumTrafficGb: 200,
      overflowAction: 'notify',
      monitoringEnabled: true,
      overflowThresholdGb: 0,
    };
    const user = userEvent.setup();

    renderSettings();

    expect(screen.getByText('默认累计流量上限（GB）')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('默认累计流量上限（GB）'));
    await user.type(screen.getByLabelText('默认累计流量上限（GB）'), '300');
    await user.selectOptions(screen.getByRole('combobox'), 'keepalive-job');
    await user.click(screen.getByText('保存默认值'));
    await user.click(screen.getByText('应用到现有账号'));

    expect(saveMutate).toHaveBeenCalledWith({
      maximumTrafficGb: 300,
      overflowAction: 'keepalive-job',
      monitoringEnabled: true,
      overflowThresholdGb: undefined,
    });
    expect(applyMutate).toHaveBeenCalled();
  });

  it('renders full overflow action options and threshold input', () => {
    platformDefaultsValue = {
      maximumTrafficGb: 200,
      overflowAction: 'notify',
      monitoringEnabled: true,
      overflowThresholdGb: 0,
    };

    renderSettings();

    const actionSelect = screen.getByRole('combobox');
    const optionValues = Array.from(actionSelect.querySelectorAll('option')).map((option) => (option as HTMLOptionElement).value);
    expect(optionValues).toEqual(['notify', 'keepalive-job', 'stop-instance', 'start-instance', 'detach-eip', 'release-instance']);
    expect(screen.getByRole('option', {name: '停止实例'})).toBeInTheDocument();
    expect(screen.getByRole('option', {name: '释放实例'})).toBeInTheDocument();

    expect(screen.getByLabelText('溢出停止阈值（GB）')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('空则按上限判定')).toBeInTheDocument();
  });

  it('prefills threshold from defaults and submits overflowThresholdGb with stop-instance', async () => {
    platformDefaultsValue = {
      maximumTrafficGb: 200,
      overflowAction: 'stop-instance',
      monitoringEnabled: true,
      overflowThresholdGb: 195,
    };
    const user = userEvent.setup();

    renderSettings();

    expect(screen.getByLabelText('溢出停止阈值（GB）')).toHaveValue(195);

    await user.click(screen.getByText('保存默认值'));

    expect(saveMutate).toHaveBeenCalledWith({
      maximumTrafficGb: 200,
      overflowAction: 'stop-instance',
      monitoringEnabled: true,
      overflowThresholdGb: 195,
    });
  });
});

describe('SettingsPage region group section', () => {
  it('renders the two-tier relationship and region group list', () => {
    regionGroupsReturnValue = [
      {
        id: 'rg-1',
        name: '华东生产组',
        siteType: 'domestic',
        regionPatterns: ['cn-hangzhou', 'cn-beijing'],
        createdAt: '2026-06-01T00:00:00Z',
        updatedAt: '2026-06-02T00:00:00Z',
      },
    ];
    platformDefaultsValue = null;

    renderSettings();

    expect(screen.getByText('地区组配置')).toBeInTheDocument();
    expect(screen.getByText('全局默认值')).toBeInTheDocument();
    expect(screen.getByText('地区组规则')).toBeInTheDocument();
    expect(screen.getByText('华东生产组')).toBeInTheDocument();
    expect(screen.getByText('cn-hangzhou, cn-beijing')).toBeInTheDocument();
    expect(screen.getByText('domestic')).toBeInTheDocument();
  });

  it('opens the editor in create mode when 新建地区组 clicked', async () => {
    regionGroupsReturnValue = [];
    platformDefaultsValue = null;
    const user = userEvent.setup();

    renderSettings();

    await user.click(screen.getByRole('button', {name: '新建地区组'}));

    expect(screen.getByText('新建地区组', {selector: 'h3'})).toBeInTheDocument();
    expect(screen.getByPlaceholderText('例如：cn-hangzhou 组')).toBeInTheDocument();
  });

  it('calls delete mutation when delete button clicked for a group', async () => {
    regionGroupsReturnValue = [
      {
        id: 'rg-9',
        name: '海外组',
        siteType: 'international',
        regionPatterns: ['ap-southeast-*'],
        createdAt: '2026-06-01T00:00:00Z',
        updatedAt: '2026-06-02T00:00:00Z',
      },
    ];
    platformDefaultsValue = null;
    const user = userEvent.setup();

    renderSettings();

    await user.click(screen.getByRole('button', {name: '删除'}));
    expect(deleteMutate).toHaveBeenCalledWith('rg-9');
  });

  it('opens editor in edit mode and submits update mutation', async () => {
    regionGroupsReturnValue = [
      {
        id: 'rg-7',
        name: '华北组',
        siteType: 'domestic',
        regionPatterns: ['cn-qingdao'],
        createdAt: '2026-06-01T00:00:00Z',
        updatedAt: '2026-06-02T00:00:00Z',
      },
    ];
    platformDefaultsValue = null;
    const user = userEvent.setup();

    renderSettings();

    await user.click(screen.getByRole('button', {name: '编辑'}));
    expect((screen.getByPlaceholderText('例如：cn-hangzhou 组') as HTMLInputElement).value).toBe('华北组');

    await user.click(screen.getByRole('button', {name: '保存'}));
    expect(updateMutate).toHaveBeenCalledWith({
      id: 'rg-7',
      payload: expect.objectContaining({
        name: '华北组',
        siteType: 'domestic',
        regionPatterns: ['cn-qingdao'],
      }),
    });
  });
});
