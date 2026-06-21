import {useMemo} from 'react';
import {useMutation, useQueries, useQuery, useQueryClient} from '@tanstack/react-query';

import {
  applyPlatformTrafficGovernanceToAccounts,
  createAccount,
  getPlatformTrafficGovernance,
  listAccounts,
  listGraph,
  listJobs,
  listTrafficPolicies,
  saveECSTrafficGovernance,
  savePlatformTrafficGovernance,
  saveTrafficPolicy,
  updateAccount,
  type ApiAccount,
  type ApiCreateAccountRequest,
  type ApiECSTrafficGovernance,
  type ApiJob,
  type ApiPlatformTrafficGovernance,
  type ApiResourceGraph,
  type ApiTrafficGovernanceDefaults,
  type ApiTrafficPolicy,
  type ApiTrafficPolicyRequest,
} from '@/src/lib/api/client';
import type {CloudAccount, DashboardSummary, ECSInstance, WorkflowRun, WorkflowTask} from '@/src/types';

export const runtimeKeys = {
  accounts: ['runtime', 'accounts'] as const,
  graph: (accountId: string) => ['runtime', 'graph', accountId] as const,
  jobs: ['runtime', 'jobs'] as const,
  settings: ['runtime', 'settings', 'traffic-governance'] as const,
  policies: (accountId: string) => ['runtime', 'traffic-policies', accountId] as const,
};

function formatDateLabel(value?: string): string {
  if (!value) {
    return '-';
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toISOString().replace('T', ' ').replace('.000Z', ' UTC');
}

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
    return 'Just now';
  }
  if (diffMinutes < 60) {
    return `${diffMinutes} mins ago`;
  }
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours} hours ago`;
  }
  return `${Math.round(diffHours / 24)} days ago`;
}

function mapAccountToViewModel(account: ApiAccount): CloudAccount {
  return {
    id: account.id,
    name: account.name,
    status: 'Active',
    providerRegion: account.siteType === 'domestic' ? 'Aliyun Domestic' : 'Aliyun International',
    mainRegion: account.regionId,
    lastSynced: relativeTimeLabel(account.updatedAt),
    creationDate: formatDateLabel(account.createdAt),
    owner: `${account.siteType}@aliyun.local`,
    accessKeyId: account.accessKeyId,
    accessKeySecret: account.accessKeySecret ?? '************************',
    managedRegions: account.regions.join(', '),
    roleArn: '',
    trafficDefaults: account.trafficGovernanceDefaults ?? {
      maximumTrafficGb: 200,
      overflowAction: 'notify',
      monitoringEnabled: true,
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

function mapJobToWorkflow(job: ApiJob): WorkflowRun {
  const tasks = (job.steps || []).map((step, index) => taskStatusFromJob(job, step, index));
  const activeStepIndex = Math.max(0, tasks.findIndex((task) => task.status === 'In Progress'));
  return {
    id: job.id,
    name: `${job.type} - ${job.accountId}`,
    status: job.status === 'running' ? 'Running' : job.status === 'succeeded' ? 'Success' : job.status === 'failed' ? 'Failed' : 'Idle',
    activeStepIndex: activeStepIndex === -1 ? Math.max(0, tasks.length - 1) : activeStepIndex,
    initiatedBy: job.accountId,
    targetRegion: job.metadata?.regionId || job.accountId,
    startedAt: formatDateLabel(job.startedAt),
    duration: relativeTimeLabel(job.updatedAt),
    tasks,
    logs: (job.logs || []).map((entry) => `[${formatDateLabel(entry.timestamp)}] ${entry.level?.toUpperCase() || 'INFO'} ${entry.message}`),
  };
}

function resolveExternalIP(graph: ApiResourceGraph, instanceId: string, metadata?: Record<string, string>): string {
  const eipEdge = graph.edges.find((edge) => edge.type === 'bound-to' && edge.to === instanceId);
  if (eipEdge) {
    const eipNode = graph.nodes.find((node) => node.id === eipEdge.from && node.kind === 'eip');
    const ipAddress = eipNode?.metadata?.ipAddress;
    if (ipAddress) {
      return ipAddress;
    }
  }
  return '未绑定';
}

function normalizeInstanceStatus(node: ApiResourceGraph['nodes'][number], metadata?: Record<string, string>): ECSInstance['status'] {
  const effectiveMax = Number.parseFloat(metadata?.trafficEffectiveMaximumGb || '0') || 0;
  const current = node.trafficUsage?.available ? node.trafficUsage.value : 0;
  if (node.status !== 'Running') {
    return 'Stopped';
  }
  if (effectiveMax > 0 && current / effectiveMax >= 0.8) {
    return 'Attention';
  }
  return 'Running';
}

function mapGraphToInstances(graphs: ApiResourceGraph[], accounts: ApiAccount[], policiesByAccount: Record<string, ApiTrafficPolicy[]>): ECSInstance[] {
  return graphs.flatMap((graph) => {
    const account = accounts.find((item) => item.id === graph.accountId);
    const accountName = account?.name || graph.accountId;
    const accountPolicies = policiesByAccount[graph.accountId] || [];
    return graph.nodes
      .filter((node) => node.kind === 'ecs')
      .map((node) => {
        const metadata = node.metadata || {};
        const maximumTraffic = Number.parseFloat(metadata.trafficEffectiveMaximumGb || '0') || 0;
        const inherited = !metadata.trafficOverrideMaximumGb && !metadata.trafficOverrideOverflowAction && !metadata.trafficOverrideMonitoringEnabled;
        const policy = accountPolicies.find((item) => item.scopeType === 'instance' && item.scopeId === node.id);
        const usage = node.trafficUsage;
        const rate = node.trafficRate;
        const currentTraffic = usage?.available ? usage.value : 0;
        const alerts: string[] = [];
        if (maximumTraffic > 0 && currentTraffic / maximumTraffic >= 0.8) {
          alerts.push(`Cumulative traffic usage at ${Math.round((currentTraffic / maximumTraffic) * 100)}% of the configured limit.`);
        }
        if (!usage?.available) {
          alerts.push('Cumulative traffic usage is currently unavailable for this instance.');
        }
        if (metadata.trafficMonitoringEnabled === 'false') {
          alerts.push('Monitoring disabled for this instance.');
        }
        return {
          id: node.id,
          accountId: graph.accountId,
          accountName,
          name: node.name,
          status: normalizeInstanceStatus(node, metadata),
          type: metadata.instanceType || 'ecs.unknown',
          zone: node.zoneId || node.regionId || '-',
          publicIp: resolveExternalIP(graph, node.id, metadata),
          privateIp: metadata.privateIps || metadata.primaryPrivateIp || '未提供',
          trafficUsage: usage?.available ? Math.round(usage.value * 100) / 100 : null,
          trafficUsageUnit: usage?.unit || 'GB',
          trafficUsageSource: usage?.source,
          trafficUsageCollectedAt: usage?.collectedAt,
          trafficRate: rate?.available ? Math.round(rate.value * 100) / 100 : null,
          trafficRateUnit: rate?.unit || 'Mbps',
          trafficRateSource: rate?.source,
          trafficRateCollectedAt: rate?.collectedAt,
          trafficLimit: Math.round(maximumTraffic),
          monitoringEnabled: metadata.trafficMonitoringEnabled !== 'false',
          overflowAction: metadata.trafficEffectiveOverflowAction || 'notify',
          inherited,
          alerts,
          trafficPolicy: policy
            ? {
                id: policy.id,
                name: policy.name,
                thresholdValue: policy.thresholdValue,
                thresholdType: policy.thresholdType,
                action: policy.action,
                cooldownMinutes: policy.cooldownMinutes,
                enabled: policy.enabled,
              }
            : null,
        };
      });
  });
}

function buildDashboardSummary(accounts: ApiAccount[], graphs: ApiResourceGraph[], jobs: ApiJob[], instances: ECSInstance[]): DashboardSummary {
  return {
    accountCount: accounts.length,
    ecsCount: graphs.reduce((sum, graph) => sum + graph.summary.ecsCount, 0),
    eipCount: graphs.reduce((sum, graph) => sum + graph.summary.eipCount, 0),
    activeWorkflowCount: jobs.filter((job) => job.status === 'running').length,
    attentionInstanceCount: instances.filter((instance) => instance.status === 'Attention').length,
    monitoredInstanceCount: instances.filter((instance) => instance.monitoringEnabled).length,
  };
}

export function useAccountsQuery() {
  return useQuery<ApiAccount[]>({
    queryKey: runtimeKeys.accounts,
    queryFn: listAccounts,
  });
}

export function useJobsQuery() {
  return useQuery<ApiJob[]>({
    queryKey: runtimeKeys.jobs,
    queryFn: listJobs,
    refetchInterval: 20_000,
  });
}

export function usePlatformTrafficGovernanceQuery() {
  return useQuery<ApiPlatformTrafficGovernance>({
    queryKey: runtimeKeys.settings,
    queryFn: getPlatformTrafficGovernance,
  });
}

export function useRuntimeDashboard() {
  const accountsQuery = useAccountsQuery();
  const jobsQuery = useJobsQuery();
  const settingsQuery = usePlatformTrafficGovernanceQuery();
  const accountIds = useMemo(() => (accountsQuery.data || []).map((account) => account.id), [accountsQuery.data]);
  const graphQueries = useQueries({
    queries: accountIds.map((accountId) => ({
      queryKey: runtimeKeys.graph(accountId),
      queryFn: () => listGraph(accountId),
      enabled: Boolean(accountId),
    })),
  }) as Array<{data?: ApiResourceGraph; isLoading: boolean}>;
  const policyQueries = useQueries({
    queries: accountIds.map((accountId) => ({
      queryKey: runtimeKeys.policies(accountId),
      queryFn: () => listTrafficPolicies(accountId),
      enabled: Boolean(accountId),
    })),
  }) as Array<{data?: ApiTrafficPolicy[]; isLoading: boolean}>;

  const graphs = graphQueries.map((query) => query.data).filter((graph): graph is ApiResourceGraph => Boolean(graph));
  const policiesByAccount = Object.fromEntries(accountIds.map((accountId, index) => [accountId, policyQueries[index]?.data || []])) as Record<string, ApiTrafficPolicy[]>;
  const instances = mapGraphToInstances(graphs, accountsQuery.data || [], policiesByAccount);

  return {
    isLoading:
      accountsQuery.isLoading ||
      jobsQuery.isLoading ||
      settingsQuery.isLoading ||
      graphQueries.some((query) => query.isLoading) ||
      policyQueries.some((query) => query.isLoading),
    accounts: (accountsQuery.data || []).map(mapAccountToViewModel),
    rawAccounts: accountsQuery.data || [],
    graphs,
    instances,
    workflows: (jobsQuery.data || []).map(mapJobToWorkflow),
    summary: buildDashboardSummary(accountsQuery.data || [], graphs, jobsQuery.data || [], instances),
    platformDefaults: settingsQuery.data?.defaults || null,
    policiesByAccount,
  };
}

export function useSaveAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: ApiCreateAccountRequest) => {
      if (payload.id) {
        return updateAccount(payload.id, payload);
      }
      return createAccount(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({queryKey: runtimeKeys.accounts});
    },
  });
}

export function useSavePlatformDefaultsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<ApiTrafficGovernanceDefaults>) => savePlatformTrafficGovernance(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({queryKey: runtimeKeys.settings});
      void queryClient.invalidateQueries({queryKey: runtimeKeys.accounts});
    },
  });
}

export function useApplyPlatformDefaultsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: applyPlatformTrafficGovernanceToAccounts,
    onSuccess: (result) => {
      void queryClient.invalidateQueries({queryKey: runtimeKeys.settings});
      void queryClient.invalidateQueries({queryKey: runtimeKeys.accounts});
      for (const accountId of result.accountIds || []) {
        void queryClient.invalidateQueries({queryKey: runtimeKeys.graph(accountId)});
      }
    },
  });
}

export function useSaveInstanceGovernanceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      accountId,
      instanceId,
      payload,
    }: {
      accountId: string;
      instanceId: string;
      payload: ApiECSTrafficGovernance['override'];
    }) => saveECSTrafficGovernance(accountId, instanceId, payload),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({queryKey: runtimeKeys.graph(variables.accountId)});
    },
  });
}

export function useSaveTrafficPolicyMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({accountId, payload}: {accountId: string; payload: ApiTrafficPolicyRequest}) => saveTrafficPolicy(accountId, payload),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({queryKey: runtimeKeys.policies(variables.accountId)});
      void queryClient.invalidateQueries({queryKey: runtimeKeys.graph(variables.accountId)});
    },
  });
}
