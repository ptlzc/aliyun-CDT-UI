import {useMemo, useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {Bell, Cloud, Menu, RefreshCw, X} from 'lucide-react';
import {AnimatePresence, motion} from 'motion/react';
import {Outlet, useLocation, useNavigate} from 'react-router-dom';

import InstanceGovernanceDrawer from './components/InstanceGovernanceDrawer';
import Sidebar from './components/Sidebar';
import {useRuntimeEventBridge} from './features/runtime/events';
import {
  accountKeys,
  mapGraphToInstances,
  runtimeKeys,
  useAccountsQuery,
  useEnrichedGraphQuery,
  useJobsQuery,
  useTrafficPoliciesQuery,
} from './features/runtime/hooks';
import {menuItems} from './navigation';
import type {ECSInstance} from './types';

/**
 * Layout shell: Sidebar + header + mobile drawer menu + instance governance
 * drawer, with the routed page rendered through <Outlet/>.
 *
 * @when 任意路由命中时作为布局层渲染
 */
export default function App() {
  const client = useQueryClient();
  const accountsQuery = useAccountsQuery();
  const jobsQuery = useJobsQuery();
  useRuntimeEventBridge(client);
  const navigate = useNavigate();
  const location = useLocation();

  const [selectedInstance, setSelectedInstance] = useState<ECSInstance | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(2);
  const [isSyncing, setIsSyncing] = useState(false);

  // The layout no longer fetches every account's enriched graph up front.
  // Only when the user opens the instance governance drawer do we request the
  // owning account's enriched graph and traffic policies.
  const enrichedGraphQuery = useEnrichedGraphQuery(selectedInstance?.accountId ?? null);
  const trafficPoliciesQuery = useTrafficPoliciesQuery(selectedInstance?.accountId ?? null);

  const selectedInstanceWithDetails = useMemo(() => {
    if (!selectedInstance) {
      return null;
    }
    const graph = enrichedGraphQuery.data;
    if (!graph) {
      return selectedInstance;
    }
    const policies = trafficPoliciesQuery.data ?? [];
    const enrichedInstances = mapGraphToInstances(
      [graph],
      accountsQuery.data || [],
      {[graph.accountId]: policies},
    );
    const matched = enrichedInstances.find((instance) => instance.id === selectedInstance.id);
    return matched ? {...matched, accountName: selectedInstance.accountName} : selectedInstance;
  }, [accountsQuery.data, enrichedGraphQuery.data, selectedInstance, trafficPoliciesQuery.data]);

  const isPathActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(`${path}/`);

  const handleGlobalSync = () => {
    setIsSyncing(true);
    void Promise.all([
      client.invalidateQueries({queryKey: accountKeys.all}),
      client.invalidateQueries({queryKey: runtimeKeys.jobs}),
      client.invalidateQueries({queryKey: runtimeKeys.settings}),
      client.invalidateQueries({queryKey: ['region-groups']}),
    ]).then(() => {
      setIsSyncing(false);
    });
  };

  const handleDeployTrigger = () => {
    navigate('/deployment');
    setMobileMenuOpen(false);
    if ((jobsQuery.data?.length ?? 0) > 0) {
      setNotificationCount((count) => Math.max(0, count - 1));
    }
  };

  return (
    <div className="bg-workspace-canvas text-primary-ink min-h-screen flex antialiased font-sans">
      <Sidebar onDeployTrigger={handleDeployTrigger} />

      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        <header className="w-full h-12 flex justify-between items-center px-6 bg-surface-white border-b border-hairline-divider z-45 sticky top-0 shadow-2xs">
          <div className="flex items-center gap-4">
            <button onClick={() => setMobileMenuOpen(true)} className="md:hidden text-outline hover:text-primary-ink p-1 rounded-md transition-colors" title="打开导航">
              <Menu className="w-5 h-5" />
            </button>
            <span className="font-space font-extrabold text-base tracking-tight text-primary">阿里云 CDT 管控台</span>
            <span className="hidden lg:inline bg-emphasis-layer/60 border border-hairline-divider px-2.5 py-0.5 rounded text-[10px] text-secondary-ink font-semibold">
              阿里云 CDT 管控运行时
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
          <Outlet
            context={{
              openInstance: (instance: ECSInstance) => setSelectedInstance(instance),
            }}
          />
        </main>
      </div>

      <AnimatePresence>
        {selectedInstanceWithDetails && (
          <motion.div key="instance-drawer" initial={{opacity: 0}} animate={{opacity: 1}} exit={{opacity: 0}}>
            <InstanceGovernanceDrawer instance={selectedInstanceWithDetails} onClose={() => setSelectedInstance(null)} />
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
                {menuItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = isPathActive(item.path);
                  return (
                    <li key={item.path}>
                      <button
                        onClick={() => {
                          navigate(item.path);
                          setMobileMenuOpen(false);
                        }}
                        className={`w-full flex items-center gap-3.5 px-4 py-3 rounded text-xs font-semibold cursor-pointer text-left ${
                          isActive ? 'bg-emphasis-layer text-primary shadow-xs' : 'text-on-surface-variant hover:bg-emphasis-layer/40'
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
