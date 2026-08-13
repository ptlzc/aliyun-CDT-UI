import {useState} from 'react';
import {AlertTriangle, Trash2} from 'lucide-react';

import type {CloudAccount} from '../../../types';

interface ConfirmDeleteModalProps {
  account: CloudAccount;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Destructive confirmation dialog for deleting an account. The operator must
 * type the exact account name before the delete action arms; a mismatch keeps
 * the confirm button disabled so a wrong account can never be destroyed.
 *
 * @when 账户列表点击删除按钮时渲染
 */
export default function ConfirmDeleteModal({account, isPending, onConfirm, onClose}: ConfirmDeleteModalProps) {
  const [typedName, setTypedName] = useState('');
  const nameMatches = typedName === account.name;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="确认删除账户"
      className="fixed inset-0 z-50 flex items-center justify-center bg-primary-ink/45 backdrop-blur-xs font-sans"
    >
      <div className="bg-surface-white border border-hairline-divider w-full max-w-md rounded-lg overflow-hidden shadow-xl flex flex-col">
        <header className="px-5 py-3.5 border-b border-hairline-divider bg-[#FAFBFD] flex justify-between items-center">
          <span className="text-xs font-bold text-primary-ink flex items-center gap-2">
            <Trash2 className="w-4 h-4 text-recovery-red" />
            确认删除账户
          </span>
          <button
            onClick={onClose}
            disabled={isPending}
            className="text-xs text-secondary-ink hover:text-primary-ink cursor-pointer px-2 py-0.5 rounded hover:bg-emphasis-layer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            关闭
          </button>
        </header>

        <div className="p-5 flex flex-col gap-4">
          <div className="rounded-md border border-recovery-red/30 bg-recovery-red/5 p-3 flex gap-2.5">
            <AlertTriangle className="w-4 h-4 text-recovery-red shrink-0 mt-0.5" />
            <p className="text-[11px] text-on-surface leading-relaxed">
              即将删除账户 <strong className="text-primary-ink font-mono">{account.name}</strong>（{account.id}）。
              该操作<strong className="text-recovery-red">不可撤销</strong>，将级联删除该账户的全部关联数据
              （资源图、编排任务、防火墙操作、流量策略、流量评估与操作审计）。
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="confirm-delete-name" className="text-[11px] font-medium text-secondary-ink">
              请输入账户名以确认删除
            </label>
            <input
              id="confirm-delete-name"
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder="请输入账户名"
              disabled={isPending}
              className="w-full px-3 py-2 bg-surface-white border border-hairline-divider rounded text-xs select-none focus:outline-none focus:ring-1 focus:ring-recovery-red focus:border-recovery-red placeholder-outline-variant disabled:opacity-50"
            />
          </div>
        </div>

        <footer className="px-5 py-3.5 border-t border-hairline-divider bg-[#FAFBFD] flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={isPending}
            className="px-4 py-2 bg-surface-white border border-hairline-divider text-primary-ink text-xs rounded hover:bg-emphasis-layer transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            取消
          </button>
          <button
            onClick={onConfirm}
            disabled={!nameMatches || isPending}
            className={`px-4 py-2 text-white text-xs rounded transition-colors flex items-center gap-1.5 ${
              nameMatches && !isPending
                ? 'bg-recovery-red hover:bg-recovery-red/90 cursor-pointer shadow-sm'
                : 'bg-outline/40 cursor-not-allowed'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5" />
            确认删除
          </button>
        </footer>
      </div>
    </div>
  );
}
