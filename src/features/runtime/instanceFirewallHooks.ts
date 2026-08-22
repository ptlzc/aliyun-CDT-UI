import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {
  applyTailscaleDirectFirewall,
  createInstanceSecurityGroupRule,
  deleteInstanceSecurityGroupRule,
  listInstanceSecurityGroups,
  type ApiInstanceFirewallRuleRequest,
} from '@/lib/api/client';

export const instanceFirewallKeys = {
  detail: (accountId: string, instanceId: string) => ['runtime', 'instance-firewall', accountId, instanceId] as const,
};

/** On-demand live firewall state and mutations for the active instance modal. */
export function useInstanceFirewall(accountId: string, instanceId: string) {
  const queryClient = useQueryClient();
  const queryKey = instanceFirewallKeys.detail(accountId, instanceId);
  const snapshotQuery = useQuery({
    queryKey,
    queryFn: () => listInstanceSecurityGroups(accountId, instanceId),
    enabled: Boolean(accountId && instanceId),
  });
  const refresh = () => queryClient.invalidateQueries({queryKey});

  const createMutation = useMutation({
    mutationFn: ({securityGroupId, rule}: {securityGroupId: string; rule: ApiInstanceFirewallRuleRequest}) =>
      createInstanceSecurityGroupRule(accountId, instanceId, securityGroupId, rule),
    onSettled: refresh,
  });
  const deleteMutation = useMutation({
    mutationFn: ({securityGroupId, ruleId, direction}: {securityGroupId: string; ruleId: string; direction: 'ingress' | 'egress'}) =>
      deleteInstanceSecurityGroupRule(accountId, instanceId, securityGroupId, ruleId, direction),
    onSettled: refresh,
  });
  const tailscaleMutation = useMutation({
    mutationFn: (securityGroupId: string) => applyTailscaleDirectFirewall(accountId, instanceId, securityGroupId),
    onSettled: refresh,
  });

  return {snapshotQuery, createMutation, deleteMutation, tailscaleMutation};
}
