import {formatTrafficValue, quotaBarColor} from './instanceLabels';

interface AccountTrafficBarProps {
  usage?: number;
  limit?: number;
  unit?: string;
}

/**
 * Compact account-level cumulative traffic bar rendered inline in the account
 * group header (next to the account ID), not as a standalone card.
 *
 * @when 实例页账号分组头部展示账号级流量条
 */
export default function AccountTrafficBar({usage, limit, unit = 'GB'}: AccountTrafficBarProps) {
  const safeLimit = limit ?? 0;
  const safeUsage = usage ?? 0;
  const unavailable = safeLimit <= 0;
  const ratio = unavailable ? 0 : Math.min(100, (safeUsage / safeLimit) * 100);

  return (
    <span className="inline-flex items-center gap-2 align-middle">
      <span className="font-mono text-[10px] font-medium text-primary-ink">
        {unavailable ? '流量不可用' : `${formatTrafficValue(safeUsage)} / ${formatTrafficValue(safeLimit)} ${unit}`}
      </span>
      {!unavailable && (
        <span className="inline-block h-1.5 w-32 overflow-hidden rounded-full border border-hairline-divider/30 bg-surface-white">
          <span
            className={`block h-full rounded-full ${quotaBarColor(safeUsage, safeLimit)}`}
            style={{width: `${ratio}%`}}
          />
        </span>
      )}
    </span>
  );
}
