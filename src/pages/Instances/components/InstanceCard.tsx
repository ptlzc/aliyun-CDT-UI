import {useState} from 'react';
import {Activity, AlertTriangle, Check, Copy, Monitor, RefreshCw, ShieldCheck, Terminal} from 'lucide-react';

import type {ECSInstance} from '../../../types';
import {regionNameZh} from '../../../utils/regionNames';
import {instanceStateLabel} from './instanceLabels';
import InstanceSoftwarePanel from './InstanceSoftwarePanel';

interface InstanceCardProps {
  instance: ECSInstance;
  /** True while live traffic/governance details are loading for this card. */
  detailsLoading: boolean;
  /** Per-instance transient power state ('starting' / 'stopping'). */
  loadingStatus: 'starting' | 'stopping' | null;
  /** Status after local power overrides (backend status otherwise). */
  effectiveStatus: ECSInstance['status'];
  powerError: string | null;
  onTogglePower: (instance: ECSInstance, effectiveStatus: ECSInstance['status']) => void;
  onOpenVnc: (instance: ECSInstance) => void;
  onOpenSsh: (instance: ECSInstance) => void;
  onOpenFirewall: (instance: ECSInstance) => void;
  onToggleStateModal: (instance: ECSInstance) => void;
  onManageInstance: (instance: ECSInstance) => void;
  /** Opens the shared auth policy modal for the instance account (permission errors). */
  onViewPolicy?: (instance: ECSInstance) => void;
}

function TrafficDetailsSkeleton() {
  return (
    <div role="status" aria-label="正在加载流量详情" className="mt-1 flex min-h-14 flex-col gap-2">
      <div className="h-2.5 w-24 animate-pulse rounded bg-section-layer" />
      <div className="h-1.5 w-full animate-pulse rounded-full bg-emphasis-layer" />
      <div className="flex items-center justify-between">
        <div className="h-2.5 w-24 animate-pulse rounded bg-emphasis-layer" />
        <div className="h-2.5 w-16 animate-pulse rounded bg-section-layer" />
      </div>
    </div>
  );
}

interface IpCopyCellProps {
  /** Distinguishes public/private copy feedback and aria labels. */
  field: 'public' | 'private';
  value: string;
  /** False for the 未绑定 sentinel: no copy affordance, italic grey text. */
  copyable: boolean;
  /** True while this cell shows the copied Check feedback. */
  copied: boolean;
  onCopy: (field: 'public' | 'private', value: string) => void;
}

/**
 * Single IP cell in the 2-col public/private grid: monospace box styled like
 * the legacy public-IP box, click-to-copy on both the IP text and the icon
 * button (touch friendly).
 *
 * @when 实例卡片公网/内网 IP 并排格子渲染
 */
function IpCopyCell({field, value, copyable, copied, onCopy}: IpCopyCellProps) {
  const ipLabel = field === 'public' ? '公网 IP' : '内网 IP';
  return (
    <div className="flex items-center justify-between rounded border border-hairline-divider bg-surface-white px-2.5 py-1 font-mono text-xs text-primary-ink shadow-2xs">
      <span
        onClick={copyable ? () => onCopy(field, value) : undefined}
        className={copyable ? 'cursor-pointer select-all font-semibold' : 'italic text-secondary-ink'}
      >
        {value}
      </span>
      {copyable && (
        <button
          type="button"
          onClick={() => onCopy(field, value)}
          aria-label={copied ? `已复制${ipLabel}` : `复制${ipLabel}`}
          title={copied ? '已复制' : '复制'}
          className="cursor-pointer p-0.5 text-outline transition-colors hover:text-primary-ink"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-healthy-green" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );
}

interface TrafficUsageErrorVariant {
  /** Tailwind classes for the notice container (credential/network/no-data/permission). */
  containerClass: string;
  /** Copy shown when the backend did not include an errorReason. */
  fallbackText: string;
  /** Permission errors are clickable and open the shared auth policy modal. */
  permission?: boolean;
}

/**
 * Per-source variants for the cumulative traffic error notice. cdt-* entries
 * keep the legacy copy/styles (cdt-region-shared carries the cannot-split
 * semantics for regions where several EIPs share eip traffic); bss-* entries
 * mirror BSS classification
 * (bss-no-data carries billing-delay semantics, bss-permission-error points
 * at bss:QueryInstanceBill, bss-api-error points at the DescribeInstanceBill
 * upgrade path). Both permission variants render in recovery-red and open the
 * full RAM policy script on click.
 *
 * @when 实例卡片累计流量监测错误分支渲染
 */
const TRAFFIC_USAGE_ERROR_VARIANTS: Record<string, TrafficUsageErrorVariant> = {
  'cdt-region-shared': {
    containerClass: 'border-hairline-divider bg-emphasis-layer text-secondary-ink',
    fallbackText: '该地域多个 EIP 共用流量, 无法按实例拆分',
  },
  'cdt-error': {
    containerClass: 'border-signal-amber/30 bg-signal-amber/[0.06] text-signal-amber',
    fallbackText: 'CDT 流量查询无权限，请在账号管理中为该账号授权 cdt:ListCdtInternetTraffic',
  },
  'cdt-permission-error': {
    containerClass: 'border-recovery-red/30 bg-recovery-red/[0.06] text-recovery-red',
    fallbackText: 'CDT 流量查询无权限，请在账号管理中为该账号授权 cdt:ListCdtInternetTraffic',
    permission: true,
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
    containerClass: 'border-recovery-red/30 bg-recovery-red/[0.06] text-recovery-red',
    fallbackText: '缺少 bss:QueryInstanceBill 权限，请在账号管理中为该账号授权',
    permission: true,
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
  detailsLoading,
  loadingStatus,
  effectiveStatus,
  powerError,
  onTogglePower,
  onOpenVnc,
  onOpenSsh,
  onOpenFirewall,
  onToggleStateModal,
  onManageInstance,
  onViewPolicy,
}: InstanceCardProps) {
  const isBooting = loadingStatus === 'starting';
  const isStopped = effectiveStatus === 'Stopped';

  // Copy feedback: which IP cell currently shows the Check icon (null = none).
  const [copiedField, setCopiedField] = useState<'public' | 'private' | null>(null);

  /**
   * Copies an IP to the clipboard and flips its cell to a Check feedback for
   * 2s. Errors propagate (no silent fallback): an unavailable clipboard
   * surfaces to the caller/console instead of being swallowed.
   *
   * @when 点击公网/内网 IP 文本或复制图标
   */
  const handleCopyIp = (field: 'public' | 'private', text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

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
  const isPermissionNotice = Boolean(trafficUsageErrorVariant?.permission);

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
          <h3 className="text-sm font-bold text-primary-ink">
            {instance.regionId ? regionNameZh(instance.regionId) : instance.name}
          </h3>
        </div>

        {/* Machine State details */}
        <div className="flex flex-col items-end gap-1">
          {loadingStatus ? (
            <span className="flex items-center gap-1 rounded border border-primary-container bg-emphasis-layer px-2 py-0.5 text-[10px] font-semibold text-primary">
              <RefreshCw className="h-3 w-3 animate-spin text-primary" />
              {isBooting ? '正在启动...' : '正在入库停机...'}
            </span>
          ) : (
            <span
              className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-bold ${
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

        {/* Public / private ip detail mapping */}
        <div>
          <div className="mb-1 flex items-center justify-between">
            <span className="block font-sans text-[10px] font-bold uppercase tracking-wider text-secondary-ink">
              绑定公网 IP
            </span>
            {detailsLoading ? (
              <span className="h-2.5 w-16 animate-pulse rounded bg-section-layer" aria-hidden="true" />
            ) : (
              <span className="font-mono text-[10px] text-secondary-ink">
                监控: {instance.monitoringEnabled ? '开启' : '关闭'}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <IpCopyCell
              field="public"
              value={instance.publicIp}
              copyable={instance.publicIp !== '未绑定'}
              copied={copiedField === 'public'}
              onCopy={handleCopyIp}
            />
            <IpCopyCell
              field="private"
              value={instance.privateIp}
              copyable
              copied={copiedField === 'private'}
              onCopy={handleCopyIp}
            />
          </div>
        </div>

        {/* Traffic remaining display progress bar */}
        {detailsLoading ? (
          <TrafficDetailsSkeleton />
        ) : (
          <div className="mt-1 flex flex-col gap-1">
            {trafficUsageErrorVariant ? (
              <>
                <span className="block font-sans text-[10px] font-bold uppercase tracking-wider text-signal-amber">
                  累计流量监测
                </span>
                <div
                  role={isPermissionNotice ? 'button' : undefined}
                  tabIndex={isPermissionNotice ? 0 : undefined}
                  onClick={isPermissionNotice ? () => onViewPolicy?.(instance) : undefined}
                  onKeyDown={
                    isPermissionNotice
                      ? (event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            onViewPolicy?.(instance);
                          }
                        }
                      : undefined
                  }
                  className={`rounded-md border px-2 py-1.5 text-[10px] leading-relaxed ${trafficUsageErrorVariant.containerClass} ${
                    isPermissionNotice ? 'flex cursor-pointer items-start gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-primary/40' : ''
                  }`}
                >
                  {isPermissionNotice && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div>{instance.trafficUsageErrorReason || trafficUsageErrorVariant.fallbackText}</div>
                    {isPermissionNotice && (
                      <div className="font-semibold underline decoration-dotted underline-offset-2">点击查看授权脚本 →</div>
                    )}
                  </div>
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
            {instance.trafficRate === null && instance.trafficRateErrorReason && !instance.trafficDetailsLoading && (
              <div className="text-[10px] text-secondary-ink">{instance.trafficRateErrorReason}</div>
            )}
          </div>
        )}
      </div>

      <InstanceSoftwarePanel instance={instance} effectiveStatus={effectiveStatus} />

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
      <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-hairline-divider/50 pt-3">
        <div className="flex flex-wrap items-center gap-2">
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

          {/* SSH login button */}
          <button
            onClick={() => onOpenSsh(instance)}
            className="cursor-pointer rounded border border-hairline-divider px-3 py-1 text-xs font-medium text-secondary-ink transition-colors hover:bg-emphasis-layer hover:text-primary-ink"
            title="SSH 登录远程终端"
          >
            <Terminal className="mr-1 inline h-3.5 w-3.5" />
            SSH 登录
          </button>

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

          <button
            onClick={() => onOpenFirewall(instance)}
            className="cursor-pointer rounded border border-hairline-divider px-3 py-1 text-xs font-medium text-secondary-ink transition-colors hover:bg-emphasis-layer hover:text-primary-ink"
            title="管理阿里云安全组入站和出站规则"
          >
            <ShieldCheck className="mr-1 inline h-3.5 w-3.5" />
            安全组/防火墙
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
