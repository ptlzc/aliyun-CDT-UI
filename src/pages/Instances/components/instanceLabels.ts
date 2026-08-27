import type {ECSInstance} from '../../../types';

export const SOURCE_LAYER_LABELS: Record<string, string> = {
  'instance': '实例级',
  'region-group': '地区组',
  'platform-default': '全局默认',
  'global': '全局默认',
};

// 实例状态枚举 → 中文展示映射（后端枚举值不翻译，仅显示层映射）
export const INSTANCE_STATUS_LABELS: Record<ECSInstance['status'], string> = {
  'Running': '运行中',
  'Stopped': '已停止',
  'Attention': '需关注',
};

// 后端返回的未知状态字符串保持原样展示（与 actionLabelZh 同模式）
export function instanceStateLabel(state: string): string {
  return INSTANCE_STATUS_LABELS[state as ECSInstance['status']] || state;
}

export function sourceLayerBadgeClass(label: string): string {
  if (label === '实例级') {
    return 'border-[#C8E6C9] bg-[#E8F5E9] text-[#1B5E20]';
  }
  if (label === '地区组') {
    return 'border-[#FFECB3] bg-[#FFF8E1] text-[#F57F17]';
  }
  return 'border-hairline-divider bg-section-layer text-secondary-ink';
}

export function quotaBarColor(usedGb: number, capacityGb: number): string {
  if (capacityGb <= 0) {
    return 'bg-hairline-divider';
  }
  const ratio = usedGb / capacityGb;
  if (ratio > 1) {
    return 'bg-recovery-red';
  }
  if (ratio >= 0.8) {
    return 'bg-signal-amber';
  }
  return 'bg-healthy-green';
}

export function formatTrafficValue(value: number): string {
  return value.toFixed(2);
}
