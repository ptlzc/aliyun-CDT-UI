import {useMemo} from 'react';
import {useMutation, useQueries, useQuery, useQueryClient} from '@tanstack/react-query';

import {
  applyPlatformTrafficGovernanceToAccounts,
  checkCdtPermission,
  createAccount,
  createOneClickDeployment,
  createRegionGroup,
  deleteAccount,
  deleteRegionGroup,
  getCdtFreeQuota,
  getEffectiveTrafficGovernance,
  getPlatformTrafficGovernance,
  listAccounts,
  listGraph,
  listInventoryGraph,
  listJobs,
  listRegionGroups,
  listRegionsForAccount,
  listTrafficAudits,
  listTrafficPolicies,
  saveECSTrafficGovernance,
  savePlatformTrafficGovernance,
  saveTrafficPolicy,
  startECSInstance,
  stopECSInstance,
  getECSInstanceState,
  getECSVncUrl,
  getECSMetrics,
  updateAccount,
  updateRegionGroup,
  type ApiAccount,
  type ApiAccountRegion,
  type ApiActionAudit,
  type ApiCreateAccountRequest,
  type ApiECSTrafficGovernance,
  type ApiECSMetricsSnapshot,
  type ApiEffectiveTrafficGovernance,
  type ApiJob,
  type ApiOneClickDeploymentBody,
  type ApiOneClickDeploymentResponse,
  type ApiPlatformTrafficGovernance,
  type ApiRegionGroup,
  type ApiResourceGraph,
  type ApiTrafficAuditPage,
  type ApiTrafficGovernanceDefaults,
  type ApiTrafficPolicy,
  type ApiTrafficPolicyRequest,
  type ApiTrafficQuotaSnapshot,
  type CdtPermissionResult,
  type TrafficAuditFilters,
  validateAccount,
} from '@/lib/api/client';
import type {CloudAccount, DashboardSummary, ECSInstance, WorkflowRun, WorkflowTask} from '@/types';
import {formatDateLabel} from '@/utils/dateFormat';
import {mapGraphToInstances} from './instanceMapping';

export {mapGraphToInstances} from './instanceMapping';

export const runtimeKeys = {
  accounts: ['runtime', 'accounts'] as const,
  graph: (accountId: string) => ['runtime', 'graph', accountId] as const,
  graphInventory: (accountId: string) => ['runtime', 'graph', accountId, 'inventory'] as const,
  graphAll: ['runtime', 'graph'] as const,
  jobs: ['runtime', 'jobs'] as const,
  settings: ['runtime', 'settings', 'traffic-governance'] as const,
  policies: (accountId: string) => ['runtime', 'traffic-policies', accountId] as const,
  audits: (accountId: string, filters: TrafficAuditFilters) => ['runtime', 'traffic-audits', accountId, filters] as const,
  cdtPermission: (accountId: string) => ['runtime', 'cdt-permission', accountId] as const,
  regions: (accountId: string) => ['runtime', 'regions', accountId] as const,
};

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

/** Workflow view models derived from the raw jobs query. */
export function useWorkflowsQuery() {
  const jobsQuery = useJobsQuery();
  return {
    ...jobsQuery,
    data: (jobsQuery.data || []).map(mapJobToWorkflow),
  };
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
  const inventoryGraphQueries = useQueries({
    queries: accountIds.map((accountId) => ({
      queryKey: runtimeKeys.graphInventory(accountId),
      queryFn: () => listInventoryGraph(accountId),
      enabled: Boolean(accountId),
      staleTime: 60_000,
    })),
  }) as Array<{data?: ApiResourceGraph; isLoading: boolean}>;
  const graphQueries = useQueries({
    queries: accountIds.map((accountId, index) => ({
      queryKey: runtimeKeys.graph(accountId),
      queryFn: () => listGraph(accountId),
      enabled: Boolean(accountId) && inventoryGraphQueries[index]?.data !== undefined,
      // Graph is persisted in the backend store and only changes when a
      // discovery run finishes — not realtime. 60s keeps it cached across
      // page visits instead of refetching the slow /graph endpoint (enrich
      // does live RPCs per node) every time.
      staleTime: 60_000,
    })),
  }) as Array<{data?: ApiResourceGraph; isLoading: boolean}>;
  const policyQueries = useQueries({
    queries: accountIds.map((accountId) => ({
      queryKey: runtimeKeys.policies(accountId),
      queryFn: () => listTrafficPolicies(accountId),
      enabled: Boolean(accountId),
    })),
  }) as Array<{data?: ApiTrafficPolicy[]; isLoading: boolean}>;

  const graphs = accountIds
    .map((_, index) => graphQueries[index]?.data ?? inventoryGraphQueries[index]?.data)
    .filter((graph): graph is ApiResourceGraph => Boolean(graph));
  const policiesByAccount = Object.fromEntries(accountIds.map((accountId, index) => [accountId, policyQueries[index]?.data || []])) as Record<string, ApiTrafficPolicy[]>;
  const instanceDetailsLoading = Object.fromEntries(accountIds.map((accountId, index) => [
    accountId,
    inventoryGraphQueries[index]?.data !== undefined &&
      graphQueries[index]?.data === undefined &&
      graphQueries[index]?.isLoading === true,
  ])) as Record<string, boolean>;
  const instances = mapGraphToInstances(graphs, accountsQuery.data || [], policiesByAccount, instanceDetailsLoading);
  const inventoryLoading = accountsQuery.isLoading || inventoryGraphQueries.some((query) => query.isLoading);

  return {
    isLoading:
      inventoryLoading ||
      jobsQuery.isLoading ||
      settingsQuery.isLoading ||
      graphQueries.some((query) => query.isLoading) ||
      policyQueries.some((query) => query.isLoading),
    accounts: (accountsQuery.data || []).map(mapAccountToViewModel),
    rawAccounts: accountsQuery.data || [],
    graphs,
    instances,
    inventoryLoading,
    instanceDetailsLoading,
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

export function useDeleteAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => deleteAccount(accountId),
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

export function useStartECSInstanceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({accountId, instanceId}: {accountId: string; instanceId: string}) => startECSInstance(accountId, instanceId),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({queryKey: runtimeKeys.graph(variables.accountId)});
      void queryClient.invalidateQueries({queryKey: runtimeKeys.jobs});
    },
  });
}

export function useStopECSInstanceMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({accountId, instanceId}: {accountId: string; instanceId: string}) => stopECSInstance(accountId, instanceId),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({queryKey: runtimeKeys.graph(variables.accountId)});
      void queryClient.invalidateQueries({queryKey: runtimeKeys.jobs});
    },
  });
}

export function useECSInstanceStateQuery(accountId: string | null, instanceId: string | null) {
  return useQuery<string>({
    queryKey: ['ecs-instance-state', accountId, instanceId],
    queryFn: () => getECSInstanceState(accountId!, instanceId!),
    enabled: Boolean(accountId && instanceId),
    refetchInterval: 15_000,
  });
}

export function useECSVncUrlQuery(accountId: string | null, instanceId: string | null, enabled = true) {
  return useQuery<string>({
    queryKey: ['ecs-vnc-url', accountId, instanceId],
    queryFn: () => getECSVncUrl(accountId!, instanceId!),
    enabled: Boolean(accountId && instanceId && enabled),
    staleTime: 10_000, // VNC URL is short-lived (15s), keep cached briefly
  });
}

export function useECSMetricsQuery(accountId: string | null, instanceId: string | null, enabled = true) {
  return useQuery<ApiECSMetricsSnapshot>({
    queryKey: ['ecs-metrics', accountId, instanceId],
    queryFn: () => getECSMetrics(accountId!, instanceId!),
    enabled: Boolean(accountId && instanceId && enabled),
    refetchInterval: 30_000, // refresh CMS metrics every 30s
  });
}

export function useRegionGroupsQuery() {
  return useQuery<ApiRegionGroup[]>({
    queryKey: ['region-groups'],
    queryFn: listRegionGroups,
  });
}

export function useCreateRegionGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: Omit<ApiRegionGroup, 'id' | 'createdAt' | 'updatedAt'>) => createRegionGroup(payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({queryKey: ['region-groups']});
    },
  });
}

export function useUpdateRegionGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({id, payload}: {id: string; payload: ApiRegionGroup}) => updateRegionGroup(id, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({queryKey: ['region-groups']});
    },
  });
}

export function useDeleteRegionGroupMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteRegionGroup(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({queryKey: ['region-groups']});
    },
  });
}

export function useEffectiveTrafficGovernanceQuery(accountId: string | null) {
  return useQuery<ApiEffectiveTrafficGovernance>({
    queryKey: ['effective-traffic-governance', accountId],
    queryFn: () => getEffectiveTrafficGovernance(accountId!),
    enabled: Boolean(accountId),
  });
}

export function useCdtFreeQuotaQuery(accountId: string | null) {
  return useQuery<ApiTrafficQuotaSnapshot>({
    queryKey: ['cdt-free-quota', accountId],
    queryFn: () => getCdtFreeQuota(accountId!),
    enabled: Boolean(accountId),
    refetchInterval: 60_000,
  });
}

/**
 * Action audits for one account with optional server-side filters (see
 * TrafficAuditFilters). Data is the {items, total} page shape; total is the
 * offset/limit-independent matching count. No filter = backend default limit
 * 100, newest first.
 *
 * @when 保护记录页单账号视图 / 账户详情操作日志弹窗挂载时
 */
export function useTrafficAuditsQuery(accountId: string | null, filters: TrafficAuditFilters = {}, enabled = true) {
  return useQuery<ApiTrafficAuditPage>({
    queryKey: runtimeKeys.audits(accountId || '', filters),
    queryFn: () => listTrafficAudits(accountId!, filters),
    enabled: Boolean(accountId) && enabled,
  });
}

export function useCdtPermissionQuery(accountId: string | null) {
  return useQuery<CdtPermissionResult>({
    queryKey: runtimeKeys.cdtPermission(accountId || ''),
    queryFn: () => checkCdtPermission(accountId!),
    enabled: Boolean(accountId),
    refetchInterval: 120_000,
  });
}

/**
 * Regions reachable by a managed account (GET /api/accounts/{accountId}/regions).
 * Drives the region dropdown of the one-click deployment form.
 *
 * @when 一键部署页选定账号后加载地域列表
 */
export function useRegionsQuery(accountId: string | null) {
  return useQuery<ApiAccountRegion[]>({
    queryKey: runtimeKeys.regions(accountId || ''),
    queryFn: () => listRegionsForAccount(accountId!),
    enabled: Boolean(accountId),
  });
}

/**
 * Fast persisted topology used to populate source-ECS, zone, and instance
 * type dropdowns in the one-click deployment form.
 *
 * @when 一键部署页选定账号后需要可下拉选择的 ECS/可用区/规格时
 */
export function useInventoryGraphQuery(accountId: string | null) {
  return useQuery<ApiResourceGraph>({
    queryKey: runtimeKeys.graphInventory(accountId || ''),
    queryFn: () => listInventoryGraph(accountId!),
    enabled: Boolean(accountId),
    staleTime: 60_000,
  });
}

/** Lightweight inventory graphs for several accounts (list views only). */
export function useInventoryGraphsQuery(accountIds: string[]) {
  return useQueries({
    queries: accountIds.map((accountId) => ({
      queryKey: runtimeKeys.graphInventory(accountId),
      queryFn: () => listInventoryGraph(accountId),
      enabled: Boolean(accountId),
      staleTime: 60_000,
    })),
  }) as Array<{data?: ApiResourceGraph; isLoading: boolean}>;
}

/**
 * Instance list data built from lightweight inventory graphs only. This is the
 * replacement for the previous heavy `useRuntimeDashboard` usage on the
 * Instances page: it never requests enriched `/graph` or traffic policies.
 */
export function useInventoryInstances() {
  const accountsQuery = useAccountsQuery();
  const accountIds = useMemo(() => (accountsQuery.data || []).map((account) => account.id), [accountsQuery.data]);
  const inventoryGraphQueries = useInventoryGraphsQuery(accountIds);
  const instances = useMemo(() => {
    const graphs = inventoryGraphQueries
      .map((query) => query.data)
      .filter((graph): graph is ApiResourceGraph => Boolean(graph));
    return mapGraphToInstances(graphs, accountsQuery.data || [], {});
  }, [accountsQuery.data, inventoryGraphQueries]);
  return {
    rawAccounts: accountsQuery.data || [],
    instances,
    inventoryLoading: accountsQuery.isLoading || inventoryGraphQueries.some((query) => query.isLoading),
  };
}

/**
 * Enriched topology for one account: inventory plus live traffic/rate details.
 * This is the heavier /graph endpoint and should only be fetched when a page
 * actually needs traffic/governance detail (e.g. dashboard risk section or an
 * opened instance drawer).
 */
export function useEnrichedGraphQuery(accountId: string | null) {
  return useQuery<ApiResourceGraph>({
    queryKey: runtimeKeys.graph(accountId || ''),
    queryFn: () => listGraph(accountId!),
    enabled: Boolean(accountId),
    staleTime: 60_000,
  });
}

/**
 * Traffic policies for one account. Only fetch when the UI needs policy data
 * (drawer/editor), not on every global layout render.
 */
export function useTrafficPoliciesQuery(accountId: string | null) {
  return useQuery<ApiTrafficPolicy[]>({
    queryKey: runtimeKeys.policies(accountId || ''),
    queryFn: () => listTrafficPolicies(accountId!),
    enabled: Boolean(accountId),
  });
}

/**
 * Kicks off the one-click deployment job. The response contains the one-time
 * root password and the full job; the job is seeded into the jobs cache so
 * the step list renders immediately, then WS job.updated events keep it live.
 *
 * @when 一键部署页表单提交
 */
export function useCreateOneClickDeploymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({accountId, body}: {accountId: string; body: ApiOneClickDeploymentBody}) => createOneClickDeployment(accountId, body),
    onSuccess: (response: ApiOneClickDeploymentResponse) => {
      queryClient.setQueryData(runtimeKeys.jobs, (previous: unknown) => {
        const items = Array.isArray(previous) ? previous : [];
        const next = items.filter((item: {id: string}) => item.id !== response.job.id);
        return [response.job, ...next];
      });
      void queryClient.invalidateQueries({queryKey: runtimeKeys.jobs});
    },
  });
}

export {useContinueOneClickDeploymentMutation} from './oneClickDeploymentHooks';

export function useValidateAccountMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) => validateAccount(accountId),
    onSuccess: () => {
      void queryClient.invalidateQueries();
    },
  });
}
