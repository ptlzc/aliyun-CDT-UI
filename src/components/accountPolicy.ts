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
        // BSS OpenAPI — 账单与 CDT 免费额度查询。实例级累计流量实际调用
        // QueryInstanceBill（RAM action bss:QueryInstanceBill）；DescribeBillList
        // 保留以覆盖旧版账单查询路径。DescribeInstanceBill 为升级路径，待后端
        // 迁移后加入。
        'bss:QueryInstanceBill',
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
