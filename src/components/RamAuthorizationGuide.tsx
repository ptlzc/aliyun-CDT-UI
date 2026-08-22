import {ExternalLink} from 'lucide-react';

import {ramConsoleUrls, type AliyunSiteType} from './accountPolicy';

interface RamAuthorizationGuideProps {
  siteType: AliyunSiteType;
}

/**
 * Concrete RAM custom-policy workflow and the site-aware console entry point.
 *
 * @when 用户需要创建或修复托管账号的 RAM 授权时渲染
 */
export default function RamAuthorizationGuide({siteType}: RamAuthorizationGuideProps) {
  const isDomestic = siteType === 'domestic';

  return (
    <div className="flex flex-col gap-2 text-[10px] leading-relaxed text-secondary-ink">
      <p className="font-bold uppercase tracking-wider text-secondary-ink">授权步骤</p>
      <ol className="list-decimal space-y-1 pl-4">
        <li>使用 RAM 管理员创建专用于本平台的 RAM 用户并生成 AccessKey；不要使用阿里云主账号 AccessKey。</li>
        <li>进入“权限管理 → 权限策略 → 创建权限策略”，切换到脚本编辑。</li>
        <li>复制并粘贴上方 JSON，保存为自定义权限策略。</li>
        <li>将该自定义策略绑定到该 RAM 用户，返回本平台重新获取地域或测试连接。</li>
      </ol>
      <a
        href={ramConsoleUrls[siteType]}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 flex items-center justify-between gap-2 rounded-md border border-primary/30 px-3 py-2 text-[11px] font-medium text-primary transition-colors hover:border-primary hover:bg-primary/5"
      >
        <span className="flex items-center gap-1.5">
          <ExternalLink className="h-3.5 w-3.5" />
          前往{isDomestic ? '阿里云' : '阿里云国际'} RAM 控制台
        </span>
        <span className="font-mono text-[9px] text-secondary-ink">
          {isDomestic ? 'ram.console.aliyun.com' : 'ram.console.alibabacloud.com'}
        </span>
      </a>
    </div>
  );
}
