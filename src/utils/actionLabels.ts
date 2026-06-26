// 流量治理动作中文标签映射
export const ACTION_LABELS_ZH: Record<string, string> = {
  'notify': '通知',
  'keepalive-job': '保活任务',
  'stop-instance': '停止实例',
  'start-instance': '启动实例',
  'detach-eip': '解绑弹性公网 IP',
  'release-instance': '释放实例',
};

// 获取动作中文名称，未找到时返回原值
export function actionLabelZh(action: string): string {
  return ACTION_LABELS_ZH[action] || action;
}

// 生成 <option> 列表，value 保持英文原值（后端契约），显示中文
export const ACTION_OPTIONS = Object.entries(ACTION_LABELS_ZH).map(([value, label]) => ({value, label}));
