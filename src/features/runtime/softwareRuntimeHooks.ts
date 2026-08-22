import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {
  configureInstanceSingBox,
  inspectInstanceSoftware,
  type ApiInstanceSoftwareInspectRequest,
  type ApiInstanceSoftwareRuntime,
  type ApiSingBoxConfigureRequest,
  type ApiSingBoxRuntimeInfo,
} from '@/lib/api/client';

export const softwareRuntimeKeys = {
  detail: (accountId: string, instanceId: string) => ['runtime', 'instance-software', accountId, instanceId] as const,
};

/**
 * Holds an explicitly inspected software snapshot and the two request-scoped
 * mutations for one ECS card. Nothing is fetched until the operator supplies
 * SSH authentication and submits the dialog.
 */
export function useInstanceSoftwareRuntime(accountId: string, instanceId: string) {
  const queryClient = useQueryClient();
  const queryKey = softwareRuntimeKeys.detail(accountId, instanceId);
  const runtimeQuery = useQuery<ApiInstanceSoftwareRuntime | null>({
    queryKey,
    queryFn: async () => null,
    enabled: false,
    staleTime: Number.POSITIVE_INFINITY,
  });

  const inspectMutation = useMutation({
    mutationFn: (payload: ApiInstanceSoftwareInspectRequest) => inspectInstanceSoftware(accountId, instanceId, payload),
    onSuccess: (runtime) => queryClient.setQueryData(queryKey, runtime),
  });

  const configureMutation = useMutation({
    mutationFn: (payload: ApiSingBoxConfigureRequest) => configureInstanceSingBox(accountId, instanceId, payload),
    onSuccess: (singBox: ApiSingBoxRuntimeInfo) => {
      queryClient.setQueryData<ApiInstanceSoftwareRuntime | null>(queryKey, (current) => current ? {...current, singBox} : null);
    },
  });

  return {
    runtime: runtimeQuery.data ?? null,
    inspectMutation,
    configureMutation,
  };
}
