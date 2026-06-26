import {useEffect, useState} from 'react';

import {
  useApplyPlatformDefaultsMutation,
  useCreateRegionGroupMutation,
  useDeleteRegionGroupMutation,
  useRegionGroupsQuery,
  useSavePlatformDefaultsMutation,
  useUpdateRegionGroupMutation,
} from '../features/runtime/hooks';
import type {ApiRegionGroup} from '../lib/api/client';
import type {TrafficDefaults} from '../types';
import RegionGroupEditor, {type RegionGroupEditorPayload} from './RegionGroupEditor';
import {ACTION_OPTIONS, actionLabelZh} from '../utils/actionLabels';

interface SettingsViewProps {
  defaults: TrafficDefaults | null;
}

export default function SettingsView({defaults}: SettingsViewProps) {
  const saveMutation = useSavePlatformDefaultsMutation();
  const applyMutation = useApplyPlatformDefaultsMutation();
  const [maximumTrafficGb, setMaximumTrafficGb] = useState(200);
  const [overflowAction, setOverflowAction] = useState('notify');
  const [monitoringEnabled, setMonitoringEnabled] = useState(true);

  const regionGroupsQuery = useRegionGroupsQuery();
  const createRegionGroupMutation = useCreateRegionGroupMutation();
  const updateRegionGroupMutation = useUpdateRegionGroupMutation();
  const deleteRegionGroupMutation = useDeleteRegionGroupMutation();

  const [editorState, setEditorState] = useState<{mode: 'create' | 'edit'; group: ApiRegionGroup | null} | null>(null);

  useEffect(() => {
    if (!defaults) {
      return;
    }
    setMaximumTrafficGb(defaults.maximumTrafficGb);
    setOverflowAction(defaults.overflowAction);
    setMonitoringEnabled(defaults.monitoringEnabled);
  }, [defaults]);

  const regionGroups = regionGroupsQuery.data || [];

  const handleEditorSave = (payload: RegionGroupEditorPayload) => {
    if (editorState?.mode === 'edit' && editorState.group) {
      const original = editorState.group;
      updateRegionGroupMutation.mutate({
        id: original.id,
        payload: {
          id: original.id,
          name: payload.name,
          siteType: payload.siteType,
          regionPatterns: payload.regionPatterns,
          createdAt: original.createdAt,
          updatedAt: original.updatedAt,
        },
      });
    } else {
      createRegionGroupMutation.mutate({
        name: payload.name,
        siteType: payload.siteType,
        regionPatterns: payload.regionPatterns,
      });
    }
    setEditorState(null);
  };

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div>
        <h1 className="font-space text-2xl font-bold text-primary-ink">系统设置</h1>
        <p className="mt-1 text-sm text-secondary-ink">配置平台默认累计流量治理参数，并支持显式应用到现有账号。</p>
      </div>

      <section className="rounded-lg border border-hairline-divider bg-surface-white p-6 shadow-xs">
        <div className="grid gap-5 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            <span className="font-medium text-primary-ink">默认累计流量上限（GB）</span>
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
              <option value="notify">通知</option>
              <option value="keepalive-job">保活任务</option>
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

      <section className="rounded-lg border border-hairline-divider bg-surface-white p-6 shadow-xs">
        <h2 className="font-space text-lg font-bold text-primary-ink">地区组配置</h2>
        <p className="mt-1 text-sm text-secondary-ink">配置分地区组的流量上限规则，支持全局默认值之上的地区组覆盖。</p>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded border border-hairline-divider bg-section-layer p-4 text-sm">
            <span className="block font-medium text-primary-ink">全局默认值</span>
            <span className="mt-1 block text-xs text-secondary-ink">
              上限 {defaults?.maximumTrafficGb ?? '-'} GB · 溢出 {defaults?.overflowAction ? actionLabelZh(defaults.overflowAction) : '-'} · 监控 {defaults?.monitoringEnabled ? '开启' : '关闭'}
            </span>
          </div>
          <div className="rounded border border-hairline-divider bg-section-layer p-4 text-sm">
            <span className="block font-medium text-primary-ink">地区组规则</span>
            <span className="mt-1 block text-xs text-secondary-ink">
              已配置 {regionGroups.length} 个地区组，优先级高于全局默认值。
            </span>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-primary-ink">地区组列表</h3>
          <button
            className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-white"
            onClick={() => setEditorState({mode: 'create', group: null})}
          >
            新建地区组
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-3">
          {regionGroups.length === 0 && (
            <p className="rounded border border-dashed border-hairline-divider p-4 text-center text-xs text-secondary-ink">
              暂无地区组，点击「新建地区组」开始配置。
            </p>
          )}
          {regionGroups.map((group) => (
            <div key={group.id} className="flex flex-col gap-2 rounded border border-hairline-divider p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-primary-ink">{group.name}</span>
                  <span className="font-mono text-xs text-secondary-ink">{group.regionPatterns.join(', ')}</span>
                </div>
                <span className="rounded border border-hairline-divider bg-emphasis-layer px-2 py-0.5 text-[10px] font-semibold text-secondary-ink">
                  {group.siteType}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded border border-primary px-3 py-1 text-xs font-medium text-primary"
                  onClick={() => setEditorState({mode: 'edit', group})}
                >
                  编辑
                </button>
                <button
                  className="rounded border border-hairline-divider px-3 py-1 text-xs font-medium text-secondary-ink"
                  onClick={() => deleteRegionGroupMutation.mutate(group.id)}
                >
                  删除
                </button>
              </div>
            </div>
          ))}
        </div>

        {editorState && (
          <div className="mt-5">
            <RegionGroupEditor
              group={editorState.mode === 'edit' ? editorState.group : null}
              onSave={handleEditorSave}
              onCancel={() => setEditorState(null)}
            />
          </div>
        )}
      </section>
    </div>
  );
}
