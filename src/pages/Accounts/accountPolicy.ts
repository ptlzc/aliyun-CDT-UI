import type {CloudAccount} from '../../types';

/**
 * RAM authorization policy required by the platform for a managed account.
 * Covers ECS lifecycle, VPC/EIP networking, CMS metrics, CDT quota queries,
 * BSS billing and OSS image import. Shown verbatim in the auth modal and
 * copyable as JSON.
 */
export const accountPolicyJson = {
  Version: '1',
  Statement: [
    {
      Effect: 'Allow',
      Action: [
        // ECS — 实例生命周期与查询
        'ecs:DescribeInstances',
        'ecs:RunInstances',
        'ecs:StartInstance',
        'ecs:StopInstance',
        'ecs:DeleteInstance',
        'ecs:DescribeInstanceVncUrl',
        'ecs:DescribeImages',
        'ecs:ImportImage',
        'ecs:DescribeTasks',
        'ecs:DescribeRegions',
        // ECS — 安全组
        'ecs:DescribeSecurityGroups',
        'ecs:CreateSecurityGroup',
        'ecs:AuthorizeSecurityGroup',
        'ecs:RevokeSecurityGroup',
        // VPC — 网络与弹性公网 IP
        'vpc:DescribeVpcs',
        'vpc:CreateVpc',
        'vpc:DescribeVSwitches',
        'vpc:CreateVSwitch',
        'vpc:DescribeEipAddresses',
        'vpc:AllocateEipAddress',
        'vpc:AssociateEipAddress',
        'vpc:UnassociateEipAddress',
        'vpc:DescribeEipMonitorData',
        // 云监控 — 流量速率指标（API 名 DescribeMetricLast，RAM action 为 QueryMetricLast）
        'cms:QueryMetricLast',
        // CDT — 累计互联网流量查询
        'cdt:ListCdtInternetTraffic',
        // BSS OpenAPI — 账单与 CDT 免费额度查询（RAM action 为 bss:DescribeBillList，覆盖 QueryBill/QueryBillDetail 等）
        'bss:DescribeBillList',
        // OSS — 镜像导入上传与存储桶管理
        'oss:ListBuckets',
        'oss:PutBucket',
        'oss:PutObject',
        'oss:GetObject',
        'oss:DeleteObject',
      ],
      Resource: '*',
    },
  ],
};

// 状态枚举 → 中文展示映射（后端枚举值不翻译，仅显示层映射）
export const ACCOUNT_STATUS_LABELS: Record<CloudAccount['status'], string> = {
  'Active': '运行中',
  'Sync Delayed': '同步延迟',
  'Auth Failed': '认证失败',
  'Inactive': '已停用',
};

export function statusLabel(status: CloudAccount['status']): string {
  return ACCOUNT_STATUS_LABELS[status];
}

/**
 * Status badge tailwind classes. Unknown statuses fall back to the muted
 * style so a future backend enum value never renders unstyled.
 *
 * @when 账户列表行与详情元数据的同步状态徽章渲染时
 */
export function getStatusStyle(status: CloudAccount['status']): string {
  switch (status) {
    case 'Active':
      return 'bg-[#E6F4EA] text-healthy-green border-[#C3E6CB]';
    case 'Sync Delayed':
      return 'bg-[#FFF4E5] text-signal-amber border-[#FFE0B2]';
    case 'Auth Failed':
      return 'bg-[#FFEBEE] text-recovery-red border-[#FFCDD2]';
    case 'Inactive':
      return 'bg-emphasis-layer text-outline border-outline-variant';
    default:
      return 'bg-emphasis-layer text-outline border-outline-variant';
  }
}
