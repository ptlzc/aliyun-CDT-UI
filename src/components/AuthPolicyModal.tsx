import {ShieldCheck} from 'lucide-react';

import type {CdtPermissionResult} from '../lib/api/client';
import type {AliyunSiteType} from './accountPolicy';
import AccountPolicyJsonPanel from './AccountPolicyJsonPanel';
import RamAuthorizationGuide from './RamAuthorizationGuide';

interface AuthPolicyModalProps {
  accountName: string;
  siteType: AliyunSiteType;
  cdtPermission?: CdtPermissionResult;
  onClose: () => void;
}

/**
 * RAM authorization guide for a saved account or an unsaved account draft.
 * The policy body is shared with the persistent account sidebar card.
 *
 * @when 用户点击账号权限错误提示或「查看授权」入口时渲染
 */
export default function AuthPolicyModal({accountName, siteType, cdtPermission, onClose}: AuthPolicyModalProps) {
  const titleId = 'account-ram-policy-title';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-ink/45 p-4 font-sans backdrop-blur-xs">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-hairline-divider bg-surface-white shadow-xl"
      >
        <header className="flex items-center justify-between border-b border-hairline-divider bg-[#FAFBFD] px-5 py-3.5">
          <span id={titleId} className="flex items-center gap-2 text-xs font-bold text-primary-ink">
            <ShieldCheck className="h-4 w-4 text-primary" />
            账号 RAM 授权策略 — {accountName || '新账号'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded px-2 py-0.5 text-xs text-secondary-ink hover:bg-emphasis-layer hover:text-primary-ink"
          >
            关闭
          </button>
        </header>

        <div className="flex flex-col gap-4 overflow-y-auto p-5">
          {cdtPermission ? (
            <PermissionSummary result={cdtPermission} />
          ) : (
            <div className="rounded-md border border-primary/25 bg-primary/[0.04] p-3 text-[11px] leading-relaxed text-primary">
              请先创建专用于本平台的 RAM 用户，将下方自定义策略绑定到该用户，再把该 RAM 用户的 AccessKey 填入账号表单。
            </div>
          )}

          <AccountPolicyJsonPanel />
          <RamAuthorizationGuide siteType={siteType} />

          <div className="rounded-md border border-primary/20 bg-primary/[0.03] p-2.5 text-[10px] leading-relaxed text-secondary-ink">
            <p className="font-medium text-primary">配置策略后仍然报错？</p>
            <p className="mt-1">
              若错误包含 <code className="rounded bg-emphasis-layer px-1 font-mono">EOF</code>、
              <code className="rounded bg-emphasis-layer px-1 font-mono">TLS handshake timeout</code> 或
              <code className="rounded bg-emphasis-layer px-1 font-mono">connection refused</code>，这是网络连通性问题，RAM 策略无法修复。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PermissionSummary({result}: {result: CdtPermissionResult}) {
  if (result.permitted) {
    return (
      <div className="rounded-md border border-healthy-green/30 bg-healthy-green/[0.04] p-3 text-[11px] leading-relaxed text-healthy-green">
        ✓ CDT 查询权限检测已通过；完整平台功能仍以本页策略 JSON 为授权基线。
      </div>
    );
  }
  if (result.errorType === 'credential') {
    return (
      <div className="rounded-md border border-recovery-red/30 bg-recovery-red/[0.04] p-3 text-[11px] leading-relaxed text-recovery-red">
        AccessKey 凭据验证失败。请重新输入 RAM 用户完整的 AccessKey Secret；添加策略不能修复错误密钥。
      </div>
    );
  }
  if (result.errorType === 'network') {
    return (
      <div className="rounded-md border border-primary/30 bg-primary/[0.04] p-3 text-[11px] leading-relaxed text-primary">
        <p className="font-medium">阿里云接口出现网络错误，非权限问题。</p>
        <p className="mt-1">请检查服务器的防火墙、DNS 和跨境网络，无需修改 RAM 策略。</p>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-signal-amber/30 bg-signal-amber/[0.04] p-3 text-[11px] leading-relaxed text-signal-amber">
      <p className="font-medium">
        当前检测至少缺少 <code className="rounded bg-signal-amber/10 px-1 font-mono">cdt:ListCdtInternetTraffic</code>；请使用下方完整策略补齐平台权限。
      </p>
      {result.error && <p className="mt-1 break-all font-mono text-[10px] opacity-80">错误详情: {result.error}</p>}
    </div>
  );
}
