import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import type {ECSInstance} from '@/types';
import InstanceSoftwarePanel from '../components/InstanceSoftwarePanel';

const inspectInstanceSoftware = vi.fn();
const configureInstanceSingBox = vi.fn();

vi.mock('@/lib/api/client', () => ({
  inspectInstanceSoftware: (...args: unknown[]) => inspectInstanceSoftware(...args),
  configureInstanceSingBox: (...args: unknown[]) => configureInstanceSingBox(...args),
}));

const instance: ECSInstance = {
  id: 'i-1',
  accountId: 'acc-1',
  accountName: 'Account A',
  name: 'ecs-a',
  status: 'Running',
  type: 'ecs.g6.large',
  zone: 'cn-hangzhou-i',
  regionId: 'cn-hangzhou',
  publicIp: '1.1.1.1',
  privateIp: '10.0.0.1',
  trafficUsage: null,
  trafficUsageUnit: 'GB',
  trafficRate: null,
  trafficRateUnit: 'Mbps',
  trafficLimit: 200,
  monitoringEnabled: true,
  overflowAction: 'notify',
  inherited: true,
  alerts: [],
};

function renderPanel(status: ECSInstance['status'] = 'Running') {
  const queryClient = new QueryClient({defaultOptions: {queries: {retry: false}, mutations: {retry: false}}});
  return render(
    <QueryClientProvider client={queryClient}>
      <InstanceSoftwarePanel instance={instance} effectiveStatus={status} />
    </QueryClientProvider>,
  );
}

async function inspectInstalledSoftware() {
  const user = userEvent.setup();
  inspectInstanceSoftware.mockResolvedValue({
    tailscale: {
      installed: true,
      running: true,
      hostname: 'edge.example.ts.net',
      ips: ['100.64.0.8', 'fd7a:115c:a1e0::8'],
    },
    singBox: {
      installed: true,
      running: true,
      version: '1.12.3',
      managedInbound: {
        listen: '0.0.0.0',
        listenPort: 1080,
        bindInterface: 'tailscale0',
        username: 'proxy-user',
      },
    },
  });
  await user.click(screen.getByRole('button', {name: '检测运行软件'}));
  await user.type(screen.getByLabelText('SSH 密码'), 'ssh-secret');
  await user.click(screen.getByRole('button', {name: '开始检测'}));
  await screen.findByText('edge.example.ts.net');
  return user;
}

describe('InstanceSoftwarePanel', () => {
  beforeEach(() => {
    inspectInstanceSoftware.mockReset();
    configureInstanceSingBox.mockReset();
  });

  it('shows request-scoped SSH authentication and detected Tailscale hostname/IPs', async () => {
    renderPanel();
    await inspectInstalledSoftware();

    expect(inspectInstanceSoftware).toHaveBeenCalledWith('acc-1', 'i-1', {
      sshUser: 'root',
      sshPassword: 'ssh-secret',
    });
    expect(screen.getByText('100.64.0.8')).toBeInTheDocument();
    expect(screen.getByText('fd7a:115c:a1e0::8')).toBeInTheDocument();
    expect(screen.getByText('Sing-box 1.12.3')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '配置 Sing-box'})).toBeInTheDocument();
  });

  it('does not render application details or Sing-box action when neither is installed', async () => {
    const user = userEvent.setup();
    inspectInstanceSoftware.mockResolvedValue({
      tailscale: {installed: false, running: false},
      singBox: {installed: false, running: false},
    });
    renderPanel();

    await user.click(screen.getByRole('button', {name: '检测运行软件'}));
    await user.click(screen.getByRole('button', {name: '开始检测'}));
    await waitFor(() => expect(inspectInstanceSoftware).toHaveBeenCalledTimes(1));

    expect(screen.queryByText('Tailscale')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: '配置 Sing-box'})).not.toBeInTheDocument();
  });

  it('shows a scoped inspection error and keeps the inspection action usable', async () => {
    const user = userEvent.setup();
    inspectInstanceSoftware.mockRejectedValue(new Error('SSH 认证失败'));
    renderPanel();

    await user.click(screen.getByRole('button', {name: '检测运行软件'}));
    await user.click(screen.getByRole('button', {name: '开始检测'}));

    expect(await screen.findByText('SSH 认证失败')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: '开始检测'})).toBeEnabled();
  });

  it('requires proxy authentication and supports listen/interface configuration', async () => {
    renderPanel();
    const user = await inspectInstalledSoftware();

    await user.click(screen.getByRole('button', {name: '配置 Sing-box'}));
    expect(screen.getByLabelText('监听地址')).toHaveValue('0.0.0.0');
    expect(screen.getByLabelText('监听端口')).toHaveValue(1080);
    expect(screen.getByLabelText('绑定网络接口（可选）')).toHaveValue('tailscale0');
    expect(screen.getByLabelText('代理用户名')).toHaveValue('proxy-user');
    expect(screen.getByLabelText('代理用户名')).toBeRequired();
    expect(screen.getByLabelText('代理密码')).toBeRequired();

    configureInstanceSingBox.mockResolvedValue({
      installed: true,
      running: true,
      version: '1.12.3',
      managedInbound: {listen: '0.0.0.0', listenPort: 1080, bindInterface: 'tailscale0', username: 'proxy-user'},
    });
    await user.type(screen.getByLabelText('SSH 密码'), 'ssh-secret-2');
    await user.type(screen.getByLabelText('代理密码'), 'proxy-secret');
    await user.click(screen.getByRole('button', {name: '保存并重启'}));

    await waitFor(() => expect(configureInstanceSingBox).toHaveBeenCalledWith('acc-1', 'i-1', {
      sshUser: 'root',
      sshPassword: 'ssh-secret-2',
      listen: '0.0.0.0',
      listenPort: 1080,
      bindInterface: 'tailscale0',
      username: 'proxy-user',
      password: 'proxy-secret',
    }));
    expect(screen.queryByRole('dialog', {name: '配置 Sing-box'})).not.toBeInTheDocument();
  });

  it('does not offer inspection while an instance is stopped', () => {
    renderPanel('Stopped');

    expect(screen.queryByRole('button', {name: '检测运行软件'})).not.toBeInTheDocument();
    expect(screen.getByText('实例启动后可检测运行软件')).toBeInTheDocument();
  });
});
