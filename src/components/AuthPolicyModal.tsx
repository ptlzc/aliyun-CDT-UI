import {useState} from 'react';
import {Check, Copy, ExternalLink, ShieldCheck} from 'lucide-react';

import type {CdtPermissionResult} from '../lib/api/client';
import type {CloudAccount} from '../types';
import {accountPolicyJson} from './accountPolicy';

interface AuthPolicyModalProps {
  account: CloudAccount;
  cdtPermission?: CdtPermissionResult;
  onClose: () => void;
}

/**
 * RAM authorization policy JSON viewer for an account. Shows the current CDT
 * permission status summary and the full copyable policy document.
 *
 * @when 账户详情权限卡点击「查看授权」时渲染
 */
export default function AuthPolicyModal({account, cdtPermission, onClose}: AuthPolicyModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopyJson = () => {
    const json = JSON.stringify(accountPolicyJson, null, 2);
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-ink/45 backdrop-blur-xs font-sans">
      <div className="bg-surface-white border border-hairline-divider w-full max-w-2xl rounded-lg overflow-hidden shadow-xl flex flex-col">
        <header className="px-5 py-3.5 border-b border-hairline-divider bg-[#FAFBFD] flex justify-between items-center">
          <span className="text-xs font-bold text-primary-ink flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            账号 RAM 授权策略 — {account.name}
          </span>
          <button
            onClick={onClose}
            className="text-xs text-secondary-ink hover:text-primary-ink cursor-pointer px-2 py-0.5 rounded hover:bg-emphasis-layer"
          >
            关闭
          </button>
        </header>

        <div className="p-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          {/* Status summary */}
          <div className={`rounded-md border p-3 text-[11px] leading-relaxed ${cdtPermission?.permitted ? 'border-healthy-green/30 bg-healthy-green/[0.04] text-healthy-green' : cdtPermission?.errorType === 'network' ? 'border-primary/30 bg-primary/[0.04] text-primary' : 'border-signal-amber/30 bg-signal-amber/[0.04] text-signal-amber'}`}>
            {cdtPermission?.permitted ? (
              <span className="font-medium">✓ 该账号已拥有所需权限，无需额外操作。</span>
            ) : cdtPermission?.errorType === 'network' ? (
              <>
                <p className="font-medium">CDT 接口出现网络错误，非权限问题。</p>
                <p className="mt-1">请检查服务器到阿里云 API 的网络连通性（防火墙、DNS、跨境网络等），无需修改 RAM 策略。</p>
                {cdtPermission?.error && (
                  <p className="mt-1 text-[10px] font-mono break-all opacity-80">错误详情: {cdtPermission.error}</p>
                )}
              </>
            ) : (
              <>
                <p className="font-medium">该账号缺少 CDT 流量查询（<code className="font-mono bg-signal-amber/10 px-1 rounded">cdt:ListCdtInternetTraffic</code>）与 BSS 账单明细（<code className="font-mono bg-signal-amber/10 px-1 rounded">bss:QueryInstanceBill</code>）权限。</p>
                {cdtPermission?.error && (
                  <p className="mt-1 text-[10px] font-mono break-all opacity-80">错误详情: {cdtPermission.error}</p>
                )}
              </>
            )}
          </div>

          {/* Authorization JSON */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-secondary-ink uppercase tracking-wider">完整账号授权策略 JSON（含 ECS/VPC/EIP/CDT/BSS/OSS 全部权限）</span>
              <button
                onClick={handleCopyJson}
                className="text-[11px] font-medium text-primary hover:bg-primary/10 px-2 py-0.5 rounded transition-colors cursor-pointer flex items-center gap-1"
              >
                {copied ? <><Check className="w-3 h-3 text-healthy-green" /> 已复制</> : <><Copy className="w-3 h-3" /> 复制 JSON</>}
              </button>
            </div>
            <pre className="bg-[#0d1117] text-[#c9d1d9] font-mono text-[11px] p-4 rounded border border-[#30363d] overflow-x-auto leading-relaxed">
{JSON.stringify(accountPolicyJson, null, 2)}
            </pre>
            <p className="text-[10px] text-secondary-ink leading-relaxed">
              以上 JSON 包含本平台所需的全部 RAM 权限（ECS 实例管理、VPC 网络、EIP、云监控、CDT 流量查询、BSS 账单、OSS 镜像上传）。在 RAM 控制台创建为自定义授权策略并附加到该子用户即可。如仅需补充 CDT 权限，也可直接附加系统策略 <code className="font-mono bg-emphasis-layer px-1 rounded">AliyunCDTReadOnlyAccess</code>。
            </p>
            <div className="mt-1 rounded-md border border-primary/20 bg-primary/[0.03] p-2.5 text-[10px] text-secondary-ink leading-relaxed">
              <p className="font-medium text-primary">提示：如果已配置以上 JSON 仍然报错</p>
              <p className="mt-1">请留意错误信息中是否包含 <code className="font-mono bg-emphasis-layer px-1 rounded">EOF</code>、<code className="font-mono bg-emphasis-layer px-1 rounded">TLS handshake timeout</code>、<code className="font-mono bg-emphasis-layer px-1 rounded">connection refused</code> 等关键词。这些是<strong>网络连通性问题</strong>，不是权限不足——RAM 策略无法解决，需要检查服务器到阿里云 API 端点的网络（防火墙、DNS、跨境链路等）。</p>
            </div>
          </div>

          {/* RAM console link */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-bold text-secondary-ink uppercase tracking-wider">快速跳转</span>
            <a
              href={account.providerRegion === 'Aliyun Domestic'
                ? 'https://ram.console.aliyun.com/users'
                : 'https://ram.console.alibabacloud.com/users'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between border border-primary/30 hover:border-primary hover:bg-primary/5 rounded-md px-4 py-2.5 text-xs font-medium text-primary transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <ExternalLink className="w-3.5 h-3.5" />
                前往{account.providerRegion === 'Aliyun Domestic' ? '阿里云国内' : '阿里云国际'} RAM 控制台
              </span>
              <span className="text-[10px] text-secondary-ink font-mono">
                {account.providerRegion === 'Aliyun Domestic' ? 'ram.console.aliyun.com' : 'ram.console.alibabacloud.com'}
              </span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
