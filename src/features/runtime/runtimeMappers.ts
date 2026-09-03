import type {ApiAccount, ApiJob, ApiResourceGraph} from '@/lib/api/client';
import type {CloudAccount, DashboardSummary, ECSInstance, WorkflowRun, WorkflowTask} from '@/types';
import {formatDateLabel} from '@/utils/dateFormat';

function relativeTimeLabel(value?: string): string {
  if (!value) {
    return '-';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  const diffMs = Date.now() - parsed.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60_000));
  if (diffMinutes < 1) {
    return '刚刚';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} 分钟前`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} 小时前`;
  }
  return `${Math.round(diffHours / 24)} 天前`;
}

export function mapAccountToViewModel(account: ApiAccount): CloudAccount {
  return {
    id: account.id,
    name: account.name,
    providerRegion: account.siteType === 'domestic' ? 'Aliyun Domestic' : 'Aliyun International',
    mainRegion: account.regionId,
    lastSynced: relativeTimeLabel(account.updatedAt),
    creationDate: formatDateLabel(account.createdAt),
    accessKeyId: account.accessKeyId,
    accessKeySecret: account.accessKeySecret ?? '************************',
    managedRegions: account.regions.join(', '),
    roleArn: '',
    trafficDefaults: account.trafficGovernanceDefaults ?? {
      maximumTrafficGb: 200,
      overflowAction: 'notify',
      monitoringEnabled: true,
      overflowThresholdGb: 0,
    },
  };
}

function taskStatusFromJob(job: ApiJob, step: ApiJob['steps'][number], index: number): WorkflowTask {
  const normalized = step.status.toLowerCase();
  let status: WorkflowTask['status'] = 'Pending';
  if (normalized === 'running') {
    status = 'In Progress';
  } else if (normalized === 'succeeded' || normalized === 'completed') {
    status = 'Completed';
  } else if (normalized === 'failed') {
    status = 'Failed';
  } else if (normalized === 'manual-required') {
    // SSH 降级态: 后端无法自动完成, 需人工经 VNC 操作。
    status = 'Manual Required';
  } else if (index === 0 && job.status === 'succeeded') {
    status = 'Completed';
  }
  return {
    id: `${job.id}-${index}`,
    name: step.title,
    status,
    description: step.message || job.message || job.type,
    progress: job.providerTask?.progress ? Number.parseInt(job.providerTask.progress, 10) || undefined : undefined,
  };
}

export function mapJobToWorkflow(job: ApiJob): WorkflowRun {
  const tasks = (job.steps || []).map((step, index) => taskStatusFromJob(job, step, index));
  const activeStepIndex = Math.max(0, tasks.findIndex((task) => task.status === 'In Progress'));
  return {
    id: job.id,
    name: `${job.type} - ${job.accountId}`,
    status: job.status === 'running' ? 'Running' : job.status === 'succeeded' ? 'Success' : job.status === 'failed' ? 'Failed' : job.status === 'manual-required' ? 'Manual Required' : 'Idle',
    activeStepIndex: activeStepIndex === -1 ? Math.max(0, tasks.length - 1) : activeStepIndex,
    initiatedBy: job.accountId,
    targetRegion: job.metadata?.regionId || job.accountId,
    startedAt: formatDateLabel(job.startedAt),
    duration: relativeTimeLabel(job.updatedAt),
    vncUrl: job.result?.vncUrl || undefined,
    tasks,
    logs: (job.logs || []).map((entry) => `[${formatDateLabel(entry.timestamp)}] ${entry.level?.toUpperCase() || 'INFO'} ${entry.message}`),
  };
}

export function buildDashboardSummary(accounts: ApiAccount[], graphs: ApiResourceGraph[], jobs: ApiJob[], instances: ECSInstance[]): DashboardSummary {
  return {
    accountCount: accounts.length,
    ecsCount: graphs.reduce((sum, graph) => sum + graph.summary.ecsCount, 0),
    eipCount: graphs.reduce((sum, graph) => sum + graph.summary.eipCount, 0),
    activeWorkflowCount: jobs.filter((job) => job.status === 'running').length,
    attentionInstanceCount: instances.filter((instance) => instance.status === 'Attention').length,
    monitoredInstanceCount: instances.filter((instance) => instance.monitoringEnabled).length,
  };
}

