import {type ReactNode} from 'react';
import {AlertTriangle, Cpu, Globe, Server} from 'lucide-react';

import type {CloudAccount, DashboardSummary, ECSInstance, WorkflowRun} from '../types';

interface DashboardViewProps {
  accounts: CloudAccount[];
  instances: ECSInstance[];
  summary: DashboardSummary;
  workflows: WorkflowRun[];
  setActiveTab: (tab: 'dashboard' | 'accounts' | 'instances' | 'workflows' | 'settings') => void;
  setSelectedAccount: (account: CloudAccount | null) => void;
}

function summaryCard(label: string, value: number, hint: string, icon: ReactNode) {
  return (
    <div className="rounded-lg border border-hairline-divider bg-surface-white p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary-ink">{label}</p>
          <p className="mt-2 text-3xl font-space font-bold text-primary-ink">{value}</p>
          <p className="mt-1 text-xs text-secondary-ink">{hint}</p>
        </div>
        <div className="rounded-full bg-emphasis-layer p-3 text-primary">{icon}</div>
      </div>
    </div>
  );
}

export default function DashboardView({
  accounts,
  instances,
  summary,
  workflows,
  setActiveTab,
  setSelectedAccount,
}: DashboardViewProps) {
  const attentionInstances = instances.filter((instance) => instance.alerts.length > 0 || instance.status === 'Attention');
  const latestWorkflows = workflows.slice(0, 5);

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-space text-2xl font-bold text-primary-ink">控制台概览</h1>
          <p className="mt-1 text-sm text-secondary-ink">摘要、实例风险和作业状态均来自后端 API 与 runtime 事件流。</p>
        </div>
        <button
          className="rounded border border-hairline-divider bg-surface-white px-4 py-2 text-sm font-medium text-primary-ink hover:bg-emphasis-layer"
          onClick={() => setActiveTab('settings')}
        >
          系统设置
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCard('账户', summary.accountCount, '已接入控制面的账号', <Globe className="h-5 w-5" />)}
        {summaryCard('ECS', summary.ecsCount, '发现到的实例总数', <Server className="h-5 w-5" />)}
        {summaryCard('EIP', summary.eipCount, '图谱中已绑定或待绑定的公网地址', <Cpu className="h-5 w-5" />)}
        {summaryCard('风险实例', summary.attentionInstanceCount, '接近阈值或监控异常', <AlertTriangle className="h-5 w-5" />)}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <section className="rounded-lg border border-hairline-divider bg-surface-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-primary-ink">账号状态</h2>
              <p className="mt-1 text-xs text-secondary-ink">点击进入账号详情或凭据编辑。</p>
            </div>
            <button className="text-sm text-primary hover:underline" onClick={() => setActiveTab('accounts')}>
              查看全部
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {accounts.length === 0 ? (
              <div className="rounded border border-dashed border-hairline-divider p-6 text-sm text-secondary-ink">暂无账号数据。</div>
            ) : (
              accounts.slice(0, 6).map((account) => (
                <button
                  key={account.id}
                  className="flex w-full items-center justify-between rounded border border-hairline-divider px-4 py-3 text-left hover:bg-emphasis-layer/40"
                  onClick={() => {
                    setSelectedAccount(account);
                    setActiveTab('accounts');
                  }}
                >
                  <div>
                    <div className="font-medium text-primary-ink">{account.name}</div>
                    <div className="mt-1 text-xs text-secondary-ink">
                      {account.mainRegion} · 最近同步 {account.lastSynced}
                    </div>
                  </div>
                  <span className="rounded bg-emphasis-layer px-2 py-1 text-xs text-secondary-ink">{account.status}</span>
                </button>
              ))
            )}
          </div>
        </section>

        <section className="rounded-lg border border-hairline-divider bg-surface-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-primary-ink">实例风险</h2>
              <p className="mt-1 text-xs text-secondary-ink">流量上限、监控开关与 EIP 绑定来自图谱数据。</p>
            </div>
            <button className="text-sm text-primary hover:underline" onClick={() => setActiveTab('instances')}>
              管理实例
            </button>
          </div>
          <div className="mt-4 space-y-3">
            {attentionInstances.length === 0 ? (
              <div className="rounded border border-dashed border-hairline-divider p-6 text-sm text-secondary-ink">当前没有需要处理的实例告警。</div>
            ) : (
              attentionInstances.slice(0, 6).map((instance) => (
                <div key={instance.id} className="rounded border border-signal-amber/30 bg-signal-amber/[0.05] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-medium text-primary-ink">{instance.name}</div>
                    <span className="text-xs font-semibold text-signal-amber">
                      {instance.trafficUsage === null ? '累计流量不可用' : `${instance.trafficUsage}/${instance.trafficLimit} ${instance.trafficUsageUnit}`}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-secondary-ink">
                    外网 {instance.publicIp} · 内网 {instance.privateIp}
                  </div>
                  <div className="mt-1 text-xs text-secondary-ink">
                    当前速率 {instance.trafficRate === null ? '不可用' : `${instance.trafficRate} ${instance.trafficRateUnit}`}
                  </div>
                  {instance.alerts.length > 0 && <div className="mt-2 text-xs text-signal-amber">{instance.alerts[0]}</div>}
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="rounded-lg border border-hairline-divider bg-surface-white p-5 shadow-xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-primary-ink">最近作业</h2>
            <p className="mt-1 text-xs text-secondary-ink">后端作业快照和 WebSocket 增量事件合并展示。</p>
          </div>
          <button className="text-sm text-primary hover:underline" onClick={() => setActiveTab('workflows')}>
            打开工作流
          </button>
        </div>
        <div className="mt-4 space-y-3">
          {latestWorkflows.length === 0 ? (
            <div className="rounded border border-dashed border-hairline-divider p-6 text-sm text-secondary-ink">暂无作业记录。</div>
          ) : (
            latestWorkflows.map((workflow) => (
              <div key={workflow.id} className="flex items-center justify-between rounded border border-hairline-divider px-4 py-3">
                <div>
                  <div className="font-medium text-primary-ink">{workflow.name}</div>
                  <div className="mt-1 text-xs text-secondary-ink">
                    {workflow.targetRegion} · {workflow.duration}
                  </div>
                </div>
                <span className="rounded bg-emphasis-layer px-2 py-1 text-xs text-secondary-ink">{workflow.status}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
