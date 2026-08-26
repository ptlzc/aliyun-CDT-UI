import {renderHook} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';

import {
  useSaveInstanceGovernanceMutation,
  useStartECSInstanceMutation,
  useValidateAccountMutation,
} from '../hooks';

const {invalidateQueriesMock, mutationCalls} = vi.hoisted(() => ({
  invalidateQueriesMock: vi.fn(),
  mutationCalls: [] as Array<{
    onSuccess?: (data?: unknown, variables?: unknown) => void;
    mutationFn?: (...args: unknown[]) => unknown;
  }>,
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({invalidateQueries: invalidateQueriesMock}),
  useMutation: vi.fn((options: {onSuccess?: (data?: unknown, variables?: unknown) => void; mutationFn?: (...args: unknown[]) => unknown}) => {
    mutationCalls.push(options);
    return {
      mutate: vi.fn(),
      mutateAsync: vi.fn(),
      isPending: false,
    };
  }),
  useQuery: vi.fn(),
  useQueries: vi.fn(),
}));

describe('mutation invalidation scoping', () => {
  beforeEach(() => {
    invalidateQueriesMock.mockClear();
    mutationCalls.length = 0;
  });

  it('useValidateAccountMutation invalidates only the account list cache', () => {
    renderHook(() => useValidateAccountMutation());

    const options = mutationCalls.at(-1);
    expect(options).toBeDefined();
    options?.onSuccess?.();

    expect(invalidateQueriesMock).toHaveBeenCalledWith({queryKey: ['runtime', 'accounts']});
    expect(invalidateQueriesMock).not.toHaveBeenCalledWith();
  });

  it('useSaveInstanceGovernanceMutation invalidates only the affected account graphs', () => {
    renderHook(() => useSaveInstanceGovernanceMutation());

    const options = mutationCalls.at(-1);
    expect(options).toBeDefined();
    options?.onSuccess?.(undefined, {accountId: 'acc-1', instanceId: 'i-1', payload: {}});

    expect(invalidateQueriesMock).toHaveBeenCalledWith({queryKey: ['runtime', 'graph', 'acc-1', 'inventory']});
    expect(invalidateQueriesMock).toHaveBeenCalledWith({queryKey: ['runtime', 'graph', 'acc-1']});
    expect(invalidateQueriesMock).not.toHaveBeenCalledWith({queryKey: ['runtime', 'graph']});
    expect(invalidateQueriesMock).not.toHaveBeenCalledWith();
  });

  it('useStartECSInstanceMutation invalidates only the affected account graphs and jobs', () => {
    renderHook(() => useStartECSInstanceMutation());

    const options = mutationCalls.at(-1);
    expect(options).toBeDefined();
    options?.onSuccess?.(undefined, {accountId: 'acc-1', instanceId: 'i-1'});

    expect(invalidateQueriesMock).toHaveBeenCalledWith({queryKey: ['runtime', 'graph', 'acc-1', 'inventory']});
    expect(invalidateQueriesMock).toHaveBeenCalledWith({queryKey: ['runtime', 'graph', 'acc-1']});
    expect(invalidateQueriesMock).toHaveBeenCalledWith({queryKey: ['runtime', 'jobs']});
    expect(invalidateQueriesMock).not.toHaveBeenCalledWith({queryKey: ['runtime', 'graph']});
    expect(invalidateQueriesMock).not.toHaveBeenCalledWith();
  });
});
