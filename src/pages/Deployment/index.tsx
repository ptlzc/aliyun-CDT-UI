import {useMemo, useState} from 'react';
import {AlertTriangle, Check, CheckCircle2, Circle, Copy, Loader2, Rocket, XCircle} from 'lucide-react';

import {
  useAccountsQuery,
  useCreateOneClickDeploymentMutation,
  useJobsQuery,
  useRegionsQuery,
} from '../../features/runtime/hooks';
import type {ApiJob, ApiOneClickDeploymentBody, ApiOneClickDeploymentResponse} from '../../lib/api/client';

// 后端 job.step.title 是英文 step key（枚举值不翻译），仅显示层映射为中文。
const DEPLOYMENT_STEP_LABELS: Record<string, string> = {
  'ensure-network': '初始化网络',
  'ensure-image': '准备镜像',
  'create-instance': '创建实例',
  'wait-running': '等待实例运行',
  'bind-eip': '绑定弹性 IP',
  'install-software': '安装软件',
  'attach-governance': '挂载保活治理',
};

const STEP_STATUS_LABELS: Record<string, string> = {
  pending: '待执行',
  running: '进行中',
  succeeded: '已完成',
  failed: '失败',
  'manual-required': '需手动操作',
};

const inputClass =
  'w-full px-3 py-2 rounded border border-hairline-divider bg-surface-white text-sm text-primary-ink placeholder:text-outline/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary';
const labelClass = 'block text-xs font-semibold text-secondary-ink mb-1.5';

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
  if (status === 'manual-required') {
    return <AlertTriangle className="w-4 h-4 text-signal-amber shrink-0" />;
  }
  return <Circle className="w-4 h-4 text-outline/50 shrink-0" />;
}

/**
 * One-click ECS deployment: account + region + instance spec + optional
 * software (sing-box / tailscale) + keep-alive governance. Submission returns
 * the one-time root password (never persisted, shown once with copy) and a
 * 7-step job whose progress is streamed through the runtime WS bridge.
 *
 * @when 侧边栏「部署新资源」或菜单「一键部署」进入 /deployment 时
 */
export default function DeploymentPage() {
  const accountsQuery = useAccountsQuery();
  const jobsQuery = useJobsQuery();
  const [accountId, setAccountId] = useState('');
  const regionsQuery = useRegionsQuery(accountId || null);
  const createMutation = useCreateOneClickDeploymentMutation();

  const [regionId, setRegionId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [instanceType, setInstanceType] = useState('ecs.e-c4m1.large');
  const [spotPriceLimit, setSpotPriceLimit] = useState('');
  const [installSingBox, setInstallSingBox] = useState(false);
  const [singBoxConfig, setSingBoxConfig] = useState('');
  const [installTailscale, setInstallTailscale] = useState(false);
  const [tailscaleAuthKey, setTailscaleAuthKey] = useState('');
  const [attachGovernance, setAttachGovernance] = useState(true);
  const [deployment, setDeployment] = useState<ApiOneClickDeploymentResponse | null>(null);
  const [copiedPassword, setCopiedPassword] = useState(false);

  const accounts = accountsQuery.data || [];
  const regions = regionsQuery.data || [];

  // Live job: WS events patch the jobs cache; fall back to the POST response
  // until the first job.updated event arrives.
  const job: ApiJob | null = useMemo(() => {
    if (!deployment) {
      return null;
    }
    return (jobsQuery.data || []).find((item) => item.id === deployment.job.id) || deployment.job;
  }, [deployment, jobsQuery.data]);

  const canSubmit = Boolean(accountId && regionId) && !createMutation.isPending;

  const handleAccountChange = (value: string) => {
    setAccountId(value);
    setRegionId('');
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }
    const body: ApiOneClickDeploymentBody = {
      regionId,
      zoneId: zoneId.trim() || undefined,
      instanceType,
      spotPriceLimit: spotPriceLimit.trim() !== '' ? Number(spotPriceLimit) : undefined,
      installSingBox: installSingBox || undefined,
      singBoxConfig: installSingBox && singBoxConfig.trim() !== '' ? singBoxConfig : undefined,
      installTailscale: installTailscale || undefined,
      tailscaleAuthKey: installTailscale && tailscaleAuthKey.trim() !== '' ? tailscaleAuthKey : undefined,
      attachGovernance,
    };
    createMutation.mutate(
      {accountId, body},
      {
        onSuccess: (response) => {
          setDeployment(response);
          setCopiedPassword(false);
        },
      },
    );
  };

  const handleCopyPassword = () => {
    if (!deployment) {
      return;
    }
    navigator.clipboard.writeText(deployment.password);
    setCopiedPassword(true);
    setTimeout(() => setCopiedPassword(false), 2000);
  };

  if (accountsQuery.isLoading || jobsQuery.isLoading) {
    return (
      <div className="font-sans flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Rocket className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold font-space text-primary-ink">一键部署 ECS</h1>
        </div>
        <div className="bg-surface-white border border-hairline-divider rounded-lg p-8 flex items-center justify-center gap-2 text-sm text-secondary-ink">
          <Loader2 className="w-4 h-4 animate-spin" /> 加载中…
        </div>
      </div>
    );
  }

  if (accounts.length === 0) {
    return (
      <div className="font-sans flex flex-col gap-6">
        <div className="flex items-center gap-3">
          <Rocket className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold font-space text-primary-ink">一键部署 ECS</h1>
        </div>
        <div className="bg-surface-white border border-hairline-divider rounded-lg p-8 text-center text-sm text-secondary-ink">
          暂无托管账号，请先在「账户管理」中添加阿里云授权凭证后再进行一键部署。
        </div>
      </div>
    );
  }

  return (
    <div className="font-sans flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Rocket className="w-5 h-5 text-primary" />
        <div>
          <h1 className="text-xl font-bold font-space text-primary-ink">一键部署 ECS</h1>
          <p className="text-xs text-secondary-ink mt-1">选地域 → 自动准备镜像 → 创建抢占式实例 + 弹性 IP → 可选安装软件 → 默认挂载保活治理。</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <section className="bg-surface-white border border-hairline-divider rounded-lg p-5 shadow-sm">
          <h2 className="text-base font-bold text-primary-ink font-space mb-4">部署配置</h2>

          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="deploy-account" className={labelClass}>托管账号</label>
              <select
                id="deploy-account"
                aria-label="托管账号"
                value={accountId}
                onChange={(event) => handleAccountChange(event.target.value)}
                className={inputClass}
              >
                <option value="">请选择账号</option>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="deploy-region" className={labelClass}>地域</label>
              <select
                id="deploy-region"
                aria-label="地域"
                value={regionId}
                disabled={!accountId}
                onChange={(event) => setRegionId(event.target.value)}
                className={`${inputClass} disabled:bg-workspace-canvas disabled:text-outline/60`}
              >
                <option value="">{accountId ? '请选择地域' : '请先选择账号'}</option>
                {regions.map((region) => (
                  <option key={region.regionId} value={region.regionId}>
                    {region.localName} ({region.regionId})
                  </option>
                ))}
              </select>
              {accountId && regionsQuery.isLoading && (
                <p className="mt-1 text-[11px] text-secondary-ink flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> 加载地域列表…
                </p>
              )}
              {accountId && regionsQuery.error && (
                <p className="mt-1 text-[11px] text-recovery-red">地域列表加载失败：{(regionsQuery.error as Error).message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="deploy-zone" className={labelClass}>可用区 (ZoneId)</label>
                <input
                  id="deploy-zone"
                  aria-label="可用区"
                  type="text"
                  value={zoneId}
                  onChange={(event) => setZoneId(event.target.value)}
                  placeholder="如 us-west-1a（非默认地域必填）"
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="deploy-instance-type" className={labelClass}>实例规格</label>
                <input
                  id="deploy-instance-type"
                  aria-label="实例规格"
                  type="text"
                  value={instanceType}
                  onChange={(event) => setInstanceType(event.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div>
              <label htmlFor="deploy-spot-price" className={labelClass}>最高出价 (SpotPriceLimit, 元/时)</label>
              <input
                id="deploy-spot-price"
                aria-label="最高出价"
                type="number"
                min="0"
                step="0.01"
                value={spotPriceLimit}
                onChange={(event) => setSpotPriceLimit(event.target.value)}
                placeholder="留空 = SpotAsPriceGo 无上限"
                className={inputClass}
              />
            </div>

            <div className="flex flex-col gap-3 border-t border-hairline-divider/40 pt-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  aria-label="安装 sing-box"
                  checked={installSingBox}
                  onChange={(event) => setInstallSingBox(event.target.checked)}
                  className="rounded text-primary"
                />
                安装 sing-box
              </label>
              {installSingBox && (
                <div>
                  <label htmlFor="deploy-singbox-config" className={labelClass}>sing-box 配置 (JSON)</label>
                  <textarea
                    id="deploy-singbox-config"
                    aria-label="sing-box 配置"
                    rows={4}
                    value={singBoxConfig}
                    onChange={(event) => setSingBoxConfig(event.target.value)}
                    placeholder="可选，粘贴 sing-box 配置 JSON"
                    className={`${inputClass} font-mono text-xs`}
                  />
                </div>
              )}

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  aria-label="安装 tailscale"
                  checked={installTailscale}
                  onChange={(event) => setInstallTailscale(event.target.checked)}
                  className="rounded text-primary"
                />
                安装 tailscale
              </label>
              {installTailscale && (
                <div>
                  <label htmlFor="deploy-tailscale-authkey" className={labelClass}>tailscale AuthKey</label>
                  <input
                    id="deploy-tailscale-authkey"
                    aria-label="tailscale AuthKey"
                    type="password"
                    value={tailscaleAuthKey}
                    onChange={(event) => setTailscaleAuthKey(event.target.value)}
                    placeholder="tskey-auth-…"
                    className={inputClass}
                  />
                </div>
              )}

              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  aria-label="挂载保活治理"
                  checked={attachGovernance}
                  onChange={(event) => setAttachGovernance(event.target.checked)}
                  className="rounded text-primary"
                />
                挂载保活治理（流量超限自动拉起）
              </label>
            </div>

            {createMutation.error && (
              <div className="flex items-start gap-2 bg-red-50 border border-recovery-red/30 text-recovery-red rounded p-3 text-xs leading-relaxed">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>部署请求失败：{createMutation.error instanceof Error ? createMutation.error.message : String(createMutation.error)}</span>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="w-full bg-primary hover:bg-primary-container disabled:opacity-40 text-white py-2.5 px-4 rounded text-sm font-bold flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
              {createMutation.isPending ? '部署中…' : '开始一键部署'}
            </button>
          </div>
        </section>

        {deployment && job && (
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
                  onClick={handleCopyPassword}
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

            <ol className="flex flex-col gap-2.5">
              {(job.steps || []).map((step, index) => {
                const label = DEPLOYMENT_STEP_LABELS[step.title] || step.title;
                const statusLabel = STEP_STATUS_LABELS[step.status] || step.status;
                const isFailed = step.status === 'failed';
                const isManualRequired = step.status === 'manual-required';
                return (
                  <li
                    key={`${job.id}-${index}`}
                    className={`flex items-start gap-3 p-3 border rounded ${isFailed ? 'border-recovery-red/40 bg-red-50/40' : isManualRequired ? 'border-signal-amber/40 bg-amber-50/40' : 'border-hairline-divider bg-section-layer/40'}`}
                  >
                    <StepStatusIcon status={step.status} />
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-xs font-bold text-primary-ink">{label}</span>
                        <span className={`text-[10px] font-semibold shrink-0 ${isFailed ? 'text-recovery-red' : isManualRequired || step.status === 'running' ? 'text-signal-amber' : step.status === 'succeeded' ? 'text-healthy-green' : 'text-outline'}`}>
                          {statusLabel}
                        </span>
                      </div>
                      {step.message && <p className={`mt-0.5 text-[11px] leading-relaxed ${isFailed ? 'text-recovery-red' : isManualRequired ? 'text-signal-amber' : 'text-[#667085]'}`}>{step.message}</p>}
                      {isManualRequired && job.result?.vncUrl && (
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
        )}
      </div>
    </div>
  );
}
