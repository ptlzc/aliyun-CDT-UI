import {Calendar, History, MapPin, User} from 'lucide-react';

import type {CloudAccount} from '../../../types';
import {getStatusStyle, statusLabel} from '../accountPolicy';

interface AccountMetadataCardProps {
  /** The account driving the view (create draft while creating). */
  account: CloudAccount;
  isCreating: boolean;
  /** Live form values so the card reflects in-progress edits. */
  editedName: string;
  editedMainRegion: string;
  onOpenAuditLogs: () => void;
}

/**
 * Right-column metadata card for the account detail view: identity, sync
 * status, main region, creation date, owner and the audit log entry point.
 *
 * @when 账户详情视图（编辑或新建）渲染时
 */
export default function AccountMetadataCard({
  account,
  isCreating,
  editedName,
  editedMainRegion,
  onOpenAuditLogs,
}: AccountMetadataCardProps) {
  return (
    <section className="bg-surface-white border border-hairline-divider rounded-lg p-5 shadow-xs flex flex-col gap-5">
      <h3 className="text-xs font-bold uppercase tracking-wider text-outline border-b pb-3 border-hairline-divider/50">
        账户元数据
      </h3>

      <div className="flex flex-col gap-4 text-xs font-sans">
        <div>
          <span className="text-[11px] text-secondary-ink font-semibold uppercase tracking-wider">云账户物理名称</span>
          <div className="font-bold text-primary-ink mt-1 font-space">
            {isCreating ? editedName || '待命名' : account.name}
          </div>
        </div>

        <div>
          <span className="text-[11px] text-secondary-ink font-semibold uppercase tracking-wider">数据同步状态</span>
          <div className="mt-1.5">
            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold border ${getStatusStyle(account.status)}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                account.status === 'Active' ? 'bg-healthy-green' : account.status === 'Sync Delayed' ? 'bg-signal-amber' : account.status === 'Auth Failed' ? 'bg-recovery-red' : 'bg-outline'
              }`} />
              {statusLabel(account.status)}
            </span>
          </div>
        </div>

        <div>
          <span className="text-[11px] text-secondary-ink font-semibold uppercase tracking-wider">注册主拓扑宿地域</span>
          <div className="text-primary-ink mt-1 flex items-center gap-2 font-medium">
            <MapPin className="w-3.5 h-3.5 text-outline" />
            {isCreating ? editedMainRegion : account.mainRegion}
          </div>
        </div>

        <div>
          <span className="text-[11px] text-secondary-ink font-semibold uppercase tracking-wider">关联导入日期</span>
          <div className="text-primary-ink mt-1 flex items-center gap-2 font-mono font-medium">
            <Calendar className="w-3.5 h-3.5 text-outline" />
            {account.creationDate}
          </div>
        </div>

        <div>
          <span className="text-[11px] text-secondary-ink font-semibold uppercase tracking-wider">项目安全所有者</span>
          <div className="text-primary-ink mt-1 flex items-center gap-2 font-medium">
            <User className="w-3.5 h-3.5 text-outline" />
            {account.owner}
          </div>
        </div>
      </div>

      {!isCreating && (
        <div className="pt-4 border-t border-hairline-divider mt-2 flex flex-col gap-2">
          <button
            onClick={onOpenAuditLogs}
            className="w-full flex items-center justify-center gap-2 py-2 text-on-surface-variant hover:text-primary-ink hover:bg-emphasis-layer border border-hairline-divider bg-white rounded text-xs transition-colors cursor-pointer font-medium"
          >
            <History className="w-4 h-4 text-outline" />
            查看操作日志
          </button>
        </div>
      )}
    </section>
  );
}
