import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import type {ECSInstance} from '@/types';
import InstanceFirewallModal from '../components/InstanceFirewallModal';

const api = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  remove: vi.fn(),
  tailscale: vi.fn(),
}));

vi.mock('@/lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api/client')>();
  return {
    ...actual,
    listInstanceSecurityGroups: (...args: unknown[]) => api.list(...args),
    createInstanceSecurityGroupRule: (...args: unknown[]) => api.create(...args),
    deleteInstanceSecurityGroupRule: (...args: unknown[]) => api.remove(...args),
    applyTailscaleDirectFirewall: (...args: unknown[]) => api.tailscale(...args),
  };
});

const instance: ECSInstance = {
  id: 'i-1', accountId: 'acc-1', accountName: 'Account A', name: 'edge', status: 'Running',
  type: 'ecs.g6.large', zone: 'cn-hangzhou-i', regionId: 'cn-hangzhou', publicIp: '1.1.1.1',
  privateIp: '10.0.0.1', trafficUsage: 1, trafficUsageUnit: 'GB', trafficRate: 1,
  trafficRateUnit: 'Mbps', trafficLimit: 200, monitoringEnabled: true, overflowAction: 'notify',
  inherited: true, alerts: [], trafficPolicy: null,
};

const snapshot = {
  instanceId: 'i-1',
  securityGroups: [
    {
      id: 'sg-1', name: 'edge-firewall', regionId: 'cn-hangzhou',
      ingressRules: [{ruleId: 'sgr-in', direction: 'ingress', protocol: 'tcp', portRange: '22/22', cidr: '10.0.0.0/8', policy: 'accept', priority: 1, description: 'ssh'}],
      egressRules: [{ruleId: 'sgr-out', direction: 'egress', protocol: 'all', portRange: '-1/-1', cidr: '0.0.0.0/0', policy: 'accept', priority: 1}],
    },
    {id: 'sg-2', name: 'service-firewall', regionId: 'cn-hangzhou', ingressRules: [], egressRules: []},
  ],
};

function renderModal(props?: Partial<React.ComponentProps<typeof InstanceFirewallModal>>) {
  const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});
  const onClose = vi.fn();
  const onViewPolicy = vi.fn();
  render(
    <QueryClientProvider client={queryClient}>
      <InstanceFirewallModal instance={instance} onClose={onClose} onViewPolicy={onViewPolicy} {...props} />
    </QueryClientProvider>,
  );
  return {onClose, onViewPolicy};
}

describe('InstanceFirewallModal', () => {
  beforeEach(() => {
    api.list.mockReset().mockResolvedValue(snapshot);
    api.create.mockReset().mockResolvedValue({status: 'succeeded'});
    api.remove.mockReset().mockResolvedValue({status: 'succeeded'});
    api.tailscale.mockReset().mockResolvedValue({status: 'succeeded', operations: []});
  });

  it('loads attached groups on demand and renders direction-scoped live rules', async () => {
    const user = userEvent.setup();
    renderModal();

    expect(screen.getByRole('status', {name: '正在加载安全组规则'})).toBeInTheDocument();
    expect(await screen.findByRole('option', {name: /edge-firewall/})).toBeInTheDocument();
    expect(api.list).toHaveBeenCalledWith('acc-1', 'i-1');
    expect(screen.getByText(/22\/22/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', {name: '出站规则'}));
    expect(screen.getByText(/-1\/-1/)).toBeInTheDocument();
  });

  it('creates a validated egress rule on the explicitly selected group', async () => {
    const user = userEvent.setup();
    renderModal();
    await screen.findByRole('option', {name: /edge-firewall/});

    await user.selectOptions(screen.getByRole('combobox', {name: '安全组'}), 'sg-2');
    await user.click(screen.getByRole('button', {name: '出站规则'}));
    await user.selectOptions(screen.getByRole('combobox', {name: '协议'}), 'udp');
    await user.clear(screen.getByRole('spinbutton', {name: '起始端口'}));
    await user.type(screen.getByRole('spinbutton', {name: '起始端口'}), '3478');
    await user.clear(screen.getByRole('spinbutton', {name: '结束端口'}));
    await user.type(screen.getByRole('spinbutton', {name: '结束端口'}), '3478');
    await user.clear(screen.getByRole('textbox', {name: '目标 CIDR'}));
    await user.type(screen.getByRole('textbox', {name: '目标 CIDR'}), '0.0.0.0/0');
    await user.click(screen.getByRole('button', {name: '新增规则'}));

    await waitFor(() => expect(api.create).toHaveBeenCalledWith('acc-1', 'i-1', 'sg-2', expect.objectContaining({
      direction: 'egress', protocol: 'udp', portRange: '3478/3478', cidr: '0.0.0.0/0', priority: 1,
    })));
  });

  it('requires confirmation before deleting a live rule by ID', async () => {
    const user = userEvent.setup();
    renderModal();
    await screen.findByText(/22\/22/);

    await user.click(screen.getByRole('button', {name: '删除规则 sgr-in'}));
    expect(api.remove).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', {name: '确认删除 sgr-in'}));

    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('acc-1', 'i-1', 'sg-1', 'sgr-in', 'ingress'));
  });

  it('does not apply Tailscale rules until Internet exposure is acknowledged', async () => {
    const user = userEvent.setup();
    renderModal();
    await screen.findByText('UDP 41641/41641');

    const apply = screen.getByRole('button', {name: '配置 Tailscale 打洞端口'});
    expect(apply).toBeDisabled();
    await user.click(screen.getByRole('checkbox', {name: /我已了解入站 UDP 41641/}));
    await user.click(apply);

    await waitFor(() => expect(api.tailscale).toHaveBeenCalledWith('acc-1', 'i-1', 'sg-1'));
  });

  it('shows the provider outcome when the Tailscale template is only partially applied', async () => {
    api.tailscale.mockResolvedValue({
      status: 'partial',
      operations: [
        {status: 'succeeded', rule: {direction: 'ingress'}},
        {status: 'failed', message: 'AccessDenied: egress', rule: {direction: 'egress'}},
      ],
    });
    const user = userEvent.setup();
    renderModal();
    await screen.findByText('UDP 41641/41641');

    await user.click(screen.getByRole('checkbox', {name: /我已了解入站 UDP 41641/}));
    await user.click(screen.getByRole('button', {name: '配置 Tailscale 打洞端口'}));

    expect(await screen.findByText(/规则仅部分配置成功/)).toBeInTheDocument();
    expect(screen.getByText(/AccessDenied: egress/)).toBeInTheDocument();
  });

  it('offers the RAM authorization guide for provider permission failures', async () => {
    api.list.mockRejectedValue(new Error('AccessDenied: ecs:DescribeSecurityGroupAttribute'));
    const user = userEvent.setup();
    const {onViewPolicy} = renderModal();

    expect(await screen.findByText(/AccessDenied/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: '查看 RAM 授权脚本'}));
    expect(onViewPolicy).toHaveBeenCalledTimes(1);
  });
});
