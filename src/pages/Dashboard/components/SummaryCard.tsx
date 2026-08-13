import type {ReactNode} from 'react';

interface SummaryCardProps {
  label: string;
  value: number;
  hint: string;
  icon: ReactNode;
}

/**
 * Summary metric tile for the dashboard header row.
 *
 * @when 仪表盘顶部概览区渲染时
 */
export default function SummaryCard({label, value, hint, icon}: SummaryCardProps) {
  return (
    <div className="rounded-lg border border-hairline-divider bg-surface-white p-5 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-secondary-ink">{label}</p>
          <p className="mt-2 text-3xl font-space font-bold text-primary-ink">{value}</p>
          <p className="mt-1 text-xs text-secondary-ink">{hint}</p>
        </div>
        <div className="rounded-full bg-emphasis-layer p-3 text-primary">{icon}</div>
      </div>
    </div>
  );
}
