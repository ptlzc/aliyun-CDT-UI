import {motion, AnimatePresence} from 'motion/react';
import {AlertTriangle} from 'lucide-react';

import type {ApiTrafficQuotaSnapshot} from '../../../lib/api/client';
import type {ECSInstance} from '../../../types';

interface OverQuotaConfirmModalProps {
  instance: ECSInstance;
  quotaSnapshot: ApiTrafficQuotaSnapshot;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Start confirmation when the CDT free quota is over capacity: the user must
 * acknowledge potential extra traffic costs before the instance boots.
 *
 * @when 启动实例时 CDT 免费额度已超容量
 */
export default function OverQuotaConfirmModal({instance, quotaSnapshot, onCancel, onConfirm}: OverQuotaConfirmModalProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{opacity: 0}}
        animate={{opacity: 1}}
        exit={{opacity: 0}}
        className="fixed inset-0 z-50 flex items-center justify-center bg-primary-ink/40 backdrop-blur-xs"
        onClick={onCancel}
      >
        <motion.div
          initial={{scale: 0.95, opacity: 0}}
          animate={{scale: 1, opacity: 1}}
          exit={{scale: 0.95, opacity: 0}}
          className="w-full max-w-md rounded-lg bg-surface-white p-6 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-signal-amber" />
            <div className="flex-1">
              <h3 className="text-base font-bold text-primary-ink">启动确认</h3>
              <p className="mt-1 text-sm text-secondary-ink">
                当前 CDT 免费额度已超出容量，启动实例可能产生额外流量费用。是否确认启动？
              </p>
              <div className="mt-3 rounded border border-signal-amber/30 bg-signal-amber/5 p-3 text-xs">
                {quotaSnapshot.domesticUsedGb > quotaSnapshot.domesticCapacityGb && (
                  <div className="text-signal-amber">
                    中国内地: {quotaSnapshot.domesticUsedGb} / {quotaSnapshot.domesticCapacityGb} GB（已超容量）
                  </div>
                )}
                {quotaSnapshot.internationalUsedGb > quotaSnapshot.internationalCapacityGb && (
                  <div className="text-signal-amber">
                    非中国内地: {quotaSnapshot.internationalUsedGb} / {quotaSnapshot.internationalCapacityGb} GB（已超容量）
                  </div>
                )}
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={onCancel}
                  className="cursor-pointer rounded border border-hairline-divider px-4 py-1.5 text-xs font-medium text-secondary-ink hover:bg-emphasis-layer"
                >
                  取消
                </button>
                <button
                  onClick={onConfirm}
                  className="cursor-pointer rounded bg-signal-amber px-4 py-1.5 text-xs font-medium text-white hover:bg-signal-amber/80"
                >
                  确认启动
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
