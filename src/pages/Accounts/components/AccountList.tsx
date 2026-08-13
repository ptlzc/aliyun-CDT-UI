import {useMemo, useState} from 'react';
import {ChevronLeft, ChevronRight, Edit, Plus, RefreshCw, Search, ShieldAlert, Trash2} from 'lucide-react';

import type {CloudAccount} from '../../../types';

interface AccountListProps {
  accounts: CloudAccount[];
  onCreate: () => void;
  onEdit: (account: CloudAccount) => void;
}

/**
 * Accounts listing: search, paginated table and the create / sync entry
 * points. Row clicks open the detail editor via `onEdit`.
 *
 * @when /accounts 列表模式渲染时
 */
export default function AccountList({accounts, onCreate, onEdit}: AccountListProps) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const filteredAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      return (
        acc.name.toLowerCase().includes(search.toLowerCase()) ||
        acc.id.toLowerCase().includes(search.toLowerCase()) ||
        acc.providerRegion.toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [accounts, search]);

  // Pagination bounds
  const pageSize = 5;
  const totalPages = Math.ceil(filteredAccounts.length / pageSize);
  const paginatedAccounts = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredAccounts.slice(startIndex, startIndex + pageSize);
  }, [filteredAccounts, currentPage]);

  return (
    <>
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
              setCurrentPage(1);
            }}
            className="px-4 py-2 bg-surface-white border border-hairline-divider text-primary-ink text-xs rounded hover:bg-emphasis-layer transition-colors flex items-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>同步全部账户</span>
          </button>
          <button
            onClick={onCreate}
            className="px-4 py-2 bg-primary text-white text-xs rounded hover:bg-primary-container font-medium transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>添加账号凭证</span>
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
        </div>

        {/* Table rendering content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap text-xs">
            <thead className="bg-[#FAFBFD] border-b border-hairline-divider text-secondary-ink font-semibold uppercase tracking-wider text-[10px]">
              <tr>
                <th className="px-5 py-3.5">账户名称</th>
                <th className="px-5 py-3.5">账户 ID</th>
                <th className="px-5 py-3.5">受托管主地域</th>
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
                    onClick={() => onEdit(acc)}
                  >
                    <td className="px-5 py-3.5 font-semibold text-primary-ink relative">
                      <span>{acc.name}</span>
                    </td>
                    <td className="px-5 py-3.5 font-mono text-secondary-ink select-all">
                      {acc.id}
                    </td>
                    <td className="px-5 py-3.5 text-secondary-ink font-medium">
                      {acc.providerRegion}
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
                            onEdit(acc);
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
                  <td colSpan={5} className="text-center py-10 text-secondary-ink bg-section-layer/20 border-dashed border-t">
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
              <span className="px-3 font-mono">第 {currentPage} 页 / 共 {totalPages} 页</span>
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
            多云资源安全编排隔离准则
          </h4>
          <p className="text-[11px] text-secondary-ink mt-1 leading-relaxed max-w-4xl">
            此平台采用高强度 KMS 加密层对 AccessKeySecret 进行本地加密封存。数据中心每 15 分钟会轮询各云厂商 API 探测可用性。部分地域（例如 Aliyun China East 2）如果触发 Auth Failed 故障，请优先确认对应的 RAM Policy ARN 所扮演的角色权限已分配。
          </p>
        </div>
      </div>
    </>
  );
}
