import {useMemo, useState} from 'react';
import {AlertTriangle, Loader2, Rocket} from 'lucide-react';

import {
  useAccountsQuery,
  useContinueOneClickDeploymentMutation,
  useCreateOneClickDeploymentMutation,
  useInventoryGraphQuery,
  useJobsQuery,
  useRegionsQuery,
} from '../../features/runtime/hooks';
import type {ApiJob, ApiOneClickDeploymentBody, ApiOneClickDeploymentResponse} from '../../lib/api/client';

import DeploymentProgress from './DeploymentProgress';
import S3ConfigFields from './S3ConfigFields';

// 后端 job.step.title 是英文 step key（枚举值不翻译），仅显示层映射为中文。
type DeploymentImageType = 'system' | 'installer' | 'auto-installer';

const inputClass =
  'w-full px-3 py-2 rounded border border-hairline-divider bg-surface-white text-sm text-primary-ink placeholder:text-outline/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary';
const labelClass = 'block text-xs font-semibold text-secondary-ink mb-1.5';

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
  const graphQuery = useInventoryGraphQuery(accountId || null);
  const createMutation = useCreateOneClickDeploymentMutation();
  const continueMutation = useContinueOneClickDeploymentMutation();

  const [regionId, setRegionId] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [customZoneId, setCustomZoneId] = useState('');
  const [instanceType, setInstanceType] = useState('ecs.e-c4m1.large');
  const [customInstanceType, setCustomInstanceType] = useState('');
  const [sourceInstanceId, setSourceInstanceId] = useState('');
  const [imageType, setImageType] = useState<DeploymentImageType>('system');
  const [storageProvider, setStorageProvider] = useState('aliyun_oss');
  const [s3Bucket, setS3Bucket] = useState('');
  const [s3Region, setS3Region] = useState('');
  const [s3Endpoint, setS3Endpoint] = useState('');
  const [s3AccessKeyId, setS3AccessKeyId] = useState('');
  const [s3AccessKeySecret, setS3AccessKeySecret] = useState('');
  const [s3ObjectKey, setS3ObjectKey] = useState('');
  const [s3ForcePathStyle, setS3ForcePathStyle] = useState(false);
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
  const graph = graphQuery.data;
  const ecsNodes = useMemo(() => (graph?.nodes || []).filter((node) => node.kind === 'ecs'), [graph]);
  const regionEcsNodes = useMemo(() => ecsNodes.filter((node) => !regionId || node.regionId === regionId), [ecsNodes, regionId]);
  const zoneOptions = useMemo(() => Array.from(new Set(regionEcsNodes.map((node) => node.zoneId).filter((value): value is string => Boolean(value)))).sort(), [regionEcsNodes]);
  const instanceTypeOptions = useMemo(() => Array.from(new Set(regionEcsNodes.map((node) => node.metadata?.instanceType).filter((value): value is string => Boolean(value)))).sort(), [regionEcsNodes]);

  // Live job: WS events patch the jobs cache; fall back to the POST response
  // until the first job.updated event arrives.
  const job: ApiJob | null = useMemo(() => {
    if (!deployment) {
      return null;
    }
    return (jobsQuery.data || []).find((item) => item.id === deployment.job.id) || deployment.job;
  }, [deployment, jobsQuery.data]);

  const canSubmit = Boolean(accountId && regionId) && !createMutation.isPending;
  const isAwaitingVnc = Boolean(
    job?.status === 'awaiting_user' &&
      (job.phase === 'vnc-install-system' || (job.steps || []).some((step) => step.title === 'vnc-install-system' && step.status === 'awaiting_user')),
  );
  const isAutoInstaller = useMemo(
    () => job?.metadata?.imageType === 'auto-installer' || imageType === 'auto-installer',
    [job, imageType],
  );
  const isAutoInstalling = Boolean(
    isAutoInstaller &&
      job?.status === 'running' &&
      (job.phase === 'vnc-install-system' || (job.steps || []).some((step) => step.title === 'vnc-install-system' && step.status === 'running')),
  );
  const isAutoInstallTimeout = Boolean(
    isAutoInstaller &&
      job?.status === 'awaiting_user' &&
      (job.metadata?.fallbackReason === 'auto-install-timeout' || job.result?.fallbackReason === 'auto-install-timeout'),
  );

  const handleAccountChange = (value: string) => {
    setAccountId(value);
    setRegionId('');
    setSourceInstanceId('');
    setZoneId('');
    setCustomZoneId('');
    setCustomInstanceType('');
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }
    const effectiveZoneId = zoneId === '__custom__' ? customZoneId.trim() : zoneId.trim();
    const effectiveInstanceType = instanceType === '__custom__' ? (customInstanceType.trim() || 'ecs.e-c4m1.large') : instanceType;
    const body: ApiOneClickDeploymentBody = {
      regionId,
      zoneId: effectiveZoneId || undefined,
      instanceType: effectiveInstanceType,
      imageType,
      storageProvider,
      sourceInstanceId: sourceInstanceId || undefined,
      ...(storageProvider === 's3' && !sourceInstanceId
        ? {
            s3Bucket,
            s3Region,
            s3Endpoint: s3Endpoint.trim() || undefined,
            s3AccessKeyId,
            s3AccessKeySecret,
            s3ObjectKey,
            s3ForcePathStyle,
          }
        : {}),
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

  const handleContinue = () => {
    if (!job || !accountId) {
      return;
    }
    continueMutation.mutate(
      {
        accountId,
        jobId: job.id,
        body: {action: 'vnc_setup_alpine_complete'},
      },
      {
        onSuccess: (response) => {
          setDeployment((current) => (current ? {...current, job: response.job} : current));
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
                onChange={(event) => {
                  setRegionId(event.target.value);
                  setSourceInstanceId('');
                  setZoneId('');
                  setCustomZoneId('');
                }}
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
                <label htmlFor="deploy-image-type" className={labelClass}>镜像类型</label>
                <select
                  id="deploy-image-type"
                  aria-label="镜像类型"
                  value={imageType}
                  onChange={(event) => {
                    const value = event.target.value as DeploymentImageType;
                    setImageType(value);
                    if (value !== 'system') {
                      setSourceInstanceId('');
                    }
                  }}
                  className={inputClass}
                >
                  <option value="system">system（现有系统镜像）</option>
                  <option value="installer">installer（Alpine 安装器，需 VNC 安装）</option>
                  <option value="auto-installer">auto-installer（Alpine 自动安装器，自动等待 SSH）</option>
                </select>
              </div>
              <div>
                <label htmlFor="deploy-storage-provider" className={labelClass}>存储类型</label>
                <select
                  id="deploy-storage-provider"
                  aria-label="存储类型"
                  value={storageProvider}
                  onChange={(event) => setStorageProvider(event.target.value)}
                  className={inputClass}
                >
                  <option value="aliyun_oss">aliyun_oss（阿里云 OSS）</option>
                  <option value="s3">s3（S3 兼容存储）</option>
                </select>
              </div>
            </div>

            {imageType === 'system' && (
              <div>
                <label htmlFor="deploy-source-instance" className={labelClass}>系统模板来源（从已有 ECS 创建）</label>
                <select
                  id="deploy-source-instance"
                  aria-label="系统模板来源"
                  value={sourceInstanceId}
                  onChange={(event) => setSourceInstanceId(event.target.value)}
                  className={inputClass}
                >
                  <option value="">不使用（自动准备镜像 / OSS）</option>
                  {regionEcsNodes.map((node) => (
                    <option key={node.id} value={node.id}>
                      {node.name} ({node.id})
                      {node.zoneId ? ` · ${node.zoneId}` : ''}
                      {node.metadata?.instanceType ? ` · ${node.metadata.instanceType}` : ''}
                    </option>
                  ))}
                </select>
                {graphQuery.isLoading && (
                  <p className="mt-1 text-[11px] text-secondary-ink flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> 加载可用 ECS 列表…
                  </p>
                )}
                {accountId && !graphQuery.isLoading && regionEcsNodes.length === 0 && (
                  <p className="mt-1 text-[11px] text-secondary-ink">当前地域暂无可作为模板的 ECS；可先完成资源发现，或选择自动准备镜像。</p>
                )}
              </div>
            )}

            {imageType === 'installer' && (
              <div className="rounded border border-signal-amber/40 bg-amber-50/60 p-3 text-xs leading-relaxed text-secondary-ink">
                <p className="font-bold text-primary-ink">VNC 安装系统阶段</p>
                <p className="mt-1">
                  选择 installer 镜像后，实例创建并绑定 EIP 后会暂停在 VNC 安装阶段。请打开 VNC 连接，登录 Alpine 安装器并执行{' '}
                  <code className="font-mono text-[11px]">setup-alpine</code>，选择磁盘安装 sys 后 reboot，再回到本页点击继续。
                </p>
              </div>
            )}

            {imageType === 'auto-installer' && (
              <div className="rounded border border-primary/30 bg-primary/5 p-3 text-xs leading-relaxed text-secondary-ink">
                <p className="font-bold text-primary-ink">自动安装器 (auto-installer)</p>
                <p className="mt-1">
                  将使用自定义 Alpine 自动安装器镜像，系统会自动 setup-alpine 并重启，无需 VNC 人工操作。
                </p>
              </div>
            )}

            {storageProvider === 's3' && !sourceInstanceId && (
              <S3ConfigFields
                bucket={s3Bucket}
                region={s3Region}
                endpoint={s3Endpoint}
                accessKeyId={s3AccessKeyId}
                accessKeySecret={s3AccessKeySecret}
                objectKey={s3ObjectKey}
                forcePathStyle={s3ForcePathStyle}
                onBucketChange={setS3Bucket}
                onRegionChange={setS3Region}
                onEndpointChange={setS3Endpoint}
                onAccessKeyIdChange={setS3AccessKeyId}
                onAccessKeySecretChange={setS3AccessKeySecret}
                onObjectKeyChange={setS3ObjectKey}
                onForcePathStyleChange={setS3ForcePathStyle}
              />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="deploy-zone" className={labelClass}>可用区 (ZoneId)</label>
                <select
                  id="deploy-zone"
                  aria-label="可用区"
                  value={zoneId}
                  onChange={(event) => setZoneId(event.target.value)}
                  className={inputClass}
                >
                  <option value="">请选择可用区</option>
                  {zoneOptions.map((zone) => (
                    <option key={zone} value={zone}>{zone}</option>
                  ))}
                  <option value="__custom__">自定义…</option>
                </select>
                {zoneId === '__custom__' && (
                  <input
                    id="deploy-custom-zone"
                    aria-label="自定义可用区"
                    type="text"
                    value={customZoneId}
                    onChange={(event) => setCustomZoneId(event.target.value)}
                    placeholder="如 us-west-1a"
                    className={`${inputClass} mt-2`}
                  />
                )}
              </div>
              <div>
                <label htmlFor="deploy-instance-type" className={labelClass}>实例规格</label>
                <select
                  id="deploy-instance-type"
                  aria-label="实例规格"
                  value={instanceType}
                  onChange={(event) => setInstanceType(event.target.value)}
                  className={inputClass}
                >
                  {Array.from(new Set(['ecs.e-c4m1.large', ...instanceTypeOptions])).map((type) => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                  <option value="__custom__">自定义…</option>
                </select>
                {instanceType === '__custom__' && (
                  <input
                    id="deploy-custom-instance-type"
                    aria-label="自定义实例规格"
                    type="text"
                    value={customInstanceType}
                    onChange={(event) => setCustomInstanceType(event.target.value)}
                    placeholder="如 ecs.g7.large"
                    className={`${inputClass} mt-2`}
                  />
                )}
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
          <DeploymentProgress
            deployment={deployment}
            job={job}
            isAwaitingVnc={isAwaitingVnc}
            isAutoInstalling={isAutoInstalling}
            isAutoInstallTimeout={isAutoInstallTimeout}
            copiedPassword={copiedPassword}
            continuePending={continueMutation.isPending}
            continueError={continueMutation.error}
            onContinue={handleContinue}
            onCopyPassword={handleCopyPassword}
          />
        )}
      </div>
    </div>
  );
}
