export type AccountStatus = 'Active' | 'Sync Delayed' | 'Auth Failed' | 'Inactive';

export interface CloudAccount {
  id: string; // e.g. ali-prod-192837
  name: string; // e.g. Production Core
  status: AccountStatus;
  providerRegion: string; // e.g. Aliyun China East 1
  mainRegion: string; // e.g. cn-hangzhou
  lastSynced: string; // e.g. 10 mins ago (or a date)
  creationDate: string; // e.g. 2023-10-14 08:30 UTC
  owner: string; // e.g. sysadmin@aliyun.com
  accessKeyId: string;
  accessKeySecret: string;
  roleArn?: string;
  managedRegions: string; // e.g. "cn-hangzhou, cn-shanghai, cn-beijing"
}

export type InstanceStatus = 'Running' | 'Stopped' | 'High CPU';

export interface ECSInstance {
  id: string; // e.g. i-bp142n2kcx1q2e9u0y
  name: string; // e.g. prod-web-front-01
  status: InstanceStatus;
  type: string; // e.g. ecs.g6.large
  zone: string; // e.g. cn-hangzhou-i
  publicIp: string; // e.g. 47.97.102.45
  trafficUsed: number; // in GB
  trafficLimit: number; // in GB
  alerts: string[];
}

export type WorkflowStatus = 'Running' | 'Success' | 'Failed' | 'Idle';

export interface WorkflowTask {
  id: string; // e.g. task-vpc-verify
  name: string;
  status: 'Completed' | 'In Progress' | 'Pending' | 'Success' | 'Failed';
  description: string;
  properties?: { [key: string]: string | number };
  progress?: number; // 0 to 100
}

export interface WorkflowRun {
  id: string; // e.g. wkf-8a7b6c5d
  name: string; // e.g. ECS 创建任务
  status: WorkflowStatus;
  activeStepIndex: number; // 0: Resource Discovery, 1: Network Bootstrap, 2: Provisioning, 3: Validation
  initiatedBy: string; // e.g. operator_system
  targetRegion: string; // e.g. China East 1 (cn-hangzhou)
  startedAt: string;
  duration: string; // e.g. 04:12
  tasks: WorkflowTask[];
  logs: string[];
}
