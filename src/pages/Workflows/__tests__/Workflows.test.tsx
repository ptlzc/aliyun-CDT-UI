import {createMemoryRouter, RouterProvider} from 'react-router-dom';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, expect, it, vi} from 'vitest';

import WorkflowsPage from '../index';
import type {WorkflowRun} from '../../../types';

const runningWorkflow: WorkflowRun = {
  id: 'job-1',
  name: 'discover - acc-1',
  status: 'Running',
  activeStepIndex: 0,
  initiatedBy: 'acc-1',
  targetRegion: 'cn-hangzhou',
  startedAt: '2026-06-17 10:00:00 UTC',
  duration: '刚刚',
  tasks: [
    {
      id: 'job-1-0',
      name: '拉取账号元数据',
      status: 'In Progress',
      description: '握手并拉取 ECS 实例清单',
      progress: 50,
    },
    {
      id: 'job-1-1',
      name: '同步拓扑图谱',
      status: 'Pending',
      description: '构建 VPC/EIP/ECS 图谱',
    },
  ],
  logs: ['[2026-06-17 10:00:01 UTC] INFO 开始发现', '[2026-06-17 10:00:02 UTC] ERROR 拉取超时重试'],
};

const finishedWorkflow: WorkflowRun = {
  id: 'job-2',
  name: 'provision - acc-2',
  status: 'Success',
  activeStepIndex: 0,
  initiatedBy: 'acc-2',
  targetRegion: 'cn-beijing',
  startedAt: '2026-06-17 11:00:00 UTC',
  duration: '5 分钟前',
  tasks: [],
  logs: [],
};

const manualRequiredWorkflow: WorkflowRun = {
  id: 'job-3',
  name: 'one-click-deployment - acc-3',
  status: 'Manual Required',
  activeStepIndex: 1,
  initiatedBy: 'acc-3',
  targetRegion: 'us-west-1',
  startedAt: '2026-06-17 12:00:00 UTC',
  duration: '刚刚',
  vncUrl: 'https://vnc.aliyun.com/instance/abc',
  tasks: [
    {
      id: 'job-3-0',
      name: '初始化网络',
      status: 'Completed',
      description: '网络已就绪',
    },
    {
      id: 'job-3-1',
      name: '安装软件',
      status: 'Manual Required',
      description: 'SSH 不可达, 请通过 VNC 手动安装',
    },
  ],
  logs: [],
};

let workflowsData: WorkflowRun[] = [];

vi.mock('../../../features/runtime/hooks', () => ({
  useWorkflowsQuery: () => ({data: workflowsData, isLoading: false}),
}));

function renderWorkflows() {
  const router = createMemoryRouter([{path: '/', element: <WorkflowsPage />}], {initialEntries: ['/']});
  render(<RouterProvider router={router} />);
  return router;
}

describe('WorkflowsPage', () => {
  it('renders the workflow center with jobs, tasks and log lines', () => {
    workflowsData = [runningWorkflow];
    renderWorkflows();

    expect(screen.getByRole('heading', {name: /自动化工作流中心/})).toBeInTheDocument();
    // Job switcher button
    expect(screen.getByRole('button', {name: /作业: discover - acc-1/})).toBeInTheDocument();
    // Active job heading (h2) shows the selected workflow name
    expect(screen.getByRole('heading', {level: 2})).toHaveTextContent('discover - acc-1');
    // Task list
    expect(screen.getByText('拉取账号元数据')).toBeInTheDocument();
    expect(screen.getByText(/执行进度/)).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    // Log lines with status coloring
    expect(screen.getByText(/INFO 开始发现/)).toBeInTheDocument();
    expect(screen.getByText(/ERROR 拉取超时重试/)).toBeInTheDocument();
    // Running status badge
    expect(screen.getByText('状态: 运行中')).toBeInTheDocument();
  });

  it('shows the empty state when no workflows exist', () => {
    workflowsData = [];
    renderWorkflows();

    expect(screen.getByRole('heading', {name: /自动化工作流中心/})).toBeInTheDocument();
    expect(screen.getByText(/当前没有运行或历史作业/)).toBeInTheDocument();
  });

  it('switches the active workflow when another job button is clicked', async () => {
    const user = userEvent.setup();
    workflowsData = [runningWorkflow, finishedWorkflow];
    renderWorkflows();

    // Initially the first workflow is active
    expect(screen.getByRole('heading', {level: 2})).toHaveTextContent('discover - acc-1');

    await user.click(screen.getByRole('button', {name: /作业: provision - acc-2/}));

    // Active heading switches to the second workflow, success badge shown
    expect(screen.getByRole('heading', {level: 2})).toHaveTextContent('provision - acc-2');
    expect(screen.getByText('状态: 成功')).toBeInTheDocument();
    expect(screen.getByText('当前任务还没有日志输出。')).toBeInTheDocument();
  });

  it('toggles the auto-scroll checkbox without losing the log view', async () => {
    const user = userEvent.setup();
    workflowsData = [runningWorkflow];
    renderWorkflows();

    const autoScroll = screen.getByRole('checkbox', {name: /自动滚动/});
    expect(autoScroll).toBeChecked();

    await user.click(autoScroll);
    expect(autoScroll).not.toBeChecked();

    // Log lines stay rendered after toggling
    expect(screen.getByText(/INFO 开始发现/)).toBeInTheDocument();
  });

  it('renders the manual-required degradation badge and VNC guidance for ssh-failed jobs', () => {
    workflowsData = [manualRequiredWorkflow];
    renderWorkflows();

    // Workflow status badge shows the degradation label
    expect(screen.getByText('状态: 需手动操作')).toBeInTheDocument();
    // Step badge shows the manual-required label on the degraded step
    expect(screen.getAllByText('需手动操作').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/SSH 不可达, 请通过 VNC 手动安装/)).toBeInTheDocument();
    // VNC guidance link is rendered from workflow.vncUrl
    const vncLink = screen.getByRole('link', {name: /打开 VNC 连接/});
    expect(vncLink).toHaveAttribute('href', 'https://vnc.aliyun.com/instance/abc');
  });
});
