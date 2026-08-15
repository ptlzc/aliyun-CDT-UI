import {createMemoryRouter, RouterProvider} from 'react-router-dom';
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import DeploymentPage from '../index';
import type {ApiAccount, ApiJob} from '../../../lib/api/client';

const h = vi.hoisted(() => ({
  mutateImpl: vi.fn(),
}));

const accounts: ApiAccount[] = [
  {
    id: 'acc-1',
    name: 'Account A',
    accessKeyId: 'ak',
    accessKeySecret: 'sk',
    createdAt: '2026-06-17T00:00:00Z',
    updatedAt: '2026-06-17T00:00:00Z',
    defaultImageKey: '',
    ossBucket: 'bucket',
    ossEndpoint: 'oss-cn-hangzhou.aliyuncs.com',
    regionId: 'cn-hangzhou',
    regions: ['cn-hangzhou', 'us-west-1'],
    siteType: 'international',
    zoneId: 'cn-hangzhou-g',
  },
];

const regions = [
  {regionId: 'us-west-1', localName: '美国 (硅谷)'},
  {regionId: 'cn-hangzhou', localName: '华东 1 (杭州)'},
];

const runningJob: ApiJob = {
  id: 'job-abc123',
  accountId: 'acc-1',
  type: 'one-click-deployment',
  status: 'running',
  startedAt: '2026-06-17T10:00:00Z',
  updatedAt: '2026-06-17T10:00:01Z',
  metadata: {regionId: 'us-west-1'},
  steps: [
    {title: 'ensure-network', status: 'succeeded', timestamp: '2026-06-17T10:00:01Z', message: '网络已就绪'},
    {title: 'ensure-image', status: 'succeeded', timestamp: '2026-06-17T10:00:02Z', message: '镜像已就绪'},
    {title: 'create-instance', status: 'succeeded', timestamp: '2026-06-17T10:00:10Z', message: '实例已创建'},
    {title: 'wait-running', status: 'succeeded', timestamp: '2026-06-17T10:00:40Z', message: '实例运行中'},
    {title: 'bind-eip', status: 'succeeded', timestamp: '2026-06-17T10:01:00Z', message: 'EIP 已绑定'},
    {title: 'install-software', status: 'running', timestamp: '2026-06-17T10:01:05Z', message: '正在安装软件'},
    {title: 'attach-governance', status: 'pending', timestamp: '2026-06-17T10:01:05Z', message: ''},
  ],
};

let jobsData: ApiJob[] = [];

vi.mock('../../../features/runtime/hooks', () => ({
  useAccountsQuery: () => ({data: accounts, isLoading: false}),
  useRegionsQuery: () => ({data: regions, isLoading: false}),
  useJobsQuery: () => ({data: jobsData, isLoading: false}),
  useCreateOneClickDeploymentMutation: () => ({mutate: h.mutateImpl, isPending: false, error: null}),
}));

function renderPage() {
  const router = createMemoryRouter([{path: '/', element: <DeploymentPage />}], {initialEntries: ['/']});
  render(<RouterProvider router={router} />);
  return router;
}

let writeTextMock: ReturnType<typeof vi.fn>;

/**
 * userEvent.setup() attaches its own clipboard stub to navigator which would
 * shadow the spy; re-apply the spy right after setup (same pattern as
 * InstanceCard IP copy layout tests).
 */
function setupUser() {
  const user = userEvent.setup();
  Object.defineProperty(navigator, 'clipboard', {
    value: {writeText: writeTextMock},
    configurable: true,
  });
  return user;
}

describe('DeploymentPage form', () => {
  beforeEach(() => {
    h.mutateImpl.mockReset();
    jobsData = [];
    writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: {writeText: writeTextMock},
      configurable: true,
    });
  });

  it('renders the form with account/region selects, instance type default and governance default on', () => {
    renderPage();

    expect(screen.getByRole('heading', {name: /一键部署 ECS/})).toBeInTheDocument();
    expect(screen.getByRole('combobox', {name: /托管账号/})).toBeInTheDocument();
    expect(screen.getByRole('combobox', {name: /地域/})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: /可用区/})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: /实例规格/})).toHaveValue('ecs.e-c4m1.large');
    expect(screen.getByRole('spinbutton', {name: /最高出价/})).toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: /挂载保活治理/})).toBeChecked();
    expect(screen.getByRole('checkbox', {name: /安装 sing-box/})).not.toBeChecked();
    expect(screen.getByRole('checkbox', {name: /安装 tailscale/})).not.toBeChecked();
  });

  it('shows region options from listRegions for the selected account', () => {
    renderPage();

    const regionSelect = screen.getByRole('combobox', {name: /地域/});
    expect(within(regionSelect).getByRole('option', {name: /美国 \(硅谷\)/})).toBeInTheDocument();
    expect(within(regionSelect).getByRole('option', {name: /华东 1 \(杭州\)/})).toBeInTheDocument();
  });

  it('submits the full payload (region/zone/instanceType/software switches+configs/spot price) when everything is filled', async () => {
    const user = setupUser();
    renderPage();

    await user.selectOptions(screen.getByRole('combobox', {name: /托管账号/}), 'acc-1');
    await user.selectOptions(screen.getByRole('combobox', {name: /地域/}), 'us-west-1');
    await user.type(screen.getByRole('textbox', {name: /可用区/}), 'us-west-1a');
    await user.clear(screen.getByRole('textbox', {name: /实例规格/}));
    await user.type(screen.getByRole('textbox', {name: /实例规格/}), 'ecs.g7.large');
    await user.type(screen.getByRole('spinbutton', {name: /最高出价/}), '0.1');
    await user.click(screen.getByRole('checkbox', {name: /安装 sing-box/}));
    fireEvent.change(screen.getByRole('textbox', {name: /sing-box 配置/}), {target: {value: '{"log":{"level":"info"}}'}});
    await user.click(screen.getByRole('checkbox', {name: /安装 tailscale/}));
    await user.type(screen.getByLabelText(/tailscale AuthKey/), 'tskey-auth-abc');
    await user.click(screen.getByRole('button', {name: /开始一键部署/}));

    await waitFor(() => {
      expect(h.mutateImpl).toHaveBeenCalledTimes(1);
    });
    expect(h.mutateImpl).toHaveBeenCalledWith(
      {
        accountId: 'acc-1',
        body: {
          regionId: 'us-west-1',
          zoneId: 'us-west-1a',
          instanceType: 'ecs.g7.large',
          spotPriceLimit: 0.1,
          installSingBox: true,
          singBoxConfig: '{"log":{"level":"info"}}',
          installTailscale: true,
          tailscaleAuthKey: 'tskey-auth-abc',
          attachGovernance: true,
        },
      },
      expect.anything(),
    );
  });

  it('omits optional fields when software switches are off and submits only required fields', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(screen.getByRole('combobox', {name: /托管账号/}), 'acc-1');
    await user.selectOptions(screen.getByRole('combobox', {name: /地域/}), 'cn-hangzhou');
    await user.click(screen.getByRole('checkbox', {name: /挂载保活治理/}));
    await user.click(screen.getByRole('button', {name: /开始一键部署/}));

    await waitFor(() => {
      expect(h.mutateImpl).toHaveBeenCalledTimes(1);
    });
    expect(h.mutateImpl).toHaveBeenCalledWith(
      {
        accountId: 'acc-1',
        body: {
          regionId: 'cn-hangzhou',
          instanceType: 'ecs.e-c4m1.large',
          attachGovernance: false,
        },
      },
      expect.anything(),
    );
  });

  it('shows the one-time password after submission with copy button and a save-now warning', async () => {
    const user = setupUser();
    h.mutateImpl.mockImplementation((_variables, options) => {
      options?.onSuccess?.({job: runningJob, password: 'Abc123Xyz789Def4'});
    });
    renderPage();

    await user.selectOptions(screen.getByRole('combobox', {name: /托管账号/}), 'acc-1');
    await user.selectOptions(screen.getByRole('combobox', {name: /地域/}), 'us-west-1');
    await user.click(screen.getByRole('button', {name: /开始一键部署/}));

    expect(await screen.findByText('Abc123Xyz789Def4')).toBeInTheDocument();
    expect(screen.getByText(/仅显示一次/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', {name: /复制密码/}));
    expect(writeTextMock).toHaveBeenCalledWith('Abc123Xyz789Def4');
  });

  it('renders the 7-step progress with mapped Chinese titles and per-step statuses', async () => {
    const user = setupUser();
    jobsData = [runningJob];
    h.mutateImpl.mockImplementation((_variables, options) => {
      options?.onSuccess?.({job: runningJob, password: 'Abc123Xyz789Def4'});
    });
    renderPage();

    await user.selectOptions(screen.getByRole('combobox', {name: /托管账号/}), 'acc-1');
    await user.selectOptions(screen.getByRole('combobox', {name: /地域/}), 'us-west-1');
    await user.click(screen.getByRole('button', {name: /开始一键部署/}));

    const progress = await screen.findByRole('region', {name: /部署进度/});
    for (const label of ['初始化网络', '准备镜像', '创建实例', '等待实例运行', '绑定弹性 IP', '安装软件', '挂载保活治理']) {
      expect(within(progress).getByText(label)).toBeInTheDocument();
    }
    expect(within(progress).getAllByText('已完成').length).toBe(5);
    expect(within(progress).getByText('进行中')).toBeInTheDocument();
    expect(within(progress).getByText('待执行')).toBeInTheDocument();
  });

  it('renders the manual-required degradation state with VNC guidance when the install step degrades', async () => {
    const user = setupUser();
    const degradedJob: ApiJob = {
      ...runningJob,
      status: 'manual-required',
      result: {vncUrl: 'https://vnc.aliyun.com/instance/xyz'},
      steps: runningJob.steps!.map((step) =>
        step.title === 'install-software'
          ? {...step, status: 'manual-required', message: 'SSH 不可达, 请通过 VNC 手动安装'}
          : step,
      ),
    };
    jobsData = [degradedJob];
    h.mutateImpl.mockImplementation((_variables, options) => {
      options?.onSuccess?.({job: degradedJob, password: 'Abc123Xyz789Def4'});
    });
    renderPage();

    await user.selectOptions(screen.getByRole('combobox', {name: /托管账号/}), 'acc-1');
    await user.selectOptions(screen.getByRole('combobox', {name: /地域/}), 'us-west-1');
    await user.click(screen.getByRole('button', {name: /开始一键部署/}));

    const progress = await screen.findByRole('region', {name: /部署进度/});
    expect(within(progress).getByText('需手动操作')).toBeInTheDocument();
    expect(within(progress).getByText(/SSH 不可达, 请通过 VNC 手动安装/)).toBeInTheDocument();
    const vncLinks = within(progress).getAllByRole('link', {name: /打开 VNC 连接/});
    expect(vncLinks.length).toBeGreaterThanOrEqual(1);
    for (const link of vncLinks) {
      expect(link).toHaveAttribute('href', 'https://vnc.aliyun.com/instance/xyz');
    }
  });

  it('shows the failed step message when a step fails', async () => {
    const user = setupUser();
    const failedJob: ApiJob = {
      ...runningJob,
      status: 'failed',
      steps: runningJob.steps!.map((step) =>
        step.title === 'create-instance'
          ? {...step, status: 'failed', message: '库存不足, 请稍后重试'}
          : step,
      ),
    };
    jobsData = [failedJob];
    h.mutateImpl.mockImplementation((_variables, options) => {
      options?.onSuccess?.({job: failedJob, password: 'Abc123Xyz789Def4'});
    });
    renderPage();

    await user.selectOptions(screen.getByRole('combobox', {name: /托管账号/}), 'acc-1');
    await user.selectOptions(screen.getByRole('combobox', {name: /地域/}), 'us-west-1');
    await user.click(screen.getByRole('button', {name: /开始一键部署/}));

    const progress = await screen.findByRole('region', {name: /部署进度/});
    expect(within(progress).getByText('失败')).toBeInTheDocument();
    expect(within(progress).getByText(/库存不足, 请稍后重试/)).toBeInTheDocument();
  });
});
