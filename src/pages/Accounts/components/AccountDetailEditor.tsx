import {useEffect, useMemo, useRef, useState} from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Copy,
  Eye,
  EyeOff,
  KeyRound,
  MapPin,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';

import {listRegions, type ApiAccountRegion, type CdtPermissionResult} from '../../../lib/api/client';
import {useSaveAccountMutation, useValidateAccountMutation} from '../../../features/runtime/hooks';
import type {CloudAccount} from '../../../types';
import AccountPolicyCard from '../../../components/AccountPolicyCard';
import AuthPolicyModal from '../../../components/AuthPolicyModal';
import {isPermissionErrorMessage} from '../../../components/accountPolicy';
import PermissionStatusCard from './PermissionStatusCard';
import AccountMetadataCard from './AccountMetadataCard';
import ResourceSummaryCard from './ResourceSummaryCard';

interface AccountDetailEditorProps {
  /** The account driving the view: create draft while creating, backend account otherwise. */
  account: CloudAccount;
  isCreating: boolean;
  cdtPermission?: CdtPermissionResult;
  cdtPermissionLoading: boolean;
  onClose: () => void;
  onOpenAuditLogs: () => void;
}

function accountManagedRegions(account: CloudAccount): string[] {
  const explicitRegions = account.managedRegions.split(',').map((item) => item.trim()).filter(Boolean);
  if (explicitRegions.length > 0) return explicitRegions;
  const historicalRegion = account.mainRegion.trim();
  return historicalRegion ? [historicalRegion] : [];
}

/**
 * Detail / create form for an account: credential fields, SDK-driven region
 * management, CDT permission card, connection test and metadata sidebar.
 * Form state is owned here; switching accounts remounts the editor through a
 * key so fields rehydrate from the account prop.
 *
 * @when /accounts/:accountId 详情或 /accounts/new 新建表单渲染时
 */
export default function AccountDetailEditor({
  account,
  isCreating,
  cdtPermission,
  cdtPermissionLoading,
  onClose,
  onOpenAuditLogs,
}: AccountDetailEditorProps) {
  const saveAccountMutation = useSaveAccountMutation();
  const validateMutation = useValidateAccountMutation();
  const [name, setName] = useState(() => (isCreating ? '' : account.name));
  const [accessKeyId, setAccessKeyId] = useState(() => (isCreating ? '' : account.accessKeyId));
  const [accessKeySecret, setAccessKeySecret] = useState(() => (isCreating ? '' : account.accessKeySecret));
  const [roleArn, setRoleArn] = useState(() => (isCreating ? '' : account.roleArn || ''));
  const [managedRegions, setManagedRegions] = useState<string[]>(() =>
    isCreating ? [] : accountManagedRegions(account),
  );
  const [siteType, setSiteType] = useState<'domestic' | 'international'>(() =>
    isCreating ? 'domestic' : account.providerRegion === 'Aliyun International' ? 'international' : 'domestic',
  );
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const [regions, setRegions] = useState<ApiAccountRegion[]>([]);
  const [regionsLoading, setRegionsLoading] = useState(false);
  const [regionsError, setRegionsError] = useState<string | null>(null);

  const [testResult, setTestResult] = useState<{status: 'idle' | 'testing' | 'success' | 'error'; message?: string; errorType?: 'permission' | 'credential' | 'network'}>({status: 'idle'});

  useEffect(() => {
    setTestResult({status: 'idle'});
  }, [account?.id, isCreating]);

  useEffect(() => {
    if (isCreating) {
      setName('');
      setAccessKeyId('');
      setAccessKeySecret('');
      setRoleArn('');
      setManagedRegions([]);
      setSiteType('domestic');
      setRegions([]);
      setRegionsError(null);
      return;
    }
    setName(account.name);
    setAccessKeyId(account.accessKeyId);
    setAccessKeySecret(account.accessKeySecret);
    setRoleArn(account.roleArn || '');
    setManagedRegions(accountManagedRegions(account));
    setSiteType(account.providerRegion === 'Aliyun International' ? 'international' : 'domestic');
  }, [account?.id, isCreating]);

  // Simulated copy helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Switching the site type invalidates every fetched region option (domestic
  // and international accounts expose disjoint region sets). Reset is done on
  // user change only — programmatic backfill (edit/create mount) must not be
  // wiped by an effect.
  const changeSiteType = (value: 'domestic' | 'international') => {
    if (value === siteType) return;
    setSiteType(value);
    setRegions([]);
    setRegionsError(null);
    setManagedRegions([]);
  };

  // SDK-fetched regions first, then any currently-selected value so the edit
  // flow keeps stored or historical regions visible until the user re-fetches.
  const regionOptions = useMemo(() => {
    const options = [...regions];
    for (const value of managedRegions) {
      if (value && !options.some((option) => option.regionId === value)) {
        options.push({regionId: value});
      }
    }
    return options;
  }, [regions, managedRegions]);

  /**
   * Fetch available regions for the entered credentials + siteType via the
   * generated SDK (POST /api/accounts/regions). Failures surface the backend
   * {"error"} message inline — never a silent empty list.
   *
   * @when 用户在账号表单填写 AK/Secret 并选择站点类型后点击「获取可用地域」时触发
   */
  const fetchRegions = async () => {
    if (!accessKeyId || !accessKeySecret) {
      setRegionsError('请先填写 Access Key ID 和 Access Key Secret');
      return;
    }
    setRegionsLoading(true);
    setRegionsError(null);
    try {
      const items = await listRegions({accessKeyId, accessKeySecret, siteType});
      setRegions(items);
    } catch (error) {
      setRegionsError(error instanceof Error ? error.message : '获取可用地域失败');
    } finally {
      setRegionsLoading(false);
    }
  };

  const toggleManagedRegion = (regionId: string) => {
    setManagedRegions((prev) =>
      prev.includes(regionId) ? prev.filter((item) => item !== regionId) : [...prev, regionId],
    );
  };

  // Select-all drives the SDK-fetched region list only: fallback options
  // (stored regions kept visible in the edit flow until a re-fetch) are never
  // touched by 全选. Indeterminate is a DOM property React cannot express via
  // JSX, so it is applied imperatively through a ref.
  const selectAllRef = useRef<HTMLInputElement>(null);
  const allManagedRegionsSelected =
    regions.length > 0 && regions.every((region) => managedRegions.includes(region.regionId));
  const someManagedRegionsSelected =
    !allManagedRegionsSelected && regions.some((region) => managedRegions.includes(region.regionId));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someManagedRegionsSelected;
    }
  }, [someManagedRegionsSelected]);

  /**
   * Select or clear every SDK-fetched region at once. When clearing, only the
   * SDK region ids are removed — pre-existing fallback selections survive.
   *
   * @when 托管地域多选区表头点击「全选」checkbox 时触发
   */
  const toggleAllManagedRegions = () => {
    setManagedRegions((prev) => {
      const selectableIds = regions.map((region) => region.regionId);
      const allSelected =
        selectableIds.length > 0 && selectableIds.every((id) => prev.includes(id));
      if (allSelected) {
        return prev.filter((id) => !selectableIds.includes(id));
      }
      return [...new Set([...prev, ...selectableIds])];
    });
  };

  const handleSave = async () => {
    // Trim before the emptiness check: whitespace-pasted or autofilled fields
    // must not pass as "filled", and the browser may fill the DOM without
    // firing React onChange (autoComplete="off"/"new-password" blocks that).
    if (!name.trim() || !accessKeyId.trim() || !accessKeySecret.trim()) {
      alert('请输入必填字段：账户名称、Access Key ID、Access Key Secret');
      return;
    }
    try {
      await saveAccountMutation.mutateAsync({
        id: isCreating ? undefined : account.id,
        name,
        siteType,
        accessKeyId,
        accessKeySecret,
        regions: managedRegions,
        regionId: managedRegions[0] || '',
        zoneId: '',
        ossBucket: '',
        ossEndpoint: siteType === 'domestic' ? 'oss-cn-hangzhou.aliyuncs.com' : 'oss-cn-hongkong.aliyuncs.com',
      });
      onClose();
    } catch (error) {
      alert(error instanceof Error ? error.message : '保存失败');
    }
  };

  const handleTestConnection = async () => {
    setTestResult({status: 'testing'});
    try {
      const result = await validateMutation.mutateAsync(account.id);
      if (result.valid && !result.warning) {
        setTestResult({status: 'success', message: '连接测试成功，凭据有效，所有权限正常'});
      } else if (result.valid && result.warning) {
        if (result.errorType === 'network') {
          setTestResult({status: 'success', errorType: 'network', message: `凭据有效，但部分接口出现网络错误（非权限问题）:\n${result.warning}\n\n请检查服务器到阿里云 API 的网络连通性（防火墙、DNS、跨境网络等），无需修改 RAM 策略。`});
        } else {
          setTestResult({status: 'success', errorType: 'permission', message: `凭据有效，但部分权限不足：\n${result.warning}\n\n请打开权限 JSON，在阿里云 RAM 控制台创建并绑定自定义策略。`});
        }
      } else {
        setTestResult({status: 'error', errorType: result.errorType === 'credential' ? 'credential' : undefined, message: result.error || '凭据验证失败，请检查 AccessKey ID 和 Secret 是否正确'});
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '连接测试失败';
      setTestResult({status: 'error', errorType: isPermissionErrorMessage(message) ? 'permission' : undefined, message});
    }
  };

  return (
    <>
      {/* Header with back navigation anchor */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-1.5 border border-hairline-divider bg-surface-white hover:bg-emphasis-layer rounded transition-colors text-on-surface-variant cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="h-5 w-[1px] bg-hairline-divider"></div>
          <div>
            <h1 className="text-lg font-bold text-primary-ink font-space flex items-center gap-2">
              {isCreating ? '添加托管云授权凭证' : '凭据配置详情'}
              <span className="text-xs font-mono font-normal bg-emphasis-layer px-2 py-0.5 rounded text-secondary border border-primary-fixed">
                {account.id}
              </span>
            </h1>
            <p className="text-[11px] text-secondary-ink mt-0.5">
              {isCreating ? '注册新的 RAM 子账号，注入安全密匙并限定管理地域。' : '审核和修改授权接入信息，校验 VPC、EIP、ECS 指数同步。'}
            </p>
          </div>
        </div>

        {!isCreating && (
          <div className="bg-[#FAFBFD] px-3 py-1 rounded border border-hairline-divider text-xs font-medium text-secondary-ink flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-healthy-green" />
            <span>探测周期: 900s 缓存轮询中</span>
          </div>
        )}
      </div>

      {/* Bento Grid containing Edit Forms on Left, Info Cards on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Form editing block (span 8) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Resource Summary indicators card (Only for edited existing accounts) */}
          {!isCreating && <ResourceSummaryCard />}

          {/* Account Permission Status */}
          {!isCreating && (
            <PermissionStatusCard
              cdtPermission={cdtPermission}
              isLoading={cdtPermissionLoading}
              onOpenAuthModal={() => setShowAuthModal(true)}
            />
          )}

          {/* Form fields settings card */}
          <section className="bg-surface-white border border-hairline-divider rounded-lg shadow-xs flex flex-col overflow-hidden">
            <header className="px-5 py-3.5 border-b border-hairline-divider bg-[#FAFBFD] flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-outline flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-primary" />
                API 凭据与角色授权策略
              </h2>
            </header>

            <div className="p-5 flex flex-col gap-4">
              <div className="rounded-md border border-primary/25 bg-primary/[0.04] px-3 py-2.5 text-[11px] leading-relaxed text-secondary-ink">
                请填写专用于本平台的 <strong className="text-primary-ink">RAM 用户 AccessKey</strong>，不要使用阿里云主账号 AccessKey。
                RAM 用户默认没有任何权限，请先复制右侧 JSON 创建自定义策略并绑定到该用户。
              </div>

              {/* Account Title block */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-secondary-ink uppercase tracking-wider">账户配置名称 *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="off"
                  placeholder="例如: 生产账号、预发账号..."
                  className="w-full px-3.5 py-2 border border-hairline-divider rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder-outline-variant font-medium text-primary-ink"
                />
              </div>

              {/* Access credentials grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* AK ID */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-secondary-ink uppercase tracking-wider">RAM 用户 Access Key ID *</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={accessKeyId}
                      onChange={(e) => setAccessKeyId(e.target.value)}
                      autoComplete="off"
                      placeholder="LTAI5t7..."
                      className="w-full pl-3.5 pr-10 py-2 border border-hairline-divider rounded font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-primary-ink"
                    />
                    <button
                      type="button"
                      onClick={() => handleCopy(accessKeyId, 'ak')}
                      className="absolute right-2.5 top-1.5 p-1 text-outline hover:text-primary-ink hover:bg-emphasis-layer rounded transition-all cursor-pointer"
                      title="复制"
                    >
                      {copiedField === 'ak' ? <Check className="w-3.5 h-3.5 text-healthy-green font-bold" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                {/* AK Secret */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-bold text-secondary-ink uppercase tracking-wider">RAM 用户 Access Key Secret *</label>
                  <div className="relative">
                    <input
                      type={showSecret ? 'text' : 'password'}
                      value={accessKeySecret}
                      onChange={(e) => setAccessKeySecret(e.target.value)}
                      // new-password stops the password manager from filling
                      // the field without firing React onChange
                      autoComplete="new-password"
                      placeholder="************************"
                      className="w-full pl-3.5 pr-16 py-2 border border-hairline-divider rounded font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-primary-ink"
                    />
                    <div className="absolute right-2 top-1.5 flex gap-1">
                      <button
                        type="button"
                        onClick={() => setShowSecret(!showSecret)}
                        className="p-1 text-outline hover:text-primary-ink hover:bg-emphasis-layer rounded transition-all cursor-pointer"
                        title={showSecret ? '隐藏' : '显示'}
                      >
                        {showSecret ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCopy(accessKeySecret, 'secret')}
                        className="p-1 text-outline hover:text-primary-ink hover:bg-emphasis-layer rounded transition-all cursor-pointer"
                        title="复制"
                      >
                        {copiedField === 'secret' ? <Check className="w-3.5 h-3.5 text-healthy-green font-bold" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Assume Role ARN */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-secondary-ink uppercase tracking-wider flex items-center justify-between">
                  <span>假定角色 ARN（可选）</span>
                  <span className="text-[9px] font-mono lowercase text-outline">acs:ram::[uid]:role/[rolename]</span>
                </label>
                <input
                  type="text"
                  value={roleArn}
                  onChange={(e) => setRoleArn(e.target.value)}
                  placeholder="例如: acs:ram::1234567890123456:role/aliyun-ops-role"
                  className="w-full px-3.5 py-2 border border-hairline-divider rounded font-mono text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-primary-ink"
                />
              </div>

              {/* Site type + region options (SDK-driven) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-bold text-secondary-ink uppercase tracking-wider">站点类型</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-1.5 text-xs text-primary-ink cursor-pointer">
                    <input
                      type="radio"
                      name="siteType"
                      checked={siteType === 'domestic'}
                      onChange={() => changeSiteType('domestic')}
                      className="accent-primary"
                    />
                    国内 (domestic)
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-primary-ink cursor-pointer">
                    <input
                      type="radio"
                      name="siteType"
                      checked={siteType === 'international'}
                      onChange={() => changeSiteType('international')}
                      className="accent-primary"
                    />
                    国际 (international)
                  </label>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={fetchRegions}
                  disabled={regionsLoading || !accessKeyId || !accessKeySecret}
                  className="flex items-center gap-1.5 px-4 py-2 border border-primary/40 text-primary bg-white font-medium hover:bg-primary hover:text-white rounded text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {regionsLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <MapPin className="w-3.5 h-3.5" />}
                  获取可用地域
                </button>
                {regionsError && (
                  <span className="flex flex-wrap items-center gap-2 text-recovery-red text-[11px]">
                    <span>{regionsError}</span>
                    {isPermissionErrorMessage(regionsError) && (
                      <button
                        type="button"
                        onClick={() => setShowAuthModal(true)}
                        className="cursor-pointer rounded border border-recovery-red/35 bg-white px-2 py-0.5 font-medium hover:bg-recovery-red hover:text-white"
                      >
                        查看所需权限 JSON
                      </button>
                    )}
                  </span>
                )}
                {!regionsError && !regionsLoading && regions.length > 0 && (
                  <span className="text-healthy-green text-[11px]">已加载 {regions.length} 个可用地域</span>
                )}
              </div>

              {/* Managed Regions */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-secondary-ink uppercase tracking-wider">管理地域限制</label>
                  {regions.length > 0 && (
                    <label className="flex items-center gap-1.5 text-[11px] text-[#0058bc] cursor-pointer select-none">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={allManagedRegionsSelected}
                        onChange={toggleAllManagedRegions}
                        className="accent-primary"
                      />
                      全选
                    </label>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1">
                  {regionOptions.length === 0 && (
                    <p className="text-[10px] text-secondary-ink col-span-2">请先填写 Access Key 并点击「获取可用地域」加载可选地域</p>
                  )}
                  {regionOptions.map((option) => (
                    <label key={option.regionId} className="flex items-center gap-2 text-xs text-primary-ink cursor-pointer">
                      <input
                        type="checkbox"
                        checked={managedRegions.includes(option.regionId)}
                        onChange={() => toggleManagedRegion(option.regionId)}
                        className="accent-primary"
                      />
                      <span className="truncate">
                        {option.localName ? `${option.regionId} (${option.localName})` : option.regionId}
                      </span>
                      {option.instanceCount !== undefined ? (
                        <span className="ml-auto shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-emphasis-layer text-secondary-ink tabular-nums">
                          {option.instanceCount} 台
                        </span>
                      ) : (
                        <span
                          className="ml-auto shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-emphasis-layer/60 text-outline"
                          title="实例数未知"
                        >
                          —
                        </span>
                      )}
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-secondary-ink mt-0.5 leading-normal">
                  锁定此云账户拉取实例的白名单。仅同步并在拓扑分析器中显示以上限定的地域资源。
                </p>
              </div>

              {/* Footer operations */}
              <div className="flex flex-col gap-3 mt-5 pt-5 border-t border-hairline-divider">
                {testResult.status !== 'idle' && testResult.status !== 'testing' && (
                  <div className={`text-[11px] px-3 py-2 rounded border whitespace-pre-wrap ${testResult.status === 'success' ? 'bg-healthy-green/5 border-healthy-green/30 text-healthy-green' : 'bg-recovery-red/5 border-recovery-red/30 text-recovery-red'}`}>
                    <p>{testResult.message}</p>
                    {testResult.errorType === 'permission' && (
                      <button
                        type="button"
                        onClick={() => setShowAuthModal(true)}
                        className="mt-2 cursor-pointer rounded border border-current/35 bg-white px-2.5 py-1 font-medium hover:bg-signal-amber hover:text-white"
                      >
                        查看连接测试所需权限 JSON
                      </button>
                    )}
                  </div>
                )}
                <div className="flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-5 py-2 border border-hairline-divider text-primary-ink bg-white font-medium hover:bg-emphasis-layer rounded text-xs transition-colors cursor-pointer"
                  >
                    取消
                  </button>
                  {!isCreating && (
                    <button
                      type="button"
                      onClick={handleTestConnection}
                      disabled={testResult.status === 'testing'}
                      className="flex items-center gap-1.5 px-5 py-2 border border-primary/40 text-primary bg-white font-medium hover:bg-primary hover:text-white rounded text-xs transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {testResult.status === 'testing' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      测试连接
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleSave}
                    className="px-5 py-2 bg-primary hover:bg-primary-container font-semibold font-space text-white rounded text-xs transition-colors cursor-pointer shadow-xs active:scale-98"
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Sidebar Account Metadata Card (span 4) */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          <AccountPolicyCard siteType={siteType} />
          <AccountMetadataCard
            account={account}
            isCreating={isCreating}
            editedName={name}
            onOpenAuditLogs={onOpenAuditLogs}
          />
        </div>
      </div>

      {showAuthModal && (
        <AuthPolicyModal
          accountName={name.trim() || (isCreating ? '' : account.name)}
          siteType={siteType}
          cdtPermission={isCreating ? undefined : cdtPermission}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </>
  );
}
