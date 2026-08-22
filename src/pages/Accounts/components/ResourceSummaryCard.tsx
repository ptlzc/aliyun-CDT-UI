import {KeyRound, MapPin, Server} from 'lucide-react';

import {useInventoryGraphQuery} from '../../../features/runtime/hooks';

interface ResourceSummaryCardProps {
  accountId: string;
}

/**
 * Managed-resource summary strip shown above the account form for existing
 * accounts (ECS / VPC / EIP counters), sourced from the backend inventory
 * graph.
 *
 * @when 账户详情视图（非新建模式）渲染时
 */
export default function ResourceSummaryCard({accountId}: ResourceSummaryCardProps) {
  const {data: graph, isLoading, isError} = useInventoryGraphQuery(accountId);
  const unavailable = isLoading || isError || !graph;

  const ecsRunningCount = unavailable
    ? '—'
    : (graph.nodes ?? []).filter((node) => node.kind === 'ecs' && node.status === 'Running').length;
  const vpcCount = unavailable ? '—' : graph.summary.vpcCount;
  const eipCount = unavailable ? '—' : graph.summary.eipCount;

  return (
    <section className="bg-surface-white border border-hairline-divider rounded-lg p-5 shadow-xs">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-outline">托管资源摘要</h2>
        <span className="text-[11px] text-secondary font-semibold font-mono">
          VPC 通道连接就绪
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-section-layer p-4 rounded border border-hairline-divider/50 flex flex-col gap-0.5">
          <div className="text-secondary-ink flex items-center gap-1.5">
            <Server className="w-3.5 h-3.5" />
            <span className="text-[11px]">ECS 运行实例</span>
          </div>
          <span className="text-xl font-bold font-space text-primary-ink mt-1">{ecsRunningCount} <span className="text-[10px] text-secondary-ink font-normal font-sans">个总计</span></span>
        </div>

        <div className="bg-section-layer p-4 rounded border border-hairline-divider/50 flex flex-col gap-0.5">
          <div className="text-secondary-ink flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            <span className="text-[11px]">VPC 核心专线</span>
          </div>
          <span className="text-xl font-bold font-space text-primary-ink mt-1">{vpcCount} <span className="text-[10px] text-secondary-ink font-normal font-sans">路已联</span></span>
        </div>

        <div className="bg-section-layer p-4 rounded border border-hairline-divider/50 flex flex-col gap-0.5">
          <div className="text-secondary-ink flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5" />
            <span className="text-[11px]">EIP 安全公网</span>
          </div>
          <span className="text-xl font-bold font-space text-primary-ink mt-1">{eipCount} <span className="text-[10px] text-secondary-ink font-normal font-sans">组配置</span></span>
        </div>
      </div>
    </section>
  );
}
