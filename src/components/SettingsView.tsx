import {useEffect, useState} from 'react';

import {useApplyPlatformDefaultsMutation, useSavePlatformDefaultsMutation} from '../features/runtime/hooks';
import type {TrafficDefaults} from '../types';

interface SettingsViewProps {
  defaults: TrafficDefaults | null;
}

export default function SettingsView({defaults}: SettingsViewProps) {
  const saveMutation = useSavePlatformDefaultsMutation();
  const applyMutation = useApplyPlatformDefaultsMutation();
  const [maximumTrafficGb, setMaximumTrafficGb] = useState(200);
  const [overflowAction, setOverflowAction] = useState('notify');
  const [monitoringEnabled, setMonitoringEnabled] = useState(true);

  useEffect(() => {
    if (!defaults) {
      return;
    }
    setMaximumTrafficGb(defaults.maximumTrafficGb);
    setOverflowAction(defaults.overflowAction);
    setMonitoringEnabled(defaults.monitoringEnabled);
  }, [defaults]);

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div>
        <h1 className="font-space text-2xl font-bold text-primary-ink">系统设置</h1>
        <p className="mt-1 text-sm text-secondary-ink">配置平台默认流量治理参数，并支持显式应用到现有账号。</p>
      </div>

      <section className="rounded-lg border border-hairline-divider bg-surface-white p-6 shadow-xs">
        <div className="grid gap-5 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-primary-ink">默认最大流量（GB）</span>
            <input
              type="number"
              min={1}
              value={maximumTrafficGb}
              onChange={(event) => setMaximumTrafficGb(Number(event.target.value))}
              className="rounded border border-hairline-divider px-3 py-2"
            />
          </label>

          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-primary-ink">溢出动作</span>
            <select
              value={overflowAction}
              onChange={(event) => setOverflowAction(event.target.value)}
              className="rounded border border-hairline-divider px-3 py-2"
            >
              <option value="notify">notify</option>
              <option value="keepalive-job">keepalive-job</option>
            </select>
          </label>
        </div>

        <label className="mt-5 flex items-center gap-3 text-sm text-primary-ink">
          <input
            type="checkbox"
            checked={monitoringEnabled}
            onChange={(event) => setMonitoringEnabled(event.target.checked)}
          />
          默认开启监控
        </label>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            className="rounded bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={saveMutation.isPending}
            onClick={() =>
              saveMutation.mutate({
                maximumTrafficGb,
                overflowAction,
                monitoringEnabled,
              })
            }
          >
            保存默认值
          </button>
          <button
            className="rounded border border-primary px-4 py-2 text-sm font-medium text-primary disabled:opacity-50"
            disabled={applyMutation.isPending}
            onClick={() => applyMutation.mutate()}
          >
            应用到现有账号
          </button>
        </div>

        {applyMutation.data && (
          <p className="mt-4 text-sm text-secondary-ink">
            已更新 {applyMutation.data.updatedCount} 个账号，执行时间 {applyMutation.data.appliedAt}。
          </p>
        )}
      </section>
    </div>
  );
}
