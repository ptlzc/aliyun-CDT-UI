import {client as accountsClient} from './generated/accounts/client.gen';
import {
  checkCdtPermission as checkCdtPermissionRequest,
  createAccount as createAccountRequest,
  deleteAccount as deleteAccountRequest,
  listAccounts as listAccountsRequest,
  listRegions as listRegionsRequest,
  listRegionsForAccount as listRegionsForAccountRequest,
  updateAccount as updateAccountRequest,
  validateAccountById as validateAccountByIdRequest,
} from './generated/accounts/sdk.gen';
import type {
  Account,
  AccountBody,
  AccountListResponse,
  AccountRegion,
  AccountRegionListResponse,
  CreateAccountRequest,
} from './generated/accounts/types.gen';
import {client as graphClient} from './generated/graph/client.gen';
import {discoverTopology as discoverTopologyRequest, getGraph as getGraphRequest} from './generated/graph/sdk.gen';
import type {ResourceGraph} from './generated/graph/types.gen';
import {client as importClient} from './generated/import/client.gen';
import {importImage as importImageRequest} from './generated/import/sdk.gen';
import type {ImportImageBody, ImportImageResponse2} from './generated/import/types.gen';
import {client as instancesClient} from './generated/instances/client.gen';
import {
  getEcsTrafficGovernance as getEcsTrafficGovernanceRequest,
  getEcsInstanceState as getEcsInstanceStateRequest,
  getEcsMetrics as getEcsMetricsRequest,
  getEcsVncUrl as getEcsVncUrlRequest,
  saveEcsTrafficGovernanceOverride as saveEcsTrafficGovernanceOverrideRequest,
  startEcsInstance as startEcsInstanceRequest,
  stopEcsInstance as stopEcsInstanceRequest,
} from './generated/instances/sdk.gen';
import type {ActionAudit, EcsInstanceStateResponse, EcsMetricsSnapshot, EcsTrafficGovernance, EcsTrafficGovernanceOverride, EcsVncUrlResponse} from './generated/instances/types.gen';
import {client as jobsClient} from './generated/jobs/client.gen';
import {getCdtFreeQuota as getCdtFreeQuotaRequest, listJobs as listJobsRequest, listTrafficAudits as listTrafficAuditsRequest, listTrafficPolicies as listTrafficPoliciesRequest, saveTrafficPolicy as saveTrafficPolicyRequest} from './generated/jobs/sdk.gen';
import type {ActionAuditListResponse, Job, JobListResponse, ListTrafficAuditsData, TrafficPolicy, TrafficPolicyListResponse, TrafficPolicyRequest} from './generated/jobs/types.gen';
import {client as provisionClient} from './generated/provision/client.gen';
import {continueOneClickDeployment as continueOneClickDeploymentRequest, createOneClickDeployment as createOneClickDeploymentRequest, provision as provisionRequest} from './generated/provision/sdk.gen';
import type {ContinueOneClickDeploymentBody, ContinueOneClickDeploymentResponse, OneClickDeploymentBody, OneClickDeploymentResponse, ProvisionBody, ProvisionResponse2} from './generated/provision/types.gen';
import {client as settingsClient} from './generated/settings/client.gen';
import {
  applyPlatformTrafficGovernanceDefaultsToAccounts as applyPlatformTrafficGovernanceDefaultsToAccountsRequest,
  createRegionGroup as createRegionGroupRequest,
  deleteRegionGroup as deleteRegionGroupRequest,
  deleteRegionGroupTrafficRule as deleteRegionGroupTrafficRuleRequest,
  getEffectiveTrafficGovernance as getEffectiveTrafficGovernanceRequest,
  getPlatformTrafficGovernanceDefaults as getPlatformTrafficGovernanceDefaultsRequest,
  getRegionGroup as getRegionGroupRequest,
  getRegionGroupTrafficRule as getRegionGroupTrafficRuleRequest,
  listRegionGroups as listRegionGroupsRequest,
  savePlatformTrafficGovernanceDefaults as savePlatformTrafficGovernanceDefaultsRequest,
  saveRegionGroupTrafficRule as saveRegionGroupTrafficRuleRequest,
  updateRegionGroup as updateRegionGroupRequest,
} from './generated/settings/sdk.gen';
import type {
  EffectiveTrafficGovernance,
  PlatformTrafficGovernance,
  PlatformTrafficGovernanceRolloutResult,
  RegionGroup,
  RegionGroupListResponse,
  RegionGroupTrafficRule,
  TrafficGovernanceDefaults,
  TrafficGovernanceDefaultsRequest,
  TrafficQuotaSnapshot,
} from './generated/settings/types.gen';
import {API_BASE_URL, apiWebSocketUrl} from '@/lib/api/baseUrl';

for (const client of [accountsClient, graphClient, importClient, instancesClient, jobsClient, provisionClient, settingsClient]) {
  client.setConfig({
    baseUrl: API_BASE_URL,
    responseStyle: 'data',
  });
}

type GeneratedResult<T> = T | {data: T; error?: unknown};

function unwrapData<T>(result: GeneratedResult<T>): T {
  if (result && typeof result === 'object' && 'data' in result) {
    return result.data as T;
  }
  return result as T;
}

export type ApiAccount = Account;
export type ApiAccountRegion = AccountRegion;
export type ApiActionAudit = ActionAudit;
export type ApiCreateAccountRequest = CreateAccountRequest | AccountBody;
export type ApiECSTrafficGovernance = EcsTrafficGovernance;
export type ApiECSTrafficGovernanceOverride = EcsTrafficGovernanceOverride;
export type ApiECSMetricsSnapshot = EcsMetricsSnapshot;
export type ApiEffectiveTrafficGovernance = EffectiveTrafficGovernance;
export type ApiJob = Job;
export type ApiOneClickDeploymentBody = OneClickDeploymentBody;
export type ApiOneClickDeploymentResponse = OneClickDeploymentResponse;
export type ApiContinueOneClickDeploymentBody = ContinueOneClickDeploymentBody;
export type ApiContinueOneClickDeploymentResponse = ContinueOneClickDeploymentResponse;
export type ApiPlatformTrafficGovernance = PlatformTrafficGovernance;
export type ApiPlatformTrafficGovernanceRolloutResult = PlatformTrafficGovernanceRolloutResult;
export type ApiProvisionRequest = ProvisionBody;
export type ApiRegionGroup = RegionGroup;
export type ApiRegionGroupListResponse = RegionGroupListResponse;
export type ApiRegionGroupTrafficRule = RegionGroupTrafficRule;
export type ApiResourceGraph = ResourceGraph;
export type ApiTrafficGovernanceDefaults = TrafficGovernanceDefaults;
export type ApiTrafficGovernanceDefaultsRequest = TrafficGovernanceDefaultsRequest;
export type ApiTrafficPolicy = TrafficPolicy;
export type ApiTrafficPolicyRequest = TrafficPolicyRequest;
export type ApiTrafficQuotaSnapshot = TrafficQuotaSnapshot;

export type RuntimeEvent = {
  type: 'job.updated' | 'job.log.appended' | 'discovery.progress';
  accountId: string;
  jobId?: string;
  timestamp: string;
  job?: ApiJob;
  log?: {message: string; level?: string; timestamp: string};
  progress?: {
    accountId: string;
    jobId: string;
    status: string;
    message?: string;
    currentTask?: string;
    regionId?: string;
    currentRegion: number;
    totalRegions: number;
    completedSteps: number;
    totalSteps: number;
    updatedAt: string;
  };
};

export function runtimeWebSocketUrl(filters?: {accountId?: string; jobId?: string}): string {
  const httpUrl = apiWebSocketUrl('/api/runtime/ws');
  if (filters?.accountId) {
    httpUrl.searchParams.set('accountId', filters.accountId);
  }
  if (filters?.jobId) {
    httpUrl.searchParams.set('jobId', filters.jobId);
  }
  return httpUrl.toString();
}

export async function listAccounts(): Promise<ApiAccount[]> {
  const response = unwrapData((await listAccountsRequest()) as GeneratedResult<AccountListResponse>);
  return response.items;
}

export interface ListRegionsRequest {
  accessKeyId: string;
  accessKeySecret: string;
  siteType: 'domestic' | 'international';
}

export async function listRegions(payload: ListRegionsRequest): Promise<ApiAccountRegion[]> {
  try {
    const response = unwrapData(
      (await listRegionsRequest({
        body: payload as AccountBody,
        throwOnError: true,
      })) as GeneratedResult<AccountRegionListResponse>,
    );
    return response.items ?? [];
  } catch (error) {
    // The generated client throws the parsed huma error body ({error: string});
    // normalize to a real Error so callers can rely on error.message.
    if (error && typeof error === 'object' && 'error' in error && typeof error.error === 'string') {
      throw new Error(error.error);
    }
    throw error;
  }
}

export async function createAccount(payload: ApiCreateAccountRequest): Promise<ApiAccount> {
  return unwrapData((await createAccountRequest({body: payload as CreateAccountRequest})) as GeneratedResult<ApiAccount>);
}

export async function updateAccount(accountId: string, payload: ApiCreateAccountRequest): Promise<ApiAccount> {
  return unwrapData((await updateAccountRequest({
    path: {accountId},
    body: payload as AccountBody,
  })) as GeneratedResult<ApiAccount>);
}

export async function deleteAccount(accountId: string): Promise<void> {
  await deleteAccountRequest({path: {accountId}});
}

export async function listGraph(accountId: string): Promise<ApiResourceGraph> {
  return unwrapData((await getGraphRequest({path: {accountId}})) as GeneratedResult<ApiResourceGraph>);
}

export async function discoverTopology(accountId: string): Promise<ApiResourceGraph> {
  return unwrapData((await discoverTopologyRequest({path: {accountId}})) as GeneratedResult<ApiResourceGraph>);
}

export async function listJobs(): Promise<ApiJob[]> {
  const response = unwrapData((await listJobsRequest()) as GeneratedResult<JobListResponse>);
  return response.items;
}

export async function getPlatformTrafficGovernance(): Promise<ApiPlatformTrafficGovernance> {
  return unwrapData((await getPlatformTrafficGovernanceDefaultsRequest()) as GeneratedResult<ApiPlatformTrafficGovernance>);
}

export async function savePlatformTrafficGovernance(
  payload: Partial<ApiTrafficGovernanceDefaults>,
): Promise<ApiPlatformTrafficGovernance> {
  return unwrapData((await savePlatformTrafficGovernanceDefaultsRequest({
    body: payload as TrafficGovernanceDefaultsRequest,
  })) as GeneratedResult<ApiPlatformTrafficGovernance>);
}

export async function applyPlatformTrafficGovernanceToAccounts(): Promise<ApiPlatformTrafficGovernanceRolloutResult> {
  return unwrapData((await applyPlatformTrafficGovernanceDefaultsToAccountsRequest()) as GeneratedResult<ApiPlatformTrafficGovernanceRolloutResult>);
}

export async function listTrafficPolicies(accountId: string): Promise<ApiTrafficPolicy[]> {
  const response = unwrapData((await listTrafficPoliciesRequest({path: {accountId}})) as GeneratedResult<TrafficPolicyListResponse>);
  return response.items;
}

/**
 * Optional server-side filters for listTrafficAudits. All conditions are ANDed
 * by the backend; triggeredBy matches any listed value (field-internal OR).
 */
export interface TrafficAuditFilters {
  /** Trigger sources, e.g. ['traffic-governance', 'traffic-policy']; sent as one comma-joined query param. */
  triggeredBy?: string[];
  /** Exact action match (stop-instance / start-instance / detach-eip / …). */
  action?: string;
  /** Exact instance id match, executed server-side. */
  targetId?: string;
  /** Max records; backend default 100, capped at 500. */
  limit?: number;
  /** 0-based offset for pagination; page = offset / limit + 1. */
  offset?: number;
}

/** One page of action audits: this page's items plus the offset/limit-independent total. */
export type ApiTrafficAuditPage = {items: ApiActionAudit[]; total: number};

export async function listTrafficAudits(accountId: string, filters?: TrafficAuditFilters): Promise<ApiTrafficAuditPage> {
  const query: ListTrafficAuditsData['query'] = {};
  if (filters?.triggeredBy?.length) {
    query.triggeredBy = filters.triggeredBy.join(',');
  }
  if (filters?.action) {
    query.action = filters.action;
  }
  if (filters?.targetId) {
    query.targetId = filters.targetId;
  }
  if (filters?.limit !== undefined) {
    query.limit = filters.limit;
  }
  if (filters?.offset !== undefined) {
    query.offset = filters.offset;
  }
  const response = unwrapData((await listTrafficAuditsRequest({path: {accountId}, query})) as GeneratedResult<ActionAuditListResponse>);
  return {items: response.items ?? [], total: response.total};
}

export async function saveTrafficPolicy(accountId: string, payload: ApiTrafficPolicyRequest): Promise<ApiTrafficPolicy> {
  return unwrapData((await saveTrafficPolicyRequest({
    path: {accountId},
    body: payload,
  })) as GeneratedResult<ApiTrafficPolicy>);
}

export async function getECSTrafficGovernance(accountId: string, instanceId: string): Promise<ApiECSTrafficGovernance> {
  return unwrapData((await getEcsTrafficGovernanceRequest({
    path: {accountId, instanceId},
  })) as GeneratedResult<ApiECSTrafficGovernance>);
}

export async function saveECSTrafficGovernance(
  accountId: string,
  instanceId: string,
  payload: ApiECSTrafficGovernanceOverride,
): Promise<ApiECSTrafficGovernance> {
  return unwrapData((await saveEcsTrafficGovernanceOverrideRequest({
    path: {accountId, instanceId},
    body: payload,
  })) as GeneratedResult<ApiECSTrafficGovernance>);
}

export async function startECSInstance(accountId: string, instanceId: string): Promise<ApiActionAudit> {
  return unwrapData((await startEcsInstanceRequest({path: {accountId, instanceId}})) as GeneratedResult<ApiActionAudit>);
}

export async function stopECSInstance(accountId: string, instanceId: string): Promise<ApiActionAudit> {
  return unwrapData((await stopEcsInstanceRequest({path: {accountId, instanceId}})) as GeneratedResult<ApiActionAudit>);
}

export async function getECSInstanceState(accountId: string, instanceId: string): Promise<string> {
  const response = unwrapData((await getEcsInstanceStateRequest({path: {accountId, instanceId}})) as GeneratedResult<EcsInstanceStateResponse>);
  return response.state;
}

export async function getECSVncUrl(accountId: string, instanceId: string): Promise<string> {
  const response = unwrapData((await getEcsVncUrlRequest({path: {accountId, instanceId}})) as GeneratedResult<EcsVncUrlResponse>);
  return response.vncUrl;
}

export async function getECSMetrics(accountId: string, instanceId: string): Promise<ApiECSMetricsSnapshot> {
  return unwrapData((await getEcsMetricsRequest({path: {accountId, instanceId}})) as GeneratedResult<EcsMetricsSnapshot>);
}

export async function importImage(accountId: string, payload: ImportImageBody): Promise<ImportImageResponse2> {
  return unwrapData((await importImageRequest({
    path: {accountId},
    body: payload,
  })) as GeneratedResult<ImportImageResponse2>);
}

export async function provision(accountId: string, payload: ApiProvisionRequest): Promise<ProvisionResponse2> {
  return unwrapData((await provisionRequest({
    path: {accountId},
    body: payload,
  })) as GeneratedResult<ProvisionResponse2>);
}

/**
 * Region options for an already-managed account (GET /api/accounts/{accountId}/regions).
 * Used by the one-click deployment form to offer the regions the account can
 * actually reach, instead of hardcoding the account's default region.
 *
 * @when 一键部署页账号选定后加载地域下拉
 */
export async function listRegionsForAccount(accountId: string): Promise<ApiAccountRegion[]> {
  const response = unwrapData((await listRegionsForAccountRequest({path: {accountId}})) as GeneratedResult<AccountRegionListResponse>);
  return response.items ?? [];
}

/**
 * Kicks off the 7-step one-click deployment job. The response carries the
 * one-time root password at the top level — the caller must show it to the
 * user immediately (it is never persisted and never returned again).
 *
 * @when 一键部署页表单提交
 */
export async function createOneClickDeployment(accountId: string, body: ApiOneClickDeploymentBody): Promise<ApiOneClickDeploymentResponse> {
  return unwrapData((await createOneClickDeploymentRequest({
    path: {accountId},
    body,
  })) as GeneratedResult<ApiOneClickDeploymentResponse>);
}

/**
 * Resumes an installer-mode one-click deployment that is paused at
 * vnc-install-system / awaiting_user. The backend verifies the job belongs to
 * the account and is waiting for the VNC setup-alpine completion action.
 *
 * @when 进度页 installer 流程用户点击“我已安装完成，继续”
 */
export async function continueOneClickDeployment(
  accountId: string,
  jobId: string,
  body: ApiContinueOneClickDeploymentBody,
): Promise<ApiContinueOneClickDeploymentResponse> {
  return unwrapData((await continueOneClickDeploymentRequest({
    path: {accountId, jobId},
    body,
  })) as GeneratedResult<ApiContinueOneClickDeploymentResponse>);
}

export async function listRegionGroups(): Promise<ApiRegionGroup[]> {
  const response = unwrapData((await listRegionGroupsRequest()) as GeneratedResult<RegionGroupListResponse>);
  return response.items;
}

export async function createRegionGroup(payload: Omit<ApiRegionGroup, 'id' | 'createdAt' | 'updatedAt'>): Promise<ApiRegionGroup> {
  return unwrapData((await createRegionGroupRequest({
    body: payload as RegionGroup,
  })) as GeneratedResult<ApiRegionGroup>);
}

export async function getRegionGroup(id: string): Promise<ApiRegionGroup> {
  return unwrapData((await getRegionGroupRequest({path: {regionGroupId: id}})) as GeneratedResult<ApiRegionGroup>);
}

export async function updateRegionGroup(id: string, payload: ApiRegionGroup): Promise<ApiRegionGroup> {
  return unwrapData((await updateRegionGroupRequest({
    path: {regionGroupId: id},
    body: payload,
  })) as GeneratedResult<ApiRegionGroup>);
}

export async function deleteRegionGroup(id: string): Promise<void> {
  await deleteRegionGroupRequest({path: {regionGroupId: id}});
}

export async function getRegionGroupTrafficRule(regionGroupId: string): Promise<ApiRegionGroupTrafficRule> {
  return unwrapData((await getRegionGroupTrafficRuleRequest({path: {regionGroupId}})) as GeneratedResult<ApiRegionGroupTrafficRule>);
}

export async function saveRegionGroupTrafficRule(
  regionGroupId: string,
  payload: Omit<ApiRegionGroupTrafficRule, 'regionGroupId'>,
): Promise<ApiRegionGroupTrafficRule> {
  return unwrapData((await saveRegionGroupTrafficRuleRequest({
    path: {regionGroupId},
    body: {regionGroupId, ...payload} as RegionGroupTrafficRule,
  })) as GeneratedResult<ApiRegionGroupTrafficRule>);
}

export async function deleteRegionGroupTrafficRule(regionGroupId: string): Promise<void> {
  await deleteRegionGroupTrafficRuleRequest({path: {regionGroupId}});
}

export async function getEffectiveTrafficGovernance(accountId: string): Promise<ApiEffectiveTrafficGovernance> {
  return unwrapData((await getEffectiveTrafficGovernanceRequest({path: {accountId}})) as GeneratedResult<ApiEffectiveTrafficGovernance>);
}

export async function getCdtFreeQuota(accountId: string): Promise<ApiTrafficQuotaSnapshot> {
  return unwrapData((await getCdtFreeQuotaRequest({path: {accountId}})) as GeneratedResult<ApiTrafficQuotaSnapshot>);
}

export interface CdtPermissionResult {
  permitted: boolean;
  error?: string;
  errorType?: 'permission' | 'credential' | 'network';
}

export async function checkCdtPermission(accountId: string): Promise<CdtPermissionResult> {
  return unwrapData((await checkCdtPermissionRequest({path: {accountId}})) as GeneratedResult<CdtPermissionResult>);
}

export interface ValidateAccountResult {
  valid: boolean;
  errorType?: 'credential' | 'permission' | 'network';
  error?: string;
  warning?: string;
}

export async function validateAccount(accountId: string): Promise<ValidateAccountResult> {
  return unwrapData((await validateAccountByIdRequest({path: {accountId}})) as GeneratedResult<ValidateAccountResult>);
}
