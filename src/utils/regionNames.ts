// 阿里云地域 ID → 中文名称映射
// 数据来源：阿里云 ECS DescribeRegions API 返回的 LocalName 字段
export const REGION_NAME_ZH: Record<string, string> = {
  // 中国内地
  'cn-hangzhou': '杭州',
  'cn-shanghai': '上海',
  'cn-beijing': '北京',
  'cn-zhangjiakou': '张家口',
  'cn-huhehaote': '呼和浩特',
  'cn-wulanchabu': '乌兰察布',
  'cn-shenzhen': '深圳',
  'cn-heyuan': '河源',
  'cn-guangzhou': '广州',
  'cn-chengdu': '成都',
  'cn-nanjing': '南京',
  'cn-fuzhou': '福州',
  'cn-wuhan-lr': '武汉',
  'cn-shanghai-finance-1': '上海（金融云）',
  'cn-shenzhen-finance-1': '深圳（金融云）',
  'cn-beijing-finance-1': '北京（金融云）',
  'cn-north-2-gov-1': '北京（政务云）',

  // 中国香港及亚太
  'cn-hongkong': '中国香港',
  'ap-southeast-1': '新加坡',
  'ap-southeast-2': '悉尼',
  'ap-southeast-3': '吉隆坡',
  'ap-southeast-5': '雅加达',
  'ap-southeast-6': '马尼拉',
  'ap-southeast-7': '曼谷',
  'ap-southeast-8': '孟买',
  'ap-south-1': '孟买',
  'ap-northeast-1': '东京',
  'ap-northeast-2': '首尔',
  'ap-east-1': '中国香港（亚太东部）',

  // 欧洲与中东
  'eu-west-1': '伦敦',
  'eu-central-1': '法兰克福',
  'me-east-1': '迪拜',
  'me-central-1': '利雅得',

  // 北美
  'us-west-1': '硅谷',
  'us-east-1': '弗吉尼亚',
};

// 获取地域中文名称，未找到时返回地域 ID 原值
export function regionNameZh(regionId: string): string {
  return REGION_NAME_ZH[regionId] || regionId;
}
