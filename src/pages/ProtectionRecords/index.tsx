import {useMemo, useState} from 'react';
import {useQueries} from '@tanstack/react-query';
import {Search} from 'lucide-react';

import {runtimeKeys, useAccountsQuery} from '../../features/runtime/hooks';
import {listTrafficAudits, type ApiActionAudit, type TrafficAuditFilters} from '../../lib/api/client';
import {ACTION_OPTIONS, actionLabelZh} from '../../utils/actionLabels';
import {formatDateLabel} from '../../utils/dateFormat';
import {regionNameZh} from '../../utils/regionNames';

/**
 * Protection actions shown by default: the governed-scan and traffic-policy
 * writers. manual-power (manual start/stop) is intentionally excluded — it
 * stays visible per-account in the Accounts audit log modal.
 */
const PROTECTION_TRIGGERED_BY = ['traffic-governance', 'traffic-policy'];

const AUDIT_STATUS_LABELS: Record<string, string> = {
  succeeded: '成功',
  failed: '失败',
};

function statusBadgeClass(status: string): string {
  if (status === 'succeeded') {
    return 'border-[#C8E6C9] bg-[#E8F5E9] text-[#1B5E20]';
  }
  if (status === 'failed') {
    return 'border-recovery-red/30 bg-recovery-red/10 text-recovery-red';
  }
  return 'border-hairline-divider bg-section-layer text-secondary-ink';
}

function statusDotClass(status: string): string {
  if (status === 'succeeded') {
    return 'bg-healthy-green';
  }
  if (status === 'failed') {
    return 'bg-recovery-red';
  }
  return 'bg-secondary-ink';
}

interface AuditRow extends ApiActionAudit {
  accountName: string;
}

/**
 * Protection records page: filterable view over governed protection actions
 * (traffic-governance + traffic-policy). "全部账号" fans out to one
 * server-side query per account (same pattern as the runtime dashboard);
 * instance and action filters are executed server-side.
 *
 * @when 侧边栏点击「保护记录」或深链 /protection-records 时渲染
 */
export default function ProtectionRecordsPage() {
  const accountsQuery = useAccountsQuery();
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [targetIdFilter, setTargetIdFilter] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');

  const filters = useMemo<TrafficAuditFilters>(() => {
    const next: TrafficAuditFilters = {triggeredBy: PROTECTION_TRIGGERED_BY};
    if (actionFilter !== 'all') {
      next.action = actionFilter;
    }
    const targetId = targetIdFilter.trim();
    if (targetId) {
      next.targetId = targetId;
    }
    return next;
  }, [actionFilter, targetIdFilter]);

  const accountIds = useMemo(() => {
    const all = (accountsQuery.data || []).map((account) => account.id);
    return accountFilter === 'all' ? all : [accountFilter];
  }, [accountFilter, accountsQuery.data]);

  const auditQueries = useQueries({
    queries: accountIds.map((accountId) => ({
      queryKey: runtimeKeys.audits(accountId, filters),
      queryFn: () => listTrafficAudits(accountId, filters),
      enabled: Boolean(accountId),
    })),
  }) as Array<{data?: ApiActionAudit[]; isLoading: boolean; isError: boolean; error: unknown}>;

  const accounts = accountsQuery.data || [];
  const audits: AuditRow[] = auditQueries
    .flatMap((query) => query.data || [])
    .map((audit) => ({
      ...audit,
      accountName: accounts.find((account) => account.id === audit.accountId)?.name || audit.accountId,
    }))
    .sort((a, b) => b.triggeredAt.localeCompare(a.triggeredAt));

  const isLoading = accountsQuery.isLoading || auditQueries.some((query) => query.isLoading);
  const fetchError = auditQueries.find((query) => query.isError)?.error;

  return (
    <div className="flex flex-col gap-6 font-sans">
      <div>
        <h1 className="font-space text-2xl font-bold text-primary-ink">保护记录</h1>
        <p className="mt-1 text-xs text-secondary-ink">
          治理扫描与流量策略触发的保护动作审计（默认过滤 traffic-governance / traffic-policy，手动操作仅在各账号详情可见）。
        </p>
      </div>

      {/* Filter bar: account fan-out, server-side instance/action filters */}
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-secondary-ink">
          账号
          <select
            value={accountFilter}
            onChange={(event) => setAccountFilter(event.target.value)}
            className="rounded border border-hairline-divider bg-surface-white px-2 py-2 text-xs text-primary-ink focus:border-primary focus:outline-none"
          >
            <option value="all">全部账号</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
        </label>

        <div className="relative w-64">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-secondary-ink" />
          <input
            value={targetIdFilter}
            onChange={(event) => setTargetIdFilter(event.target.value)}
            placeholder="实例 ID 过滤（服务端）"
            className="w-full rounded border border-hairline-divider bg-surface-white py-2 pl-9 pr-3 text-xs focus:border-primary focus:outline-none"
          />
        </div>

        <label className="flex items-center gap-2 text-xs text-secondary-ink">
          动作
          <select
            value={actionFilter}
            onChange={(event) => setActionFilter(event.target.value)}
            className="rounded border border-hairline-divider bg-surface-white px-2 py-2 text-xs text-primary-ink focus:border-primary focus:outline-none"
          >
            <option value="all">全部动作</option>
            {ACTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {isLoading && audits.length === 0 ? (
        <div className="rounded border border-hairline-divider bg-surface-white p-10 text-center text-sm text-secondary-ink">
          正在加载保护记录…
        </div>
      ) : fetchError ? (
        <div className="rounded border border-recovery-red/20 bg-recovery-red/[0.04] p-4 text-xs text-recovery-red">
          加载保护记录失败：{fetchError instanceof Error ? fetchError.message : String(fetchError)}
        </div>
      ) : audits.length === 0 ? (
        <div className="rounded border border-dashed border-hairline-divider bg-surface-white p-10 text-center text-sm text-secondary-ink">
          暂无保护记录。
        </div>
      ) : (
        <section className="overflow-x-auto rounded-lg border border-hairline-divider bg-surface-white shadow-xs">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-hairline-divider text-[10px] uppercase tracking-wider text-secondary-ink">
                <th className="px-4 py-3 font-bold">时间</th>
                <th className="px-4 py-3 font-bold">账号</th>
                <th className="px-4 py-3 font-bold">实例</th>
                <th className="px-4 py-3 font-bold">地区</th>
                <th className="px-4 py-3 font-bold">动作</th>
                <th className="px-4 py-3 font-bold">状态</th>
                <th className="px-4 py-3 font-bold">消息</th>
              </tr>
            </thead>
            <tbody>
              {audits.map((audit) => (
                <tr key={audit.id} className="border-b border-hairline-divider/50 last:border-0 hover:bg-emphasis-layer/40">
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="font-mono text-[11px] text-secondary-ink">{formatDateLabel(audit.triggeredAt)}</div>
                    {audit.completedAt && audit.completedAt !== audit.triggeredAt && (
                      <div className="font-mono text-[10px] text-outline">完成 {formatDateLabel(audit.completedAt)}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-primary-ink">{audit.accountName}</td>
                  <td className="px-4 py-3 font-mono text-[11px] text-primary-ink">{audit.targetId || '-'}</td>
                  <td className="px-4 py-3 text-primary-ink">{audit.regionId ? regionNameZh(audit.regionId) : '-'}</td>
                  <td className="px-4 py-3 text-primary-ink">{actionLabelZh(audit.action)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-bold ${statusBadgeClass(audit.status)}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${statusDotClass(audit.status)}`} />
                      {AUDIT_STATUS_LABELS[audit.status] || audit.status}
                    </span>
                  </td>
                  <td className="max-w-md px-4 py-3 text-secondary-ink">{audit.message || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
