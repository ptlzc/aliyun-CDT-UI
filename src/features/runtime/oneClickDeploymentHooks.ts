import {useMutation, useQueryClient} from '@tanstack/react-query';

import {
  continueOneClickDeployment,
  type ApiContinueOneClickDeploymentBody,
  type ApiContinueOneClickDeploymentResponse,
} from '@/src/lib/api/client';

/**
 * Resumes an installer-mode one-click deployment after the user finishes the
 * VNC setup-alpine step. Updates the jobs cache with the returned job and
 * invalidates the list so later WS/refetch events can take over.
 *
 * @when 一键部署进度页 installer 流程点击“我已安装完成，继续”
 */
export function useContinueOneClickDeploymentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({accountId, jobId, body}: {accountId: string; jobId: string; body: ApiContinueOneClickDeploymentBody}) =>
      continueOneClickDeployment(accountId, jobId, body),
    onSuccess: (response: ApiContinueOneClickDeploymentResponse) => {
      queryClient.setQueryData(['runtime', 'jobs'], (previous: unknown) => {
        const items = Array.isArray(previous) ? previous : [];
        return items.map((item: {id: string}) => (item.id === response.job.id ? response.job : item));
      });
      void queryClient.invalidateQueries({queryKey: ['runtime', 'jobs']});
    },
  });
}
