import {render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import type {ApiActionAudit} from '../../../lib/api/client';
import AuditLogModal from '../components/AuditLogModal';

interface HookCall {
  accountId: string | null;
  filters: Record<string, unknown>;
}

const h = vi.hoisted(() => ({
  auditsQueryMock: vi.fn(),
  hookCalls: [] as HookCall[],
  audits: [] as ApiActionAudit[],
  isLoading: false,
  isError: false,
}));

vi.mock('../../../features/runtime/hooks', () => ({
  useTrafficAuditsQuery: (accountId: string | null, filters: Record<string, unknown> = {}) => {
    h.hookCalls.push({accountId, filters});
    return {
      // The hook now exposes the {items, total} page shape; the modal only consumes items.
      data: {items: h.audits, total: h.audits.length},
      isLoading: h.isLoading,
      isError: h.isError,
      error: new Error('modal-fetch-error'),
    };
  },
}));

const stopAudit: ApiActionAudit = {
  id: 'a1',
  accountId: 'acc-1',
  action: 'stop-instance',
  targetId: 'i-001',
  status: 'succeeded',
  message: '实例已停止',
  triggeredBy: 'traffic-governance',
  triggeredAt: '2026-06-16T10:14:15Z',
};
const manualPowerAudit: ApiActionAudit = {
  id: 'a2',
  accountId: 'acc-1',
  action: 'start-instance',
  targetId: 'i-002',
  status: 'failed',
  message: 'IncorrectInstanceStatus',
  triggeredBy: 'manual-power',
  triggeredAt: '2026-06-16T09:00:00Z',
};

describe('AuditLogModal', () => {
  beforeEach(() => {
    h.hookCalls.length = 0;
    h.audits = [];
    h.isLoading = false;
    h.isError = false;
    h.auditsQueryMock.mockReset();
  });

  it('queries the account audits without a triggeredBy filter so manual-power actions stay visible', () => {
    h.audits = [manualPowerAudit];
    render(<AuditLogModal accountId="acc-1" accountName="Account A" onClose={vi.fn()} />);

    expect(h.hookCalls).toHaveLength(1);
    expect(h.hookCalls[0].accountId).toBe('acc-1');
    // Design Decision 4: the modal shows every action (incl. manual-power),
    // so only the record cap is passed — never a triggeredBy filter.
    expect(h.hookCalls[0].filters).toEqual({limit: 100});
  });

  it('renders real audit rows (time / action / instance / status / message)', () => {
    h.audits = [stopAudit, manualPowerAudit];
    render(<AuditLogModal accountId="acc-1" accountName="Account A" onClose={vi.fn()} />);

    expect(screen.getByText(/API 操作审计日志 — Account A/)).toBeInTheDocument();
    expect(screen.getByText('2026-06-16 18:14 UTC+8')).toBeInTheDocument();
    expect(screen.getAllByText('停止实例').length).toBeGreaterThan(0);
    expect(screen.getByText('启动实例')).toBeInTheDocument();
    expect(screen.getByText('i-001')).toBeInTheDocument();
    expect(screen.getByText('i-002')).toBeInTheDocument();
    expect(screen.getAllByText('成功').length).toBeGreaterThan(0);
    expect(screen.getByText('失败')).toBeInTheDocument();
    expect(screen.getByText('实例已停止')).toBeInTheDocument();
    expect(screen.getByText('IncorrectInstanceStatus')).toBeInTheDocument();
  });

  it('shows the empty state when the account has no audits', () => {
    render(<AuditLogModal accountId="acc-1" accountName="Account A" onClose={vi.fn()} />);
    expect(screen.getByText('该账号暂无操作日志。')).toBeInTheDocument();
  });

  it('shows a loading placeholder while the audits are being fetched', () => {
    h.isLoading = true;
    render(<AuditLogModal accountId="acc-1" accountName="Account A" onClose={vi.fn()} />);
    expect(screen.getByText('正在加载操作日志…')).toBeInTheDocument();
  });

  it('surfaces the fetch error instead of an empty table', () => {
    h.isError = true;
    render(<AuditLogModal accountId="acc-1" accountName="Account A" onClose={vi.fn()} />);
    expect(screen.getByText(/加载操作日志失败/)).toBeInTheDocument();
    expect(screen.getByText(/modal-fetch-error/)).toBeInTheDocument();
  });
});
