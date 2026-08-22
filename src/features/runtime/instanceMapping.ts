import type {ApiAccount, ApiResourceGraph, ApiTrafficPolicy} from '@/lib/api/client';
import type {ECSInstance} from '@/types';

/** Copy used when a graph traffic track is unavailable. */
const TRAFFIC_UNAVAILABLE_ALERT_COPY: Record<string, string> = {
  'bss-no-data': '该实例本月暂无 CDT 出账明细（出账有小时级延迟）。',
  'bss-api-error': 'BSS 账单接口不可用，请联系管理员升级到 DescribeInstanceBill。',
  'cdt-region-shared': '该地域多个 EIP 共用流量, 无法按实例拆分。',
};

function resolveExternalIP(graph: ApiResourceGraph, instanceId: string): string {
  const eipEdge = graph.edges.find((edge) => edge.type === 'bound-to' && edge.to === instanceId);
  if (eipEdge) {
    const eipNode = graph.nodes.find((node) => node.id === eipEdge.from && node.kind === 'eip');
    const ipAddress = eipNode?.metadata?.ipAddress;
    if (ipAddress) return ipAddress;
  }
  return '未绑定';
}

function normalizeInstanceStatus(node: ApiResourceGraph['nodes'][number], metadata?: Record<string, string>): ECSInstance['status'] {
  const effectiveMax = Number.parseFloat(metadata?.trafficEffectiveMaximumGb || '0') || 0;
  const current = node.trafficUsage?.available ? node.trafficUsage.value : 0;
  if (node.status !== 'Running') return 'Stopped';
  if (effectiveMax > 0 && current / effectiveMax >= 0.8) return 'Attention';
  return 'Running';
}

export function mapGraphToInstances(
  graphs: ApiResourceGraph[],
  accounts: ApiAccount[],
  policiesByAccount: Record<string, ApiTrafficPolicy[]>,
): ECSInstance[] {
  return graphs.flatMap((graph) => {
    const account = accounts.find((item) => item.id === graph.accountId);
    const accountName = account?.name || graph.accountId;
    const accountPolicies = policiesByAccount[graph.accountId] || [];
    return graph.nodes
      .filter((node) => node.kind === 'ecs')
      .map((node) => {
        const metadata = node.metadata || {};
        const maximumTraffic = Number.parseFloat(metadata.trafficEffectiveMaximumGb || '0') || 0;
        const inherited = !metadata.trafficOverrideMaximumGb && !metadata.trafficOverrideOverflowAction && !metadata.trafficOverrideMonitoringEnabled;
        const policy = accountPolicies.find((item) => item.scopeType === 'instance' && item.scopeId === node.id);
        const usage = node.trafficUsage;
        const rate = node.trafficRate;
        const currentTraffic = usage?.available ? usage.value : 0;
        const alerts: string[] = [];
        if (maximumTraffic > 0 && currentTraffic / maximumTraffic >= 0.8) {
          alerts.push(`累计流量使用已达配置上限的 ${Math.round((currentTraffic / maximumTraffic) * 100)}%。`);
        }
        if (!usage?.available) {
          const sourceAlert = usage?.source ? TRAFFIC_UNAVAILABLE_ALERT_COPY[usage.source] : undefined;
          alerts.push(sourceAlert || '该实例的累计流量数据当前不可用。');
        }
        if (metadata.trafficMonitoringEnabled === 'false') alerts.push('该实例的监控已关闭。');
        return {
          id: node.id,
          accountId: graph.accountId,
          accountName,
          name: node.name,
          status: normalizeInstanceStatus(node, metadata),
          type: metadata.instanceType || 'ecs.unknown',
          zone: node.zoneId || node.regionId || '-',
          regionId: node.regionId || account?.regionId || '',
          publicIp: resolveExternalIP(graph, node.id),
          privateIp: metadata.privateIps || metadata.primaryPrivateIp || '未提供',
          trafficUsage: usage?.available ? Math.round(usage.value * 100) / 100 : null,
          trafficUsageUnit: usage?.unit || 'GB',
          trafficUsageSource: usage?.source,
          trafficUsageErrorReason: usage?.errorReason,
          trafficUsageCollectedAt: usage?.collectedAt,
          trafficRate: rate?.available ? Math.round(rate.value * 100) / 100 : null,
          trafficRateUnit: rate?.unit || 'Mbps',
          trafficRateSource: rate?.source,
          trafficRateCollectedAt: rate?.collectedAt,
          trafficLimit: Math.round(maximumTraffic),
          monitoringEnabled: metadata.trafficMonitoringEnabled !== 'false',
          overflowAction: metadata.trafficEffectiveOverflowAction || 'notify',
          inherited,
          alerts,
          trafficPolicy: policy
            ? {
                id: policy.id,
                name: policy.name,
                thresholdValue: policy.thresholdValue,
                thresholdType: policy.thresholdType,
                action: policy.action,
                cooldownMinutes: policy.cooldownMinutes,
                enabled: policy.enabled,
              }
            : null,
        };
      });
  });
}
