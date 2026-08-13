import type {ApiTrafficQuotaSnapshot} from '../../../lib/api/client';
import {quotaBarColor} from './instanceLabels';

interface CdtFreeQuotaCardProps {
  snapshot: ApiTrafficQuotaSnapshot;
}

/**
 * CDT free quota progress card: domestic and international usage bars with
 * capacity, delay and billing month metadata.
 *
 * @when 实例页带有 accountId 且 CDT 额度快照可用时渲染
 */
export default function CdtFreeQuotaCard({snapshot}: CdtFreeQuotaCardProps) {
  const domesticRatio = snapshot.domesticCapacityGb > 0
    ? Math.min(100, (snapshot.domesticUsedGb / snapshot.domesticCapacityGb) * 100)
    : 0;
  const internationalRatio = snapshot.internationalCapacityGb > 0
    ? Math.min(100, (snapshot.internationalUsedGb / snapshot.internationalCapacityGb) * 100)
    : 0;

  return (
    <section className="rounded-lg border border-hairline-divider bg-surface-white p-6 shadow-xs">
      <h2 className="font-space text-lg font-bold text-primary-ink">CDT 免费额度</h2>
      <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-secondary-ink">
        <span>数据延迟: {snapshot.dataDelayHours} 小时</span>
        <span>账单月份: {snapshot.billingMonth}</span>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <span className="block font-sans text-[10px] font-bold uppercase tracking-wider text-secondary-ink">中国内地</span>
          <div className="h-1.5 w-full overflow-hidden rounded-full border border-hairline-divider/30 bg-surface-white">
            <div
              className={`h-full rounded-full ${quotaBarColor(snapshot.domesticUsedGb, snapshot.domesticCapacityGb)}`}
              style={{width: `${domesticRatio}%`}}
            />
          </div>
          <span className="font-mono text-[10px] text-primary-ink">
            {snapshot.domesticUsedGb} / {snapshot.domesticCapacityGb} GB
          </span>
        </div>

        <div className="flex flex-col gap-1">
          <span className="block font-sans text-[10px] font-bold uppercase tracking-wider text-secondary-ink">非中国内地</span>
          <div className="h-1.5 w-full overflow-hidden rounded-full border border-hairline-divider/30 bg-surface-white">
            <div
              className={`h-full rounded-full ${quotaBarColor(snapshot.internationalUsedGb, snapshot.internationalCapacityGb)}`}
              style={{width: `${internationalRatio}%`}}
            />
          </div>
          <span className="font-mono text-[10px] text-primary-ink">
            {snapshot.internationalUsedGb} / {snapshot.internationalCapacityGb} GB
          </span>
        </div>
      </div>
    </section>
  );
}
