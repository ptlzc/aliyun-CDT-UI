import {createMemoryRouter, RouterProvider} from 'react-router-dom';
import {fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import DeploymentPage from '../index';
import type {ApiAccount, ApiJob} from '../../../lib/api/client';

const h = vi.hoisted(() => ({
  mutateImpl: vi.fn(),
  continueImpl: vi.fn(),
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

const inventoryGraph = {
  accountId: 'acc-1',
  nodes: [],
  edges: [],
  summary: {ecsCount: 0, eipCount: 0, imageCount: 0, vpcCount: 0, vswitchCount: 0, securityGroupCount: 0},
};

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
  useInventoryGraphQuery: () => ({data: inventoryGraph, isLoading: false}),
  useJobsQuery: () => ({data: jobsData, isLoading: false}),
  useCreateOneClickDeploymentMutation: () => ({mutate: h.mutateImpl, isPending: false, error: null}),
  useContinueOneClickDeploymentMutation: () => ({mutate: h.continueImpl, isPending: false, error: null}),
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
    h.continueImpl.mockReset();
    jobsData = [];
    inventoryGraph.nodes = [];
    inventoryGraph.edges = [];
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
    expect(screen.getByRole('combobox', {name: /镜像类型/})).toHaveValue('system');
    expect(screen.getByRole('combobox', {name: /存储类型/})).toHaveValue('aliyun_oss');
    expect(screen.queryByRole('textbox', {name: /S3 Bucket/})).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', {name: /可用区/})).toHaveValue('');
    expect(screen.getByRole('combobox', {name: /实例规格/})).toHaveValue('ecs.e-c4m1.large');
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
    await user.selectOptions(screen.getByRole('combobox', {name: /可用区/}), '__custom__');
    await user.type(screen.getByRole('textbox', {name: /自定义可用区/}), 'us-west-1a');
    await user.selectOptions(screen.getByRole('combobox', {name: /实例规格/}), '__custom__');
    await user.type(screen.getByRole('textbox', {name: /自定义实例规格/}), 'ecs.g7.large');
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
          imageType: 'system',
          storageProvider: 'aliyun_oss',
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
          imageType: 'system',
          storageProvider: 'aliyun_oss',
          instanceType: 'ecs.e-c4m1.large',
          attachGovernance: false,
        },
      },
      expect.anything(),
    );
  });

  it('shows S3 config when storage provider is s3 and submits S3 fields only in S3 mode', async () => {
    const user = setupUser();
    renderPage();

    await user.selectOptions(screen.getByRole('combobox', {name: /托管账号/}), 'acc-1');
    await user.selectOptions(screen.getByRole('combobox', {name: /地域/}), 'us-west-1');
    await user.selectOptions(screen.getByRole('combobox', {name: /存储类型/}), 's3');

    expect(screen.getByRole('textbox', {name: /S3 Bucket/})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: /S3 Region/})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: /S3 Endpoint/})).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: /S3 AccessKey ID/})).toBeInTheDocument();
    expect(screen.getByLabelText(/S3 AccessKey Secret/)).toBeInTheDocument();
    expect(screen.getByRole('textbox', {name: /S3 ObjectKey/})).toBeInTheDocument();
    expect(screen.getByRole('checkbox', {name: /S3 ForcePathStyle/})).not.toBeChecked();

    await user.type(screen.getByRole('textbox', {name: /S3 Bucket/}), 'my-bucket');
    await user.type(screen.getByRole('textbox', {name: /S3 Region/}), 'us-east-1');
    await user.type(screen.getByRole('textbox', {name: /S3 Endpoint/}), 'https://s3.example.com');
    await user.type(screen.getByRole('textbox', {name: /S3 AccessKey ID/}), 'AKID');
    await user.type(screen.getByLabelText(/S3 AccessKey Secret/), 'SECRET');
    await user.type(screen.getByRole('textbox', {name: /S3 ObjectKey/}), 'alpine.raw');
    await user.click(screen.getByRole('checkbox', {name: /S3 ForcePathStyle/}));
    await user.click(screen.getByRole('button', {name: /开始一键部署/}));

    await waitFor(() => {
      expect(h.mutateImpl).toHaveBeenCalledTimes(1);
    });
    expect(h.mutateImpl).toHaveBeenCalledWith(
      {
        accountId: 'acc-1',
        body: {
          regionId: 'us-west-1',
          imageType: 'system',
          storageProvider: 's3',
          instanceType: 'ecs.e-c4m1.large',
          s3Bucket: 'my-bucket',
          s3Region: 'us-east-1',
          s3Endpoint: 'https://s3.example.com',
          s3AccessKeyId: 'AKID',
          s3AccessKeySecret: 'SECRET',
          s3ObjectKey: 'alpine.raw',
          s3ForcePathStyle: true,
          attachGovernance: true,
        },
      },
      expect.anything(),
    );
  });

  it('shows VNC flow hint when image type is installer', async () => {
    const user = setupUser();
    renderPage();

    await user.selectOptions(screen.getByRole('combobox', {name: /镜像类型/}), 'installer');

    expect(screen.getByText(/VNC 安装系统阶段/)).toBeInTheDocument();
    expect(screen.getByText(/setup-alpine/)).toBeInTheDocument();
  });

  it('shows auto-installer option and hint when selected', async () => {
    const user = setupUser();
    renderPage();

    const imageTypeSelect = screen.getByRole('combobox', {name: /镜像类型/});
    expect(within(imageTypeSelect).getByRole('option', {name: /auto-installer/})).toBeInTheDocument();

    await user.selectOptions(imageTypeSelect, 'auto-installer');

    expect(screen.getByText(/自定义 Alpine 自动安装器镜像/)).toBeInTheDocument();
    expect(screen.getByText(/setup-alpine/)).toBeInTheDocument();
    expect(screen.getByText(/无需 VNC 人工操作/)).toBeInTheDocument();
  });

  it('submits auto-installer imageType with S3 fields when storage provider is s3', async () => {
    const user = setupUser();
    renderPage();

    await user.selectOptions(screen.getByRole('combobox', {name: /托管账号/}), 'acc-1');
    await user.selectOptions(screen.getByRole('combobox', {name: /地域/}), 'us-west-1');
    await user.selectOptions(screen.getByRole('combobox', {name: /镜像类型/}), 'auto-installer');
    await user.selectOptions(screen.getByRole('combobox', {name: /存储类型/}), 's3');

    expect(screen.getByRole('textbox', {name: /S3 Bucket/})).toBeInTheDocument();

    await user.type(screen.getByRole('textbox', {name: /S3 Bucket/}), 'auto-bucket');
    await user.type(screen.getByRole('textbox', {name: /S3 Region/}), 'us-east-1');
    await user.type(screen.getByRole('textbox', {name: /S3 Endpoint/}), 'https://s3.example.com');
    await user.type(screen.getByRole('textbox', {name: /S3 AccessKey ID/}), 'AKID');
    await user.type(screen.getByLabelText(/S3 AccessKey Secret/), 'SECRET');
    await user.type(screen.getByRole('textbox', {name: /S3 ObjectKey/}), 'alpine-auto.raw');
    await user.click(screen.getByRole('checkbox', {name: /S3 ForcePathStyle/}));
    await user.click(screen.getByRole('button', {name: /开始一键部署/}));

    await waitFor(() => {
      expect(h.mutateImpl).toHaveBeenCalledTimes(1);
    });
    expect(h.mutateImpl).toHaveBeenCalledWith(
      {
        accountId: 'acc-1',
        body: {
          regionId: 'us-west-1',
          imageType: 'auto-installer',
          storageProvider: 's3',
          instanceType: 'ecs.e-c4m1.large',
          s3Bucket: 'auto-bucket',
          s3Region: 'us-east-1',
          s3Endpoint: 'https://s3.example.com',
          s3AccessKeyId: 'AKID',
          s3AccessKeySecret: 'SECRET',
          s3ObjectKey: 'alpine-auto.raw',
          s3ForcePathStyle: true,
          attachGovernance: true,
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

  it('renders awaiting_user installer progress with VNC guidance and continue button that resumes job', async () => {
    const user = setupUser();
    const installerJob: ApiJob = {
      ...runningJob,
      status: 'awaiting_user',
      phase: 'vnc-install-system',
      result: {vncUrl: 'https://vnc.aliyun.com/instance/installer'},
      metadata: {regionId: 'us-west-1', imageType: 'installer', awaitingAction: 'vnc_setup_alpine_complete'},
      steps: [
        ...runningJob.steps!.slice(0, 5),
        {title: 'vnc-install-system', status: 'awaiting_user', timestamp: '2026-06-17T10:02:00Z', message: '请通过 VNC 完成 Alpine 安装'},
        {title: 'install-software', status: 'pending', timestamp: '2026-06-17T10:02:00Z', message: ''},
        {title: 'attach-governance', status: 'pending', timestamp: '2026-06-17T10:02:00Z', message: ''},
      ],
    };
    const resumedJob: ApiJob = {
      ...installerJob,
      status: 'running',
      phase: 'install-software',
      steps: installerJob.steps!.map((step) =>
        step.title === 'vnc-install-system'
          ? {...step, status: 'succeeded'}
          : step.title === 'install-software'
            ? {...step, status: 'running', message: '正在安装软件'}
            : step,
      ),
    };
    jobsData = [installerJob];
    h.mutateImpl.mockImplementation((_variables, options) => {
      options?.onSuccess?.({job: installerJob, password: 'Abc123Xyz789Def4'});
    });
    h.continueImpl.mockImplementation((_variables, options) => {
      jobsData = [resumedJob];
      options?.onSuccess?.({job: resumedJob});
    });
    renderPage();

    await user.selectOptions(screen.getByRole('combobox', {name: /托管账号/}), 'acc-1');
    await user.selectOptions(screen.getByRole('combobox', {name: /地域/}), 'us-west-1');
    await user.click(screen.getByRole('button', {name: /开始一键部署/}));

    const progress = await screen.findByRole('region', {name: /部署进度/});
    expect(within(progress).getAllByText('VNC 安装系统').length).toBeGreaterThan(0);
    expect(within(progress).getByText('等待用户操作')).toBeInTheDocument();
    const vncLinks = within(progress).getAllByRole('link', {name: /打开 VNC 连接/});
    expect(vncLinks.length).toBeGreaterThanOrEqual(1);
    for (const link of vncLinks) {
      expect(link).toHaveAttribute('href', 'https://vnc.aliyun.com/instance/installer');
    }
    expect(within(progress).getAllByText(/登录/).length).toBeGreaterThan(0);
    expect(within(progress).getAllByText(/setup-alpine/).length).toBeGreaterThan(0);
    expect(within(progress).getAllByText(/选择磁盘安装 sys/).length).toBeGreaterThan(0);
    expect(within(progress).getAllByText(/reboot/).length).toBeGreaterThan(0);

    await user.click(within(progress).getByRole('button', {name: /我已安装完成，继续/}));
    await waitFor(() => {
      expect(h.continueImpl).toHaveBeenCalledTimes(1);
    });
    expect(h.continueImpl).toHaveBeenCalledWith(
      {
        accountId: 'acc-1',
        jobId: 'job-abc123',
        body: {action: 'vnc_setup_alpine_complete'},
      },
      expect.anything(),
    );

    expect(await within(progress).findByText('进行中')).toBeInTheDocument();
    expect(within(progress).queryByRole('button', {name: /我已安装完成，继续/})).not.toBeInTheDocument();
  });

  it('hides continue button and shows auto-install waiting hint while auto-installer is running in vnc-install-system', async () => {
    const user = setupUser();
    const autoInstallingJob: ApiJob = {
      ...runningJob,
      status: 'running',
      phase: 'vnc-install-system',
      metadata: {regionId: 'us-west-1', imageType: 'auto-installer', autoInstall: 'true'},
      steps: [
        ...runningJob.steps!.slice(0, 5),
        {title: 'vnc-install-system', status: 'running', timestamp: '2026-06-17T10:02:00Z', message: '等待 SSH 可达'},
        {title: 'install-software', status: 'pending', timestamp: '2026-06-17T10:02:00Z', message: ''},
        {title: 'attach-governance', status: 'pending', timestamp: '2026-06-17T10:02:00Z', message: ''},
      ],
    };
    jobsData = [autoInstallingJob];
    h.mutateImpl.mockImplementation((_variables, options) => {
      options?.onSuccess?.({job: autoInstallingJob, password: 'Abc123Xyz789Def4'});
    });
    renderPage();

    await user.selectOptions(screen.getByRole('combobox', {name: /托管账号/}), 'acc-1');
    await user.selectOptions(screen.getByRole('combobox', {name: /地域/}), 'us-west-1');
    await user.click(screen.getByRole('button', {name: /开始一键部署/}));

    const progress = await screen.findByRole('region', {name: /部署进度/});
    expect(within(progress).getByText(/系统正在自动安装/)).toBeInTheDocument();
    expect(within(progress).getByText(/预计 5-10 分钟/)).toBeInTheDocument();
    expect(within(progress).queryByRole('button', {name: /我已安装完成，继续/})).not.toBeInTheDocument();
  });

  it('renders auto-installer timeout fallback with VNC guidance and continue button', async () => {
    const user = setupUser();
    const timeoutJob: ApiJob = {
      ...runningJob,
      status: 'awaiting_user',
      phase: 'vnc-install-system',
      result: {vncUrl: 'https://vnc.aliyun.com/instance/auto-timeout'},
      metadata: {
        regionId: 'us-west-1',
        imageType: 'auto-installer',
        fallbackReason: 'auto-install-timeout',
        awaitingAction: 'vnc_setup_alpine_complete',
      },
      steps: [
        ...runningJob.steps!.slice(0, 5),
        {title: 'vnc-install-system', status: 'awaiting_user', timestamp: '2026-06-17T10:02:00Z', message: '自动安装超时，请通过 VNC 完成 Alpine 安装'},
        {title: 'install-software', status: 'pending', timestamp: '2026-06-17T10:02:00Z', message: ''},
        {title: 'attach-governance', status: 'pending', timestamp: '2026-06-17T10:02:00Z', message: ''},
      ],
    };
    jobsData = [timeoutJob];
    h.mutateImpl.mockImplementation((_variables, options) => {
      options?.onSuccess?.({job: timeoutJob, password: 'Abc123Xyz789Def4'});
    });
    renderPage();

    await user.selectOptions(screen.getByRole('combobox', {name: /托管账号/}), 'acc-1');
    await user.selectOptions(screen.getByRole('combobox', {name: /地域/}), 'us-west-1');
    await user.click(screen.getByRole('button', {name: /开始一键部署/}));

    const progress = await screen.findByRole('region', {name: /部署进度/});
    expect(within(progress).getByText(/自动安装超时，请通过 VNC 手动完成以下步骤/)).toBeInTheDocument();
    expect(within(progress).getByText(/setup-alpine/)).toBeInTheDocument();
    expect(within(progress).getByRole('button', {name: /我已安装完成，继续/})).toBeInTheDocument();
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
