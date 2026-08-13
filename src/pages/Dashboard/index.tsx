import {AlertTriangle, Cpu, Globe, Server} from 'lucide-react';
import {useNavigate} from 'react-router-dom';

import type {CloudAccount, DashboardSummary, ECSInstance, WorkflowRun} from '../../types';
import {useRuntimeDashboard} from '../../features/runtime/hooks';
import SummaryCard from './components/SummaryCard';

// 状态枚举 → 中文展示映射（后端枚举值不翻译，仅显示层映射）
const ACCOUNT_STATUS_LABELS: Record<CloudAccount['status'], string> = {
  'Active': '运行中',
  'Sync Delayed': '同步延迟',
  'Auth Failed': '认证失败',
  'Inactive': '已停用',
};

const WORKFLOW_STATUS_LABELS: Record<WorkflowRun['status'], string> = {
  'Running': '运行中',
  'Success': '成功',
  'Failed': '失败',
  'Idle': '空闲',
};

export default function DashboardPage() {
  const runtime = useRuntimeDashboard();
  const navigate = useNavigate();
  const {accounts, instances, summary, workflows} = runtime;

  const attentionInstances = instances.filter((instance) => instance.alerts.length > 0 || instance.status === 'Attention');
  const latestWorkflows = workflows.slice(0, 5);

  /**
   * @when 仪表盘按钮点击跳转对应页面时触发
   */
  const openPage = (path: string) => {
    navigate(path);
  };

  /**
   * @when 账号状态卡片点击进入该账号详情时触发
   */
  const openAccount = (account: CloudAccount) => {
    navigate(`/accounts/${account.id}`);
  };

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-space text-2xl font-bold text-primary-ink">控制台概览</h1>
          <p className="mt-1 text-sm text-secondary-ink">摘要、实例风险和作业状态均来自后端 API 与 runtime 事件流。</p>
        </div>
        <button
          className="rounded border border-hairline-divider bg-surface-white px-4 py-2 text-sm font-medium text-primary-ink hover:bg-emphasis-layer"
          onClick={() => openPage('/settings')}
        >
          系统设置
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="账户" value={summary.accountCount} hint="已接入控制面的账号" icon={<Globe className="h-5 w-5" />} />
        <SummaryCard label="ECS" value={summary.ecsCount} hint="发现到的实例总数" icon={<Server className="h-5 w-5" />} />
        <SummaryCard label="EIP" value={summary.eipCount} hint="图谱中已绑定或待绑定的公网地址" icon={<Cpu className="h-5 w-5" />} />
        <SummaryCard label="风险实例" value={summary.attentionInstanceCount} hint="接近阈值或监控异常" icon={<AlertTriangle className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_1fr]">
        <section className="rounded-lg border border-hairline-divider bg-surface-white p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-primary-ink">账号状态</h2>
              <p className="mt-1 text-xs text-secondary-ink">点击进入账号详情或凭据编辑。</p>
            </div>
            <button className="text-sm text-primary hover:underline" onClick={() => openPage('/accounts')}>
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
                    openAccount(account);
                  }}
                >
                  <div>
                    <div className="font-medium text-primary-ink">{account.name}</div>
                    <div className="mt-1 text-xs text-secondary-ink">
                      {account.mainRegion} · 最近同步 {account.lastSynced}
                    </div>
                  </div>
                  <span className="rounded bg-emphasis-layer px-2 py-1 text-xs text-secondary-ink">{ACCOUNT_STATUS_LABELS[account.status]}</span>
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
            <button className="text-sm text-primary hover:underline" onClick={() => openPage('/instances')}>
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
          <button className="text-sm text-primary hover:underline" onClick={() => openPage('/workflows')}>
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
                <span className="rounded bg-emphasis-layer px-2 py-1 text-xs text-secondary-ink">{WORKFLOW_STATUS_LABELS[workflow.status]}</span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
