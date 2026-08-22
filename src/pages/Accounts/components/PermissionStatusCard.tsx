import {AlertTriangle, RefreshCw, ShieldCheck} from 'lucide-react';

import type {CdtPermissionResult} from '../../../lib/api/client';

interface PermissionStatusCardProps {
  cdtPermission?: CdtPermissionResult;
  isLoading: boolean;
  onOpenAuthModal: () => void;
}

/**
 * CDT permission detection card shown for existing accounts in the detail
 * view. Surfaces credential / network / missing-permission states inline.
 *
 * @when 账户详情视图（非新建模式）渲染时
 */
export default function PermissionStatusCard({cdtPermission, isLoading, onOpenAuthModal}: PermissionStatusCardProps) {
  const statusClass = cdtPermission?.permitted
    ? 'bg-surface-white border-hairline-divider'
    : cdtPermission?.errorType === 'credential'
      ? 'bg-[#FFEBEE] border-recovery-red/30'
      : cdtPermission?.errorType === 'network'
        ? 'bg-[#E3F2FD] border-primary/30'
        : 'bg-[#FFF8E1] border-signal-amber/30';

  const statusText = isLoading
    ? '检测中…'
    : cdtPermission?.permitted
      ? '已授权'
      : cdtPermission?.errorType === 'credential'
        ? '凭据错误'
        : cdtPermission?.errorType === 'network'
          ? '网络异常'
          : '未授权';

  const statusBadgeClass = cdtPermission?.permitted
    ? 'bg-healthy-green/10 text-healthy-green'
    : cdtPermission?.errorType === 'credential'
      ? 'bg-recovery-red/10 text-recovery-red'
      : cdtPermission?.errorType === 'network'
        ? 'bg-primary/10 text-primary'
        : 'bg-signal-amber/10 text-signal-amber';

  return (
    <section className={`border rounded-lg p-4 shadow-xs ${statusClass}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isLoading ? (
            <RefreshCw className="w-4 h-4 text-secondary-ink animate-spin" />
          ) : cdtPermission?.permitted ? (
            <ShieldCheck className="w-4 h-4 text-healthy-green" />
          ) : cdtPermission?.errorType === 'credential' ? (
            <AlertTriangle className="w-4 h-4 text-recovery-red" />
          ) : cdtPermission?.errorType === 'network' ? (
            <AlertTriangle className="w-4 h-4 text-primary" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-signal-amber" />
          )}
          <h2 className="text-xs font-bold uppercase tracking-wider text-outline">
            账号权限
          </h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onOpenAuthModal}
            className="text-[11px] font-medium text-primary border border-primary/40 hover:bg-primary hover:text-white px-2.5 py-0.5 rounded transition-colors cursor-pointer"
          >
            查看授权
          </button>
          <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded ${statusBadgeClass}`}>
            {statusText}
          </span>
        </div>
      </div>
      {!isLoading && !cdtPermission?.permitted && (
        <div className="mt-3 text-[11px] text-secondary-ink leading-relaxed">
          {cdtPermission?.errorType === 'credential' ? (
            <>
              <p className="font-medium text-recovery-red">AccessKey 凭据验证失败，请检查 AccessKey Secret 是否正确。</p>
              <p className="mt-1">签名验证失败意味着密钥不正确或已被掩码覆盖，请在下方重新输入完整的 AccessKey Secret 后保存。</p>
            </>
          ) : cdtPermission?.errorType === 'network' ? (
            <>
              <p className="font-medium text-primary">CDT 接口出现网络错误，非权限问题。</p>
              <p className="mt-1">服务器无法连通阿里云 CDT API（<code className="font-mono bg-primary/10 px-1 rounded">cdt.aliyuncs.com</code>），请检查网络连通性（防火墙、DNS、跨境网络等），无需修改 RAM 策略。</p>
            </>
          ) : (
            <>
              <p className="font-medium text-signal-amber">当前检测至少缺少 CDT 流量查询（<code className="font-mono bg-signal-amber/10 px-1 rounded">cdt:ListCdtInternetTraffic</code>）权限，ECS 卡片无法显示累计流量。</p>
              <p className="mt-1">请使用平台完整策略一次补齐 ECS、VPC/EIP、CMS、CDT、BSS OpenAPI 与 OSS 权限。</p>
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="mt-2 cursor-pointer rounded border border-signal-amber/40 bg-white px-2.5 py-1 text-[11px] font-medium text-signal-amber transition-colors hover:bg-signal-amber hover:text-white"
              >
                查看所需权限 JSON
              </button>
            </>
          )}
          {cdtPermission?.error && (
            <p className="mt-1 text-[10px] text-secondary-ink/70 font-mono break-all">错误详情: {cdtPermission.error}</p>
          )}
        </div>
      )}
    </section>
  );
}
