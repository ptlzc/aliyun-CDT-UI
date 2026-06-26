import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import InstancesView from './InstancesView';

let cdtData: any = null;
let governanceData: any = null;

vi.mock('../features/runtime/hooks', () => ({
  useStartECSInstanceMutation: () => ({mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false}),
  useStopECSInstanceMutation: () => ({mutateAsync: vi.fn(), mutate: vi.fn(), isPending: false}),
  useCdtFreeQuotaQuery: () => ({data: cdtData, isLoading: false}),
  useEffectiveTrafficGovernanceQuery: () => ({data: governanceData, isLoading: false}),
  useECSInstanceStateQuery: () => ({data: 'Running', isLoading: false}),
  useECSVncUrlQuery: () => ({data: null, isLoading: false}),
  useECSMetricsQuery: () => ({data: null, isLoading: false}),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({invalidateQueries: vi.fn().mockResolvedValue(undefined)}),
}));

describe('InstancesView CDT free quota card', () => {
  it('renders domestic and international progress bars with used / capacity values', () => {
    cdtData = {
      billingMonth: '2026-06',
      collectedAt: '2026-06-22T00:00:00Z',
      dataDelayHours: 2.5,
      domesticCapacityGb: 20,
      domesticRemainingGb: 7.5,
      domesticUsedGb: 12.5,
      internationalCapacityGb: 10,
      internationalRemainingGb: 10,
      internationalUsedGb: 0,
    };
    governanceData = null;

    render(
      <InstancesView
        instances={[]}
        accountId="acc-1"
        onManageInstance={() => {}}
      />,
    );

    expect(screen.getByText('CDT 免费额度')).toBeInTheDocument();
    expect(screen.getByText('12.5 / 20 GB')).toBeInTheDocument();
    expect(screen.getByText('0 / 10 GB')).toBeInTheDocument();
    expect(screen.getByText('数据延迟: 2.5 小时')).toBeInTheDocument();
    expect(screen.getByText('账单月份: 2026-06')).toBeInTheDocument();
  });

  it('does not render the CDT card when accountId is not provided', () => {
    cdtData = null;
    governanceData = null;

    render(<InstancesView instances={[]} onManageInstance={() => {}} />);

    expect(screen.queryByText('CDT 免费额度')).not.toBeInTheDocument();
  });
});

describe('InstancesView effective governance source layer badge', () => {
  it('renders the source layer badge labelled by sourceLayer value', () => {
    cdtData = null;
    governanceData = {
      maximumTrafficGb: 200,
      monitoringEnabled: true,
      overflowAction: 'notify',
      sourceLayer: 'region-group',
      underflowAction: 'notify',
    };

    render(
      <InstancesView
        instances={[]}
        accountId="acc-1"
        onManageInstance={() => {}}
      />,
    );

    expect(screen.getByText('地区组')).toBeInTheDocument();
  });

  it('maps instance source layer to 实例级 label', () => {
    cdtData = null;
    governanceData = {
      maximumTrafficGb: 200,
      monitoringEnabled: true,
      overflowAction: 'notify',
      sourceLayer: 'instance',
      underflowAction: 'notify',
    };

    render(
      <InstancesView
        instances={[]}
        accountId="acc-1"
        onManageInstance={() => {}}
      />,
    );

    expect(screen.getByText('实例级')).toBeInTheDocument();
  });
});
