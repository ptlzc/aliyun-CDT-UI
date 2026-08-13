import {FileCode} from 'lucide-react';

interface AuditLogModalProps {
  accountName: string;
  logs: string[];
  onClose: () => void;
}

/**
 * Dark-themed audit log viewer shown from the account metadata card.
 *
 * @when 账户详情点击「查看操作日志」时渲染
 */
export default function AuditLogModal({accountName, logs, onClose}: AuditLogModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-ink/45 backdrop-blur-xs font-sans">
      <div className="bg-[#0d1117] border border-[#30363d] w-full max-w-xl rounded-lg overflow-hidden shadow-xl flex flex-col">
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
        <div className="p-4 flex flex-col gap-2 font-mono text-[11px] text-[#c9d1d9] bg-[#0d1117] select-all max-h-80 overflow-y-auto">
          {logs.map((log, idx) => (
            <div key={idx} className="line-clamp-2">
              <span className="text-[#8b949e]">{log.substring(0, 27)}</span>
              <span className="text-[#58a6ff]">{log.substring(27)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
