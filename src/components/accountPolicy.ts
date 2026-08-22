/** RAM site selected by the managed Alibaba Cloud account. */
export type AliyunSiteType = 'domestic' | 'international';

export const ramConsoleUrls: Record<AliyunSiteType, string> = {
  domestic: 'https://ram.console.aliyun.com/users',
  international: 'https://ram.console.alibabacloud.com/users',
};

/**
 * RAM authorization policy required by the platform for a managed account.
 *
 * Keep this action list aligned with the concrete RPC/OSS operations under
 * apps/server/internal/infra/aliyun and infra/objectstorage. The policy is
 * operation-minimal while Resource remains "*" because the platform creates
 * and discovers resources across user-selected regions.
 */
export const accountPolicyJson = {
  Version: '1',
  Statement: [
    {
      Effect: 'Allow',
      Action: [
        // ECS — region/resource discovery, provisioning and lifecycle
        'ecs:DescribeRegions',
        'ecs:DescribeInstances',
        'ecs:DescribeImages',
        'ecs:DescribeTasks',
        'ecs:DescribeSecurityGroups',
        'ecs:DescribeSecurityGroupAttribute',
        'ecs:CreateSecurityGroup',
        'ecs:AuthorizeSecurityGroup',
        'ecs:RevokeSecurityGroup',
        'ecs:AuthorizeSecurityGroupEgress',
        'ecs:RevokeSecurityGroupEgress',
        'ecs:RunInstances',
        'ecs:StartInstance',
        'ecs:StopInstance',
        'ecs:DeleteInstance',
        'ecs:DescribeInstanceVncUrl',
        'ecs:ImportImage',
        // VPC and EIP networking
        'vpc:DescribeVpcs',
        'vpc:CreateVpc',
        'vpc:DescribeVSwitches',
        'vpc:CreateVSwitch',
        'vpc:DescribeEipAddresses',
        'vpc:AllocateEipAddress',
        'vpc:AssociateEipAddress',
        'vpc:UnassociateEipAddress',
        'vpc:DescribeEipMonitorData',
        // CloudMonitor API DescribeMetricLast maps to this RAM action.
        'cms:QueryMetricLast',
        // CDT cumulative Internet traffic
        'cdt:ListCdtInternetTraffic',
        // BSS OpenAPI exact-operation permission for QueryInstanceBill.
        'bssapi:QueryInstanceBill',
        // OSS image upload/import and object reads
        'oss:ListBuckets',
        'oss:PutBucket',
        'oss:PutObject',
        'oss:GetObject',
      ],
      Resource: '*',
    },
  ],
} as const;

/** The exact paste/copy payload used by every account authorization surface. */
export const accountPolicyJsonText = JSON.stringify(accountPolicyJson, null, 2);

/**
 * Narrow fallback classifier for endpoints that currently expose only a text
 * error rather than a structured permission error type.
 */
export function isPermissionErrorMessage(message: string): boolean {
  return /NoPermission|AccessDenied|Forbidden|\b403\b|权限不足|无权限|未授权/i.test(message);
}
