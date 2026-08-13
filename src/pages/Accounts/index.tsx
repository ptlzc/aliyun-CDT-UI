import {useEffect, useState} from 'react';
import {AnimatePresence, motion} from 'motion/react';
import {useNavigate, useParams} from 'react-router-dom';

import {useCdtPermissionQuery, useDeleteAccountMutation, useRuntimeDashboard} from '../../features/runtime/hooks';
import type {CloudAccount} from '../../types';
import AccountList from './components/AccountList';
import AccountDetailEditor from './components/AccountDetailEditor';
import AuditLogModal from './components/AuditLogModal';
import AuthPolicyModal from './components/AuthPolicyModal';
import ConfirmDeleteModal from './components/ConfirmDeleteModal';

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
    providerRegion: 'Aliyun China East 1',
    mainRegion: 'cn-hangzhou (华东 1)',
    lastSynced: '刚刚',
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
 * Accounts page: URL-driven listing ↔ detail/create orchestration.
 *
 * - /accounts          → list mode
 * - /accounts/new      → create form (matched by :accountId with value 'new')
 * - /accounts/:id      → detail mode; unknown ids redirect back to the list
 *
 * accountId from the matched /accounts/:accountId route; /accounts/new is
 * matched with accountId='new'.
 *
 * @when 侧边栏点击「账户管理」或深链 /accounts* 时渲染
 */
export default function AccountsPage() {
  const runtime = useRuntimeDashboard();
  const {accountId} = useParams();
  const navigate = useNavigate();

  // Mode discrimination: /accounts/new is matched by :accountId ('new'); any
  // other id selects an existing account from the backend list.
  const isCreating = accountId === 'new';
  const detailAccountId = accountId && accountId !== 'new' ? accountId : undefined;
  const selectedAccount =
    detailAccountId ? runtime.accounts.find((account) => account.id === detailAccountId) || null : null;

  // Guard: after the accounts list has loaded, an unknown id must not render
  // a dangling detail view — redirect back to the listing.
  const accountNotFound = Boolean(
    detailAccountId && !runtime.isLoading && runtime.accounts.length > 0 && !selectedAccount,
  );
  useEffect(() => {
    if (accountNotFound) {
      navigate('/accounts', {replace: true});
    }
  }, [accountNotFound, navigate]);

  // Local draft for the create flow (see makeAccountDraft). Lazily seeded when
  // the create route is entered; cleared when leaving it.
  const [createDraft, setCreateDraft] = useState<CloudAccount | null>(() => (isCreating ? makeAccountDraft() : null));
  useEffect(() => {
    if (isCreating && !createDraft) {
      setCreateDraft(makeAccountDraft());
    }
    if (!isCreating && createDraft) {
      setCreateDraft(null);
    }
  }, [isCreating]);

  // CDT permission check for existing accounts
  const cdtPermissionQuery = useCdtPermissionQuery(selectedAccount && !isCreating ? selectedAccount.id : null);

  // Log audit history modal or list preview trigger
  const [showAudits, setShowAudits] = useState(false);
  const [selectedAuditLog, setSelectedAuditLog] = useState<string[] | null>(null);

  // Account permission authorization modal
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Account deletion: destructive confirmation driven by the list trash button
  const [accountToDelete, setAccountToDelete] = useState<CloudAccount | null>(null);
  const deleteAccountMutation = useDeleteAccountMutation();

  // The account driving the details view: the create draft while creating,
  // otherwise the parent-selected account.
  const displayAccount = isCreating ? createDraft : selectedAccount;

  const handleCreateClick = () => {
    navigate('/accounts/new');
  };

  // Exit the details/create view back to the listing.
  const handleCloseDetails = () => {
    navigate('/accounts');
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
              accounts={runtime.accounts}
              onCreate={handleCreateClick}
              onEdit={(acc) => navigate(`/accounts/${acc.id}`)}
              onDelete={setAccountToDelete}
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

      {/* Account Deletion Confirmation Modal */}
      {accountToDelete && (
        <ConfirmDeleteModal
          account={accountToDelete}
          isPending={deleteAccountMutation.isPending}
          onConfirm={() => {
            deleteAccountMutation.mutate(accountToDelete.id, {
              onSuccess: () => {
                // Fallback: invalidateQueries already refreshed the list; if a
                // dangling detail view ever survives the refetch, the
                // accountNotFound effect redirects back — navigate here is a
                // belt-and-braces landing on the listing.
                setAccountToDelete(null);
                navigate('/accounts');
              },
            });
          }}
          onClose={() => setAccountToDelete(null)}
        />
      )}
    </div>
  );
}
