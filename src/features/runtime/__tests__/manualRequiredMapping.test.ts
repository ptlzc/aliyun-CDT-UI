import {describe, expect, it} from 'vitest';

import {mapJobToWorkflow} from '../hooks';
import type {ApiJob} from '@/src/lib/api/client';

const baseJob: ApiJob = {
  id: 'job-1',
  accountId: 'acc-1',
  type: 'one-click-deployment',
  status: 'manual-required',
  startedAt: '2026-06-17T10:00:00Z',
  updatedAt: '2026-06-17T10:05:00Z',
  metadata: {regionId: 'us-west-1'},
  result: {vncUrl: 'https://vnc.aliyun.com/instance/123'},
  steps: [
    {title: '初始化网络', status: 'succeeded', timestamp: '2026-06-17T10:00:01Z', message: '网络已就绪'},
    {title: '创建实例', status: 'succeeded', timestamp: '2026-06-17T10:00:30Z', message: '实例运行中'},
    {title: '安装软件', status: 'manual-required', timestamp: '2026-06-17T10:01:00Z', message: 'SSH 不可达, 请通过 VNC 手动安装'},
  ],
  logs: [],
};

describe('mapJobToWorkflow manual-required mapping', () => {
  it('maps a manual-required job status to the Manual Required workflow status', () => {
    const workflow = mapJobToWorkflow(baseJob);

    expect(workflow.status).toBe('Manual Required');
  });

  it('maps a manual-required step to the Manual Required task status with the step message', () => {
    const workflow = mapJobToWorkflow(baseJob);

    const installStep = workflow.tasks[2];
    expect(installStep.status).toBe('Manual Required');
    expect(installStep.description).toBe('SSH 不可达, 请通过 VNC 手动安装');
    expect(workflow.tasks[0].status).toBe('Completed');
  });

  it('surfaces the VNC url from job.result for the VNC guidance', () => {
    const workflow = mapJobToWorkflow(baseJob);

    expect(workflow.vncUrl).toBe('https://vnc.aliyun.com/instance/123');
  });

  it('keeps the running mapping untouched for regular job statuses', () => {
    const running: ApiJob = {
      ...baseJob,
      status: 'running',
      result: {},
      steps: [
        {title: '初始化网络', status: 'running', timestamp: '2026-06-17T10:00:01Z', message: ''},
      ],
    };

    const workflow = mapJobToWorkflow(running);

    expect(workflow.status).toBe('Running');
    expect(workflow.tasks[0].status).toBe('In Progress');
    expect(workflow.vncUrl).toBeUndefined();
  });
});
