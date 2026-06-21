import {useMemo, useState} from 'react';
import {ChevronRight, Filter, SlidersHorizontal, Globe} from 'lucide-react';

import type {ECSInstance} from '../types';

interface InstancesViewProps {
  instances: ECSInstance[];
  onManageInstance: (instance: ECSInstance) => void;
}

export default function InstancesView({instances, onManageInstance}: InstancesViewProps) {
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ECSInstance['status']>('ALL');

  const filtered = useMemo(() => {
    return instances.filter((instance) => {
      const matchesText =
        instance.name.toLowerCase().includes(filterText.toLowerCase()) ||
        instance.id.toLowerCase().includes(filterText.toLowerCase()) ||
        instance.accountName.toLowerCase().includes(filterText.toLowerCase());
      if (statusFilter === 'ALL') {
        return matchesText;
      }
      return matchesText && instance.status === statusFilter;
    });
  }, [filterText, instances, statusFilter]);

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold font-space text-primary-ink">
            ECS 实例列表
          </h1>
          <p className="mt-1 text-xs text-secondary-ink">所有公网 IP、流量阈值和监控状态均来自后端图谱与治理数据。</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative w-56">
            <Filter className="absolute left-3 top-2.5 h-3.5 w-3.5 text-outline" />
            <input
              value={filterText}
              onChange={(event) => setFilterText(event.target.value)}
              placeholder="搜索实例或账号"
              className="w-full rounded border border-hairline-divider bg-surface-white py-2 pl-9 pr-3 text-xs focus:border-primary focus:outline-none"
            />
          </div>
          <button className="rounded border border-hairline-divider bg-surface-white px-3 py-2 text-xs text-secondary-ink">
            <SlidersHorizontal className="inline-block h-3.5 w-3.5" /> 过滤
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['ALL', 'Running', 'Attention', 'Stopped'] as const).map((status) => (
          <button
            key={status}
            className={`rounded px-3 py-1.5 text-xs ${
              statusFilter === status ? 'bg-primary text-white' : 'border border-hairline-divider bg-surface-white text-secondary-ink'
            }`}
            onClick={() => setStatusFilter(status)}
          >
            {status === 'ALL' ? '全部' : status}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((instance) => (
          <article key={instance.id} className="rounded-lg border border-hairline-divider bg-surface-white p-5 shadow-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-medium text-primary-ink">{instance.name}</h2>
                <p className="mt-1 text-xs text-secondary-ink">{instance.accountName}</p>
              </div>
              <span className="rounded bg-emphasis-layer px-2 py-1 text-xs text-secondary-ink">{instance.status}</span>
            </div>

            <div className="mt-4 space-y-2 text-xs text-secondary-ink">
              <div>公网: {instance.publicIp}</div>
              <div>内网: {instance.privateIp}</div>
              <div>
                累计流量: {instance.trafficUsage === null ? '不可用' : `${instance.trafficUsage}/${instance.trafficLimit} ${instance.trafficUsageUnit}`}
              </div>
              <div>
                当前速率: {instance.trafficRate === null ? '不可用' : `${instance.trafficRate} ${instance.trafficRateUnit}`}
              </div>
              <div>监控: {instance.monitoringEnabled ? '开启' : '关闭'} · 继承: {instance.inherited ? '是' : '否'}</div>
            </div>

            {instance.alerts.length > 0 && (
              <div className="mt-4 rounded border border-signal-amber/30 bg-signal-amber/[0.05] p-3 text-xs text-signal-amber">
                {instance.alerts[0]}
              </div>
            )}

            <button
              className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
              onClick={() => onManageInstance(instance)}
            >
              管理 <ChevronRight className="h-4 w-4" />
            </button>
          </article>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded border border-dashed border-hairline-divider bg-surface-white p-10 text-center text-sm text-secondary-ink">
          没有匹配的实例。
        </div>
      )}
    </div>
  );
}
