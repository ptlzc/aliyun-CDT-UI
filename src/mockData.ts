import { CloudAccount, ECSInstance, WorkflowRun } from './types';

export const initialAccounts: CloudAccount[] = [
  {
    id: 'ali-prod-192837',
    name: 'Production Core',
    status: 'Active',
    providerRegion: 'Aliyun China East 1',
    mainRegion: 'cn-hangzhou (华东 1)',
    lastSynced: '10 mins ago',
    creationDate: '2023-10-14 08:30 UTC',
    owner: 'sysadmin@aliyun.com',
    accessKeyId: 'LTAI5t7***********',
    accessKeySecret: '************************',
    roleArn: 'acs:ram::1234567890123456:role/aliyun-ops-role',
    managedRegions: 'cn-hangzhou, cn-beijing, cn-shanghai',
  },
  {
    id: 'ali-stg-847291',
    name: 'Staging Environment',
    status: 'Active',
    providerRegion: 'Aliyun China North 2',
    mainRegion: 'cn-beijing (华北 2)',
    lastSynced: '1 hour ago',
    creationDate: '2023-11-20 10:15 UTC',
    owner: 'stg-admin@aliyun.com',
    accessKeyId: 'LTAI5t8***********',
    accessKeySecret: '************************',
    roleArn: '',
    managedRegions: 'cn-beijing',
  },
  {
    id: 'ali-dr-459012',
    name: 'Data Lake DR',
    status: 'Sync Delayed',
    providerRegion: 'Aliyun China South 1',
    mainRegion: 'cn-shenzhen (华南 1)',
    lastSynced: '4 hours ago',
    creationDate: '2024-01-05 14:00 UTC',
    owner: 'datalake@aliyun.com',
    accessKeyId: 'LTAI5t9***********',
    accessKeySecret: '************************',
    roleArn: 'acs:ram::1234567890123456:role/aliyun-data-role',
    managedRegions: 'cn-shenzhen',
  },
  {
    id: 'ali-leg-112093',
    name: 'Legacy Auth Services',
    status: 'Auth Failed',
    providerRegion: 'Aliyun China East 2',
    mainRegion: 'cn-shanghai (华东 2)',
    lastSynced: '2 days ago',
    creationDate: '2022-06-18 11:22 UTC',
    owner: 'legacy-auth@aliyun.com',
    accessKeyId: 'LTAI5t1***********',
    accessKeySecret: '************************',
    roleArn: 'acs:ram::1122334455667788:role/aliyun-auth-role',
    managedRegions: 'cn-shanghai',
  },
  {
    id: 'ali-dev-998231',
    name: 'Dev Sandbox Alpha',
    status: 'Inactive',
    providerRegion: 'Aliyun China North 1',
    mainRegion: 'cn-qingdao (华北 1)',
    lastSynced: '-',
    creationDate: '2025-02-14 09:00 UTC',
    owner: 'sandbox-dev@aliyun.com',
    accessKeyId: 'LTAI5t0***********',
    accessKeySecret: '************************',
    roleArn: '',
    managedRegions: 'cn-qingdao',
  }
];

export const initialInstances: ECSInstance[] = [
  {
    id: 'i-bp142n2kcx1q2e9u0y',
    name: 'prod-web-front-01',
    status: 'Running',
    type: 'ecs.g6.large',
    zone: 'cn-hangzhou-i',
    publicIp: '47.97.102.45',
    trafficUsed: 650,
    trafficLimit: 1000,
    alerts: []
  },
  {
    id: 'i-bp1g5t8mxl2p9r4v3z',
    name: 'dev-api-worker-02',
    status: 'Stopped',
    type: 'ecs.c6.xlarge',
    zone: 'cn-hangzhou-h',
    publicIp: '未分配',
    trafficUsed: 75,
    trafficLimit: 500,
    alerts: []
  },
  {
    id: 'i-bp1k8j2mxb4q1v9w5h',
    name: 'prod-db-replica',
    status: 'High CPU',
    type: 'ecs.r6.2xlarge',
    zone: 'cn-hangzhou-i',
    publicIp: '47.97.102.88',
    trafficUsed: 1760,
    trafficLimit: 2000,
    alerts: [
      'CPU Usage at 94.2% for the last 15 mins',
      'Read IOPS approaching EBS GP3 hardware limit of 6,000 IOPS'
    ]
  }
];

export const initialWorkflows: WorkflowRun[] = [
  {
    id: 'wkf-8a7b6c5d',
    name: 'ECS 创建任务 - Aliyun CDT',
    status: 'Running',
    activeStepIndex: 2,
    initiatedBy: 'operator_system',
    targetRegion: 'Prod • China East 1 (cn-hangzhou) • VPC-Main',
    startedAt: '2026-06-16 19:03',
    duration: '04:12',
    tasks: [
      {
        id: 'task-vpc-verify',
        name: 'task-vpc-verify',
        status: 'Completed',
        description: 'Verified vSwitch and Security Group bindings.'
      },
      {
        id: 'task-ecs-provisioning',
        name: 'task-ecs-provisioning',
        status: 'In Progress',
        description: 'Preparing CreateInstance API payload. Calling Aliyun RunInstances API and tracking instance power states.',
        properties: {
          InstanceType: 'ecs.g7.xlarge',
          ImageId: 'aliyun_3_x64_20G_alibase_20231220.vhd',
          Count: 3
        },
        progress: 45
      },
      {
        id: 'task-eip-allocate',
        name: 'task-eip-allocate',
        status: 'Pending',
        description: 'Allocating regional Elastic IP pool and performing direct binding associations.'
      },
      {
        id: 'task-slb-register',
        name: 'task-slb-register',
        status: 'Pending',
        description: 'Registering newly provisioned virtual server targets under regional Load Balancer groups.'
      }
    ],
    logs: [
      '[2023-10-27 14:32:01 UTC] INFO Starting workflow execution wkf-8a7b6c5d',
      '[2023-10-27 14:32:02 UTC] INFO Engine context initialized. Target: cn-hangzhou',
      '[2023-10-27 14:32:05 UTC] INFO Loading task DAG... 12 nodes discovered.',
      '[2023-10-27 14:32:10 UTC] SUCCESS Resource Discovery complete. Took 00:45s',
      '[2023-10-27 14:32:12 UTC] INFO Executing Network Bootstrap phase...',
      '[2023-10-27 14:32:15 UTC] INFO task-vpc-verify: Checking VPC configuration vpc-bp1qpo...',
      '[2023-10-27 14:32:18 UTC] INFO task-vpc-verify: VSwitch vsw-bp1xyz identified and verified.',
      '[2023-10-27 14:33:24 UTC] SUCCESS Network Bootstrap complete. Took 01:12s',
      '[2023-10-27 14:33:25 UTC] INFO Entering Provisioning phase...',
      '[2023-10-27 14:33:26 UTC] INFO task-ecs-provisioning: Preparing CreateInstance API payload.',
      '[2023-10-27 14:33:30 UTC] INFO task-ecs-provisioning: Calling Aliyun RunInstances (Count: 3, Type: ecs.g7.xlarge)',
      '[2023-10-27 14:34:01 UTC] INFO task-ecs-provisioning: Waiting for instances to reach \'Running\' state...',
      '[2023-10-27 14:34:15 UTC] INFO Polling status: 1/3 instances active (i-bp1abcdefg1)',
      '[2023-10-27 14:34:45 UTC] INFO Polling status: 1/3 instances active. Waiting...',
      '[2023-10-27 14:35:10 UTC] DEBUG API request throttled, applying backoff strategy...',
      '❯ Polling status: 2/3 instances active (i-bp1abcdefg2)...'
    ]
  },
  {
    id: 'wkf-a0e2d5c1',
    name: 'VPC 弹性网络安全加固',
    status: 'Success',
    activeStepIndex: 3,
    initiatedBy: 'security_audit',
    targetRegion: 'Staging • China North 2 (cn-beijing)',
    startedAt: '2026-06-15 10:12',
    duration: '02:05',
    tasks: [
      {
        id: 'sec-vsw-scan',
        name: 'Sec-VSw-Scan',
        status: 'Completed',
        description: 'Audit network access control list (NACL) overrides.',
      },
      {
        id: 'sec-sg-harden',
        name: 'Sec-SG-Harden',
        status: 'Completed',
        description: 'Hardened security group rule bindings, closing debug port 8080.',
      }
    ],
    logs: [
      '[2026-06-15 10:12:01 UTC] INFO Initiating VPC Security audit and hardening workflow wkf-a0e2d5c1',
      '[2026-06-15 10:12:30 UTC] SUCCESS Scan finished. Found 1 high risk warning on security group sg-bp1882n4.',
      '[2026-06-15 10:13:02 UTC] INFO Sec-SG-Harden: Revoked ingress TCP 0.0.0.0/0 on port 8080.',
      '[2026-06-15 10:14:06 UTC] SUCCESS Hardening validated. All tests green.'
    ]
  }
];
