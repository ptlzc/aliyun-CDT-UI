import {render, screen} from '@testing-library/react';
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
};

interface CapturedQuery {
  queryKey: readonly unknown[];
  queryFn: () => unknown;
  enabled?: boolean;
}

const h = vi.hoisted(() => ({
  listAuditsMock: vi.fn(),
  useQueriesCalls: [] as CapturedQuery[][],
  auditsByAccount: {} as Record<string, ApiActionAudit[]>,
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
      return {data: h.auditsByAccount[accountId] ?? [], isLoading: false, isError: false, error: null};
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
      'acc-1': [governanceStopAudit, policyStartAudit],
      'acc-2': [manualPowerAudit],
    };
    renderPage();

    expect(screen.getByRole('heading', {name: /保护记录/})).toBeInTheDocument();
    // Time (TriggeredAt, UTC label) + completed time
    expect(screen.getByText('2026-06-16 10:14 UTC')).toBeInTheDocument();
    expect(screen.getByText(/完成 2026-06-16 10:14 UTC/)).toBeInTheDocument();
    // Account, instance, action (Chinese label), status badge, message
    expect(screen.getByText('Account A')).toBeInTheDocument();
    expect(screen.getByText('Account B')).toBeInTheDocument();
    expect(screen.getByText('i-001')).toBeInTheDocument();
    expect(screen.getByText('i-003')).toBeInTheDocument();
    expect(screen.getByText('停止实例')).toBeInTheDocument();
    expect(screen.getByText('启动实例')).toBeInTheDocument();
    expect(screen.getByText('成功')).toBeInTheDocument();
    expect(screen.getByText('失败')).toBeInTheDocument();
    expect(screen.getByText('实例已停止')).toBeInTheDocument();
    expect(screen.getByText('IncorrectInstanceStatus')).toBeInTheDocument();
  });

  it('sends the default protection filter (traffic-governance + traffic-policy) for every account query', async () => {
    renderPage();

    const queries = h.useQueriesCalls.at(-1)!;
    expect(queries).toHaveLength(2);
    const expectedFilter = {triggeredBy: ['traffic-governance', 'traffic-policy']};
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
    h.auditsByAccount = {'acc-1': [governanceStopAudit]};
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
});
