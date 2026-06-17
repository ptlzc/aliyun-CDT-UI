import { useState } from 'react';
import Sidebar from './components/Sidebar';
import DashboardView from './components/DashboardView';
import AccountsView from './components/AccountsView';
import InstancesView from './components/InstancesView';
import WorkflowsView from './components/WorkflowsView';
import { initialAccounts, initialInstances, initialWorkflows } from './mockData';
import { CloudAccount, ECSInstance, WorkflowRun } from './types';
import { RefreshCw, Bell, Settings, Menu, X, Cloud, LayoutDashboard, KeyRound, Server, Cpu } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'accounts' | 'instances' | 'workflows'>('dashboard');
  const [accounts, setAccounts] = useState<CloudAccount[]>(initialAccounts);
  const [instances, setInstances] = useState<ECSInstance[]>(initialInstances);
  const [workflows, setWorkflows] = useState<WorkflowRun[]>(initialWorkflows);
  
  // Account drill-down selection (from dashboard or list)
  const [selectedAccount, setSelectedAccount] = useState<CloudAccount | null>(null);

  // Mobile navigation overlay menu toggle
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Global Sync indicator spinner
  const [isSyncing, setIsSyncing] = useState(false);
  const [notificationCount, setNotificationCount] = useState(2);

  const handleGlobalSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      // Simulate credential updates and log sync
      setAccounts(prev =>
        prev.map(acc => {
          if (acc.status === 'Sync Delayed') {
            return { ...acc, status: 'Active', lastSynced: 'Just now' };
          }
          return { ...acc, lastSynced: 'Just now' };
        })
      );
      // Add a fresh log line into current workflow if running
      setWorkflows(prev =>
        prev.map(wkf => {
          if (wkf.status === 'Running') {
            return {
              ...wkf,
              logs: [...wkf.logs, `[2026-06-16 19:03:15 UTC] INFO - Forced sync refresh requested by operator. OK.`]
            };
          }
          return wkf;
        })
      );
    }, 1200);
  };

  // Deploy trigger clicked from sidebar pushes user into active workflow tab and restarts simulation
  const handleDeployTrigger = () => {
    setActiveTab('workflows');
    setMobileMenuOpen(false);
    
    // Reset active default workflow run demo
    setWorkflows((prev) =>
      prev.map((w) => {
        if (w.id === 'wkf-8a7b6c5d') {
          return {
            ...w,
            status: 'Running',
            activeStepIndex: 2,
            tasks: [
              { id: 'task-vpc-verify', name: 'task-vpc-verify', status: 'Completed', description: 'Verified vSwitch and Security Group bindings.' },
              { id: 'task-ecs-provisioning', name: 'task-ecs-provisioning', status: 'In Progress', description: 'Preparing CreateInstance API payload. Calling Aliyun RunInstances API and tracking instance power states.', properties: { InstanceType: 'ecs.g7.xlarge', ImageId: 'aliyun_3_x64_20G_alibase_20231220.vhd', Count: 3 }, progress: 10 },
              { id: 'task-eip-allocate', name: 'task-eip-allocate', status: 'Pending', description: 'Allocating regional Elastic IP pool and performing direct binding associations.' },
              { id: 'task-slb-register', name: 'task-slb-register', status: 'Pending', description: 'Registering newly provisioned virtual server targets under regional Load Balancer groups.' }
            ],
            logs: [
              '[2023-10-27 14:32:01 UTC] INFO Starting workflow execution wkf-8a7b6c5d',
              '[2023-10-27 14:32:02 UTC] INFO Engine context initialized. Target: cn-hangzhou',
              '[2023-10-27 14:32:05 UTC] INFO Loading task DAG... 12 nodes discovered.',
              '[2023-10-27 14:32:10 UTC] SUCCESS Resource Discovery complete. Took 00:45s',
              `[2026-06-16 19:03:00 UTC] INFO Sparked new Aliyun Cluster deployment DAG flow. Starting bootstrap.`
            ]
          };
        }
        return w;
      })
    );
  };

  return (
    <div className="bg-workspace-canvas text-primary-ink min-h-screen flex antialiased font-sans">
      
      {/* 1. Sidebar element - suppressed/hidden on mobile, visible on medium+ */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setSelectedAccount(null); // clear detail panels on tab switch
        }} 
        onDeployTrigger={handleDeployTrigger}
      />

      {/* 2. Main content canvas layout */}
      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        
        {/* Top bar header */}
        <header className="w-full h-12 flex justify-between items-center px-6 bg-surface-white border-b border-hairline-divider z-45 sticky top-0 shadow-2xs">
          <div className="flex items-center gap-4">
            
            {/* Mobile menu drawer trigger button */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden text-outline hover:text-primary-ink p-1 rounded-md transition-colors"
              title="Open Navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Title brand typography */}
            <span className="font-space font-extrabold text-base tracking-tight text-primary">
              CloudOps Workbench
            </span>

            <span className="hidden lg:inline bg-emphasis-layer/60 border border-hairline-divider px-2.5 py-0.5 rounded text-[10px] text-secondary-ink font-semibold">
              Aliyun CDT Control Plane Redesign v1.2
            </span>
          </div>

          {/* Right utility toolbar actions button groups */}
          <div className="flex items-center gap-2">
            
            {/* Sync trigger button */}
            <button
              onClick={handleGlobalSync}
              disabled={isSyncing}
              className={`p-1.5 text-on-surface-variant hover:bg-emphasis-layer rounded transition-colors cursor-pointer shrink-0 disabled:opacity-40`}
              title="手工同步云资源 (Test credentials sync)"
            >
              <RefreshCw className={`w-4 h-4 text-outline ${isSyncing ? 'animate-spin text-primary font-bold' : ''}`} />
            </button>

            {/* Notifications panel toggle indicator */}
            <button
              onClick={() => {
                setNotificationCount(0);
                alert('系统消息通知已悉数清除。当前 CDT 部署网关处于就绪接收状态。');
              }}
              className="p-1.5 text-on-surface-variant hover:bg-emphasis-layer rounded transition-colors relative cursor-pointer"
              title="查看系统提示通知"
            >
              <Bell className="w-4 h-4 text-outline" />
              {notificationCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-signal-amber rounded-full border border-surface-white" />
              )}
            </button>

            {/* Settings button */}
            <button
              onClick={() => alert('Aliyun CDT Workbench CLI Options:\n- TLS 1.3 encryption\n- KMS Envelope Master Secret\n- Polling sync interval: 15m')}
              className="p-1.5 text-on-surface-variant hover:bg-emphasis-layer rounded transition-colors cursor-pointer"
              title="设置首选项"
            >
              <Settings className="w-4 h-4 text-outline" />
            </button>

            <div className="h-4 w-[1px] bg-hairline-divider mx-1 hidden sm:block"></div>

            {/* Professional Operator photo avatar - as shown in index.html snippet */}
            <div 
              onClick={() => alert(`Operator details:\nEmail: oraleeed789@gmail.com\nRole: Production Auditor System Administrator`)}
              className="w-8 h-8 rounded-full overflow-hidden border border-hairline-divider cursor-pointer shrink-0 flex items-center justify-center hover:scale-105 active:scale-95 transition-all ml-1"
              title="Operator details"
            >
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuCsbPUAz6XH8YQd1ZwyxmGNz_Tx-pPdPa-51nkyrgoRlWsW7QDPIgYO_veVPfNztTUmSWEQ0NQlcxJz6m8T5lgCZmwXgl-LR0iJjrJ-CjBMY0nzyrLroHX0clCHXYmKts7Ibm2gbHdPU6No11R_VbhSsJFkOrxr_9gqYayXCFgemARKlWO2RGL2_ZQu7MrF1yc53ZZD8Al7gIIT2haCnMglU91-u7J8hNPrsPh8yaC23g8l3qWxkTXMfdyJ6k0gSIYxtDeGaAq6Rd4"
                alt="Cloud Engineer Operator Profile"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        </header>

        {/* 3. Central Router Workspace container fluid */}
        <main className="flex-1 p-6 max-w-7xl w-full mx-auto flex flex-col gap-6">
          <AnimatePresence mode="wait">
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
              >
                <DashboardView 
                  accounts={accounts}
                  instances={instances}
                  workflows={workflows}
                  setActiveTab={setActiveTab}
                  setSelectedAccount={setSelectedAccount}
                />
              </motion.div>
            )}

            {activeTab === 'accounts' && (
              <motion.div
                key="accounts"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
              >
                <AccountsView 
                  accounts={accounts}
                  setAccounts={setAccounts}
                  selectedAccount={selectedAccount}
                  setSelectedAccount={setSelectedAccount}
                />
              </motion.div>
            )}

            {activeTab === 'instances' && (
              <motion.div
                key="instances"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
              >
                <InstancesView 
                  instances={instances}
                  setInstances={setInstances}
                />
              </motion.div>
            )}

            {activeTab === 'workflows' && (
              <motion.div
                key="workflows"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
              >
                <WorkflowsView 
                  workflows={workflows}
                  setWorkflows={setWorkflows}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* 4. Responsive Mobile Navigation drawer menu overlay */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <div className="fixed inset-0 z-50 flex md:hidden font-sans">
            {/* Blurry dark backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileMenuOpen(false)}
              className="fixed inset-0 bg-primary-ink/50 backdrop-blur-xs"
            />

            {/* Drawer menu content block */}
            <motion.div
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="relative w-64 max-w-xs bg-section-layer h-full shadow-2xl flex flex-col py-4 z-10"
            >
              {/* Header inside drawer */}
              <div className="px-5 mb-5 flex items-center justify-between border-b pb-3 border-hairline-divider/50">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded bg-primary flex items-center justify-center text-white">
                    <Cloud className="w-4.5 h-4.5" />
                  </div>
                  <span className="font-space font-black text-xs text-primary uppercase">Aliyun Ops Menu</span>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="p-1 text-on-surface-variant hover:text-primary-ink hover:bg-emphasis-layer rounded-full cursor-pointer"
                  title="Close Menu"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Navigation links drawer rendering */}
              <ul className="flex-1 flex flex-col gap-1 px-2.5">
                {[
                  { id: 'dashboard', label: '仪表盘', icon: LayoutDashboard },
                  { id: 'accounts', label: '账户管理', icon: KeyRound },
                  { id: 'instances', label: 'ECS 实例列表', icon: Server },
                  { id: 'workflows', label: '自动化工作流', icon: Cpu },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.id}>
                      <button
                        onClick={() => {
                          setActiveTab(item.id as any);
                          setSelectedAccount(null);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3.5 px-4 py-3 rounded text-xs font-semibold cursor-pointer text-left ${
                          activeTab === item.id 
                            ? 'bg-emphasis-layer text-primary shadow-xs' 
                            : 'text-on-surface-variant hover:bg-emphasis-layer/40'
                        }`}
                      >
                        <Icon className="w-4.5 h-4.5 text-outline" />
                        <span>{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {/* Trigger deploy in drawer bottom */}
              <div className="px-3 mt-auto">
                <button
                  onClick={handleDeployTrigger}
                  className="w-full bg-primary text-white py-2 px-4 rounded text-xs font-bold shadow hover:bg-primary-container transition-all flex items-center justify-center gap-2"
                >
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

