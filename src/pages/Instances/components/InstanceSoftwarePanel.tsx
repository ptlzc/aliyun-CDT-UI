import {Network, RefreshCw, Settings2} from 'lucide-react';
import {useState} from 'react';

import {useInstanceSoftwareRuntime} from '@/features/runtime/softwareRuntimeHooks';
import type {ApiInstanceSoftwareInspectRequest, ApiSingBoxConfigureRequest} from '@/lib/api/client';
import type {ECSInstance} from '@/types';
import InstanceSoftwareModal from './InstanceSoftwareModal';

interface InstanceSoftwarePanelProps {
  instance: ECSInstance;
  effectiveStatus: ECSInstance['status'];
}

function errorMessage(error: unknown): string | null {
  if (!error) return null;
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'error' in error && typeof error.error === 'string') return error.error;
  return String(error);
}

/** Per-card software inspection result and entry point for authenticated
 * Sing-box configuration. Runtime snapshots stay in TanStack Query only. */
export default function InstanceSoftwarePanel({instance, effectiveStatus}: InstanceSoftwarePanelProps) {
  const [mode, setMode] = useState<'inspect' | 'configure' | null>(null);
  const {runtime, inspectMutation, configureMutation} = useInstanceSoftwareRuntime(instance.accountId, instance.id);
  const isStopped = effectiveStatus === 'Stopped';

  const open = (nextMode: 'inspect' | 'configure') => {
    inspectMutation.reset();
    configureMutation.reset();
    setMode(nextMode);
  };

  const inspect = async (payload: ApiInstanceSoftwareInspectRequest) => {
    try {
      await inspectMutation.mutateAsync(payload);
      setMode(null);
    } catch {
      // The request error remains on the mutation and is rendered in the dialog.
    }
  };

  const configure = async (payload: ApiSingBoxConfigureRequest) => {
    try {
      await configureMutation.mutateAsync(payload);
      setMode(null);
    } catch {
      // The request error remains on the mutation and is rendered in the dialog.
    }
  };

  if (isStopped) {
    return <p className="text-[10px] text-secondary-ink">实例启动后可检测运行软件</p>;
  }

  return (
    <div className="rounded border border-hairline-divider/60 bg-workspace-canvas p-3 text-xs">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 font-semibold text-primary-ink">
          <Network className="h-3.5 w-3.5 text-primary" />
          运行软件
        </div>
        <button
          type="button"
          onClick={() => open('inspect')}
          className="cursor-pointer rounded border border-hairline-divider bg-surface-white px-2.5 py-1 text-[10px] font-medium text-secondary-ink hover:text-primary"
        >
          <RefreshCw className="mr-1 inline h-3 w-3" />
          {runtime ? '重新检测' : '检测运行软件'}
        </button>
      </div>

      {runtime && !runtime.tailscale.installed && !runtime.singBox.installed && (
        <p className="mt-2 text-[10px] text-secondary-ink">未检测到支持的运行软件。</p>
      )}

      {runtime?.tailscale.installed && (
        <div className="mt-2 rounded border border-primary/15 bg-surface-white px-2.5 py-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-primary-ink">Tailscale</span>
            <span className={runtime.tailscale.running ? 'text-healthy-green' : 'text-secondary-ink'}>
              {runtime.tailscale.running ? '运行中' : '未运行'}
            </span>
          </div>
          {runtime.tailscale.hostname && <p className="mt-1 break-all font-mono text-[10px] text-primary-ink">{runtime.tailscale.hostname}</p>}
          <div className="mt-1 flex flex-wrap gap-1">
            {(runtime.tailscale.ips || []).map((ip) => <span key={ip} className="rounded bg-emphasis-layer px-1.5 py-0.5 font-mono text-[10px] text-secondary-ink">{ip}</span>)}
          </div>
        </div>
      )}

      {runtime?.singBox.installed && (
        <div className="mt-2 flex items-center justify-between gap-3 rounded border border-primary/15 bg-surface-white px-2.5 py-2">
          <div>
            <p className="font-semibold text-primary-ink">Sing-box{runtime.singBox.version ? ` ${runtime.singBox.version}` : ''}</p>
            <p className="mt-0.5 text-[10px] text-secondary-ink">{runtime.singBox.running ? '运行中' : '未运行'}</p>
          </div>
          <button type="button" onClick={() => open('configure')} className="cursor-pointer rounded border border-primary/30 px-2.5 py-1 text-[10px] font-medium text-primary hover:bg-primary hover:text-white">
            <Settings2 className="mr-1 inline h-3 w-3" />配置 Sing-box
          </button>
        </div>
      )}

      {mode && (
        <InstanceSoftwareModal
          mode={mode}
          runtime={runtime}
          pending={mode === 'inspect' ? inspectMutation.isPending : configureMutation.isPending}
          error={errorMessage(mode === 'inspect' ? inspectMutation.error : configureMutation.error)}
          onClose={() => setMode(null)}
          onInspect={(payload) => void inspect(payload)}
          onConfigure={(payload) => void configure(payload)}
        />
      )}
    </div>
  );
}
