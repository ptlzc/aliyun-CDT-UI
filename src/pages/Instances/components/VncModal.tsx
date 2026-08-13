import {motion, AnimatePresence} from 'motion/react';
import {X} from 'lucide-react';

import type {ECSInstance} from '../../../types';

interface VncModalProps {
  instance: ECSInstance;
  vncUrl: string | undefined;
  vncLoading: boolean;
  vncError: string | null;
  onClose: () => void;
}

// Build Alibaba Cloud VNC web terminal URL from VncUrl.
// The VncUrl returned by API is a URL-encoded wss endpoint.
// The web terminal URL format: https://ecs.console.aliyun.com/vnc/index.htm?instanceId=xxx&vncUrl=xxx&isWindows=false
function buildVncWebUrl(vncUrl: string, instance: ECSInstance): string {
  const decoded = decodeURIComponent(vncUrl);
  const regionId = instance.regionId || '';
  const consoleBase = `https://ecs.console.aliyun.com/${regionId}/instance/vnc?instanceId=${instance.id}`;
  return `${consoleBase}&vncUrl=${encodeURIComponent(decoded)}&isWindows=false&from=cdt-manager`;
}

/**
 * VNC connection confirmation modal: shows the fetched short-lived terminal
 * URL and opens it in a new window.
 *
 * @when 实例卡片点击「连接 VNC」后渲染
 */
export default function VncModal({instance, vncUrl, vncLoading, vncError, onClose}: VncModalProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{opacity: 0}}
        animate={{opacity: 1}}
        exit={{opacity: 0}}
        className="fixed inset-0 z-50 flex items-center justify-center bg-primary-ink/40 backdrop-blur-xs"
        onClick={onClose}
      >
        <motion.div
          initial={{scale: 0.95, opacity: 0}}
          animate={{scale: 1, opacity: 1}}
          exit={{scale: 0.95, opacity: 0}}
          className="w-full max-w-lg rounded-lg bg-surface-white p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-base font-bold text-primary-ink">连接 VNC 远程终端</h3>
              <p className="mt-1 text-xs text-secondary-ink">{instance.name} · {instance.id}</p>
            </div>
            <button onClick={onClose} className="text-secondary-ink hover:text-primary-ink">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-4">
            {vncLoading && (
              <div className="rounded border border-hairline-divider bg-emphasis-layer/50 p-4 text-sm text-secondary-ink">
                正在获取 VNC 连接地址...
              </div>
            )}
            {vncError && (
              <div className="rounded border border-recovery-red/30 bg-recovery-red/5 p-4 text-sm text-recovery-red">
                获取 VNC 地址失败：{vncError}
              </div>
            )}
            {vncUrl && (
              <div className="flex flex-col gap-3">
                <div className="rounded border border-hairline-divider bg-emphasis-layer/50 p-3 text-xs text-secondary-ink">
                  <div className="font-semibold text-primary-ink">VNC 连接已就绪</div>
                  <div className="mt-1">点击下方按钮在新窗口打开阿里云 VNC 管理终端。连接地址有效期为 15 秒，请尽快使用。</div>
                </div>
                <a
                  href={buildVncWebUrl(vncUrl, instance)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cursor-pointer rounded bg-primary px-4 py-2 text-center text-sm font-medium text-white transition-colors hover:bg-primary-container"
                >
                  打开 VNC 终端
                </a>
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
