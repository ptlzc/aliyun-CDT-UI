import {useMemo, useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {Filter, Monitor, Activity, AlertTriangle, RefreshCw, X} from 'lucide-react';
import {motion, AnimatePresence} from 'motion/react';

import {
  useCdtFreeQuotaQuery,
  useEffectiveTrafficGovernanceQuery,
  useECSInstanceStateQuery,
  useECSMetricsQuery,
  useECSVncUrlQuery,
  useStartECSInstanceMutation,
  useStopECSInstanceMutation,
} from '../features/runtime/hooks';
import type {ApiECSMetricsSnapshot, ApiTrafficQuotaSnapshot} from '../lib/api/client';
import type {ECSInstance} from '../types';
import {regionNameZh} from '../utils/regionNames';
import {actionLabelZh} from '../utils/actionLabels';

interface InstancesViewProps {
  instances: ECSInstance[];
  isLoading?: boolean;
  onManageInstance: (instance: ECSInstance) => void;
  accountId?: string | null;
}

const SOURCE_LAYER_LABELS: Record<string, string> = {
  'instance': '实例级',
  'region-group': '地区组',
  'platform-default': '全局默认',
  'global': '全局默认',
};

function sourceLayerBadgeClass(label: string): string {
  if (label === '实例级') {
    return 'border-[#C8E6C9] bg-[#E8F5E9] text-[#1B5E20]';
  }
  if (label === '地区组') {
    return 'border-[#FFECB3] bg-[#FFF8E1] text-[#F57F17]';
  }
  return 'border-hairline-divider bg-section-layer text-secondary-ink';
}

function quotaBarColor(usedGb: number, capacityGb: number): string {
  if (capacityGb <= 0) {
    return 'bg-hairline-divider';
  }
  const ratio = usedGb / capacityGb;
  if (ratio > 1) {
    return 'bg-recovery-red';
  }
  if (ratio >= 0.8) {
    return 'bg-signal-amber';
  }
  return 'bg-healthy-green';
}

function CdtFreeQuotaCard({snapshot}: {snapshot: ApiTrafficQuotaSnapshot}) {
  const domesticRatio = snapshot.domesticCapacityGb > 0
    ? Math.min(100, (snapshot.domesticUsedGb / snapshot.domesticCapacityGb) * 100)
    : 0;
  const internationalRatio = snapshot.internationalCapacityGb > 0
    ? Math.min(100, (snapshot.internationalUsedGb / snapshot.internationalCapacityGb) * 100)
    : 0;

  return (
    <section className="rounded-lg border border-hairline-divider bg-surface-white p-6 shadow-xs">
      <h2 className="font-space text-lg font-bold text-primary-ink">CDT 免费额度</h2>
      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-secondary-ink">
        <span>数据延迟: {snapshot.dataDelayHours} 小时</span>
        <span>账单月份: {snapshot.billingMonth}</span>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="block font-sans text-[10px] font-bold uppercase tracking-wider text-secondary-ink">中国内地</span>
          <div className="h-1.5 w-full overflow-hidden rounded-full border border-hairline-divider/30 bg-surface-white">
            <div
              className={`h-full rounded-full ${quotaBarColor(snapshot.domesticUsedGb, snapshot.domesticCapacityGb)}`}
              style={{width: `${domesticRatio}%`}}
            />
          </div>
          <span className="font-mono text-[10px] text-primary-ink">
            {snapshot.domesticUsedGb} / {snapshot.domesticCapacityGb} GB
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="block font-sans text-[10px] font-bold uppercase tracking-wider text-secondary-ink">非中国内地</span>
          <div className="h-1.5 w-full overflow-hidden rounded-full border border-hairline-divider/30 bg-surface-white">
            <div
              className={`h-full rounded-full ${quotaBarColor(snapshot.internationalUsedGb, snapshot.internationalCapacityGb)}`}
              style={{width: `${internationalRatio}%`}}
            />
          </div>
          <span className="font-mono text-[10px] text-primary-ink">
            {snapshot.internationalUsedGb} / {snapshot.internationalCapacityGb} GB
          </span>
        </div>
      </div>
    </section>
  );
}

export default function InstancesView({instances, isLoading = false, onManageInstance, accountId = null}: InstancesViewProps) {
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ECSInstance['status']>('ALL');

  // Interactive UI states per instance (VNC + state modal, power via backend API)
  const [activeStateModalId, setActiveStateModalId] = useState<string | null>(null);
  const [activeVncId, setActiveVncId] = useState<string | null>(null);
  const [pendingStartInstance, setPendingStartInstance] = useState<ECSInstance | null>(null);
  const [tempState, setTempState] = useState<{[key: string]: 'starting' | 'stopping' | null}>({});
  const [statusOverride, setStatusOverride] = useState<{[key: string]: ECSInstance['status']}>({});
  const [powerError, setPowerError] = useState<{[key: string]: string | null}>({});

  const startMutation = useStartECSInstanceMutation();
  const stopMutation = useStopECSInstanceMutation();
  const cdtQuotaQuery = useCdtFreeQuotaQuery(accountId);
  const effectiveGovernanceQuery = useEffectiveTrafficGovernanceQuery(accountId);

  // VNC URL and instance metrics queries — only enabled for the active instance
  const activeInstance = instances.find((inst) => inst.id === activeVncId) || null;
  const vncUrlQuery = useECSVncUrlQuery(activeInstance?.accountId || null, activeVncId, Boolean(activeVncId));
  const stateModalInstance = instances.find((inst) => inst.id === activeStateModalId) || null;
  const metricsQuery = useECSMetricsQuery(stateModalInstance?.accountId || null, activeStateModalId, Boolean(activeStateModalId));

  const filtered = useMemo(() => {
    return instances.filter((instance) => {
      const matchesText =
        instance.name.toLowerCase().includes(filterText.toLowerCase()) ||
        instance.id.toLowerCase().includes(filterText.toLowerCase()) ||
        instance.accountName.toLowerCase().includes(filterText.toLowerCase());
      if (statusFilter === 'ALL') {
        return matchesText;
      }
      return matchesText && (statusOverride[instance.id] || instance.status) === statusFilter;
    });
  }, [filterText, instances, statusFilter, statusOverride]);

  // Power toggle via backend start/stop API
  // For start: pre-check CDT free quota; if over capacity, require confirmation
  const togglePower = async (instance: ECSInstance, currentStatus: ECSInstance['status']) => {
    if (tempState[instance.id]) return;

    const isStarting = currentStatus === 'Stopped';

    // Pre-check: if starting and CDT quota data shows over-capacity, prompt for confirmation
    if (isStarting && cdtQuotaQuery.data) {
      const snapshot = cdtQuotaQuery.data;
      const domesticOver = snapshot.domesticUsedGb > snapshot.domesticCapacityGb;
      const internationalOver = snapshot.internationalUsedGb > snapshot.internationalCapacityGb;
      if (domesticOver || internationalOver) {
        setPendingStartInstance(instance);
        return;
      }
    }

    await executePowerToggle(instance, isStarting);
  };

  const executePowerToggle = async (instance: ECSInstance, isStarting: boolean) => {
    setTempState((prev) => ({...prev, [instance.id]: isStarting ? 'starting' : 'stopping'}));
    setPowerError((prev) => ({...prev, [instance.id]: null}));

    try {
      if (isStarting) {
        await startMutation.mutateAsync({accountId: instance.accountId, instanceId: instance.id});
      } else {
        await stopMutation.mutateAsync({accountId: instance.accountId, instanceId: instance.id});
      }
      setStatusOverride((prev) => ({...prev, [instance.id]: isStarting ? 'Running' : 'Stopped'}));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setPowerError((prev) => ({...prev, [instance.id]: message}));
    } finally {
      setTempState((prev) => ({...prev, [instance.id]: null}));
    }
  };

  const confirmStartOverQuota = async () => {
    if (!pendingStartInstance) return;
    const instance = pendingStartInstance;
    setPendingStartInstance(null);
    await executePowerToggle(instance, true);
  };

  // Open VNC connection in new window
  const openVnc = (instance: ECSInstance) => {
    setActiveVncId(instance.id);
  };

  // Build Alibaba Cloud VNC web terminal URL from VncUrl
  // The VncUrl returned by API is a URL-encoded wss endpoint.
  // The web terminal URL format: https://ecs.console.aliyun.com/vnc/index.htm?instanceId=xxx&vncUrl=xxx&isWindows=false
  const buildVncWebUrl = (vncUrl: string, instance: ECSInstance): string => {
    const decoded = decodeURIComponent(vncUrl);
    const regionId = instance.regionId || '';
    const consoleBase = `https://ecs.console.aliyun.com/${regionId}/instance/vnc?instanceId=${instance.id}`;
    return `${consoleBase}&vncUrl=${encodeURIComponent(decoded)}&isWindows=false&from=cdt-manager`;
  };

  const handleSync = () => {
    setIsSyncing(true);
    void queryClient.invalidateQueries().then(() => {
      setIsSyncing(false);
    });
  };

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* Top action header section */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold font-space text-primary-ink">ECS 实例列表</h1>
          <p className="mt-1 text-xs text-secondary-ink">
            监控和调配跨物理隔离 AZ 的阿里云云服务器实例，绑定虚拟专用网络（VPC）并配置宽带限额。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-56">
            <Filter className="absolute left-3 top-2.5 h-3.5 w-3.5 text-secondary-ink" />
            <input
              value={filterText}
              onChange={(event) => setFilterText(event.target.value)}
              placeholder="搜索实例或账号"
              className="w-full rounded border border-hairline-divider bg-surface-white py-2 pl-9 pr-3 text-xs focus:border-primary focus:outline-none"
            />
          </div>
          <button
            onClick={handleSync}
            disabled={isSyncing}
            title="同步实例数据与 CDT 权限状态"
            className="flex items-center gap-1.5 rounded border border-hairline-divider bg-surface-white px-3 py-2 text-xs font-medium text-primary-ink hover:bg-emphasis-layer transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>同步</span>
          </button>
        </div>
      </div>

      {/* Status filter tabs */}
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

      {/* Account-level traffic panel: CDT free quota + effective governance source layer */}
      {accountId && (
        <div className="grid gap-4 md:grid-cols-2">
          {cdtQuotaQuery.data && <CdtFreeQuotaCard snapshot={cdtQuotaQuery.data} />}
          {effectiveGovernanceQuery.data && (
            <section className="rounded-lg border border-hairline-divider bg-surface-white p-6 shadow-xs">
              <h2 className="font-space text-lg font-bold text-primary-ink">生效治理来源</h2>
              <p className="mt-1 text-xs text-secondary-ink">当前账号生效的累计流量治理规则来源层级。</p>
              <div className="mt-4 flex items-center gap-3">
                <span
                  className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-[10px] font-bold ${
                    sourceLayerBadgeClass(SOURCE_LAYER_LABELS[effectiveGovernanceQuery.data.sourceLayer] || effectiveGovernanceQuery.data.sourceLayer)
                  }`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {SOURCE_LAYER_LABELS[effectiveGovernanceQuery.data.sourceLayer] || effectiveGovernanceQuery.data.sourceLayer}
                </span>
                <span className="text-xs text-secondary-ink">
                  上限 {effectiveGovernanceQuery.data.maximumTrafficGb} GB · 溢出 {actionLabelZh(effectiveGovernanceQuery.data.overflowAction)}
                </span>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Bento Grid Layout */}
      {isLoading && instances.length === 0 ? (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({length: 6}).map((_, idx) => (
            <div
              key={idx}
              className="relative flex flex-col gap-4 overflow-hidden rounded-lg border border-hairline-divider bg-surface-white p-5"
            >
              <div className="absolute bottom-0 left-0 top-0 w-1 bg-hairline-divider" />

              {/* Skeleton: top title row */}
              <div className="flex items-start justify-between">
                <div className="flex flex-col gap-1.5">
                  <div className="h-3.5 w-28 animate-pulse rounded bg-emphasis-layer" />
                  <div className="h-2.5 w-36 animate-pulse rounded bg-section-layer" />
                  <div className="h-2.5 w-20 animate-pulse rounded bg-section-layer" />
                </div>
                <div className="h-5 w-16 animate-pulse rounded border border-hairline-divider bg-emphasis-layer" />
              </div>

              {/* Skeleton: specifications subcard */}
              <div className="flex flex-col gap-3 rounded border border-hairline-divider/50 bg-workspace-canvas p-3">
                <div className="grid grid-cols-2 gap-y-2">
                  <div className="flex flex-col gap-1">
                    <div className="h-2.5 w-12 animate-pulse rounded bg-section-layer" />
                    <div className="h-3 w-20 animate-pulse rounded bg-emphasis-layer" />
                  </div>
                  <div className="flex flex-col gap-1">
                    <div className="h-2.5 w-12 animate-pulse rounded bg-section-layer" />
                    <div className="h-3 w-20 animate-pulse rounded bg-emphasis-layer" />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="h-2.5 w-16 animate-pulse rounded bg-section-layer" />
                  <div className="h-5 w-full animate-pulse rounded border border-hairline-divider bg-surface-white" />
                  <div className="flex items-center justify-between">
                    <div className="h-2.5 w-24 animate-pulse rounded bg-section-layer" />
                    <div className="h-2.5 w-16 animate-pulse rounded bg-section-layer" />
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="h-2.5 w-24 animate-pulse rounded bg-section-layer" />
                  <div className="h-1.5 w-full animate-pulse rounded-full bg-emphasis-layer" />
                  <div className="flex items-center justify-between">
                    <div className="h-2.5 w-20 animate-pulse rounded bg-emphasis-layer" />
                    <div className="h-2.5 w-14 animate-pulse rounded bg-section-layer" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="h-2.5 w-24 animate-pulse rounded bg-section-layer" />
                    <div className="h-2.5 w-12 animate-pulse rounded bg-section-layer" />
                  </div>
                </div>
              </div>

              {/* Skeleton: bottom button area */}
              <div className="mt-auto flex items-center justify-between border-t border-hairline-divider/50 pt-3">
                <div className="flex gap-1">
                  <div className="h-7 w-7 animate-pulse rounded bg-emphasis-layer" />
                  <div className="h-7 w-7 animate-pulse rounded bg-emphasis-layer" />
                  <div className="h-7 w-7 animate-pulse rounded bg-emphasis-layer" />
                </div>
                <div className="flex items-center gap-2.5">
                  <div className="h-2.5 w-14 animate-pulse rounded bg-section-layer" />
                  <div className="h-3.5 w-px animate-pulse bg-hairline-divider" />
                  <div className="h-3 w-16 animate-pulse rounded bg-emphasis-layer" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((instance) => {
          const loadingStatus = tempState[instance.id];
          const isBooting = loadingStatus === 'starting';
          const effectiveStatus = statusOverride[instance.id] || instance.status;
          const isStopped = effectiveStatus === 'Stopped';

          // Traffic indicators
          let trafficDisplayStr = '不可用';
          let remainingDisplayStr = '';
          let progressVal = 0;
          let isWarningOnLimit = false;

          if (instance.trafficUsage === null || instance.trafficLimit <= 0) {
            trafficDisplayStr = isStopped ? '未运行' : '不可用';
            remainingDisplayStr = isStopped ? '剩余 -' : '剩余 -';
          } else {
            const usedGb = instance.trafficUsage;
            const limitGb = instance.trafficLimit;
            const remainingGb = Math.max(0, limitGb - usedGb);
            progressVal = Math.min(100, Math.floor((usedGb / limitGb) * 100));
            const unit = instance.trafficUsageUnit || 'GB';

            if (limitGb >= 1000) {
              trafficDisplayStr = `${usedGb} ${unit} / ${(limitGb / 1000).toFixed(1)} TB`;
            } else {
              trafficDisplayStr = `${usedGb} ${unit} / ${limitGb} ${unit}`;
            }

            if (remainingGb >= 1000) {
              remainingDisplayStr = `剩余 ${(remainingGb / 1000).toFixed(1)} TB`;
            } else {
              remainingDisplayStr = `剩余 ${remainingGb.toFixed(1)} ${unit}`;
            }

            if (progressVal > 80) isWarningOnLimit = true;
          }

          const rateDisplayStr =
            instance.trafficRate === null ? '不可用' : `${instance.trafficRate} ${instance.trafficRateUnit || 'Mbps'}`;

          return (
            <div
              key={instance.id}
              className={`relative flex flex-col gap-4 overflow-hidden rounded-lg border bg-surface-white p-5 transition-shadow hover:shadow-md ${
                effectiveStatus === 'Attention' ? 'border-l-signal-amber shadow-[0_0_8px_rgba(180,83,9,0.04)]' : 'border-hairline-divider'
              }`}
            >
              <div
                className={`absolute bottom-0 left-0 top-0 w-1 ${
                  effectiveStatus === 'Attention'
                    ? 'bg-signal-amber'
                    : effectiveStatus === 'Running'
                      ? 'bg-healthy-green'
                      : 'bg-hairline-divider'
                }`}
              />

              {/* Card top banner details */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-bold text-primary-ink">
                    {instance.name}
                    {instance.regionId && (
                      <span className="rounded bg-emphasis-layer px-1.5 py-0.5 text-[10px] font-medium text-secondary-ink">
                        [{regionNameZh(instance.regionId)}]
                      </span>
                    )}
                  </h3>
                  <span className="mt-1 block select-all font-mono text-[11px] text-secondary-ink">{instance.id}</span>
                  <span className="mt-0.5 block text-[10px] text-secondary-ink">{instance.accountName}</span>
                </div>

                {/* Machine State details */}
                <div className="flex flex-col items-end gap-1">
                  {loadingStatus ? (
                    <span className="flex items-center gap-1 rounded border border-primary-container bg-emphasis-layer px-2.5 py-1 text-[10px] font-semibold text-primary">
                      <RefreshCw className="h-3 w-3 animate-spin text-primary" />
                      {isBooting ? '正在启动...' : '正在入库停机...'}
                    </span>
                  ) : (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-[10px] font-bold ${
                        effectiveStatus === 'Running'
                          ? 'border-[#C8E6C9] bg-[#E8F5E9] text-[#1B5E20]'
                          : effectiveStatus === 'Attention'
                            ? 'border-[#FFECB3] bg-[#FFF8E1] text-[#F57F17]'
                            : 'border-hairline-divider bg-section-layer text-secondary-ink'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          effectiveStatus === 'Running'
                            ? 'animate-pulse bg-healthy-green'
                            : effectiveStatus === 'Attention'
                              ? 'animate-pulse bg-signal-amber'
                              : 'bg-secondary-ink'
                        }`}
                      />
                      {effectiveStatus}
                    </span>
                  )}
                </div>
              </div>

              {/* Specifications Block Card */}
              <div className="flex flex-col gap-3 rounded border border-hairline-divider/50 bg-workspace-canvas p-3 text-xs">
                <div className="grid grid-cols-2 gap-y-2">
                  <div>
                    <span className="mb-0.5 block font-sans text-[10px] font-bold uppercase tracking-wider text-secondary-ink">
                      规格类型
                    </span>
                    <span className="font-mono text-xs font-semibold text-primary-ink">{instance.type}</span>
                  </div>
                  <div>
                    <span className="mb-0.5 block font-sans text-[10px] font-bold uppercase tracking-wider text-secondary-ink">
                      交换机网域
                    </span>
                    <span className="text-xs font-semibold text-primary-ink">{instance.zone}</span>
                  </div>
                </div>

                {/* Public ip detail mapping */}
                <div>
                  <span className="mb-1 block font-sans text-[10px] font-bold uppercase tracking-wider text-secondary-ink">
                    绑定公网 IP
                  </span>
                  <div className="flex items-center justify-between rounded border border-hairline-divider bg-surface-white px-2.5 py-1 font-mono text-xs text-primary-ink shadow-2xs">
                    <span className={instance.publicIp === '未绑定' ? 'italic text-secondary-ink' : 'font-semibold'}>
                      {instance.publicIp}
                    </span>
                    {instance.publicIp !== '未绑定' && (
                      <span className="font-sans text-[10px] font-bold text-healthy-green">✓ 已绑定</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-secondary-ink">
                    <span>内网: {instance.privateIp}</span>
                    <span>监控: {instance.monitoringEnabled ? '开启' : '关闭'}</span>
                  </div>
                </div>

                {/* Traffic remaining display progress bar */}
                <div className="mt-1 flex flex-col gap-1">
                  {instance.trafficUsageSource === 'cdt-error' || instance.trafficUsageSource === 'cdt-permission-error' || instance.trafficUsageSource === 'cdt-network-error' || instance.trafficUsageSource === 'cdt-credential-error' || instance.trafficUsageSource === 'cdt-no-data' ? (
                    <>
                      <span className="block font-sans text-[10px] font-bold uppercase tracking-wider text-signal-amber">
                        累计流量监测
                      </span>
                      <div className={`rounded-md border px-2 py-1.5 text-[10px] leading-relaxed ${
                        instance.trafficUsageSource === 'cdt-network-error'
                          ? 'border-primary/30 bg-primary/[0.06] text-primary'
                          : instance.trafficUsageSource === 'cdt-credential-error'
                            ? 'border-recovery-red/30 bg-recovery-red/[0.06] text-recovery-red'
                            : instance.trafficUsageSource === 'cdt-no-data'
                              ? 'border-hairline-divider bg-emphasis-layer text-secondary-ink'
                              : 'border-signal-amber/30 bg-signal-amber/[0.06] text-signal-amber'
                      }`}>
                        {instance.trafficUsageErrorReason || (
                          instance.trafficUsageSource === 'cdt-network-error'
                            ? 'CDT 接口网络错误（非权限问题），请检查服务器到阿里云 API 的网络连通性'
                            : instance.trafficUsageSource === 'cdt-credential-error'
                              ? '凭据验证失败，请检查 AccessKey Secret 是否正确'
                              : instance.trafficUsageSource === 'cdt-no-data'
                                ? '该实例暂无 CDT 累计流量数据'
                                : 'CDT 流量查询无权限，请在账号管理中为该账号授权 cdt:ListCdtInternetTraffic'
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="block font-sans text-[10px] font-bold uppercase tracking-wider text-secondary-ink">
                        {isStopped ? '剩余流量' : '累计流量监测'}
                      </span>
                      <div className="h-1.5 w-full overflow-hidden rounded-full border border-hairline-divider/30 bg-surface-white">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            isWarningOnLimit ? 'bg-recovery-red' : effectiveStatus === 'Attention' ? 'bg-signal-amber' : 'bg-primary-container'
                          }`}
                          style={{width: `${progressVal}%`}}
                        />
                      </div>
                      <div className="flex items-center justify-between font-mono text-[10px] font-medium">
                        <span className="text-primary-ink">{trafficDisplayStr}</span>
                        <span className={isWarningOnLimit ? 'font-bold text-recovery-red' : 'text-secondary-ink'}>
                          {remainingDisplayStr}
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between font-mono text-[10px] text-secondary-ink">
                    <span>当前速率: {rateDisplayStr}</span>
                    <span>继承: {instance.inherited ? '是' : '否'}</span>
                  </div>
                </div>
              </div>

              {/* Warning box if Attention */}
              {effectiveStatus === 'Attention' && instance.alerts.length > 0 && (
                <div className="flex items-start gap-2 rounded-md border border-signal-amber/20 bg-signal-amber/[0.04] p-2.5 text-[11px] text-signal-amber">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="flex-1 space-y-0.5">
                    <div className="font-semibold">节点监控报警</div>
                    {instance.alerts.map((alert, alertIndex) => (
                      <div key={alertIndex} className="text-[10px] leading-relaxed text-secondary-ink">
                        {alert}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Power operation error */}
              {powerError[instance.id] && (
                <div className="flex items-start gap-2 rounded-md border border-recovery-red/20 bg-recovery-red/[0.04] p-2.5 text-[11px] text-recovery-red">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="flex-1 space-y-0.5">
                    <div className="font-semibold">电源操作失败</div>
                    <div className="text-[10px] leading-relaxed">{powerError[instance.id]}</div>
                  </div>
                </div>
              )}

              {/* Bottom footer button actions */}
              <div className="mt-auto flex items-center justify-between border-t border-hairline-divider/50 pt-3">
                <div className="flex items-center gap-2">
                  {/* Power button: text label, red 停止 when running, blue 启动 when stopped */}
                  {isStopped ? (
                    <button
                      onClick={() => togglePower(instance, effectiveStatus)}
                      disabled={loadingStatus !== null && loadingStatus !== undefined}
                      className="cursor-pointer rounded border border-healthy-green/30 bg-healthy-green/10 px-3 py-1 text-xs font-semibold text-healthy-green transition-colors hover:bg-healthy-green/20 disabled:opacity-40"
                      title="启动实例"
                    >
                      {loadingStatus === 'starting' ? '启动中...' : '启动'}
                    </button>
                  ) : (
                    <button
                      onClick={() => togglePower(instance, effectiveStatus)}
                      disabled={loadingStatus !== null && loadingStatus !== undefined}
                      className="cursor-pointer rounded border border-recovery-red/30 bg-recovery-red/10 px-3 py-1 text-xs font-semibold text-recovery-red transition-colors hover:bg-recovery-red/20 disabled:opacity-40"
                      title="停止实例"
                    >
                      {loadingStatus === 'stopping' ? '停止中...' : '停止'}
                    </button>
                  )}

                  {/* VNC connection button */}
                  <button
                    onClick={() => openVnc(instance)}
                    className="cursor-pointer rounded border border-hairline-divider px-3 py-1 text-xs font-medium text-secondary-ink transition-colors hover:bg-emphasis-layer hover:text-primary-ink"
                    title="连接 VNC 远程终端"
                  >
                    <Monitor className="mr-1 inline h-3.5 w-3.5" />
                    连接 VNC
                  </button>

                  {/* Instance state modal button */}
                  <button
                    onClick={() => setActiveStateModalId(activeStateModalId === instance.id ? null : instance.id)}
                    className="cursor-pointer rounded border border-hairline-divider px-3 py-1 text-xs font-medium text-secondary-ink transition-colors hover:bg-emphasis-layer hover:text-primary-ink"
                    title="查看实例状态"
                  >
                    <Activity className="mr-1 inline h-3.5 w-3.5" />
                    状态
                  </button>
                </div>

                <button
                  onClick={() => onManageInstance(instance)}
                  className="cursor-pointer text-xs font-semibold text-primary hover:text-primary-container"
                >
                  编辑
                </button>
              </div>
            </div>
          );
        })}
          </div>

          {filtered.length === 0 && (
            <div className="rounded border border-dashed border-hairline-divider bg-surface-white p-10 text-center text-sm text-secondary-ink">
              没有匹配的实例。
            </div>
          )}
        </>
      )}

      {/* VNC URL Modal */}
      <AnimatePresence>
        {activeVncId && activeInstance && (
          <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            className="fixed inset-0 z-50 flex items-center justify-center bg-primary-ink/40 backdrop-blur-xs"
            onClick={() => setActiveVncId(null)}
          >
            <motion.div
              initial={{scale: 0.95, opacity: 0}}
              animate={{scale: 1, opacity: 1}}
              exit={{scale: 0.95, opacity: 0}}
              className="w-full max-w-lg rounded-lg bg-surface-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-base font-bold text-primary-ink">连接 VNC 远程终端</h3>
                  <p className="mt-1 text-xs text-secondary-ink">{activeInstance.name} · {activeInstance.id}</p>
                </div>
                <button onClick={() => setActiveVncId(null)} className="text-secondary-ink hover:text-primary-ink">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4">
                {vncUrlQuery.isLoading && (
                  <div className="rounded border border-hairline-divider bg-emphasis-layer/50 p-4 text-sm text-secondary-ink">
                    正在获取 VNC 连接地址...
                  </div>
                )}
                {vncUrlQuery.isError && (
                  <div className="rounded border border-recovery-red/30 bg-recovery-red/5 p-4 text-sm text-recovery-red">
                    获取 VNC 地址失败：{vncUrlQuery.error instanceof Error ? vncUrlQuery.error.message : '未知错误'}
                  </div>
                )}
                {vncUrlQuery.data && (
                  <div className="flex flex-col gap-3">
                    <div className="rounded border border-hairline-divider bg-emphasis-layer/50 p-3 text-xs text-secondary-ink">
                      <div className="font-semibold text-primary-ink">VNC 连接已就绪</div>
                      <div className="mt-1">点击下方按钮在新窗口打开阿里云 VNC 管理终端。连接地址有效期为 15 秒，请尽快使用。</div>
                    </div>
                    <a
                      href={buildVncWebUrl(vncUrlQuery.data, activeInstance)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cursor-pointer rounded bg-primary px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-primary-container"
                    >
                      打开 VNC 终端
                    </a>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instance State Modal — CMS metrics */}
      <AnimatePresence>
        {activeStateModalId && stateModalInstance && (
          <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            className="fixed inset-0 z-50 flex items-center justify-center bg-primary-ink/40 backdrop-blur-xs"
            onClick={() => setActiveStateModalId(null)}
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
                  <p className="mt-1 text-xs text-secondary-ink">{stateModalInstance.name} · {stateModalInstance.id}</p>
                </div>
                <button onClick={() => setActiveStateModalId(null)} className="text-secondary-ink hover:text-primary-ink">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="mt-4 flex flex-col gap-3">
                {/* Power state badge */}
                <div className="rounded border border-hairline-divider bg-emphasis-layer/50 p-4">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-secondary-ink">阿里云 ECS 实时状态</span>
                  {metricsQuery.isLoading && <span className="mt-1 block text-sm text-secondary-ink">查询中...</span>}
                  {metricsQuery.isError && (
                    <span className="mt-1 block text-sm text-recovery-red">
                      查询失败：{metricsQuery.error instanceof Error ? metricsQuery.error.message : '未知错误'}
                    </span>
                  )}
                  {metricsQuery.data && (
                    <span
                      className={`mt-1 inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-bold ${
                        metricsQuery.data.state === 'Running'
                          ? 'border-[#C8E6C9] bg-[#E8F5E9] text-[#1B5E20]'
                          : metricsQuery.data.state === 'Stopped'
                            ? 'border-hairline-divider bg-section-layer text-secondary-ink'
                            : 'border-[#FFECB3] bg-[#FFF8E1] text-[#F57F17]'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          metricsQuery.data.state === 'Running' ? 'animate-pulse bg-healthy-green' : 'bg-secondary-ink'
                        }`}
                      />
                      {metricsQuery.data.state}
                    </span>
                  )}
                </div>

                {/* CMS Metrics grid */}
                {metricsQuery.data && (metricsQuery.data.metrics?.length ?? 0) > 0 && (
                  <div className="rounded border border-hairline-divider bg-emphasis-layer/50 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-secondary-ink">云监控指标</span>
                      <span className="text-[9px] text-secondary-ink">采集时间: {metricsQuery.data.collectedAt}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {metricsQuery.data.metrics.map((metric) => (
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
                    <div>规格: {stateModalInstance.type}</div>
                    <div>地域: {regionNameZh(stateModalInstance.regionId)}</div>
                    <div>可用区: {stateModalInstance.zone}</div>
                    <div>公网 IP: {stateModalInstance.publicIp}</div>
                    <div>内网 IP: {stateModalInstance.privateIp}</div>
                    <div>监控: {stateModalInstance.monitoringEnabled ? '开启' : '关闭'}</div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Start Confirmation Modal — when CDT free quota is exceeded */}
      <AnimatePresence>
        {pendingStartInstance && cdtQuotaQuery.data && (
          <motion.div
            initial={{opacity: 0}}
            animate={{opacity: 1}}
            exit={{opacity: 0}}
            className="fixed inset-0 z-50 flex items-center justify-center bg-primary-ink/40 backdrop-blur-xs"
            onClick={() => setPendingStartInstance(null)}
          >
            <motion.div
              initial={{scale: 0.95, opacity: 0}}
              animate={{scale: 1, opacity: 1}}
              exit={{scale: 0.95, opacity: 0}}
              className="w-full max-w-md rounded-lg bg-surface-white p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-signal-amber" />
                <div className="flex-1">
                  <h3 className="text-base font-bold text-primary-ink">启动确认</h3>
                  <p className="mt-1 text-sm text-secondary-ink">
                    当前 CDT 免费额度已超出容量，启动实例可能产生额外流量费用。是否确认启动？
                  </p>
                  <div className="mt-3 rounded border border-signal-amber/30 bg-signal-amber/5 p-3 text-xs">
                    {cdtQuotaQuery.data.domesticUsedGb > cdtQuotaQuery.data.domesticCapacityGb && (
                      <div className="text-signal-amber">
                        中国内地: {cdtQuotaQuery.data.domesticUsedGb} / {cdtQuotaQuery.data.domesticCapacityGb} GB（已超容量）
                      </div>
                    )}
                    {cdtQuotaQuery.data.internationalUsedGb > cdtQuotaQuery.data.internationalCapacityGb && (
                      <div className="text-signal-amber">
                        非中国内地: {cdtQuotaQuery.data.internationalUsedGb} / {cdtQuotaQuery.data.internationalCapacityGb} GB（已超容量）
                      </div>
                    )}
                  </div>
                  <div className="mt-4 flex justify-end gap-2">
                    <button
                      onClick={() => setPendingStartInstance(null)}
                      className="cursor-pointer rounded border border-hairline-divider px-4 py-1.5 text-xs font-medium text-secondary-ink hover:bg-emphasis-layer"
                    >
                      取消
                    </button>
                    <button
                      onClick={confirmStartOverQuota}
                      className="cursor-pointer rounded bg-signal-amber px-4 py-1.5 text-xs font-medium text-white hover:bg-signal-amber/80"
                    >
                      确认启动
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
