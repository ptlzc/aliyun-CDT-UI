import {formatTrafficValue, quotaBarColor} from './instanceLabels';

interface AccountTrafficBarProps {
  accountName: string;
  usage?: number;
  limit?: number;
  unit?: string;
}

/**
 * Account-level cumulative traffic bar rendered once per account group.
 * Shows the account total used against the account-level cap with a progress
 * bar; each ECS card below only shows its own simple traffic value.
 *
 * @when 实例页按账号分组渲染账号级流量条
 */
export default function AccountTrafficBar({accountName, usage, limit, unit = 'GB'}: AccountTrafficBarProps) {
  const safeLimit = limit ?? 0;
  const safeUsage = usage ?? 0;
  const unavailable = safeLimit <= 0;
  const ratio = unavailable ? 0 : Math.min(100, (safeUsage / safeLimit) * 100);

  return (
    <div className="rounded-lg border border-hairline-divider bg-surface-white p-4 shadow-xs">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-primary-ink">{accountName}</h3>
        <span className="font-mono text-xs font-medium text-primary-ink">
          {unavailable ? '不可用' : `${formatTrafficValue(safeUsage)} ${unit} / ${formatTrafficValue(safeLimit)} ${unit}`}
        </span>
      </div>
      {!unavailable && (
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full border border-hairline-divider/30 bg-surface-white">
          <div
            className={`h-full rounded-full ${quotaBarColor(safeUsage, safeLimit)}`}
            style={{width: `${ratio}%`}}
          />
        </div>
      )}
    </div>
  );
}
