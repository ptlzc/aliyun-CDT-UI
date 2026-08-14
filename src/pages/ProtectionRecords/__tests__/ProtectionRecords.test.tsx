import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import type {ApiAccount, ApiActionAudit} from '../../../lib/api/client';

const accountA: ApiAccount = {
  id: 'acc-1',
  name: 'Account A',
  siteType: 'domestic',
  regionId: 'cn-hangzhou',
  regions: ['cn-hangzhou'],
  createdAt: '2026-06-17T00:00:00Z',
  updatedAt: '2026-06-17T00:00:00Z',
  accessKeyId: 'ak',
  accessKeySecret: 'sk',
  defaultImageKey: '',
  ossBucket: '',
  ossEndpoint: '',
  zoneId: '',
};
const accountB: ApiAccount = {
  id: 'acc-2',
  name: 'Account B',
  siteType: 'international',
  regionId: 'ap-southeast-1',
  regions: ['ap-southeast-1'],
  createdAt: '2026-06-17T00:00:00Z',
  updatedAt: '2026-06-17T00:00:00Z',
  accessKeyId: 'ak2',
  accessKeySecret: 'sk2',
  defaultImageKey: '',
  ossBucket: '',
  ossEndpoint: '',
  zoneId: '',
};

interface CapturedQuery {
  queryKey: readonly unknown[];
  queryFn: () => unknown;
  enabled?: boolean;
  placeholderData?: (previous: unknown) => unknown;
}

interface AuditPage {
  items: ApiActionAudit[];
  total: number;
}

const h = vi.hoisted(() => ({
  listAuditsMock: vi.fn(),
  useQueriesCalls: [] as CapturedQuery[][],
  auditsByAccount: {} as Record<string, AuditPage>,
  auditErrors: {} as Record<string, boolean>,
  accountsQuery: {data: [] as ApiAccount[], isLoading: false},
}));

vi.mock('@tanstack/react-query', () => ({
  useQueries: vi.fn((options: {queries: CapturedQuery[]}) => {
    h.useQueriesCalls.push(options.queries);
    return options.queries.map((query) => {
      const accountId = (query.queryKey as readonly unknown[])[2] as string;
      if (h.auditErrors[accountId]) {
        return {data: undefined, isLoading: false, isError: true, error: new Error(`audit-fetch-failed-${accountId}`)};
      }
      // Server-side pagination contract: the page requests (offset, limit) and
      // receives {items, total}; total is offset/limit-independent.
      const filters = (query.queryKey as readonly unknown[])[3] as {offset?: number; limit?: number} | undefined;
      const page = h.auditsByAccount[accountId];
      const offset = filters?.offset ?? 0;
      const limit = filters?.limit ?? 20;
      const items = page ? page.items.slice(offset, offset + limit) : [];
      return {data: {items, total: page?.total ?? 0}, isLoading: false, isError: false, error: null};
    });
  }),
}));

vi.mock('../../../features/runtime/hooks', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../features/runtime/hooks')>();
  return {
    ...actual,
    useAccountsQuery: () => h.accountsQuery,
  };
});

vi.mock('../../../lib/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/api/client')>();
  return {
    ...actual,
    listTrafficAudits: h.listAuditsMock,
  };
});

const governanceStopAudit: ApiActionAudit = {
  id: 'a1',
  accountId: 'acc-1',
  action: 'stop-instance',
  targetId: 'i-001',
  regionId: 'ap-southeast-1',
  status: 'succeeded',
  message: '实例已停止',
  triggeredBy: 'traffic-governance',
  triggeredAt: '2026-06-16T10:14:15Z',
  completedAt: '2026-06-16T10:14:20Z',
};
const policyStartAudit: ApiActionAudit = {
  id: 'a2',
  accountId: 'acc-1',
  action: 'start-instance',
  targetId: 'i-002',
  status: 'failed',
  message: 'IncorrectInstanceStatus',
  triggeredBy: 'traffic-policy',
  triggeredAt: '2026-06-16T09:00:00Z',
};
const manualPowerAudit: ApiActionAudit = {
  id: 'a3',
  accountId: 'acc-2',
  action: 'stop-instance',
  targetId: 'i-003',
  status: 'succeeded',
  message: '手动停止',
  triggeredBy: 'manual-power',
  triggeredAt: '2026-06-16T08:00:00Z',
};

/** 25 records with distinct ids/targets/timestamps to exercise 20-per-page slicing. */
const twentyFiveAudits: ApiActionAudit[] = Array.from({length: 25}, (_, index) => ({
  id: `a-${index}`,
  accountId: 'acc-1',
  action: 'stop-instance',
  targetId: `i-${String(index).padStart(3, '0')}`,
  regionId: 'ap-southeast-1',
  status: 'succeeded',
  message: `msg-${index}`,
  triggeredBy: 'traffic-governance',
  triggeredAt: new Date(Date.UTC(2026, 5, 16, 10, 0, index)).toISOString(),
}));

function renderPage() {
  return render(<ProtectionRecordsPage />);
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ProtectionRecordsPage = (await import('../index')).default;

describe('ProtectionRecordsPage', () => {
  beforeEach(() => {
    h.useQueriesCalls.length = 0;
    h.auditsByAccount = {};
    h.auditErrors = {};
    h.accountsQuery.data = [accountA, accountB];
    h.listAuditsMock.mockReset();
    h.listAuditsMock.mockResolvedValue([]);
  });

  it('renders the page heading and table fields for every audit row', () => {
    h.auditsByAccount = {
      'acc-1': {items: [governanceStopAudit, policyStartAudit], total: 2},
      'acc-2': {items: [manualPowerAudit], total: 1},
    };
    renderPage();

    expect(screen.getByRole('heading', {name: /保护记录/})).toBeInTheDocument();
    const table = within(screen.getByRole('table'));
    // Time (TriggeredAt, UTC+8 label) + completed time
    expect(table.getByText('2026-06-16 18:14 UTC+8')).toBeInTheDocument();
    expect(table.getByText(/完成 2026-06-16 18:14 UTC\+8/)).toBeInTheDocument();
    // Account, instance, action (Chinese label), status badge, message
    // acc-1 contributes two rows (both Account A), acc-2 one row (Account B)
    expect(table.getAllByText('Account A')).toHaveLength(2);
    expect(table.getByText('Account B')).toBeInTheDocument();
    expect(table.getByText('i-001')).toBeInTheDocument();
    expect(table.getByText('i-003')).toBeInTheDocument();
    // Region column header; regionId renders the Chinese name (ap-southeast-1
    // → 新加坡) and missing regionId falls back to '-'
    expect(table.getByRole('columnheader', {name: '地区'})).toBeInTheDocument();
    expect(within(table.getByText('i-001').closest('tr')!).getByText('新加坡')).toBeInTheDocument();
    expect(within(table.getByText('i-002').closest('tr')!).getByText('-')).toBeInTheDocument();
    expect(within(table.getByText('i-003').closest('tr')!).getByText('-')).toBeInTheDocument();
    // two stop-instance rows (acc-1 governance + acc-2 manual) + one start-instance row
    expect(table.getAllByText('停止实例')).toHaveLength(2);
    expect(table.getByText('启动实例')).toBeInTheDocument();
    expect(table.getAllByText('成功')).toHaveLength(2);
    expect(table.getByText('失败')).toBeInTheDocument();
    expect(table.getByText('实例已停止')).toBeInTheDocument();
    expect(table.getByText('IncorrectInstanceStatus')).toBeInTheDocument();
  });

  it('sends the default protection filter (traffic-governance + traffic-policy) for every account query', async () => {
    renderPage();

    const queries = h.useQueriesCalls.at(-1)!;
    expect(queries).toHaveLength(2);
    const expectedFilter = {triggeredBy: ['traffic-governance', 'traffic-policy'], offset: 0, limit: 20};
    for (const [index, accountId] of ['acc-1', 'acc-2'].entries()) {
      const query = queries[index];
      expect(query.queryKey).toEqual(['runtime', 'traffic-audits', accountId, expectedFilter]);
      expect(query.enabled).toBe(true);
      await query.queryFn();
      expect(h.listAuditsMock).toHaveBeenCalledWith(accountId, expectedFilter);
    }
  });

  it('shows the empty state when no account has audit records', () => {
    renderPage();
    expect(screen.getByText('暂无保护记录。')).toBeInTheDocument();
  });

  it('fan-outs only the selected account after the account dropdown changes', async () => {
    const user = userEvent.setup();
    h.auditsByAccount = {'acc-1': {items: [governanceStopAudit], total: 1}};
    renderPage();
    expect(h.useQueriesCalls.at(-1)).toHaveLength(2);

    await user.selectOptions(screen.getByRole('combobox', {name: '账号'}), 'acc-2');

    const queries = h.useQueriesCalls.at(-1)!;
    expect(queries).toHaveLength(1);
    expect((queries[0].queryKey as readonly unknown[])[2]).toBe('acc-2');
  });

  it('sends the typed instance id as a server-side targetId filter', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByPlaceholderText(/实例 ID/), 'i-042');

    const queries = h.useQueriesCalls.at(-1)!;
    expect(queries).toHaveLength(2);
    for (const query of queries) {
      expect((query.queryKey as readonly unknown[])[3]).toEqual({
        triggeredBy: ['traffic-governance', 'traffic-policy'],
        targetId: 'i-042',
        offset: 0,
        limit: 20,
      });
    }
  });

  it('sends the selected action as a server-side action filter', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.selectOptions(screen.getByRole('combobox', {name: '动作'}), 'stop-instance');

    const queries = h.useQueriesCalls.at(-1)!;
    for (const query of queries) {
      expect((query.queryKey as readonly unknown[])[3]).toEqual({
        triggeredBy: ['traffic-governance', 'traffic-policy'],
        action: 'stop-instance',
        offset: 0,
        limit: 20,
      });
    }
  });

  it('surfaces the fetch error instead of silently rendering an empty table', () => {
    h.auditErrors = {'acc-1': true};
    renderPage();

    expect(screen.getByText(/加载保护记录失败/)).toBeInTheDocument();
    expect(screen.getByText(/audit-fetch-failed-acc-1/)).toBeInTheDocument();
    expect(screen.queryByText('暂无保护记录。')).not.toBeInTheDocument();
  });

  it('paginates: next page requests offset=(page-1)*pageSize and renders the page-2 slice', async () => {
    const user = userEvent.setup();
    h.auditsByAccount = {'acc-1': {items: twentyFiveAudits, total: 25}};
    renderPage();

    // Page 1: first 20 of 25 records, total display, prev disabled / next enabled.
    expect(screen.getByText(/共 25 条/)).toBeInTheDocument();
    expect(screen.getByText('第 1 页 / 共 2 页')).toBeInTheDocument();
    expect(screen.getByText('i-000')).toBeInTheDocument();
    expect(screen.queryByText('i-024')).not.toBeInTheDocument();
    // Enriched regionId (backend enrichment) renders the Chinese name on every row.
    expect(screen.getAllByText('新加坡')).toHaveLength(20);
    expect(screen.getByRole('button', {name: /上一页/})).toBeDisabled();
    expect(screen.getByRole('button', {name: /下一页/})).toBeEnabled();

    await user.click(screen.getByRole('button', {name: /下一页/}));

    const queries = h.useQueriesCalls.at(-1)!;
    expect(queries).toHaveLength(2);
    const expectedFilter = {triggeredBy: ['traffic-governance', 'traffic-policy'], offset: 20, limit: 20};
    expect((queries[0].queryKey as readonly unknown[])[3]).toEqual(expectedFilter);
    await queries[0].queryFn();
    expect(h.listAuditsMock).toHaveBeenLastCalledWith('acc-1', expectedFilter);

    // Page 2: remaining 5 records, same total, next disabled.
    expect(screen.getByText('i-024')).toBeInTheDocument();
    expect(screen.queryByText('i-000')).not.toBeInTheDocument();
    expect(screen.getAllByText('新加坡')).toHaveLength(5);
    expect(screen.getByText(/共 25 条/)).toBeInTheDocument();
    expect(screen.getByText('第 2 页 / 共 2 页')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /下一页/})).toBeDisabled();
    expect(screen.getByRole('button', {name: /上一页/})).toBeEnabled();
  });

  it('keeps the previous page as placeholder data while the next page loads (no empty flash)', () => {
    h.auditsByAccount = {'acc-1': {items: twentyFiveAudits, total: 25}};
    renderPage();

    const queries = h.useQueriesCalls.at(-1)!;
    const query = queries[0];
    // TanStack Query 5 placeholderData: (prev) => prev — captures the previous page.
    expect(query.placeholderData).toBeTypeOf('function');
    const previous = {items: [governanceStopAudit], total: 25};
    expect(query.placeholderData!(previous)).toBe(previous);
  });

  it('switches pageSize to 50 with a fresh offset=0 and a single total page', async () => {
    const user = userEvent.setup();
    h.auditsByAccount = {'acc-1': {items: twentyFiveAudits, total: 25}};
    renderPage();

    await user.selectOptions(screen.getByRole('combobox', {name: '每页'}), '50');

    const queries = h.useQueriesCalls.at(-1)!;
    for (const query of queries) {
      expect((query.queryKey as readonly unknown[])[3]).toEqual({
        triggeredBy: ['traffic-governance', 'traffic-policy'],
        offset: 0,
        limit: 50,
      });
    }
    expect(screen.getByText('第 1 页 / 共 1 页')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /下一页/})).toBeDisabled();
  });

  it('resets to page 1 when the account selection changes', async () => {
    const user = userEvent.setup();
    h.auditsByAccount = {'acc-1': {items: twentyFiveAudits, total: 25}};
    renderPage();
    await user.click(screen.getByRole('button', {name: /下一页/}));
    expect(screen.getByText('第 2 页 / 共 2 页')).toBeInTheDocument();

    await user.selectOptions(screen.getByRole('combobox', {name: '账号'}), 'acc-1');

    const queries = h.useQueriesCalls.at(-1)!;
    expect(queries).toHaveLength(1);
    expect((queries[0].queryKey as readonly unknown[])[3]).toEqual({
      triggeredBy: ['traffic-governance', 'traffic-policy'],
      offset: 0,
      limit: 20,
    });
    expect(screen.getByText('第 1 页 / 共 2 页')).toBeInTheDocument();
  });

  it('sums per-account totals in the all-accounts fan-out view', () => {
    h.auditsByAccount = {
      'acc-1': {items: [governanceStopAudit], total: 25},
      'acc-2': {items: [manualPowerAudit], total: 7},
    };
    renderPage();

    // 25 + 7 = 32; the annotation marks the fan-out semantics.
    expect(screen.getByText(/共 32 条（全部账号合计）/)).toBeInTheDocument();
  });
});
