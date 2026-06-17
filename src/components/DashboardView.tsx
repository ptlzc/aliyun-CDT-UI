import { CloudAccount, ECSInstance, WorkflowRun } from '../types';
import { Server, KeyRound, Cpu, AlertTriangle, Play, RefreshCw, Terminal, ArrowRight, ShieldCheck, CheckCircle, Flame } from 'lucide-react';
import { motion } from 'motion/react';

interface DashboardViewProps {
  accounts: CloudAccount[];
  instances: ECSInstance[];
  workflows: WorkflowRun[];
  setActiveTab: (tab: 'dashboard' | 'accounts' | 'instances' | 'workflows') => void;
  setSelectedAccount: (account: CloudAccount | null) => void;
}

export default function DashboardView({ accounts, instances, workflows, setActiveTab, setSelectedAccount }: DashboardViewProps) {
  const activeWorkflows = workflows.filter(w => w.status === 'Running');
  const alertInstances = instances.filter(i => i.status === 'High CPU' || i.alerts.length > 0);
  const inactiveInstances = instances.filter(i => i.status === 'Stopped');
  
  // Dynamic metrics
  const totalEcs = accounts.reduce((acc, curr) => {
    // Simulated sum based on account weights
    if (curr.id === 'ali-prod-192837') return acc + 142;
    if (curr.id === 'ali-stg-847291') return acc + 12;
    return acc + 5;
  }, 0);

  const totalVpc = accounts.reduce((acc, curr) => {
    if (curr.id === 'ali-prod-192837') return acc + 8;
    return acc + 1;
  }, 0);

  const totalEip = accounts.reduce((acc, curr) => {
    if (curr.id === 'ali-prod-192837') return acc + 24;
    return acc + 2;
  }, 0);

  const authFailedAccounts = accounts.filter(a => a.status === 'Auth Failed');

  return (
    <div className="flex flex-col gap-6 font-sans">
      {/* Global Stats Counter Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div id="stat-ecs-total" className="bg-surface-white p-5 rounded-lg border border-hairline-divider shadow-xs flex items-center justify-between">
          <div>
            <span className="block text-[11px] uppercase tracking-wider text-secondary-ink font-semibold">ECS 实例总数</span>
            <span className="text-2xl font-bold font-space text-primary-ink mt-1 block">{totalEcs} <span className="text-xs font-normal text-secondary-ink">Units</span></span>
          </div>
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Server className="w-5 h-5" />
          </div>
        </div>

        <div id="stat-active-workflows" className="bg-surface-white p-5 rounded-lg border border-hairline-divider shadow-xs flex items-center justify-between">
          <div>
            <span className="block text-[11px] uppercase tracking-wider text-secondary-ink font-semibold">活动工作流</span>
            <span className="text-2xl font-bold font-space text-primary-ink mt-1 block">{activeWorkflows.length} <span className="text-[10px] text-signal-amber font-semibold animate-pulse">Running</span></span>
          </div>
          <div className="w-10 h-10 rounded-full bg-signal-amber/10 flex items-center justify-center text-signal-amber">
            <Cpu className="w-5 h-5" />
          </div>
        </div>

        <div id="stat-controlled-accounts" className="bg-surface-white p-5 rounded-lg border border-hairline-divider shadow-xs flex items-center justify-between">
          <div>
            <span className="block text-[11px] uppercase tracking-wider text-secondary-ink font-semibold">受控云账号</span>
            <span className="text-2xl font-bold font-space text-primary-ink mt-1 block">{accounts.length} / 12</span>
          </div>
          <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center text-secondary">
            <KeyRound className="w-5 h-5" />
          </div>
        </div>

        <div id="stat-alerts-warnings" className="bg-surface-white p-5 rounded-lg border border-hairline-divider shadow-xs flex items-center justify-between">
          <div>
            <span className="block text-[11px] uppercase tracking-wider text-secondary-ink font-semibold">凭期预警警告</span>
            <span className="text-2xl font-bold font-space text-recovery-red mt-1 block">{authFailedAccounts.length + alertInstances.length} <span className="text-xs font-normal text-secondary-ink">Alerts</span></span>
          </div>
          <div className="w-10 h-10 rounded-full bg-recovery-red/10 flex items-center justify-center text-recovery-red">
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Grid contents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left span 2: Workflows and Alerts */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Active Workflows Panel */}
          <section className="bg-surface-white border border-hairline-divider rounded-lg p-5 flex flex-col gap-3 shadow-xs">
            <div className="flex items-center justify-between border-b pb-3 border-hairline-divider/50">
              <h3 className="text-sm font-bold text-primary-ink flex items-center gap-2">
                <Cpu className="w-4 h-4 text-primary" />
                正在运行的集成工作流 (Active Deployments)
              </h3>
              <button 
                onClick={() => setActiveTab('workflows')} 
                className="text-xs text-secondary hover:underline flex items-center gap-1 font-medium"
              >
                进入自动化流面板 <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {activeWorkflows.length > 0 ? (
              <div className="space-y-4">
                {activeWorkflows.map((wkf) => {
                  const activeTask = wkf.tasks[wkf.activeStepIndex];
                  return (
                    <div key={wkf.id} className="border border-emphasis-layer bg-workspace-canvas/50 p-4 rounded-md">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-primary">{wkf.name}</span>
                            <span className="bg-emphasis-layer border border-primary-fixed text-secondary font-mono px-1.5 py-0.5 rounded text-[10px]">
                              {wkf.id}
                            </span>
                          </div>
                          <p className="text-[11px] text-secondary-ink mt-1">
                            发起网关: {wkf.initiatedBy} • 目标地域: {wkf.targetRegion}
                          </p>
                        </div>
                        <span className="text-xs font-semibold text-signal-amber flex items-center gap-1">
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          运行节点: {activeTask?.name || 'Provisioning'}
                        </span>
                      </div>

                      {/* Micro Stepper preview */}
                      <div className="grid grid-cols-4 gap-2 text-center text-[10px] mt-4 mb-3">
                        {['发现资源', '网关启动', '实例置备', '上线审计'].map((nTitle, idx) => {
                          const isDone = idx < wkf.activeStepIndex;
                          const isCurrent = idx === wkf.activeStepIndex;
                          return (
                            <div key={idx} className="flex flex-col items-center gap-1.5">
                              <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                isDone ? 'bg-healthy-green text-white' : isCurrent ? 'bg-primary text-white animate-pulse' : 'bg-emphasis-layer text-outline'
                              }`}>
                                {isDone ? '✓' : idx + 1}
                              </div>
                              <span className={isCurrent ? 'text-primary font-semibold' : 'text-secondary-ink'}>{nTitle}</span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="mt-3 bg-secondary/5 border border-secondary/15 rounded p-2.5 text-xs text-secondary flex items-start gap-2.5">
                        <Terminal className="w-4 h-4 mt-0.5 shrink-0" />
                        <div className="flex-1 font-mono text-[11px] overflow-hidden text-ellipsis whitespace-nowrap">
                          LATEST LOG: {wkf.logs[wkf.logs.length - 1]}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 text-center bg-section-layer/40 rounded border border-dashed border-hairline-divider flex flex-col items-center gap-2">
                <CheckCircle className="w-8 h-8 text-healthy-green" />
                <span className="text-xs font-semibold text-primary-ink">当前没有活动的置备任务</span>
                <p className="text-[11px] text-secondary-ink">所有系统微服务均处于正常、已同步的完成形态。</p>
              </div>
            )}
          </section>

          {/* Account Credential and Warning Alerts Panel */}
          <section className="bg-surface-white border border-hairline-divider rounded-lg p-5 flex flex-col gap-3 shadow-xs">
            <h3 className="text-sm font-bold text-primary-ink border-b pb-3 border-hairline-divider/50 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-healthy-green" />
              账号凭据过期审计预警 (Credentials Audit Alert)
            </h3>

            {authFailedAccounts.length > 0 ? (
              <div className="space-y-3">
                {authFailedAccounts.map((acc) => (
                  <div key={acc.id} className="border border-recovery-red/20 bg-recovery-red/[0.02] p-3 rounded-md flex justify-between items-start">
                    <div className="flex gap-2.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-recovery-red mt-1.5"></div>
                      <div>
                        <div className="text-xs font-semibold text-primary-ink">{acc.name} ({acc.id})</div>
                        <p className="text-[11px] text-secondary-ink mt-0.5">
                          主地域: {acc.mainRegion} • 失败类型: 凭据检测握手失败。RAM 角色扮演权限不足。
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedAccount(acc);
                        setActiveTab('accounts');
                      }}
                      className="px-2.5 py-1 text-[11px] text-primary hover:text-white hover:bg-primary border border-primary/30 rounded font-medium transition-colors cursor-pointer"
                    >
                      修改凭据
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 bg-healthy-green/5 border border-healthy-green/20 rounded-md flex items-center gap-2.5 text-xs text-healthy-green font-medium">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>所有托管云账号身份凭证在有效期内，无角色越权或扮演失败警告。</span>
              </div>
            )}

            {/* Warning: Hardcoded credentials expiry soon */}
            <div className="bg-signal-amber/[0.03] border border-signal-amber/20 rounded-md p-3 flex justify-between items-start mt-1">
              <div>
                <div className="text-xs font-semibold text-signal-amber flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5" />
                  主账单授权凭证将在 12 天内过期
                </div>
                <p className="text-[11px] text-secondary-ink mt-1 max-w-lg">
                  子账号 (LTAI5t7***********) 密匙关联了 Aliyun CDT 路由、云企业网、ECS 管理权限。建议提前轮转 Access Key 以防止监控数据同步中断。
                </p>
              </div>
              <button
                onClick={() => {
                  const targetAcc = accounts.find(a => a.id === 'ali-prod-192837') || null;
                  setSelectedAccount(targetAcc);
                  setActiveTab('accounts');
                }}
                className="px-2.5 py-1 border border-signal-amber/30 text-signal-amber hover:bg-signal-amber hover:text-white rounded text-[11px] font-medium transition-colors cursor-pointer"
              >
                查看凭据配置
              </button>
            </div>
          </section>
        </div>

        {/* Right column: Instance Alert center */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* Quick instance health tracking */}
          <section className="bg-surface-white border border-hairline-divider rounded-lg p-5 flex flex-col gap-4 shadow-xs">
            <h3 className="text-sm font-bold text-primary-ink border-b pb-3 border-hairline-divider/50 flex items-center gap-2">
              <Server className="w-4 h-4 text-primary" />
              ECS 性能与状态异常预警
            </h3>

            {/* Active alerts */}
            {alertInstances.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-outline">异常占用警报 ({alertInstances.length})</h4>
                {alertInstances.map(inst => (
                  <div key={inst.id} className="border border-signal-amber/20 bg-signal-amber/[0.01] p-3 rounded-md">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-xs font-bold text-primary-ink">{inst.name}</span>
                      <span className="bg-signal-amber/10 border border-signal-amber/20 text-signal-amber text-[9px] px-1.5 py-0.5 rounded font-mono font-bold uppercase">
                        {inst.status}
                      </span>
                    </div>
                    <ul className="space-y-1 pl-1">
                      {inst.alerts.map((al, idx) => (
                        <li key={idx} className="text-[10px] text-secondary-ink list-disc list-inside">
                          {al}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            {/* Stopped instances ready for work */}
            {inactiveInstances.length > 0 && (
              <div className="space-y-3">
                <h4 className="text-[11px] font-bold uppercase tracking-wider text-outline">暂停备用实例 ({inactiveInstances.length})</h4>
                {inactiveInstances.map(inst => (
                  <div key={inst.id} className="bg-section-layer border border-hairline-divider/50 p-3 rounded-md">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-xs font-medium text-primary-ink">{inst.name}</div>
                        <p className="text-[10px] text-secondary-ink mt-0.5">{inst.type} • {inst.zone}</p>
                      </div>
                      <button
                        onClick={() => setActiveTab('instances')}
                        className="p-1.5 bg-primary/10 text-primary hover:bg-primary hover:text-white rounded transition-all cursor-pointer shadow-xs active:scale-95"
                        title="Start instance"
                      >
                        <Play className="w-3 h-3 fill-current" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => setActiveTab('instances')}
              className="mt-2 w-full text-center border border-hairline-divider hover:bg-emphasis-layer text-primary-ink font-medium text-xs py-2 rounded transition-colors"
            >
              管理全部 ECS 资源
            </button>
          </section>

          {/* Quick resource summary dashboard cards */}
          <section className="bg-surface-white border border-hairline-divider rounded-lg p-5 flex flex-col gap-4 shadow-xs">
            <h3 className="text-sm font-bold text-primary-ink border-b pb-3 border-hairline-divider/50 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-primary" />
              中国主骨干 CDT 地域摘要
            </h3>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-hairline-divider/30">
                <span className="text-secondary-ink">VPC 虚拟专用专用网</span>
                <span className="font-semibold text-primary">{totalVpc} 个总计</span>
              </div>
              <div className="flex justify-between py-1 border-b border-hairline-divider/30">
                <span className="text-secondary-ink">EIP 弹性公网 IP 绑定数</span>
                <span className="font-semibold text-primary">{totalEip} 个活跃</span>
              </div>
              <div className="flex justify-between py-1 border-b border-hairline-divider/30">
                <span className="text-secondary-ink">同步成功率</span>
                <span className="font-semibold text-healthy-green">80.0% (4/5)</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-secondary-ink">最高 CPU 占用实例</span>
                <span className="font-semibold text-recovery-red">prod-db-replica (94%)</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
