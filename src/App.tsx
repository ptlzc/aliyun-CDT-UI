import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, Cloud, Cpu, KeyRound, LayoutDashboard, Menu, RefreshCw, Server, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';

import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import AccountsView from './components/AccountsView';
import InstancesView from './components/InstancesView';
import InstanceGovernanceDrawer from './components/InstanceGovernanceDrawer';
import SettingsView from './components/SettingsView';
import WorkflowsView from './components/WorkflowsView';
import { useRuntimeDashboard } from './features/runtime/hooks';
import { useRuntimeEventBridge } from './features/runtime/events';

export default function App() {
  const runtime = useRuntimeDashboard();
  const client = useQueryClient();
  useRuntimeEventBridge(client);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'accounts' | 'instances' | 'workflows' | 'settings'>('dashboard');
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(2);
  const [isSyncing, setIsSyncing] = useState(false);

  const selectedAccount = runtime.accounts.find((account) => account.id === selectedAccountId) || null;
  const selectedInstance = runtime.instances.find((instance) => instance.id === selectedInstanceId) || null;

  const handleGlobalSync = () => {
    setIsSyncing(true);
    void Promise.resolve().then(() => {
      setIsSyncing(false);
      void client.invalidateQueries();
    });
  };

  const handleDeployTrigger = () => {
    setActiveTab('workflows');
    setMobileMenuOpen(false);
    if (runtime.workflows.length > 0) {
      setNotificationCount((count) => Math.max(0, count - 1));
    }
  };

  return (
    <div className="bg-workspace-canvas text-primary-ink min-h-screen flex antialiased font-sans">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSelectedAccountId(null);
        }}
        onDeployTrigger={handleDeployTrigger}
      />

      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <header className="w-full h-12 flex justify-between items-center px-6 bg-surface-white border-b border-hairline-divider z-45 sticky top-0 shadow-2xs">
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileMenuOpen(true)} className="md:hidden text-outline hover:text-primary-ink p-1 rounded-md transition-colors" title="Open Navigation">
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-space font-extrabold text-base tracking-tight text-primary">CloudOps Workbench</span>
            <span className="hidden lg:inline bg-emphasis-layer/60 border border-hairline-divider px-2.5 py-0.5 rounded text-[10px] text-secondary-ink font-semibold">
              Aliyun CDT Control Plane Runtime
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleGlobalSync} disabled={isSyncing} className="p-1.5 text-on-surface-variant hover:bg-emphasis-layer rounded transition-colors cursor-pointer shrink-0 disabled:opacity-40" title="同步后端数据">
              <RefreshCw className={`w-4 h-4 text-outline ${isSyncing ? 'animate-spin text-primary font-bold' : ''}`} />
            </button>
            <button onClick={() => setNotificationCount(0)} className="p-1.5 text-on-surface-variant hover:bg-emphasis-layer rounded transition-colors relative cursor-pointer" title="查看系统提示通知">
              <Bell className="w-4 h-4 text-outline" />
              {notificationCount > 0 && <span className="absolute top-1 right-1 w-2 h-2 bg-signal-amber rounded-full border border-surface-white" />}
            </button>
          </div>
        </header>

        <main className="flex-1 p-6 max-w-7xl w-full mx-auto flex flex-col gap-6">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div key="dashboard" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
                <DashboardView
                  accounts={runtime.accounts}
                  instances={runtime.instances}
                  summary={runtime.summary}
                  workflows={runtime.workflows}
                  setActiveTab={setActiveTab}
                  setSelectedAccount={(account) => setSelectedAccountId(account?.id || null)}
                />
              </motion.div>
            )}

            {activeTab === 'accounts' && (
              <motion.div key="accounts" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
                <AccountsView
                  accounts={runtime.accounts}
                  selectedAccount={selectedAccount}
                  setSelectedAccount={(account) => setSelectedAccountId(account?.id || null)}
                />
              </motion.div>
            )}

            {activeTab === 'instances' && (
              <motion.div key="instances" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
                <InstancesView
                  instances={runtime.instances}
                  isLoading={runtime.isLoading}
                  onManageInstance={(instance) => {
                    setSelectedInstanceId(instance.id);
                  }}
                />
              </motion.div>
            )}

            {activeTab === 'workflows' && (
              <motion.div key="workflows" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
                <WorkflowsView workflows={runtime.workflows} />
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div key="settings" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }}>
                <SettingsView defaults={runtime.platformDefaults} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      <AnimatePresence>
        {selectedInstance && (
          <motion.div key="instance-drawer" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}>
            <InstanceGovernanceDrawer instance={selectedInstance} onClose={() => setSelectedInstanceId(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden font-sans">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMobileMenuOpen(false)} className="fixed inset-0 bg-primary-ink/50 backdrop-blur-xs" />
            <motion.div initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }} transition={{ type: 'spring', damping: 25, stiffness: 220 }} className="relative w-64 max-w-xs bg-section-layer h-full shadow-2xl flex flex-col py-4 z-10">
              <div className="px-5 mb-5 flex items-center justify-between border-b pb-3 border-hairline-divider/50">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded bg-primary flex items-center justify-center text-white"><Cloud className="w-4.5 h-4.5" /></div>
                  <span className="font-space font-black text-xs text-primary uppercase">阿里云运维菜单</span>
                </div>
                <button onClick={() => setMobileMenuOpen(false)} className="p-1 text-on-surface-variant hover:text-primary-ink hover:bg-emphasis-layer rounded-full cursor-pointer" title="关闭菜单">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ul className="flex-1 flex flex-col gap-1 px-2.5">
                {[
                  { id: 'dashboard', label: '仪表盘', icon: LayoutDashboard },
                  { id: 'accounts', label: '账户管理', icon: KeyRound },
                  { id: 'instances', label: 'ECS 实例列表', icon: Server },
                  { id: 'workflows', label: '自动化工作流', icon: Cpu },
                  { id: 'settings', label: '系统设置', icon: Settings },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => {
                          setActiveTab(item.id as any);
                          setSelectedAccountId(null);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3.5 px-4 py-3 rounded text-xs font-semibold cursor-pointer text-left ${
                          activeTab === item.id ? 'bg-emphasis-layer text-primary shadow-xs' : 'text-on-surface-variant hover:bg-emphasis-layer/40'
                        }`}
                      >
                        <Icon className="w-4.5 h-4.5 text-outline" />
                        <span>{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="px-3 mt-auto">
                <button onClick={handleDeployTrigger} className="w-full bg-primary text-white py-2 px-4 rounded text-xs font-bold shadow hover:bg-primary-container transition-all flex items-center justify-center gap-2">
                  部署新资源
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
