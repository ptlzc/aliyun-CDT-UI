import {useEffect, useState} from 'react';

import {useSaveInstanceGovernanceMutation, useSaveTrafficPolicyMutation} from '../features/runtime/hooks';
import type {ECSInstance} from '../types';

interface InstanceGovernanceDrawerProps {
  instance: ECSInstance | null;
  onClose: () => void;
}

export default function InstanceGovernanceDrawer({instance, onClose}: InstanceGovernanceDrawerProps) {
  const governanceMutation = useSaveInstanceGovernanceMutation();
  const policyMutation = useSaveTrafficPolicyMutation();
  const [maximumTrafficGb, setMaximumTrafficGb] = useState<number | ''>('');
  const [overflowAction, setOverflowAction] = useState('notify');
  const [monitoringEnabled, setMonitoringEnabled] = useState(true);
  const [policyEnabled, setPolicyEnabled] = useState(true);
  const [thresholdValue, setThresholdValue] = useState(80);
  const [cooldownMinutes, setCooldownMinutes] = useState(30);
  const [policyAction, setPolicyAction] = useState('keepalive-job');

  useEffect(() => {
    if (!instance) {
      return;
    }
    setMaximumTrafficGb(instance.inherited ? '' : instance.trafficLimit);
    setOverflowAction(instance.overflowAction);
    setMonitoringEnabled(instance.monitoringEnabled);
    setPolicyEnabled(instance.trafficPolicy?.enabled ?? true);
    setThresholdValue(instance.trafficPolicy?.thresholdValue ?? 80);
    setCooldownMinutes(instance.trafficPolicy?.cooldownMinutes ?? 30);
    setPolicyAction(instance.trafficPolicy?.action ?? 'keepalive-job');
  }, [instance]);

  if (!instance) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-primary-ink/25">
      <div className="h-full w-full max-w-xl overflow-y-auto bg-surface-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-space text-xl font-bold text-primary-ink">{instance.name}</h2>
            <p className="mt-1 text-sm text-secondary-ink">{instance.accountName} · {instance.id}</p>
          </div>
          <button className="text-sm text-secondary-ink hover:text-primary-ink" onClick={onClose}>
            关闭
          </button>
        </div>

        <section className="mt-6 rounded-lg border border-hairline-divider p-5">
          <h3 className="text-base font-semibold text-primary-ink">Traffic Governance</h3>
          <p className="mt-1 text-xs text-secondary-ink">留空表示继续继承账号默认值。</p>
          <div className="mt-4 grid gap-4">
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-primary-ink">实例最大流量（GB）</span>
              <input
                type="number"
                value={maximumTrafficGb}
                onChange={(event) => setMaximumTrafficGb(event.target.value === '' ? '' : Number(event.target.value))}
                className="rounded border border-hairline-divider px-3 py-2"
                placeholder={`继承当前 ${instance.trafficLimit}`}
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-primary-ink">溢出动作</span>
              <select value={overflowAction} onChange={(event) => setOverflowAction(event.target.value)} className="rounded border border-hairline-divider px-3 py-2">
                <option value="notify">notify</option>
                <option value="keepalive-job">keepalive-job</option>
              </select>
            </label>
            <label className="flex items-center gap-3 text-sm text-primary-ink">
              <input type="checkbox" checked={monitoringEnabled} onChange={(event) => setMonitoringEnabled(event.target.checked)} />
              启用监控
            </label>
            <button
              className="rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              disabled={governanceMutation.isPending}
              onClick={() =>
                governanceMutation.mutate({
                  accountId: instance.accountId,
                  instanceId: instance.id,
                  payload: {
                    maximumTrafficGb: maximumTrafficGb === '' ? undefined : maximumTrafficGb,
                    overflowAction,
                    monitoringEnabled,
                  },
                })
              }
            >
              保存治理设置
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-lg border border-hairline-divider p-5">
          <h3 className="text-base font-semibold text-primary-ink">Traffic Policy / Keepalive</h3>
          <div className="mt-4 grid gap-4">
            <label className="flex items-center gap-3 text-sm text-primary-ink">
              <input type="checkbox" checked={policyEnabled} onChange={(event) => setPolicyEnabled(event.target.checked)} />
              启用实例策略
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-primary-ink">阈值（百分比）</span>
              <input type="number" value={thresholdValue} onChange={(event) => setThresholdValue(Number(event.target.value))} className="rounded border border-hairline-divider px-3 py-2" />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-primary-ink">动作</span>
              <select value={policyAction} onChange={(event) => setPolicyAction(event.target.value)} className="rounded border border-hairline-divider px-3 py-2">
                <option value="keepalive-job">keepalive-job</option>
                <option value="notify">notify</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm">
              <span className="font-medium text-primary-ink">冷却时间（分钟）</span>
              <input type="number" value={cooldownMinutes} onChange={(event) => setCooldownMinutes(Number(event.target.value))} className="rounded border border-hairline-divider px-3 py-2" />
            </label>
            <button
              className="rounded border border-primary px-4 py-2 text-sm font-medium text-primary disabled:opacity-50"
              disabled={policyMutation.isPending}
              onClick={() =>
                policyMutation.mutate({
                  accountId: instance.accountId,
                  payload: {
                    id: instance.trafficPolicy?.id,
                    name: instance.trafficPolicy?.name || `${instance.name}-keepalive`,
                    scopeType: 'instance',
                    scopeId: instance.id,
                    metricName: 'traffic_usage_ratio',
                    thresholdType: 'gte',
                    thresholdValue,
                    action: policyAction,
                    cooldownMinutes,
                    enabled: policyEnabled,
                  },
                })
              }
            >
              保存策略
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
