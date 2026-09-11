import {useQueries} from '@tanstack/react-query';

import {getCdtFreeQuota, type ApiTrafficQuotaSnapshot} from '@/lib/api/client';

/**
 * Official CDT free quota snapshots (China mainland 20 GB / outside mainland
 * 200 GB) for every account on the page, keyed by account id.
 *
 * The backend reads these numbers from the Aliyun bill, so the query does not
 * retry: an account without the `bssapi:QueryInstanceBill` permission must not
 * be polled in a loop. A missing map entry simply means "quota unknown" for
 * that account and must never block instance rendering or power actions.
 *
 * @when 实例页按账号分组展示 CDT 免费额度、启动实例前做超额确认
 */
export function useCdtFreeQuotaQueries(accountIds: string[]): Map<string, ApiTrafficQuotaSnapshot> {
  const queries = useQueries({
    queries: accountIds.map((accountId) => ({
      queryKey: ['cdt-free-quota', accountId],
      queryFn: () => getCdtFreeQuota(accountId),
      enabled: Boolean(accountId),
      retry: false,
      refetchInterval: 60_000,
    })),
  }) as Array<{data?: ApiTrafficQuotaSnapshot}>;

  const byAccount = new Map<string, ApiTrafficQuotaSnapshot>();
  accountIds.forEach((accountId, index) => {
    const snapshot = queries[index]?.data;
    if (snapshot) {
      byAccount.set(accountId, snapshot);
    }
  });
  return byAccount;
}
