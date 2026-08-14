import {FileCode} from 'lucide-react';

import {useTrafficAuditsQuery} from '../../../features/runtime/hooks';
import {actionLabelZh} from '../../../utils/actionLabels';
import {formatDateLabel} from '../../../utils/dateFormat';

interface AuditLogModalProps {
  accountId: string;
  accountName: string;
  onClose: () => void;
}

const AUDIT_STATUS_LABELS: Record<string, string> = {
  succeeded: '成功',
  failed: '失败',
};

function statusBadgeClass(status: string): string {
  if (status === 'succeeded') {
    return 'border-[#C8E6C9]/40 bg-[#C8E6C9]/10 text-[#3fb950]';
  }
  if (status === 'failed') {
    return 'border-[#ff7b72]/40 bg-[#ff7b72]/10 text-[#ff7b72]';
  }
  return 'border-[#30363d] text-[#8b949e]';
}

/**
 * Real action-audit viewer for a single account. Every action is shown —
 * including manual-power — via useTrafficAuditsQuery with only the record cap
 * (Design Decision 4); the dark terminal shell carries over from the legacy
 * fake-log modal.
 *
 * @when 账户详情点击「查看操作日志」时渲染
 */
export default function AuditLogModal({accountId, accountName, onClose}: AuditLogModalProps) {
  const auditsQuery = useTrafficAuditsQuery(accountId, {limit: 100});
  const audits = auditsQuery.data || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-ink/45 backdrop-blur-xs font-sans">
      <div className="bg-[#0d1117] border border-[#30363d] w-full max-w-2xl rounded-lg overflow-hidden shadow-xl flex flex-col">
        <header className="px-4 py-3 bg-[#161b22] border-b border-[#30363d] flex justify-between items-center text-white">
          <span className="text-xs font-bold font-mono text-[#c9d1d9] flex items-center gap-2">
            <FileCode className="w-4 h-4 text-primary" />
            API 操作审计日志 — {accountName}
          </span>
          <button
            onClick={onClose}
            className="text-xs text-[#8b949e] hover:text-white cursor-pointer px-2 py-0.5 rounded hover:bg-white/10"
          >
            关闭
          </button>
        </header>
        <div className="max-h-96 overflow-y-auto">
          {auditsQuery.isLoading ? (
            <div className="p-6 text-center text-xs text-[#8b949e]">正在加载操作日志…</div>
          ) : auditsQuery.isError ? (
            <div className="p-6 text-center text-xs text-[#ff7b72]">
              加载操作日志失败：{auditsQuery.error instanceof Error ? auditsQuery.error.message : String(auditsQuery.error)}
            </div>
          ) : audits.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#8b949e]">该账号暂无操作日志。</div>
          ) : (
            <table className="w-full text-left font-mono text-[11px] text-[#c9d1d9]">
              <thead>
                <tr className="border-b border-[#21262d] text-[10px] uppercase tracking-wider text-[#8b949e]">
                  <th className="px-4 py-2.5 font-bold">时间</th>
                  <th className="px-4 py-2.5 font-bold">动作</th>
                  <th className="px-4 py-2.5 font-bold">实例</th>
                  <th className="px-4 py-2.5 font-bold">状态</th>
                  <th className="px-4 py-2.5 font-bold">消息</th>
                </tr>
              </thead>
              <tbody>
                {audits.map((audit) => (
                  <tr key={audit.id} className="border-b border-[#21262d] last:border-0 align-top">
                    <td className="whitespace-nowrap px-4 py-2.5 text-[#8b949e]">
                      <div>{formatDateLabel(audit.triggeredAt)}</div>
                      {audit.completedAt && audit.completedAt !== audit.triggeredAt && (
                        <div className="text-[10px] text-[#484f58]">完成 {formatDateLabel(audit.completedAt)}</div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[#58a6ff]">{actionLabelZh(audit.action)}</td>
                    <td className="px-4 py-2.5 text-[#c9d1d9]">{audit.targetId || '-'}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-bold ${statusBadgeClass(audit.status)}`}>
                        {AUDIT_STATUS_LABELS[audit.status] || audit.status}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 max-w-xs text-[#c9d1d9]">{audit.message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
