import {useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';

import {useCdtPermissionQuery} from '../../features/runtime/hooks';
import type {CloudAccount} from '../../types';
import AccountList from './components/AccountList';
import AccountDetailEditor from './components/AccountDetailEditor';
import AuditLogModal from './components/AuditLogModal';
import AuthPolicyModal from './components/AuthPolicyModal';

interface AccountsPageProps {
  accounts: CloudAccount[];
  selectedAccount: CloudAccount | null;
  setSelectedAccount: (account: CloudAccount | null) => void;
}

/**
 * Synthetic draft for the create flow. The parent re-derives selectedAccount
 * from the backend accounts list by id, so a draft id would never resolve —
 * the create form must own its draft.
 *
 * @when 点击「添加账号凭证」进入新建表单时生成
 */
function makeAccountDraft(): CloudAccount {
  return {
    id: `ali-${Math.random().toString(36).substr(2, 4)}-${Math.floor(100000 + Math.random() * 900000)}`,
    name: '',
    status: 'Active',
    providerRegion: 'Aliyun China East 1',
    mainRegion: 'cn-hangzhou (华东 1)',
    lastSynced: '刚刚',
    creationDate: new Date().toISOString().substring(0, 10) + ' 12:00 UTC',
    owner: 'sysadmin@aliyun.com',
    accessKeyId: '',
    accessKeySecret: '',
    roleArn: '',
    managedRegions: 'cn-hangzhou',
    trafficDefaults: {
      maximumTrafficGb: 200,
      overflowAction: 'notify',
      monitoringEnabled: true,
    },
  };
}

/**
 * Accounts page: listing ↔ detail/create orchestration. The parent holds the
 * selected account id and re-derives the account from the accounts list.
 *
 * @when 侧边栏点击「账户管理」或深链 /accounts* 时渲染
 */
export default function AccountsPage({accounts, selectedAccount, setSelectedAccount}: AccountsPageProps) {
  // Track if we are creating a brand new account
  const [isCreating, setIsCreating] = useState(false);

  // Local draft for the create flow (see makeAccountDraft).
  const [createDraft, setCreateDraft] = useState<CloudAccount | null>(null);

  // CDT permission check for existing accounts
  const cdtPermissionQuery = useCdtPermissionQuery(selectedAccount && !isCreating ? selectedAccount.id : null);

  // Log audit history modal or list preview trigger
  const [showAudits, setShowAudits] = useState(false);
  const [selectedAuditLog, setSelectedAuditLog] = useState<string[] | null>(null);

  // Account permission authorization modal
  const [showAuthModal, setShowAuthModal] = useState(false);

  // The account driving the details view: the create draft while creating,
  // otherwise the parent-selected account.
  const displayAccount = isCreating ? createDraft : selectedAccount;

  const handleCreateClick = () => {
    setIsCreating(true);
    setCreateDraft(makeAccountDraft());
  };

  // Exit the details/create view back to the listing. Clears both the
  // parent-selected account and the local create draft.
  const handleCloseDetails = () => {
    setIsCreating(false);
    setCreateDraft(null);
    setSelectedAccount(null);
  };

  const handleOpenAuditLogs = () => {
    if (!selectedAccount) {
      return;
    }
    setSelectedAuditLog([
      `[2026-06-16 10:14:15 UTC] - SYSTEM 操作员已对 ${selectedAccount.name} 发起同步扫描`,
      `[2026-06-16 10:14:16 UTC] - 握手元数据检查 - 成功`,
      `[2026-06-16 10:14:18 UTC] - 已成功拉取 142 个 ECS 实例元数据。`,
      `[2026-06-16 10:14:20 UTC] - KMS 密钥解密校验码匹配 - 签名一致`,
    ]);
    setShowAudits(true);
  };

  return (
    <div className="font-sans flex flex-col gap-6">
      <AnimatePresence mode="wait">
        {!displayAccount ? (
          /* ================== TAB LISTING VIEW ================== */
          <motion.div
            key="list"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col gap-6"
          >
            <AccountList
              accounts={accounts}
              onCreate={handleCreateClick}
              onEdit={(acc) => {
                setSelectedAccount(acc);
                setIsCreating(false);
              }}
            />
          </motion.div>
        ) : (
          /* ================== DETAILED VIEW / EDITOR ================== */
          <motion.div
            key="details"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -15 }}
            transition={{ duration: 0.15 }}
            className="flex flex-col gap-6"
          >
            <AccountDetailEditor
              account={displayAccount}
              isCreating={isCreating}
              cdtPermission={cdtPermissionQuery.data}
              cdtPermissionLoading={cdtPermissionQuery.isLoading}
              onClose={handleCloseDetails}
              onOpenAuthModal={() => setShowAuthModal(true)}
              onOpenAuditLogs={handleOpenAuditLogs}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Audit log visual Modal */}
      {showAudits && selectedAuditLog && (
        <AuditLogModal
          accountName={selectedAccount?.name ?? ''}
          logs={selectedAuditLog}
          onClose={() => {
            setShowAudits(false);
            setSelectedAuditLog(null);
          }}
        />
      )}

      {/* Account Authorization Modal */}
      {showAuthModal && selectedAccount && (
        <AuthPolicyModal
          account={selectedAccount}
          cdtPermission={cdtPermissionQuery.data}
          onClose={() => setShowAuthModal(false)}
        />
      )}
    </div>
  );
}
