import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import SettingsView from './SettingsView';

const saveMutate = vi.fn();
const applyMutate = vi.fn();
const createMutate = vi.fn();
const updateMutate = vi.fn();
const deleteMutate = vi.fn();

let regionGroupsReturnValue: any[] = [];

vi.mock('../features/runtime/hooks', () => ({
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

describe('SettingsView', () => {
  it('submits platform defaults and rollout action', async () => {
    const user = userEvent.setup();

    render(
      <SettingsView
        defaults={{
          maximumTrafficGb: 200,
          overflowAction: 'notify',
          monitoringEnabled: true,
        }}
      />,
    );

    expect(screen.getByText('默认累计流量上限（GB）')).toBeInTheDocument();

    await user.clear(screen.getByDisplayValue('200'));
    await user.type(screen.getByRole('spinbutton'), '300');
    await user.selectOptions(screen.getByRole('combobox'), 'keepalive-job');
    await user.click(screen.getByText('保存默认值'));
    await user.click(screen.getByText('应用到现有账号'));

    expect(saveMutate).toHaveBeenCalledWith({
      maximumTrafficGb: 300,
      overflowAction: 'keepalive-job',
      monitoringEnabled: true,
    });
    expect(applyMutate).toHaveBeenCalled();
  });
});

describe('SettingsView region group section', () => {
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

    render(<SettingsView defaults={null} />);

    expect(screen.getByText('地区组配置')).toBeInTheDocument();
    expect(screen.getByText('全局默认值')).toBeInTheDocument();
    expect(screen.getByText('地区组规则')).toBeInTheDocument();
    expect(screen.getByText('华东生产组')).toBeInTheDocument();
    expect(screen.getByText('cn-hangzhou, cn-beijing')).toBeInTheDocument();
    expect(screen.getByText('domestic')).toBeInTheDocument();
  });

  it('opens the editor in create mode when 新建地区组 clicked', async () => {
    regionGroupsReturnValue = [];
    const user = userEvent.setup();

    render(<SettingsView defaults={null} />);

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
    const user = userEvent.setup();

    render(<SettingsView defaults={null} />);

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
    const user = userEvent.setup();

    render(<SettingsView defaults={null} />);

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
