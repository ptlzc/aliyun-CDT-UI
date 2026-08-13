import {Activity, AlertTriangle, Monitor, RefreshCw} from 'lucide-react';

import type {ECSInstance} from '../../../types';
import {regionNameZh} from '../../../utils/regionNames';
import {instanceStateLabel} from './instanceLabels';

interface InstanceCardProps {
  instance: ECSInstance;
  /** Per-instance transient power state ('starting' / 'stopping'). */
  loadingStatus: 'starting' | 'stopping' | null;
  /** Status after local power overrides (backend status otherwise). */
  effectiveStatus: ECSInstance['status'];
  powerError: string | null;
  onTogglePower: (instance: ECSInstance, effectiveStatus: ECSInstance['status']) => void;
  onOpenVnc: (instance: ECSInstance) => void;
  onToggleStateModal: (instance: ECSInstance) => void;
  onManageInstance: (instance: ECSInstance) => void;
}

interface TrafficUsageErrorVariant {
  /** Tailwind classes for the notice container (credential/network/no-data/permission). */
  containerClass: string;
  /** Copy shown when the backend did not include an errorReason. */
  fallbackText: string;
}

/**
 * Per-source variants for the cumulative traffic error notice. cdt-* entries
 * keep the legacy copy/styles; bss-* entries mirror BSS classification
 * (bss-no-data carries billing-delay semantics, bss-permission-error points
 * at bss:DescribeBillList, bss-api-error points at the DescribeInstanceBill
 * upgrade path).
 *
 * @when 实例卡片累计流量监测错误分支渲染
 */
const TRAFFIC_USAGE_ERROR_VARIANTS: Record<string, TrafficUsageErrorVariant> = {
  'cdt-error': {
    containerClass: 'border-signal-amber/30 bg-signal-amber/[0.06] text-signal-amber',
    fallbackText: 'CDT 流量查询无权限，请在账号管理中为该账号授权 cdt:ListCdtInternetTraffic',
  },
  'cdt-permission-error': {
    containerClass: 'border-signal-amber/30 bg-signal-amber/[0.06] text-signal-amber',
    fallbackText: 'CDT 流量查询无权限，请在账号管理中为该账号授权 cdt:ListCdtInternetTraffic',
  },
  'cdt-network-error': {
    containerClass: 'border-primary/30 bg-primary/[0.06] text-primary',
    fallbackText: 'CDT 接口网络错误（非权限问题），请检查服务器到阿里云 API 的网络连通性',
  },
  'cdt-credential-error': {
    containerClass: 'border-recovery-red/30 bg-recovery-red/[0.06] text-recovery-red',
    fallbackText: '凭据验证失败，请检查 AccessKey Secret 是否正确',
  },
  'cdt-no-data': {
    containerClass: 'border-hairline-divider bg-emphasis-layer text-secondary-ink',
    fallbackText: '该实例暂无 CDT 累计流量数据',
  },
  'bss-permission-error': {
    containerClass: 'border-signal-amber/30 bg-signal-amber/[0.06] text-signal-amber',
    fallbackText: '缺少 bss:DescribeBillList 权限，请在账号管理中为该账号授权',
  },
  'bss-network-error': {
    containerClass: 'border-primary/30 bg-primary/[0.06] text-primary',
    fallbackText: 'BSS 接口网络错误（非权限问题），请检查服务器到阿里云 API 的网络连通性',
  },
  'bss-api-error': {
    containerClass: 'border-primary/30 bg-primary/[0.06] text-primary',
    fallbackText: 'BSS 账单接口不可用，请联系管理员升级到 DescribeInstanceBill',
  },
  'bss-credential-error': {
    containerClass: 'border-recovery-red/30 bg-recovery-red/[0.06] text-recovery-red',
    fallbackText: '凭据验证失败，请检查 AccessKey Secret 是否正确',
  },
  'bss-no-data': {
    containerClass: 'border-hairline-divider bg-emphasis-layer text-secondary-ink',
    fallbackText: '该实例本月暂无 CDT 出账明细（出账有小时级延迟）',
  },
};

/**
 * Single ECS instance bento card: identity, specs, traffic usage / quota bar,
 * alerts, power error and the action row (power / VNC / state / manage).
 *
 * @when 实例列表过滤后逐实例渲染
 */
export default function InstanceCard({
  instance,
  loadingStatus,
  effectiveStatus,
  powerError,
  onTogglePower,
  onOpenVnc,
  onToggleStateModal,
  onManageInstance,
}: InstanceCardProps) {
  const isBooting = loadingStatus === 'starting';
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

  // Unknown / successful sources (bss-cumulative, …) fall through to the progress bar.
  const trafficUsageErrorVariant = instance.trafficUsageSource
    ? TRAFFIC_USAGE_ERROR_VARIANTS[instance.trafficUsageSource]
    : undefined;

  return (
    <div
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
              {instanceStateLabel(effectiveStatus)}
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
          {trafficUsageErrorVariant ? (
            <>
              <span className="block font-sans text-[10px] font-bold uppercase tracking-wider text-signal-amber">
                累计流量监测
              </span>
              <div
                className={`rounded-md border px-2 py-1.5 text-[10px] leading-relaxed ${trafficUsageErrorVariant.containerClass}`}
              >
                {instance.trafficUsageErrorReason || trafficUsageErrorVariant.fallbackText}
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
      {powerError && (
        <div className="flex items-start gap-2 rounded-md border border-recovery-red/20 bg-recovery-red/[0.04] p-2.5 text-[11px] text-recovery-red">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1 space-y-0.5">
            <div className="font-semibold">电源操作失败</div>
            <div className="text-[10px] leading-relaxed">{powerError}</div>
          </div>
        </div>
      )}

      {/* Bottom footer button actions */}
      <div className="mt-auto flex items-center justify-between border-t border-hairline-divider/50 pt-3">
        <div className="flex items-center gap-2">
          {/* Power button: text label, red 停止 when running, blue 启动 when stopped */}
          {isStopped ? (
            <button
              onClick={() => onTogglePower(instance, effectiveStatus)}
              disabled={loadingStatus !== null && loadingStatus !== undefined}
              className="cursor-pointer rounded border border-healthy-green/30 bg-healthy-green/10 px-3 py-1 text-xs font-semibold text-healthy-green transition-colors hover:bg-healthy-green/20 disabled:opacity-40"
              title="启动实例"
            >
              {loadingStatus === 'starting' ? '启动中...' : '启动'}
            </button>
          ) : (
            <button
              onClick={() => onTogglePower(instance, effectiveStatus)}
              disabled={loadingStatus !== null && loadingStatus !== undefined}
              className="cursor-pointer rounded border border-recovery-red/30 bg-recovery-red/10 px-3 py-1 text-xs font-semibold text-recovery-red transition-colors hover:bg-recovery-red/20 disabled:opacity-40"
              title="停止实例"
            >
              {loadingStatus === 'stopping' ? '停止中...' : '停止'}
            </button>
          )}

          {/* VNC connection button */}
          <button
            onClick={() => onOpenVnc(instance)}
            className="cursor-pointer rounded border border-hairline-divider px-3 py-1 text-xs font-medium text-secondary-ink transition-colors hover:bg-emphasis-layer hover:text-primary-ink"
            title="连接 VNC 远程终端"
          >
            <Monitor className="mr-1 inline h-3.5 w-3.5" />
            连接 VNC
          </button>

          {/* Instance state modal button */}
          <button
            onClick={() => onToggleStateModal(instance)}
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
}
