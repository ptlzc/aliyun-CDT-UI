import {render, screen} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import ResourceSummaryCard from '../ResourceSummaryCard';

const mocks = vi.hoisted(() => ({
  useInventoryGraphQuery: vi.fn(),
}));

vi.mock('../../../../features/runtime/hooks', () => ({
  useInventoryGraphQuery: mocks.useInventoryGraphQuery,
}));

describe('ResourceSummaryCard', () => {
  beforeEach(() => {
    mocks.useInventoryGraphQuery.mockReset();
  });

  it('renders real inventory graph data, counting only Running ECS instances', () => {
    mocks.useInventoryGraphQuery.mockReturnValue({
      data: {
        accountId: 'acc-1',
        edges: [],
        nodes: [
          {id: 'i-1', kind: 'ecs', name: 'web-1', status: 'Running'},
          {id: 'i-2', kind: 'ecs', name: 'web-2', status: 'Running'},
          {id: 'i-3', kind: 'ecs', name: 'db-1', status: 'Stopped'},
          {id: 'v-1', kind: 'vpc', name: 'vpc-1', status: 'Available'},
        ],
        summary: {ecsCount: 3, eipCount: 6, imageCount: 0, securityGroupCount: 0, vpcCount: 5, vswitchCount: 0},
      },
      isLoading: false,
      isError: false,
    });

    render(<ResourceSummaryCard accountId="acc-1" />);

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('VPC 通道连接就绪')).toBeInTheDocument();
  });

  it('shows no VPC channel when vpcCount is zero', () => {
    mocks.useInventoryGraphQuery.mockReturnValue({
      data: {
        accountId: 'acc-1',
        edges: [],
        nodes: [],
        summary: {ecsCount: 0, eipCount: 0, imageCount: 0, securityGroupCount: 0, vpcCount: 0, vswitchCount: 0},
      },
      isLoading: false,
      isError: false,
    });

    render(<ResourceSummaryCard accountId="acc-1" />);

    expect(screen.getByText('暂无 VPC 通道')).toBeInTheDocument();
    expect(screen.queryByText('VPC 通道连接就绪')).not.toBeInTheDocument();
  });

  it('shows an em dash while loading', () => {
    mocks.useInventoryGraphQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    render(<ResourceSummaryCard accountId="acc-1" />);

    expect(screen.getAllByText('—')).toHaveLength(3);
    expect(screen.getByText('VPC 状态未知')).toBeInTheDocument();
  });

  it('shows an em dash when there is no data', () => {
    mocks.useInventoryGraphQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });

    render(<ResourceSummaryCard accountId="acc-1" />);

    expect(screen.getAllByText('—')).toHaveLength(3);
    expect(screen.getByText('VPC 状态未知')).toBeInTheDocument();
  });

  it('shows an em dash when the request fails', () => {
    mocks.useInventoryGraphQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    render(<ResourceSummaryCard accountId="acc-1" />);

    expect(screen.getAllByText('—')).toHaveLength(3);
    expect(screen.getByText('VPC 状态未知')).toBeInTheDocument();
  });
});
