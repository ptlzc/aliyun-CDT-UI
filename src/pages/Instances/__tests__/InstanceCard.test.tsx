import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import type {ECSInstance} from '../../../types';
import InstanceCard from '../components/InstanceCard';

/**
 * Renders a single InstanceCard with a default healthy instance; per-test
 * overrides (e.g. trafficUsageSource) drive the branch under assertion.
 *
 * @when InstanceCard 累计流量监测分支测试
 */
function renderCard(overrides: Partial<ECSInstance> = {}, onViewPolicy: (instance: ECSInstance) => void = vi.fn()) {
  const instance: ECSInstance = {
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
    monitoringEnabled: true,
    overflowAction: 'notify',
    inherited: true,
    alerts: [],
    ...overrides,
  };
  render(
    <InstanceCard
      instance={instance}
      loadingStatus={null}
      effectiveStatus="Running"
      powerError={null}
      onTogglePower={vi.fn()}
      onOpenVnc={vi.fn()}
      onToggleStateModal={vi.fn()}
      onManageInstance={vi.fn()}
      onViewPolicy={onViewPolicy}
    />,
  );
  return onViewPolicy;
}

describe('InstanceCard bss-* cumulative traffic usage branches', () => {
  it('renders the billing-delay copy for bss-no-data', () => {
    renderCard({trafficUsageSource: 'bss-no-data'});

    expect(screen.getByText('该实例本月暂无 CDT 出账明细（出账有小时级延迟）')).toBeInTheDocument();
  });

  it('mentions the bss:QueryInstanceBill permission for bss-permission-error', () => {
    renderCard({trafficUsageSource: 'bss-permission-error'});

    expect(screen.getByText(/bss:QueryInstanceBill/)).toBeInTheDocument();
  });

  it('renders the bss-permission-error notice in recovery-red with a click-to-view hint', () => {
    renderCard({trafficUsageSource: 'bss-permission-error'});

    const notice = screen.getByRole('button', {name: /点击查看授权脚本/});
    expect(notice.className).toContain('recovery-red');
  });

  it('invokes onViewPolicy with the instance when the permission notice is clicked', async () => {
    const user = userEvent.setup();
    const onViewPolicy = renderCard({trafficUsageSource: 'bss-permission-error'});

    await user.click(screen.getByRole('button', {name: /点击查看授权脚本/}));

    expect(onViewPolicy).toHaveBeenCalledWith(expect.objectContaining({id: 'i-1', accountId: 'acc-1'}));
  });

  it('reuses the credential error copy for bss-credential-error', () => {
    renderCard({trafficUsageSource: 'bss-credential-error'});

    expect(screen.getByText('凭据验证失败，请检查 AccessKey Secret 是否正确')).toBeInTheDocument();
  });

  it('reuses the network error copy for bss-network-error', () => {
    renderCard({trafficUsageSource: 'bss-network-error'});

    expect(screen.getByText(/BSS 接口网络错误/)).toBeInTheDocument();
  });

  it('mentions the DescribeInstanceBill upgrade for bss-api-error', () => {
    renderCard({trafficUsageSource: 'bss-api-error'});

    expect(screen.getByText('BSS 账单接口不可用，请联系管理员升级到 DescribeInstanceBill')).toBeInTheDocument();
  });

  it('prefers the backend errorReason over the branch fallback copy', () => {
    renderCard({trafficUsageSource: 'bss-no-data', trafficUsageErrorReason: '自定义出账原因'});

    expect(screen.getByText('自定义出账原因')).toBeInTheDocument();
  });

  it('renders the progress bar instead of an error notice for bss-cumulative with data', () => {
    renderCard({trafficUsageSource: 'bss-cumulative', trafficUsage: 180});

    expect(screen.getByText('180 GB / 200 GB')).toBeInTheDocument();
    expect(screen.queryByText(/暂无 CDT 出账明细/)).not.toBeInTheDocument();
  });
});

describe('InstanceCard cdt-region-shared branch', () => {
  it('renders the region-shared fallback copy when the backend omitted the errorReason', () => {
    renderCard({trafficUsageSource: 'cdt-region-shared'});

    expect(screen.getByText('该地域多个 EIP 共用流量, 无法按实例拆分')).toBeInTheDocument();
  });

  it('shows the backend errorReason verbatim when present', () => {
    renderCard({
      trafficUsageSource: 'cdt-region-shared',
      trafficUsageErrorReason: '该地域有多个 EIP 共用流量, 无法按实例拆分（地域合计 51.5 GB）',
    });

    expect(screen.getByText('该地域有多个 EIP 共用流量, 无法按实例拆分（地域合计 51.5 GB）')).toBeInTheDocument();
  });

  it('renders the region-shared notice with the neutral no-data style, not a permission/network error', () => {
    renderCard({trafficUsageSource: 'cdt-region-shared'});

    const notice = screen.getByText('该地域多个 EIP 共用流量, 无法按实例拆分').closest('div.rounded-md');
    expect(notice?.className).toContain('bg-emphasis-layer');
    expect(notice?.className).not.toContain('recovery-red');
    expect(notice?.className).not.toContain('border-primary');
    expect(screen.queryByRole('button', {name: /点击查看授权脚本/})).not.toBeInTheDocument();
    expect(screen.queryByText(/cdt:ListCdtInternetTraffic/)).not.toBeInTheDocument();
  });
});

describe('InstanceCard legacy cdt-* compatibility', () => {
  it('still renders the legacy copy for cdt-no-data', () => {
    renderCard({trafficUsageSource: 'cdt-no-data'});

    expect(screen.getByText('该实例暂无 CDT 累计流量数据')).toBeInTheDocument();
  });

  it('still renders the legacy permission copy for cdt-permission-error', () => {
    renderCard({trafficUsageSource: 'cdt-permission-error'});

    expect(screen.getByText(/cdt:ListCdtInternetTraffic/)).toBeInTheDocument();
  });

  it('renders the cdt-permission-error notice in recovery-red with a click-to-view hint', () => {
    renderCard({trafficUsageSource: 'cdt-permission-error'});

    const notice = screen.getByRole('button', {name: /点击查看授权脚本/});
    expect(notice.className).toContain('recovery-red');
  });
});
