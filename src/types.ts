export interface TrafficDefaults {
  maximumTrafficGb: number;
  overflowAction: string;
  monitoringEnabled: boolean;
  /** 溢出停止阈值 (GB); 缺省/0 = 未配置, 按上限判定 */
  overflowThresholdGb?: number;
}

export interface CloudAccount {
  id: string;
  name: string;
  providerRegion: string;
  mainRegion: string;
  lastSynced: string;
  /** Real backend createdAt (formatted). Absent for the create draft, which
   * has no real account yet — the UI hides the row instead of faking a date. */
  creationDate?: string;
  accessKeyId: string;
  accessKeySecret: string;
  roleArn?: string;
  managedRegions: string;
  trafficDefaults: TrafficDefaults;
}

export type InstanceStatus = 'Running' | 'Stopped' | 'Attention';

export interface InstanceTrafficPolicy {
  id?: string;
  name: string;
  thresholdValue: number;
  thresholdType: string;
  action: string;
  cooldownMinutes: number;
  enabled: boolean;
}

export interface ECSInstance {
  id: string;
  accountId: string;
  accountName: string;
  name: string;
  status: InstanceStatus;
  type: string;
  zone: string;
  regionId: string;
  publicIp: string;
  privateIp: string;
  trafficUsage: number | null;
  trafficUsageUnit: string;
  trafficUsageSource?: string;
  trafficUsageErrorReason?: string;
  trafficUsageCollectedAt?: string;
  trafficRate: number | null;
  trafficRateUnit: string;
  trafficRateSource?: string;
  trafficRateCollectedAt?: string;
  trafficRateErrorReason?: string;
  trafficDetailsLoading?: boolean;
  trafficLimit: number;
  /** Account-level CDT total used for the account-scoped traffic bar. */
  accountTrafficUsage?: number;
  /** Account-level CDT cap (e.g. 200 GB) for the account-scoped traffic bar. */
  accountTrafficLimit?: number;
  accountTrafficUnit?: string;
  monitoringEnabled: boolean;
  overflowAction: string;
  inherited: boolean;
  alerts: string[];
  trafficPolicy?: InstanceTrafficPolicy | null;
}

export interface DashboardSummary {
  accountCount: number;
  ecsCount: number;
  eipCount: number;
  activeWorkflowCount: number;
  attentionInstanceCount: number;
  monitoredInstanceCount: number;
}

export type WorkflowStatus = 'Running' | 'Success' | 'Failed' | 'Idle' | 'Manual Required';

export interface WorkflowTask {
  id: string;
  name: string;
  status: 'Completed' | 'In Progress' | 'Pending' | 'Success' | 'Failed' | 'Manual Required';
  description: string;
  properties?: {[key: string]: string | number};
  progress?: number;
}

export interface WorkflowRun {
  id: string;
  name: string;
  status: WorkflowStatus;
  activeStepIndex: number;
  initiatedBy: string;
  targetRegion: string;
  startedAt: string;
  duration: string;
  /** VNC fallback link for manual-required (SSH 降级) jobs, from job.result.vncUrl. */
  vncUrl?: string;
  tasks: WorkflowTask[];
  logs: string[];
}
