import {X} from 'lucide-react';
import {useState, type FormEvent} from 'react';

import type {
  ApiInstanceSoftwareInspectRequest,
  ApiInstanceSoftwareRuntime,
  ApiSingBoxConfigureRequest,
} from '@/lib/api/client';

interface InstanceSoftwareModalProps {
  mode: 'inspect' | 'configure';
  runtime: ApiInstanceSoftwareRuntime | null;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onInspect: (payload: ApiInstanceSoftwareInspectRequest) => void;
  onConfigure: (payload: ApiSingBoxConfigureRequest) => void;
}

const inputClass = 'w-full rounded border border-hairline-divider bg-surface-white px-3 py-2 text-xs text-primary-ink focus:border-primary focus:outline-none';

/** Request-scoped SSH and authenticated Sing-box form. Secret state is owned
 * by this mount and disappears when the dialog closes. */
export default function InstanceSoftwareModal({
  mode,
  runtime,
  pending,
  error,
  onClose,
  onInspect,
  onConfigure,
}: InstanceSoftwareModalProps) {
  const managed = runtime?.singBox.managedInbound;
  const [sshUser, setSshUser] = useState('root');
  const [sshPassword, setSshPassword] = useState('');
  const [listen, setListen] = useState(managed?.listen || '0.0.0.0');
  const [listenPort, setListenPort] = useState(String(managed?.listenPort || 1080));
  const [bindInterface, setBindInterface] = useState(managed?.bindInterface || '');
  const [username, setUsername] = useState(managed?.username || 'proxy-user');
  const [password, setPassword] = useState('');
  const title = mode === 'inspect' ? '检测运行软件' : '配置 Sing-box';

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (mode === 'inspect') {
      onInspect({sshUser, sshPassword});
      return;
    }
    onConfigure({
      sshUser,
      sshPassword,
      listen,
      listenPort: Number(listenPort),
      bindInterface,
      username,
      password,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-primary-ink/40 p-4 backdrop-blur-xs" onClick={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="instance-software-modal-title"
        className="w-full max-w-lg rounded-lg bg-surface-white p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 id="instance-software-modal-title" className="text-base font-bold text-primary-ink">{title}</h3>
            <p className="mt-1 text-xs text-secondary-ink">
              SSH 凭据仅用于本次操作，不会保存。后端已配置私钥时密码可留空。
            </p>
          </div>
          <button type="button" aria-label="关闭软件配置" onClick={onClose} className="cursor-pointer text-secondary-ink hover:text-primary-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1 text-xs font-medium text-primary-ink">
              <span>SSH 用户</span>
              <input aria-label="SSH 用户" value={sshUser} onChange={(event) => setSshUser(event.target.value)} className={inputClass} />
            </label>
            <label className="space-y-1 text-xs font-medium text-primary-ink">
              <span>SSH 密码</span>
              <input aria-label="SSH 密码" type="password" value={sshPassword} onChange={(event) => setSshPassword(event.target.value)} className={inputClass} autoComplete="current-password" />
            </label>
          </div>

          {mode === 'configure' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-xs font-medium text-primary-ink">
                  <span>监听地址</span>
                  <input aria-label="监听地址" required value={listen} onChange={(event) => setListen(event.target.value)} className={inputClass} />
                </label>
                <label className="space-y-1 text-xs font-medium text-primary-ink">
                  <span>监听端口</span>
                  <input aria-label="监听端口" required type="number" min={1} max={65535} value={listenPort} onChange={(event) => setListenPort(event.target.value)} className={inputClass} />
                </label>
              </div>
              <label className="block space-y-1 text-xs font-medium text-primary-ink">
                <span>绑定网络接口（可选）</span>
                <input aria-label="绑定网络接口（可选）" value={bindInterface} onChange={(event) => setBindInterface(event.target.value)} placeholder="例如 tailscale0" className={inputClass} />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-xs font-medium text-primary-ink">
                  <span>代理用户名</span>
                  <input aria-label="代理用户名" required value={username} onChange={(event) => setUsername(event.target.value)} className={inputClass} autoComplete="username" />
                </label>
                <label className="space-y-1 text-xs font-medium text-primary-ink">
                  <span>代理密码</span>
                  <input aria-label="代理密码" required type="password" value={password} onChange={(event) => setPassword(event.target.value)} className={inputClass} autoComplete="new-password" />
                </label>
              </div>
              <p className="rounded border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] leading-relaxed text-secondary-ink">
                创建一个同时支持 SOCKS 与 HTTP 的 mixed 入站；用户名和密码为必填，避免开放匿名代理。
              </p>
            </>
          )}

          {error && <p role="alert" className="rounded border border-recovery-red/20 bg-recovery-red/5 px-3 py-2 text-xs text-recovery-red">{error}</p>}

          <div className="flex justify-end gap-2 border-t border-hairline-divider pt-4">
            <button type="button" onClick={onClose} className="cursor-pointer rounded border border-hairline-divider px-3 py-2 text-xs text-secondary-ink">取消</button>
            <button type="submit" disabled={pending} className="cursor-pointer rounded bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-50">
              {pending ? '处理中…' : mode === 'inspect' ? '开始检测' : '保存并重启'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
