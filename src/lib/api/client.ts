import {client as accountsClient} from './generated/accounts/client.gen';
import {
  createAccount as createAccountRequest,
  listAccounts as listAccountsRequest,
  updateAccount as updateAccountRequest,
} from './generated/accounts/sdk.gen';
import type {Account, AccountListResponse, CreateAccountRequest, UpdateAccountRequest} from './generated/accounts/types.gen';
import {client as graphClient} from './generated/graph/client.gen';
import {discoverTopology as discoverTopologyRequest, getGraph as getGraphRequest} from './generated/graph/sdk.gen';
import type {ResourceGraph} from './generated/graph/types.gen';
import {client as importClient} from './generated/import/client.gen';
import {importImage as importImageRequest} from './generated/import/sdk.gen';
import type {ImportImageRequest, ImportImageResponse2} from './generated/import/types.gen';
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
import type {ActionAudit, EcsMetricsSnapshot, EcsTrafficGovernance, EcsTrafficGovernanceOverride, ECSInstanceStateResponse, ECSVncUrlResponse} from './generated/instances/types.gen';
import {client as jobsClient} from './generated/jobs/client.gen';
import {getCdtFreeQuota as getCdtFreeQuotaRequest, listJobs as listJobsRequest, listTrafficPolicies as listTrafficPoliciesRequest, saveTrafficPolicy as saveTrafficPolicyRequest} from './generated/jobs/sdk.gen';
import type {Job, JobListResponse, TrafficPolicy, TrafficPolicyListResponse, TrafficPolicyRequest} from './generated/jobs/types.gen';
import {client as provisionClient} from './generated/provision/client.gen';
import {provision as provisionRequest} from './generated/provision/sdk.gen';
import type {ProvisionRequest, ProvisionResponse2} from './generated/provision/types.gen';
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

const API_BASE_URL = (
  import.meta.env.NEXT_PUBLIC_API_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  'http://localhost:8080/api'
).replace(/\/$/, '');

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
export type ApiActionAudit = ActionAudit;
export type ApiCreateAccountRequest = CreateAccountRequest | UpdateAccountRequest;
export type ApiECSTrafficGovernance = EcsTrafficGovernance;
export type ApiECSTrafficGovernanceOverride = EcsTrafficGovernanceOverride;
export type ApiECSMetricsSnapshot = EcsMetricsSnapshot;
export type ApiEffectiveTrafficGovernance = EffectiveTrafficGovernance;
export type ApiJob = Job;
export type ApiPlatformTrafficGovernance = PlatformTrafficGovernance;
export type ApiPlatformTrafficGovernanceRolloutResult = PlatformTrafficGovernanceRolloutResult;
export type ApiProvisionRequest = ProvisionRequest;
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
  const httpUrl = new URL(`${API_BASE_URL}/runtime/ws`);
  httpUrl.protocol = httpUrl.protocol === 'https:' ? 'wss:' : 'ws:';
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

export async function createAccount(payload: ApiCreateAccountRequest): Promise<ApiAccount> {
  return unwrapData((await createAccountRequest({body: payload as CreateAccountRequest})) as GeneratedResult<ApiAccount>);
}

export async function updateAccount(accountId: string, payload: ApiCreateAccountRequest): Promise<ApiAccount> {
  return unwrapData((await updateAccountRequest({
    path: {accountId},
    body: payload as UpdateAccountRequest,
  })) as GeneratedResult<ApiAccount>);
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
    body: {
      instanceId,
      ...payload,
    },
  })) as GeneratedResult<ApiECSTrafficGovernance>);
}

export async function startECSInstance(accountId: string, instanceId: string): Promise<ApiActionAudit> {
  return unwrapData((await startEcsInstanceRequest({path: {accountId, instanceId}})) as GeneratedResult<ApiActionAudit>);
}

export async function stopECSInstance(accountId: string, instanceId: string): Promise<ApiActionAudit> {
  return unwrapData((await stopEcsInstanceRequest({path: {accountId, instanceId}})) as GeneratedResult<ApiActionAudit>);
}

export async function getECSInstanceState(accountId: string, instanceId: string): Promise<string> {
  const response = unwrapData((await getEcsInstanceStateRequest({path: {accountId, instanceId}})) as GeneratedResult<ECSInstanceStateResponse>);
  return response.state;
}

export async function getECSVncUrl(accountId: string, instanceId: string): Promise<string> {
  const response = unwrapData((await getEcsVncUrlRequest({path: {accountId, instanceId}})) as GeneratedResult<ECSVncUrlResponse>);
  return response.vncUrl;
}

export async function getECSMetrics(accountId: string, instanceId: string): Promise<ApiECSMetricsSnapshot> {
  return unwrapData((await getEcsMetricsRequest({path: {accountId, instanceId}})) as GeneratedResult<EcsMetricsSnapshot>);
}

export async function importImage(accountId: string, payload: ImportImageRequest): Promise<ImportImageResponse2> {
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
  const response = await fetch(`${API_BASE_URL}/accounts/${accountId}/cdt-permission`);
  if (!response.ok) {
    return {permitted: false, error: `HTTP ${response.status}`};
  }
  return response.json() as Promise<CdtPermissionResult>;
}

export interface ValidateAccountResult {
  valid: boolean;
  errorType?: 'credential' | 'permission' | 'network';
  error?: string;
  warning?: string;
}

export async function validateAccount(accountId: string): Promise<ValidateAccountResult> {
  const response = await fetch(`${API_BASE_URL}/accounts/${accountId}/validate`, {method: 'POST'});
  if (!response.ok) {
    const text = await response.text();
    return {valid: false, errorType: 'credential', error: text};
  }
  return response.json() as Promise<ValidateAccountResult>;
}
