import {useMemo, useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {Filter, RefreshCw} from 'lucide-react';
import {useOutletContext} from 'react-router-dom';

import AuthPolicyModal from '../../components/AuthPolicyModal';
import {
  accountKeys,
  enrichedKeys,
  mapAccountToViewModel,
  runtimeKeys,
  useCdtFreeQuotaQuery,
  useECSMetricsQuery,
  useECSVncUrlQuery,
  useEnrichedInstances,
  useStartECSInstanceMutation,
  useStopECSInstanceMutation,
} from '../../features/runtime/hooks';
import type {CloudAccount, ECSInstance} from '../../types';
import AccountTrafficBar from './components/AccountTrafficBar';
import InstanceCard from './components/InstanceCard';
import InstanceFirewallModal from './components/InstanceFirewallModal';
import InstanceMetricsModal from './components/InstanceMetricsModal';
import OverQuotaConfirmModal from './components/OverQuotaConfirmModal';
import VncModal from './components/VncModal';
import {INSTANCE_STATUS_LABELS} from './components/instanceLabels';

/**
 * Instances page: search/filter orchestration, per-instance power/VNC/metrics
 * state and the account-level CDT quota / governance panels. The governance
 * drawer stays mounted by the layout shell; "编辑" triggers it through the
 * Outlet context `openInstance` callback.
 *
 * @when 侧边栏点击「ECS 实例列表」或深链 /instances 时渲染
 */
export default function InstancesPage() {
  const {rawAccounts, instances, inventoryLoading} = useEnrichedInstances();
  const {openInstance} = useOutletContext<{openInstance: (instance: ECSInstance) => void}>();
  const queryClient = useQueryClient();
  const [isSyncing, setIsSyncing] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ECSInstance['status']>('ALL');

  // Interactive UI states per instance (SSH + VNC + state modal, power via backend API)
  const [activeStateModalId, setActiveStateModalId] = useState<string | null>(null);
  const [activeVncId, setActiveVncId] = useState<string | null>(null);
  const [activeFirewallId, setActiveFirewallId] = useState<string | null>(null);
  const [pendingStartInstance, setPendingStartInstance] = useState<ECSInstance | null>(null);
  const [tempState, setTempState] = useState<{[key: string]: 'starting' | 'stopping' | null}>({});
  const [statusOverride, setStatusOverride] = useState<{[key: string]: ECSInstance['status']}>({});
  const [powerError, setPowerError] = useState<{[key: string]: string | null}>({});
  const [activePolicyAccount, setActivePolicyAccount] = useState<CloudAccount | null>(null);

  const startMutation = useStartECSInstanceMutation();
  const stopMutation = useStopECSInstanceMutation();
  const cdtQuotaQuery = useCdtFreeQuotaQuery(null);

  // VNC URL and instance metrics queries — only enabled for the active instance
  const activeInstance = instances.find((inst) => inst.id === activeVncId) || null;
  const vncUrlQuery = useECSVncUrlQuery(activeInstance?.accountId || null, activeVncId, Boolean(activeVncId));
  const activeFirewallInstance = instances.find((inst) => inst.id === activeFirewallId) || null;
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

  const groupedByAccount = useMemo(() => {
    const groups = new Map<string, ECSInstance[]>();
    for (const instance of filtered) {
      const key = instance.accountId || instance.accountName || 'unknown';
      const list = groups.get(key);
      if (list) {
        list.push(instance);
      } else {
        groups.set(key, [instance]);
      }
    }
    return Array.from(groups.entries()).map(([accountId, items]) => ({
      accountId,
      accountName: items[0]?.accountName || accountId,
      items,
    }));
  }, [filtered]);

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

  // Open SSH terminal modal for the selected instance
  const openSsh = (instance: ECSInstance) => {
    const url = `/ssh/${encodeURIComponent(instance.accountId)}/${encodeURIComponent(instance.id)}?host=${encodeURIComponent(instance.publicIp)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  // Permission notices on instance cards open the shared auth policy modal for
  // the owning account. rawAccounts covers every graph account, so a missing
  // match is unexpected; if it ever happens, keep the card as-is (no modal).
  const openPolicyModal = (instance: ECSInstance) => {
    const rawAccount = rawAccounts.find((account) => account.id === instance.accountId);
    if (!rawAccount) return;
    setActivePolicyAccount(mapAccountToViewModel(rawAccount));
  };

  const handleSync = () => {
    setIsSyncing(true);
    // Targeted invalidate: graph (all accounts, prefix match) + jobs +
    // accounts. Avoids the previous full invalidate that refetched every
    // query on the page (settings, policies, region groups, …).
    void Promise.all([
      queryClient.invalidateQueries({queryKey: enrichedKeys.all}),
      queryClient.invalidateQueries({queryKey: runtimeKeys.jobs}),
      queryClient.invalidateQueries({queryKey: accountKeys.all}),
    ]).then(() => {
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
            {status === 'ALL' ? '全部' : INSTANCE_STATUS_LABELS[status]}
          </button>
        ))}
      </div>

      {/* Account-level traffic panel: CDT free quota + effective governance source layer */}
      {/* Account-level traffic bar is rendered per account group below. */}

      {/* Bento Grid Layout */}
      {inventoryLoading && instances.length === 0 ? (
        <InstanceSkeletonGrid />
      ) : (
        <>
          {groupedByAccount.map((group) => (
            <section key={group.accountId} className="flex flex-col gap-4">
              <div className="flex items-center justify-between border-b border-hairline-divider pb-2">
                <h2 className="text-base font-bold text-primary-ink">
                  {group.accountName}
                  <span className="ml-2 text-xs font-normal text-secondary-ink">{group.accountId}</span>
                  <span className="ml-3">
                    <AccountTrafficBar
                      usage={group.items[0]?.accountTrafficUsage}
                      limit={group.items[0]?.accountTrafficLimit}
                      unit={group.items[0]?.accountTrafficUnit}
                    />
                  </span>
                </h2>
                <span className="text-xs text-secondary-ink">{group.items.length} 台实例</span>
              </div>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2">
                {group.items.map((instance) => (
                  <InstanceCard
                    key={instance.id}
                    instance={instance}
                    detailsLoading={false}
                    loadingStatus={tempState[instance.id]}
                    effectiveStatus={statusOverride[instance.id] || instance.status}
                    powerError={powerError[instance.id]}
                    onTogglePower={togglePower}
                    onOpenVnc={openVnc}
                    onOpenSsh={openSsh}
                    onOpenFirewall={(inst) => setActiveFirewallId(inst.id)}
                    onToggleStateModal={(inst) => setActiveStateModalId(activeStateModalId === inst.id ? null : inst.id)}
                    onManageInstance={openInstance}
                    onViewPolicy={openPolicyModal}
                  />
                ))}
              </div>
            </section>
          ))}

          {filtered.length === 0 && (
            <div className="rounded border border-dashed border-hairline-divider bg-surface-white p-10 text-center text-sm text-secondary-ink">
              没有匹配的实例。
            </div>
          )}
        </>
      )}

      {/* SSH Terminal Modal */}
      {activeFirewallInstance && (
        <InstanceFirewallModal
          instance={activeFirewallInstance}
          onClose={() => setActiveFirewallId(null)}
          onViewPolicy={() => openPolicyModal(activeFirewallInstance)}
        />
      )}

      {/* VNC URL Modal */}
      {activeVncId && activeInstance && (
        <VncModal
          instance={activeInstance}
          vncUrl={vncUrlQuery.data}
          vncLoading={vncUrlQuery.isLoading}
          vncError={vncUrlQuery.isError ? (vncUrlQuery.error instanceof Error ? vncUrlQuery.error.message : '未知错误') : null}
          onClose={() => setActiveVncId(null)}
        />
      )}

      {/* Instance State Modal — CMS metrics */}
      {activeStateModalId && stateModalInstance && (
        <InstanceMetricsModal
          instance={stateModalInstance}
          metrics={metricsQuery.data}
          metricsLoading={metricsQuery.isLoading}
          metricsError={metricsQuery.isError ? (metricsQuery.error instanceof Error ? metricsQuery.error.message : '未知错误') : null}
          onClose={() => setActiveStateModalId(null)}
        />
      )}

      {/* Start Confirmation Modal — when CDT free quota is exceeded */}
      {pendingStartInstance && cdtQuotaQuery.data && (
        <OverQuotaConfirmModal
          instance={pendingStartInstance}
          quotaSnapshot={cdtQuotaQuery.data}
          onCancel={() => setPendingStartInstance(null)}
          onConfirm={confirmStartOverQuota}
        />
      )}

      {/* Shared Auth Policy Modal — opened from a permission error notice */}
      {activePolicyAccount && (
        <AuthPolicyModal
          accountName={activePolicyAccount.name}
          siteType={activePolicyAccount.providerRegion === 'Aliyun International' ? 'international' : 'domestic'}
          onClose={() => setActivePolicyAccount(null)}
        />
      )}
    </div>
  );
}

/**
 * Loading skeleton grid shown while the first instance batch is being fetched.
 *
 * @when 实例列表首次加载（无数据）时渲染
 */
function InstanceSkeletonGrid() {
  return (
    <div role="status" aria-label="正在加载实例列表" className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-2">
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
  );
}
