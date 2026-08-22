import {AlertTriangle, Check, CheckCircle2, Circle, Copy, Loader2, XCircle} from 'lucide-react';

import type {ApiJob, ApiOneClickDeploymentResponse} from '../../lib/api/client';

// 后端 job.step.title 是英文 step key（枚举值不翻译），仅显示层映射为中文。
const DEPLOYMENT_STEP_LABELS: Record<string, string> = {
  'ensure-network': '初始化网络',
  'ensure-image': '准备镜像',
  'create-instance': '创建实例',
  'wait-running': '等待实例运行',
  'bind-eip': '绑定弹性 IP',
  'vnc-install-system': 'VNC 安装系统',
  'install-software': '安装软件',
  'attach-governance': '挂载保活治理',
};

const STEP_STATUS_LABELS: Record<string, string> = {
  pending: '待执行',
  running: '进行中',
  succeeded: '已完成',
  failed: '失败',
  'manual-required': '需手动操作',
  'awaiting_user': '等待用户操作',
};

function StepStatusIcon({status}: {status: string}) {
  if (status === 'succeeded') {
    return <CheckCircle2 className="w-4 h-4 text-healthy-green shrink-0" />;
  }
  if (status === 'failed') {
    return <XCircle className="w-4 h-4 text-recovery-red shrink-0" />;
  }
  if (status === 'running') {
    return <Loader2 className="w-4 h-4 text-signal-amber animate-spin shrink-0" />;
  }
  if (status === 'manual-required' || status === 'awaiting_user') {
    return <AlertTriangle className="w-4 h-4 text-signal-amber shrink-0" />;
  }
  return <Circle className="w-4 h-4 text-outline/50 shrink-0" />;
}

interface DeploymentProgressProps {
  deployment: ApiOneClickDeploymentResponse;
  job: ApiJob;
  isAwaitingVnc: boolean;
  isAutoInstalling: boolean;
  isAutoInstallTimeout: boolean;
  copiedPassword: boolean;
  continuePending: boolean;
  continueError: Error | null;
  onContinue: () => void;
  onCopyPassword: () => void;
}

export default function DeploymentProgress({
  deployment,
  job,
  isAwaitingVnc,
  isAutoInstalling,
  isAutoInstallTimeout,
  copiedPassword,
  continuePending,
  continueError,
  onContinue,
  onCopyPassword,
}: DeploymentProgressProps) {
  return (
    <section aria-label="部署进度" className="bg-surface-white border border-hairline-divider rounded-lg p-5 shadow-sm">
      <div className="flex items-center justify-between border-b border-hairline-divider/40 pb-3 mb-4">
        <h2 className="text-base font-bold text-primary-ink font-space">部署进度</h2>
        <span className="bg-emphasis-layer border border-primary-fixed text-secondary font-mono px-2 py-0.5 rounded text-[10px] font-bold">{job.id}</span>
      </div>

      <div className="mb-5 border border-signal-amber/40 bg-amber-50 rounded p-4">
        <p className="text-xs font-bold text-primary-ink mb-1">一次性实例密码（root）</p>
        <div className="flex items-center gap-2">
          <code className="flex-1 font-mono text-sm font-bold text-primary bg-surface-white border border-hairline-divider rounded px-3 py-2 select-all">{deployment.password}</code>
          <button
            onClick={onCopyPassword}
            aria-label="复制密码"
            className="p-2 border border-hairline-divider rounded bg-surface-white text-secondary-ink hover:text-primary cursor-pointer"
          >
            {copiedPassword ? <Check className="w-4 h-4 text-healthy-green" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <p className="mt-2 text-[11px] text-signal-amber font-semibold flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>仅显示一次，请立即保存。密码不落盘，刷新或关闭后无法再次查看；丢失密码请用 VNC 登录修复。</span>
        </p>
      </div>

      {job.status === 'manual-required' && job.result?.vncUrl && (
        <div className="mb-4 bg-amber-50 border border-signal-amber/40 rounded p-3 text-xs text-signal-amber leading-relaxed flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>
            软件安装无法自动完成（SSH 不可达），需手动操作。
            <a href={job.result.vncUrl} target="_blank" rel="noreferrer" className="font-bold underline ml-1">
              打开 VNC 连接
            </a>
            完成安装，密码见上方。
          </span>
        </div>
      )}

      {isAutoInstalling && (
        <div className="mb-4 bg-blue-50 border border-primary/30 rounded p-4 text-xs leading-relaxed text-secondary-ink">
          <p className="text-sm font-bold text-primary-ink mb-2">自动安装系统</p>
          <p>系统正在自动安装，预计 5-10 分钟，请稍候…</p>
        </div>
      )}

      {isAwaitingVnc && (
        <div className="mb-4 bg-amber-50 border border-signal-amber/40 rounded p-4 text-xs leading-relaxed text-secondary-ink">
          <p className="text-sm font-bold text-primary-ink mb-2">VNC 安装系统</p>
          <p className="text-signal-amber font-semibold mb-2">
            {isAutoInstallTimeout ? '自动安装超时，请通过 VNC 手动完成以下步骤：' : '实例已暂停在安装系统阶段，请通过 VNC 完成以下步骤：'}
          </p>
          <ol className="list-decimal list-inside space-y-1">
            <li>使用上方密码登录 VNC</li>
            <li>在 Alpine 安装器执行 <code className="font-mono text-[11px]">setup-alpine</code></li>
            <li>选择磁盘安装 sys 并 reboot</li>
            <li>完成后回到本页点击“我已安装完成，继续”</li>
          </ol>
          {job.result?.vncUrl && (
            <a href={job.result.vncUrl} target="_blank" rel="noreferrer" className="inline-block mt-3 font-bold text-primary underline">
              打开 VNC 连接
            </a>
          )}
          <div className="mt-3 flex flex-col gap-2">
            <button
              onClick={onContinue}
              disabled={continuePending}
              className="inline-flex items-center justify-center gap-2 bg-primary hover:bg-primary-container disabled:opacity-40 text-white px-4 py-2 rounded text-xs font-bold cursor-pointer disabled:cursor-not-allowed"
            >
              {continuePending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              我已安装完成，继续
            </button>
            {continueError && (
              <p className="text-recovery-red">
                继续失败：{continueError instanceof Error ? continueError.message : String(continueError)}
              </p>
            )}
          </div>
        </div>
      )}

      <ol className="flex flex-col gap-2.5">
        {(job.steps || []).map((step, index) => {
          const label = DEPLOYMENT_STEP_LABELS[step.title] || step.title;
          const statusLabel = STEP_STATUS_LABELS[step.status] || step.status;
          const isFailed = step.status === 'failed';
          const isManualRequired = step.status === 'manual-required';
          const isAwaitingUser = step.status === 'awaiting_user';
          return (
            <li
              key={`${job.id}-${index}`}
              className={`flex items-start gap-3 p-3 border rounded ${isFailed ? 'border-recovery-red/40 bg-red-50/40' : isManualRequired || isAwaitingUser ? 'border-signal-amber/40 bg-amber-50/40' : 'border-hairline-divider bg-section-layer/40'}`}
            >
              <StepStatusIcon status={step.status} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-xs font-bold text-primary-ink">{label}</span>
                  <span className={`text-[10px] font-semibold shrink-0 ${isFailed ? 'text-recovery-red' : isManualRequired || isAwaitingUser || step.status === 'running' ? 'text-signal-amber' : step.status === 'succeeded' ? 'text-healthy-green' : 'text-outline'}`}>
                    {statusLabel}
                  </span>
                </div>
                {step.message && <p className={`mt-0.5 text-[11px] leading-relaxed ${isFailed ? 'text-recovery-red' : isManualRequired || isAwaitingUser ? 'text-signal-amber' : 'text-[#667085]'}`}>{step.message}</p>}
                {(isManualRequired || isAwaitingUser) && job.result?.vncUrl && (
                  <p className="mt-1 text-[11px] text-signal-amber">
                    <a href={job.result.vncUrl} target="_blank" rel="noreferrer" className="font-bold underline">
                      打开 VNC 连接
                    </a>
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
