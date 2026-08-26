import type {TrafficAuditFilters} from '@/lib/api/client';

export const runtimeKeys = {
  accounts: ['runtime', 'accounts'] as const,
  graph: (accountId: string) => ['runtime', 'graph', accountId] as const,
  graphInventory: (accountId: string) => ['runtime', 'graph', accountId, 'inventory'] as const,
  graphAll: ['runtime', 'graph'] as const,
  jobs: ['runtime', 'jobs'] as const,
  settings: ['runtime', 'settings', 'traffic-governance'] as const,
  policies: (accountId: string) => ['runtime', 'traffic-policies', accountId] as const,
  audits: (accountId: string, filters: TrafficAuditFilters) => ['runtime', 'traffic-audits', accountId, filters] as const,
  cdtPermission: (accountId: string) => ['runtime', 'cdt-permission', accountId] as const,
  regions: (accountId: string) => ['runtime', 'regions', accountId] as const,
};

/** Query key factories for scoped invalidation. */
export const accountKeys = {
  all: runtimeKeys.accounts,
  byId: (accountId: string) => ['runtime', 'accounts', accountId] as const,
};

export const inventoryKeys = {
  all: runtimeKeys.graphAll,
  byAccount: (accountId: string) => runtimeKeys.graphInventory(accountId),
};

export const enrichedKeys = {
  all: runtimeKeys.graphAll,
  byAccount: (accountId: string) => runtimeKeys.graph(accountId),
};

export const policyKeys = {
  all: ['runtime', 'traffic-policies'] as const,
  byAccount: (accountId: string) => runtimeKeys.policies(accountId),
};
