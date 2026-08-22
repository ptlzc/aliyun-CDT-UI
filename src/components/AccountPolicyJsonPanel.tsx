import {useEffect, useRef, useState} from 'react';
import {Check, Copy} from 'lucide-react';

import {accountPolicyJsonText} from './accountPolicy';

interface AccountPolicyJsonPanelProps {
  compact?: boolean;
}

type CopyState = 'idle' | 'copied' | 'error';

/**
 * Shared, copyable RAM policy JSON surface used by both the account sidebar
 * and the permission-help modal.
 *
 * @when 账号添加/修改页或权限引导弹窗展示完整 RAM 策略时渲染
 */
export default function AccountPolicyJsonPanel({compact = false}: AccountPolicyJsonPanelProps) {
  const [copyState, setCopyState] = useState<CopyState>('idle');
  const resetTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (resetTimer.current !== null) {
      window.clearTimeout(resetTimer.current);
    }
  }, []);

  const handleCopy = async () => {
    if (resetTimer.current !== null) {
      window.clearTimeout(resetTimer.current);
    }
    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(accountPolicyJsonText);
      setCopyState('copied');
      resetTimer.current = window.setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      setCopyState('error');
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] font-bold uppercase tracking-wider text-secondary-ink">
          完整 RAM 权限 JSON
        </span>
        <button
          type="button"
          aria-label="复制权限 JSON"
          onClick={handleCopy}
          className="flex shrink-0 cursor-pointer items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/10"
        >
          {copyState === 'copied' ? (
            <>
              <Check className="h-3 w-3 text-healthy-green" /> 已复制
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" /> 复制 JSON
            </>
          )}
        </button>
      </div>
      <pre
        data-testid="account-policy-json"
        tabIndex={0}
        className={`select-text overflow-auto whitespace-pre rounded border border-[#30363d] bg-[#0d1117] p-3 font-mono text-[10px] leading-relaxed text-[#c9d1d9] ${compact ? 'max-h-80' : 'max-h-[46vh]'}`}
      >{accountPolicyJsonText}</pre>
      {copyState === 'error' && (
        <p role="status" className="text-[10px] font-medium text-recovery-red">
          复制失败，请手动选择 JSON
        </p>
      )}
    </div>
  );
}
