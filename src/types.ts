export type AccountStatus = 'Active' | 'Sync Delayed' | 'Auth Failed' | 'Inactive';

export interface TrafficDefaults {
  maximumTrafficGb: number;
  overflowAction: string;
  monitoringEnabled: boolean;
}

export interface CloudAccount {
  id: string;
  name: string;
  status: AccountStatus;
  providerRegion: string;
  mainRegion: string;
  lastSynced: string;
  creationDate: string;
  owner: string;
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
  publicIp: string;
  privateIp: string;
  trafficUsed: number;
  trafficLimit: number;
  trafficUnit: string;
  trafficCollectedAt?: string;
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

export type WorkflowStatus = 'Running' | 'Success' | 'Failed' | 'Idle';

export interface WorkflowTask {
  id: string;
  name: string;
  status: 'Completed' | 'In Progress' | 'Pending' | 'Success' | 'Failed';
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
  tasks: WorkflowTask[];
  logs: string[];
}
