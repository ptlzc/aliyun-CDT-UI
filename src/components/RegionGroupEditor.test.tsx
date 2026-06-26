import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import RegionGroupEditor from './RegionGroupEditor';

describe('RegionGroupEditor', () => {
  it('renders all form fields in create mode', () => {
    render(<RegionGroupEditor onSave={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText('地区组名称')).toBeInTheDocument();
    expect(screen.getByText('站点类型')).toBeInTheDocument();
    expect(screen.getByText('地区匹配规则')).toBeInTheDocument();
    expect(screen.getByText('累计流量上限（GB）')).toBeInTheDocument();
    expect(screen.getByText('溢出动作')).toBeInTheDocument();
    expect(screen.getByText('欠费/低流量动作')).toBeInTheDocument();
    expect(screen.getByText('启用监控')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '保存'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '取消'})).toBeInTheDocument();
  });

  it('submits onSave with parsed payload from form inputs', async () => {
    const onSave = vi.fn();
    const user = userEvent.setup();

    render(<RegionGroupEditor onSave={onSave} onCancel={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('例如：cn-hangzhou 组'), '华东生产组');
    await user.type(screen.getByPlaceholderText('cn-*, ap-southeast-*'), 'cn-*, ap-southeast-*');
    await user.clear(screen.getByRole('spinbutton'));
    await user.type(screen.getByRole('spinbutton'), '250');
    await user.selectOptions(screen.getAllByRole('combobox')[0], 'international');
    await user.selectOptions(screen.getAllByRole('combobox')[1], 'stop-instance');
    await user.selectOptions(screen.getAllByRole('combobox')[2], 'notify');
    await user.click(screen.getByText('启用监控'));

    await user.click(screen.getByRole('button', {name: '保存'}));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith({
      name: '华东生产组',
      siteType: 'international',
      regionPatterns: ['cn-*', 'ap-southeast-*'],
      maximumTrafficGb: 250,
      overflowAction: 'stop-instance',
      underflowAction: 'notify',
      monitoringEnabled: false,
    });
  });

  it('preloads existing group fields in edit mode', () => {
    render(
      <RegionGroupEditor
        group={{
          id: 'rg-1',
          name: '华东组',
          siteType: 'domestic',
          regionPatterns: ['cn-hangzhou', 'cn-beijing'],
          createdAt: '2026-06-01T00:00:00Z',
          updatedAt: '2026-06-02T00:00:00Z',
        }}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect((screen.getByPlaceholderText('例如：cn-hangzhou 组') as HTMLInputElement).value).toBe('华东组');
    expect((screen.getByPlaceholderText('cn-*, ap-southeast-*') as HTMLInputElement).value).toBe('cn-hangzhou, cn-beijing');
    expect((screen.getByRole('spinbutton') as HTMLInputElement).value).toBe('0');
  });

  it('calls onCancel when cancel button clicked', async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();

    render(<RegionGroupEditor onSave={vi.fn()} onCancel={onCancel} />);

    await user.click(screen.getByRole('button', {name: '取消'}));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
