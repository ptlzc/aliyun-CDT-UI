import {ShieldCheck} from 'lucide-react';

import type {AliyunSiteType} from './accountPolicy';
import AccountPolicyJsonPanel from './AccountPolicyJsonPanel';
import RamAuthorizationGuide from './RamAuthorizationGuide';

interface AccountPolicyCardProps {
  siteType: AliyunSiteType;
}

/**
 * Persistent account-editor sidebar card for the platform RAM policy.
 *
 * @when 添加或修改托管账号时在右侧栏常驻渲染
 */
export default function AccountPolicyCard({siteType}: AccountPolicyCardProps) {
  return (
    <section className="flex flex-col overflow-hidden rounded-lg border border-hairline-divider bg-surface-white shadow-xs">
      <header className="flex items-center gap-2 border-b border-hairline-divider bg-[#FAFBFD] px-4 py-3">
        <ShieldCheck className="h-4 w-4 text-primary" />
        <div>
          <h2 className="text-xs font-bold text-primary-ink">平台 RAM 最小权限</h2>
          <p className="mt-0.5 text-[10px] text-secondary-ink">供专用 RAM 用户使用，禁止填写主账号 AccessKey。</p>
        </div>
      </header>
      <div className="flex flex-col gap-4 p-4">
        <AccountPolicyJsonPanel compact />
        <RamAuthorizationGuide siteType={siteType} />
      </div>
    </section>
  );
}
