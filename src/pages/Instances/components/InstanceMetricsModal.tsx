import {motion, AnimatePresence} from 'motion/react';
import {X} from 'lucide-react';

import type {ApiECSMetricsSnapshot} from '../../../lib/api/client';
import type {ECSInstance} from '../../../types';
import {regionNameZh} from '../../../utils/regionNames';
import {instanceStateLabel} from './instanceLabels';

interface InstanceMetricsModalProps {
  instance: ECSInstance;
  metrics: ApiECSMetricsSnapshot | undefined;
  metricsLoading: boolean;
  metricsError: string | null;
  onClose: () => void;
}

/**
 * Instance state + CMS metrics modal: power state badge, cloud-monitor metric
 * grid and cached instance info.
 *
 * @when 实例卡片点击「状态」后渲染
 */
export default function InstanceMetricsModal({instance, metrics, metricsLoading, metricsError, onClose}: InstanceMetricsModalProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{opacity: 0}}
        animate={{opacity: 1}}
        exit={{opacity: 0}}
        className="fixed inset-0 z-50 flex items-center justify-center bg-primary-ink/40 backdrop-blur-xs"
        onClick={onClose}
      >
        <motion.div
          initial={{scale: 0.95, opacity: 0}}
          animate={{scale: 1, opacity: 1}}
          exit={{scale: 0.95, opacity: 0}}
          className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-lg bg-surface-white p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-bold text-primary-ink">实例监控指标</h3>
              <p className="mt-1 text-xs text-secondary-ink">{instance.name} · {instance.id}</p>
            </div>
            <button onClick={onClose} className="text-secondary-ink hover:text-primary-ink">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-3">
            {/* Power state badge */}
            <div className="rounded border border-hairline-divider bg-emphasis-layer/50 p-4">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-secondary-ink">阿里云 ECS 实时状态</span>
              {metricsLoading && <span className="mt-1 block text-sm text-secondary-ink">查询中...</span>}
              {metricsError && (
                <span className="mt-1 block text-sm text-recovery-red">
                  查询失败：{metricsError}
                </span>
              )}
              {metrics && (
                <span
                  className={`mt-1 inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-bold ${
                    metrics.state === 'Running'
                      ? 'border-[#C8E6C9] bg-[#E8F5E9] text-[#1B5E20]'
                      : metrics.state === 'Stopped'
                        ? 'border-hairline-divider bg-section-layer text-secondary-ink'
                        : 'border-[#FFECB3] bg-[#FFF8E1] text-[#F57F17]'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      metrics.state === 'Running' ? 'animate-pulse bg-healthy-green' : 'bg-secondary-ink'
                    }`}
                  />
                  {instanceStateLabel(metrics.state)}
                </span>
              )}
            </div>

            {/* CMS Metrics grid */}
            {metrics && (metrics.metrics?.length ?? 0) > 0 && (
              <div className="rounded border border-hairline-divider bg-emphasis-layer/50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-secondary-ink">云监控指标</span>
                  <span className="text-[9px] text-secondary-ink">采集时间: {metrics.collectedAt}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {metrics.metrics.map((metric) => (
                    <div key={metric.metricName} className="rounded border border-hairline-divider bg-surface-white p-2.5">
                      <span className="block text-[10px] text-secondary-ink">{metric.displayName}</span>
                      <span className="mt-0.5 block font-mono text-sm font-semibold text-primary-ink">
                        {metric.value}{metric.unit && <span className="ml-0.5 text-[10px] font-normal text-secondary-ink">{metric.unit}</span>}
                      </span>
                      {/* Mini progress bar for percentage metrics */}
                      {metric.unit === '%' && (
                        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-hairline-divider">
                          <div
                            className={`h-full rounded-full ${metric.value > 80 ? 'bg-recovery-red' : metric.value > 60 ? 'bg-signal-amber' : 'bg-healthy-green'}`}
                            style={{width: `${Math.min(100, metric.value)}%`}}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Local cached info */}
            <div className="rounded border border-hairline-divider bg-emphasis-layer/50 p-4 text-xs text-secondary-ink">
              <div className="font-semibold text-primary-ink">实例信息</div>
              <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-0.5">
                <div>规格: {instance.type}</div>
                <div>地域: {regionNameZh(instance.regionId)}</div>
                <div>可用区: {instance.zone}</div>
                <div>公网 IP: {instance.publicIp}</div>
                <div>内网 IP: {instance.privateIp}</div>
                <div>监控: {instance.monitoringEnabled ? '开启' : '关闭'}</div>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
