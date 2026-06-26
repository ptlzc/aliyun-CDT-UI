import {useEffect, useState} from 'react';

import type {ApiRegionGroup} from '../lib/api/client';
import {ACTION_OPTIONS} from '../utils/actionLabels';

export type RegionGroupEditorPayload = {
  name: string;
  siteType: string;
  regionPatterns: string[];
  maximumTrafficGb: number;
  overflowAction: string;
  underflowAction: string;
  monitoringEnabled: boolean;
};

interface RegionGroupEditorProps {
  group?: ApiRegionGroup | null;
  onSave: (payload: RegionGroupEditorPayload) => void;
  onCancel: () => void;
}

const SITE_TYPE_OPTIONS = ['domestic', 'international'] as const;

function parsePatterns(input: string): string[] {
  return input
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

export default function RegionGroupEditor({group, onSave, onCancel}: RegionGroupEditorProps) {
  const [name, setName] = useState('');
  const [siteType, setSiteType] = useState<string>('domestic');
  const [regionPatterns, setRegionPatterns] = useState('');
  const [maximumTrafficGb, setMaximumTrafficGb] = useState(0);
  const [overflowAction, setOverflowAction] = useState<string>('notify');
  const [underflowAction, setUnderflowAction] = useState<string>('notify');
  const [monitoringEnabled, setMonitoringEnabled] = useState(true);

  useEffect(() => {
    if (!group) {
      return;
    }
    setName(group.name);
    setSiteType(group.siteType);
    setRegionPatterns((group.regionPatterns || []).join(', '));
  }, [group]);

  const handleSave = () => {
    onSave({
      name,
      siteType,
      regionPatterns: parsePatterns(regionPatterns),
      maximumTrafficGb,
      overflowAction,
      underflowAction,
      monitoringEnabled,
    });
  };

  return (
    <section className="rounded-lg border border-hairline-divider bg-surface-white p-6 shadow-xs">
      <h3 className="font-space text-lg font-bold text-primary-ink">
        {group ? '编辑地区组' : '新建地区组'}
      </h3>

      <div className="mt-4 grid gap-5 md:grid-cols-2">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-primary-ink">地区组名称</span>
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：cn-hangzhou 组"
            className="rounded border border-hairline-divider px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-primary-ink">站点类型</span>
          <select
            value={siteType}
            onChange={(event) => setSiteType(event.target.value)}
            className="rounded border border-hairline-divider px-3 py-2"
          >
            {SITE_TYPE_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm md:col-span-2">
          <span className="font-medium text-primary-ink">地区匹配规则</span>
          <input
            type="text"
            value={regionPatterns}
            onChange={(event) => setRegionPatterns(event.target.value)}
            placeholder="cn-*, ap-southeast-*"
            className="rounded border border-hairline-divider px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-primary-ink">累计流量上限（GB）</span>
          <input
            type="number"
            min={0}
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
            {ACTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span className="font-medium text-primary-ink">欠费/低流量动作</span>
          <select
            value={underflowAction}
            onChange={(event) => setUnderflowAction(event.target.value)}
            className="rounded border border-hairline-divider px-3 py-2"
          >
            {ACTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-3 text-sm text-primary-ink md:col-span-2">
          <input
            type="checkbox"
            checked={monitoringEnabled}
            onChange={(event) => setMonitoringEnabled(event.target.checked)}
          />
          启用监控
        </label>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-white"
          onClick={handleSave}
        >
          保存
        </button>
        <button
          className="rounded border border-hairline-divider px-4 py-2 text-sm font-medium text-secondary-ink"
          onClick={onCancel}
        >
          取消
        </button>
      </div>
    </section>
  );
}
