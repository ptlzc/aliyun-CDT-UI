import {render, screen} from '@testing-library/react';
import {describe, expect, it, vi} from 'vitest';

import type {CloudAccount} from '../../../types';
import AccountDetailEditor from '../components/AccountDetailEditor';

vi.mock('../../../features/runtime/hooks', () => ({
  useSaveAccountMutation: () => ({mutateAsync: vi.fn(), isPending: false}),
  useValidateAccountMutation: () => ({mutateAsync: vi.fn()}),
  useInventoryGraphQuery: () => ({data: undefined, isLoading: false, isError: false}),
}));

vi.mock('../../../lib/api/client', () => ({listRegions: vi.fn()}));

const account: CloudAccount = {
  id: 'acc-1',
  name: 'Account A',
  providerRegion: 'Aliyun Domestic',
  mainRegion: 'cn-shanghai',
  lastSynced: 'Just now',
  creationDate: '2026-06-17',
  accessKeyId: 'ak',
  accessKeySecret: 'secret',
  managedRegions: '',
  trafficDefaults: {
    maximumTrafficGb: 200,
    overflowAction: 'notify',
    monitoringEnabled: true,
  },
};

function renderEditor(overrides: Partial<CloudAccount> = {}) {
  render(
    <AccountDetailEditor
      account={{...account, ...overrides}}
      isCreating={false}
      cdtPermissionLoading={false}
      onClose={vi.fn()}
      onOpenAuditLogs={vi.fn()}
    />,
  );
}

describe('AccountDetailEditor managed-region compatibility', () => {
  it('uses historical regionId only when the explicit managed-region list is empty', () => {
    renderEditor();

    expect(screen.getByRole('checkbox', {name: /cn-shanghai/})).toBeChecked();
  });

  it('prefers explicit managed regions over a different historical regionId', () => {
    renderEditor({managedRegions: 'cn-hangzhou'});

    expect(screen.getByRole('checkbox', {name: /cn-hangzhou/})).toBeChecked();
    expect(screen.queryByRole('checkbox', {name: /cn-shanghai/})).not.toBeInTheDocument();
  });
});
