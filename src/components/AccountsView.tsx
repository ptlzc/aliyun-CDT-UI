import React, { useState, useMemo } from 'react';
import { CloudAccount } from '../types';
import { Search, Filter, RefreshCw, Plus, Edit, Trash2, KeyRound, ArrowLeft, ShieldAlert, Copy, Eye, EyeOff, MapPin, Calendar, User, History, Check, ShieldCheck, ChevronLeft, ChevronRight, FileCode, Server } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useSaveAccountMutation } from '../features/runtime/hooks';

interface AccountsViewProps {
  accounts: CloudAccount[];
  selectedAccount: CloudAccount | null;
  setSelectedAccount: (acc: CloudAccount | null) => void;
}

export default function AccountsView({ accounts, selectedAccount, setSelectedAccount }: AccountsViewProps) {
  const saveAccountMutation = useSaveAccountMutation();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  // Form states when editing/creating
  const [name, setName] = useState('');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [accessKeySecret, setAccessKeySecret] = useState('');
  const [roleArn, setRoleArn] = useState('');
  const [managedRegions, setManagedRegions] = useState('');
  const [mainRegion, setMainRegion] = useState('');
  const [owner, setOwner] = useState('');

  // Track if we are creating a brand new account
  const [isCreating, setIsCreating] = useState(false);

  // Log audit history modal or list preview trigger
  const [showAudits, setShowAudits] = useState(false);
  const [selectedAuditLog, setSelectedAuditLog] = useState<string[] | null>(null);

  // Simulated copy helper
  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // Filter accounts
  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const matchSearch =
        acc.name.toLowerCase().includes(search.toLowerCase()) ||
        acc.id.toLowerCase().includes(search.toLowerCase()) ||
        acc.providerRegion.toLowerCase().includes(search.toLowerCase());
      
      if (statusFilter === 'ALL') return matchSearch;
      return matchSearch && acc.status === statusFilter;
    });
  }, [accounts, search, statusFilter]);

  // Pagination bounds
  const pageSize = 5;
  const totalPages = Math.ceil(filteredAccounts.length / pageSize);
  const paginatedAccounts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAccounts.slice(startIndex, startIndex + pageSize);
  }, [filteredAccounts, currentPage]);

  const handleEditClick = (acc: CloudAccount) => {
    setSelectedAccount(acc);
    setIsCreating(false);
    setName(acc.name);
    setAccessKeyId(acc.accessKeyId);
    setAccessKeySecret(acc.accessKeySecret);
    setRoleArn(acc.roleArn || '');
    setManagedRegions(acc.managedRegions);
    setMainRegion(acc.mainRegion);
    setOwner(acc.owner);
  };

  const handleCreateClick = () => {
    setIsCreating(true);
    setSelectedAccount({
      id: `ali-${Math.random().toString(36).substr(2, 4)}-${Math.floor(100000 + Math.random() * 900000)}`,
      name: '',
      status: 'Active',
      providerRegion: 'Aliyun China East 1',
      mainRegion: 'cn-hangzhou (华东 1)',
      lastSynced: 'Just now',
      creationDate: new Date().toISOString().substring(0, 10) + ' 12:00 UTC',
      owner: 'sysadmin@aliyun.com',
      accessKeyId: '',
      accessKeySecret: '',
      roleArn: '',
      managedRegions: 'cn-hangzhou',
      trafficDefaults: {
        maximumTrafficGb: 200,
        overflowAction: 'notify',
        monitoringEnabled: true,
      },
    });
    setName('');
    setAccessKeyId('');
    setAccessKeySecret('');
    setRoleArn('');
    setManagedRegions('cn-hangzhou, cn-beijing, cn-shanghai');
    setMainRegion('cn-hangzhou (华东 1)');
    setOwner('sysadmin@aliyun.com');
  };

  const handleSave = async () => {
    if (!name || !accessKeyId || !accessKeySecret) {
      alert('请输入必填字段：账户名称、Access Key ID、Access Key Secret');
      return;
    }
    try {
      await saveAccountMutation.mutateAsync({
        id: isCreating ? undefined : selectedAccount?.id,
        name,
        siteType: mainRegion.includes('cn-') ? 'domestic' : 'international',
        accessKeyId,
        accessKeySecret,
        regions: managedRegions.split(',').map((item) => item.trim()).filter(Boolean),
        regionId: managedRegions.split(',')[0]?.trim() || mainRegion,
        zoneId: mainRegion,
        ossBucket: '',
        ossEndpoint: mainRegion.includes('cn-') ? 'oss-cn-hangzhou.aliyuncs.com' : 'oss-cn-hongkong.aliyuncs.com',
      });
      setIsCreating(false);
      setSelectedAccount(null);
    } catch (error) {
      alert(error instanceof Error ? error.message : '保存失败');
    }
  };

  // Get status color styling helper
  const getStatusStyle = (status: CloudAccount['status']) => {
    switch (status) {
      case 'Active':
        return 'bg-[#E6F4EA] text-healthy-green border-[#C3E6CB]';
      case 'Sync Delayed':
        return 'bg-[#FFF4E5] text-signal-amber border-[#FFE0B2]';
      case 'Auth Failed':
        return 'bg-[#FFEBEE] text-recovery-red border-[#FFCDD2]';
      case 'Inactive':
        return 'bg-emphasis-layer text-outline border-outline-variant';
      default:
        return 'bg-emphasis-layer text-outline border-outline-variant';
    }
  };

  return (
    <div className="font-sans flex flex-col gap-6">
      <AnimatePresence mode="wait">
        {!selectedAccount ? (
          /* ================== TAB LISTING VIEW ================== */
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col gap-6"
          >
            {/* Header section */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h1 className="text-xl font-bold font-space text-primary-ink flex items-center gap-2">
                  账户管理
                </h1>
                <p className="text-xs text-secondary-ink mt-1">
                  管理和配置跨地域、跨业务组互联的阿里云多账户凭证，驱动资源编排链路。
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setSearch('');
                    setStatusFilter('ALL');
                    setCurrentPage(1);
                  }}
                  className="px-4 py-2 bg-surface-white border border-hairline-divider text-primary-ink text-xs rounded hover:bg-emphasis-layer transition-colors flex items-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>同步全部 accounts</span>
                </button>
                <button
                  onClick={handleCreateClick}
                  className="px-4 py-2 bg-primary text-white text-xs rounded hover:bg-primary-container font-medium transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>添加账号 Credential</span>
                </button>
              </div>
            </div>

            {/* Main listing card */}
            <div className="bg-surface-white border border-hairline-divider rounded-lg overflow-hidden shadow-sm flex flex-col">
              {/* Filtering ribbon bar */}
              <div className="p-4 border-b border-hairline-divider bg-section-layer flex flex-wrap items-center justify-between gap-4">
                <div className="relative w-64">
                  <Search className="absolute left-3 top-2.5 text-outline w-3.5 h-3.5" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="按账户名、ID或宿地域搜索..."
                    className="w-full pl-9 pr-4 py-2 bg-surface-white border border-hairline-divider rounded text-xs select-none focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder-outline-variant"
                  />
                </div>

                <div className="flex items-center gap-4 text-xs font-medium text-primary-ink select-none">
                  <span className="text-secondary-ink text-[11px] font-bold uppercase tracking-wider">过滤状态:</span>
                  <div className="flex bg-surface-white border border-hairline-divider rounded p-0.5">
                    {['ALL', 'Active', 'Sync Delayed', 'Auth Failed', 'Inactive'].map((st) => (
                      <button
                        key={st}
                        onClick={() => {
                          setStatusFilter(st);
                          setCurrentPage(1);
                        }}
                        className={`px-2.5 py-1 text-[11px] rounded transition-colors cursor-pointer ${
                          statusFilter === st
                            ? 'bg-primary text-white font-semibold shadow-xs'
                            : 'text-on-surface-variant hover:bg-emphasis-layer'
                        }`}
                      >
                        {st === 'ALL' ? '全部' : st}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Table rendering content */}
              <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap text-xs">
                  <thead className="bg-[#FAFBFD] border-b border-hairline-divider text-secondary-ink font-semibold uppercase tracking-wider text-[10px]">
                    <tr>
                      <th className="px-5 py-3.5">账户名称 / Account Name</th>
                      <th className="px-5 py-3.5">Account ID</th>
                      <th className="px-5 py-3.5">受托管主地域 / Region</th>
                      <th className="px-5 py-3.5">探测同步状态</th>
                      <th className="px-5 py-3.5">上次同步检测</th>
                      <th className="px-5 py-3.5 text-right w-24">操作指令</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline-divider/70 text-on-surface font-sans">
                    {paginatedAccounts.length > 0 ? (
                      paginatedAccounts.map((acc) => (
                        <tr
                          key={acc.id}
                          className="hover:bg-emphasis-layer/40 transition-colors group cursor-pointer"
                          onClick={() => handleEditClick(acc)}
                        >
                          <td className="px-5 py-3.5 font-semibold text-primary-ink relative">
                            {acc.status === 'Auth Failed' && (
                              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-recovery-red"></div>
                            )}
                            <div className="flex flex-col">
                              <span>{acc.name}</span>
                              <span className="text-[10px] text-secondary-ink font-mono font-normal">
                                {acc.owner}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3.5 font-mono text-secondary-ink select-all">
                            {acc.id}
                          </td>
                          <td className="px-5 py-3.5 text-secondary-ink font-medium">
                            {acc.providerRegion}
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[10px] font-semibold ${getStatusStyle(acc.status)}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                acc.status === 'Active' ? 'bg-healthy-green' : acc.status === 'Sync Delayed' ? 'bg-signal-amber' : acc.status === 'Auth Failed' ? 'bg-recovery-red animate-pulse' : 'bg-outline'
                              }`} />
                              {acc.status}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-secondary-ink font-mono">
                            {acc.lastSynced}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {/* Actions visible on hover/focus */}
                            <div className="flex items-center justify-end gap-1.5 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleEditClick(acc);
                                }}
                                className="p-1.5 text-on-surface-variant hover:text-primary hover:bg-emphasis-layer rounded transition-colors"
                                title="编辑配置"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 text-on-surface-variant hover:text-recovery-red hover:bg-emphasis-layer rounded transition-colors"
                                title="删除能力未开放"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="text-center py-10 text-secondary-ink bg-section-layer/20 border-dashed border-t">
                          无匹配过滤账号凭据，请重新输入或清空过滤器。
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination block */}
              <div className="px-5 py-3 bg-[#FAFBFD] border-t border-hairline-divider flex items-center justify-between text-secondary-ink font-medium text-[11px] select-none">
                <div>
                  显示 {filteredAccounts.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} 至{' '}
                  {Math.min(currentPage * pageSize, filteredAccounts.length)} 个账号，共 {filteredAccounts.length} 个
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((c) => Math.max(c - 1, 1))}
                      className="p-1 rounded border border-hairline-divider bg-white hover:bg-emphasis-layer disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-3 font-mono">Page {currentPage} of {totalPages}</span>
                    <button
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((c) => Math.min(c + 1, totalPages))}
                      className="p-1 rounded border border-hairline-divider bg-white hover:bg-emphasis-layer disabled:opacity-40 transition-colors cursor-pointer"
                    >
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Static context syncing statement policy */}
            <div className="bg-section-layer border border-hairline-divider rounded-lg p-4 flex gap-4 items-start shadow-xs">
              <ShieldAlert className="w-5 h-5 text-secondary shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-primary-ink">
                  多云资源安全编排隔离隔离准则 (Account Syncing Rules)
                </h4>
                <p className="text-[11px] text-secondary-ink mt-1 leading-relaxed max-w-4xl">
                  此平台采用高强度 KMS 加密层对 AccessKeySecret 进行本地加密封存。数据中心每 15 分钟会轮询各云厂商 API 探测可用性。部分地域（例如 Aliyun China East 2）如果触发 Auth Failed 故障，请优先确认对应的 RAM Policy ARN 所扮演的角色权限已分配。
                </p>
              </div>
            </div>
          </motion.div>
        ) : (
          /* ================== DETAILED VIEW / EDITOR ================== */
          <motion.div
            key="details"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col gap-6"
          >
            {/* Header with back navigation anchor */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedAccount(null)}
                  className="p-1.5 border border-hairline-divider bg-surface-white hover:bg-emphasis-layer rounded transition-colors text-on-surface-variant cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <div className="h-5 w-[1px] bg-hairline-divider"></div>
                <div>
                  <h1 className="text-lg font-bold text-primary-ink font-space flex items-center gap-2">
                    {isCreating ? '添加托管云授权凭证' : '凭据配置详情'}
                    <span className="text-xs font-mono font-normal bg-emphasis-layer px-2 py-0.5 rounded text-secondary border border-primary-fixed">
                      {selectedAccount.id}
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
                {!isCreating && (
                  <section className="bg-surface-white border border-hairline-divider rounded-lg p-5 shadow-xs">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-xs font-bold uppercase tracking-wider text-outline">托管资源摘要 (Resource Metrics)</h2>
                      <span className="text-[11px] text-secondary font-semibold font-mono">
                        VPC 通道连接就绪
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-section-layer p-4 rounded border border-hairline-divider/50 flex flex-col gap-0.5">
                        <div className="text-secondary-ink flex items-center gap-1.5">
                          <Server className="w-3.5 h-3.5" />
                          <span className="text-[11px]">ECS 运行实例</span>
                        </div>
                        <span className="text-xl font-bold font-space text-primary-ink mt-1">142 <span className="text-[10px] text-secondary-ink font-normal font-sans">个总计</span></span>
                      </div>

                      <div className="bg-section-layer p-4 rounded border border-hairline-divider/50 flex flex-col gap-0.5">
                        <div className="text-secondary-ink flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5" />
                          <span className="text-[11px]">VPC 核心专线</span>
                        </div>
                        <span className="text-xl font-bold font-space text-primary-ink mt-1">8 <span className="text-[10px] text-secondary-ink font-normal font-sans">路已联</span></span>
                      </div>

                      <div className="bg-section-layer p-4 rounded border border-hairline-divider/50 flex flex-col gap-0.5">
                        <div className="text-secondary-ink flex items-center gap-1.5">
                          <KeyRound className="w-3.5 h-3.5" />
                          <span className="text-[11px]">EIP 安全公网</span>
                        </div>
                        <span className="text-xl font-bold font-space text-primary-ink mt-1">24 <span className="text-[10px] text-secondary-ink font-normal font-sans">组配置</span></span>
                      </div>
                    </div>
                  </section>
                )}

                {/* Form fields settings card */}
                <section className="bg-surface-white border border-hairline-divider rounded-lg shadow-xs flex flex-col overflow-hidden">
                  <header className="px-5 py-3.5 border-b border-hairline-divider bg-[#FAFBFD] flex items-center justify-between">
                    <h2 className="text-xs font-bold uppercase tracking-wider text-outline flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-primary" />
                      API Credentials & Role ARN Access Policy
                    </h2>
                    {selectedAccount.status === 'Auth Failed' && (
                      <span className="bg-[#FFEBEE] border border-recovery-red/30 text-recovery-red px-2.5 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1">
                        🔑 密匙检测失效，请输入正确密钥重连
                      </span>
                    )}
                  </header>

                  <div className="p-5 flex flex-col gap-4">
                    {/* Account Title block */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-secondary-ink uppercase tracking-wider">账户配置名称 (Account Target ID) *</label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="例如: Production Core, Staging Environment..."
                        className="w-full px-3.5 py-2 border border-hairline-divider rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary placeholder-outline-variant font-medium text-primary-ink"
                      />
                    </div>

                    {/* Access credentials grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* AK ID */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold text-secondary-ink uppercase tracking-wider">Access Key ID *</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={accessKeyId}
                            onChange={(e) => setAccessKeyId(e.target.value)}
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
                        <label className="text-[11px] font-bold text-secondary-ink uppercase tracking-wider">Access Key Secret *</label>
                        <div className="relative">
                          <input
                            type={showSecret ? 'text' : 'password'}
                            value={accessKeySecret}
                            onChange={(e) => setAccessKeySecret(e.target.value)}
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
                        <span>假定角色 ARN (Assume Role ARN - 可选)</span>
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

                    {/* Managed Regions */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[11px] font-bold text-secondary-ink uppercase tracking-wider flex items-center justify-between">
                        <span>管理地域限制 (Managed Cloud Regions)</span>
                        <span className="text-[9px] text-[#0058bc]">可选多个，逗号分割</span>
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={managedRegions}
                          onChange={(e) => setManagedRegions(e.target.value)}
                          placeholder="例如: cn-hangzhou, cn-beijing, cn-shanghai"
                          className="w-full pl-3.5 pr-10 py-2 border border-hairline-divider rounded text-xs focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary text-primary-ink font-medium"
                        />
                        <span className="absolute right-3 top-2.5 text-outline">
                          <MapPin className="w-4 h-4" />
                        </span>
                      </div>
                      <p className="text-[10px] text-secondary-ink mt-0.5 leading-normal">
                        锁定此云账户拉取实例的白名单。仅同步并在拓扑分析器中显示以上限定的地域资源。
                      </p>
                    </div>

                    {/* Additional fields if creating */}
                    {isCreating && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-1 bg-section-layer/50 p-4 border rounded-md">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-bold text-secondary-ink uppercase">责任人 (Main Owner)</label>
                          <input
                            type="email"
                            value={owner}
                            onChange={(e) => setOwner(e.target.value)}
                            className="w-full px-3 py-1.5 border border-hairline-divider rounded text-xs bg-white text-primary-ink"
                          />
                        </div>
                        <div className="flex flex-col gap-1.5">
                          <label className="text-[11px] font-bold text-secondary-ink uppercase">主注册地域</label>
                          <input
                            type="text"
                            value={mainRegion}
                            onChange={(e) => setMainRegion(e.target.value)}
                            className="w-full px-3 py-1.5 border border-hairline-divider rounded text-xs bg-white text-primary-ink"
                          />
                        </div>
                      </div>
                    )}

                    {/* Footer operations */}
                    <div className="flex justify-end gap-2.5 mt-5 pt-5 border-t border-hairline-divider">
                      <button
                        type="button"
                        onClick={() => setSelectedAccount(null)}
                        className="px-5 py-2 border border-hairline-divider text-primary-ink bg-white font-medium hover:bg-emphasis-layer rounded text-xs transition-colors cursor-pointer"
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        onClick={handleSave}
                        className="px-5 py-2 bg-primary hover:bg-primary-container font-semibold font-space text-white rounded text-xs transition-colors cursor-pointer shadow-xs active:scale-98"
                      >
                        保存凭据并测试重连
                      </button>
                    </div>
                  </div>
                </section>
              </div>

              {/* Sidebar Account Metadata Card (span 4) */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                <section className="bg-surface-white border border-hairline-divider rounded-lg p-5 shadow-xs flex flex-col gap-5">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-outline border-b pb-3 border-hairline-divider/50">
                    账户元数据 (Metadata Console)
                  </h3>

                  <div className="flex flex-col gap-4 text-xs font-sans">
                    <div>
                      <span className="text-[11px] text-secondary-ink font-semibold uppercase tracking-wider">云账户物理名称</span>
                      <div className="font-bold text-primary-ink mt-1 font-space">
                        {isCreating ? name || 'Pending Name' : selectedAccount.name}
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] text-secondary-ink font-semibold uppercase tracking-wider">数据同步状态</span>
                      <div className="mt-1.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold border ${getStatusStyle(selectedAccount.status)}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            selectedAccount.status === 'Active' ? 'bg-healthy-green' : selectedAccount.status === 'Sync Delayed' ? 'bg-signal-amber' : selectedAccount.status === 'Auth Failed' ? 'bg-recovery-red' : 'bg-outline'
                          }`} />
                          {selectedAccount.status === 'Active' ? '运行中 (Active)' : selectedAccount.status === 'Auth Failed' ? '认证失效 (Failed)' : selectedAccount.status}
                        </span>
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] text-secondary-ink font-semibold uppercase tracking-wider">注册主拓扑宿地域 (Billing Zone)</span>
                      <div className="text-primary-ink mt-1 flex items-center gap-2 font-medium">
                        <MapPin className="w-3.5 h-3.5 text-outline" />
                        {isCreating ? mainRegion : selectedAccount.mainRegion}
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] text-secondary-ink font-semibold uppercase tracking-wider">关联导入日期</span>
                      <div className="text-primary-ink mt-1 flex items-center gap-2 font-mono font-medium">
                        <Calendar className="w-3.5 h-3.5 text-outline" />
                        {selectedAccount.creationDate}
                      </div>
                    </div>

                    <div>
                      <span className="text-[11px] text-secondary-ink font-semibold uppercase tracking-wider">项目安全所有者</span>
                      <div className="text-primary-ink mt-1 flex items-center gap-2 font-medium">
                        <User className="w-3.5 h-3.5 text-outline" />
                        {isCreating ? owner : selectedAccount.owner}
                      </div>
                    </div>
                  </div>

                  {!isCreating && (
                    <div className="pt-4 border-t border-hairline-divider mt-2 flex flex-col gap-2">
                      <button 
                        onClick={() => {
                          setSelectedAuditLog([
                            `[2026-06-16 10:14:15 UTC] - Operator SYSTEM initiated sync scan on ${selectedAccount.name}`,
                            `[2026-06-16 10:14:16 UTC] - Handshake metadata check - Success`,
                            `[2026-06-16 10:14:18 UTC] - Pulled 142 ECS instances metadata successfully.`,
                            `[2026-06-16 10:14:20 UTC] - KMS secret decryption verify code matches - Signature matches`,
                          ]);
                          setShowAudits(true);
                        }}
                        className="w-full flex items-center justify-center gap-2 py-2 text-on-surface-variant hover:text-primary-ink hover:bg-emphasis-layer border border-hairline-divider bg-white rounded text-xs transition-colors cursor-pointer font-medium"
                      >
                        <History className="w-4 h-4 text-outline" />
                        查看操作日志 (API Logs)
                      </button>
                    </div>
                  )}
                </section>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audit log visual Modal */}
      {showAudits && selectedAuditLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-ink/45 backdrop-blur-xs font-sans">
          <div className="bg-[#0d1117] border border-[#30363d] w-full max-w-xl rounded-lg overflow-hidden shadow-xl flex flex-col">
            <header className="px-4 py-3 bg-[#161b22] border-b border-[#30363d] flex justify-between items-center text-white">
              <span className="text-xs font-bold font-mono text-[#c9d1d9] flex items-center gap-2">
                <FileCode className="w-4 h-4 text-primary" />
                API Audit Operations Log - {selectedAccount?.name}
              </span>
              <button 
                onClick={() => {
                  setShowAudits(false);
                  setSelectedAuditLog(null);
                }}
                className="text-xs text-[#8b949e] hover:text-white cursor-pointer px-2 py-0.5 rounded hover:bg-white/10"
              >
                关闭
              </button>
            </header>
            <div className="p-4 flex flex-col gap-2 font-mono text-[11px] text-[#c9d1d9] bg-[#0d1117] select-all max-h-80 overflow-y-auto">
              {selectedAuditLog.map((log, idx) => (
                <div key={idx} className="line-clamp-2">
                  <span className="text-[#8b949e]">{log.substring(0, 27)}</span>
                  <span className="text-[#58a6ff]">{log.substring(27)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
