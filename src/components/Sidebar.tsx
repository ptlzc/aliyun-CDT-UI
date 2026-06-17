import { Cloud, LayoutDashboard, KeyRound, Server, Cpu, FileText, FileQuestion, Headphones, Plus } from 'lucide-react';
import { motion } from 'motion/react';

interface SidebarProps {
  activeTab: 'dashboard' | 'accounts' | 'instances' | 'workflows';
  setActiveTab: (tab: 'dashboard' | 'accounts' | 'instances' | 'workflows') => void;
  onDeployTrigger: () => void;
}

export default function Sidebar({ activeTab, setActiveTab, onDeployTrigger }: SidebarProps) {
  const menuItems = [
    { id: 'dashboard', label: '仪表盘', subLabel: 'Dashboard', icon: LayoutDashboard },
    { id: 'accounts', label: '账户管理', subLabel: 'Accounts', icon: KeyRound },
    { id: 'instances', label: 'ECS 实例列表', subLabel: 'Instances', icon: Server },
    { id: 'workflows', label: '自动化工作流', subLabel: 'Workflows', icon: Cpu },
  ] as const;

  return (
    <nav className="fixed left-0 top-0 h-full w-64 z-50 flex flex-col py-4 bg-section-layer border-r border-hairline-divider hidden md:flex font-sans">
      {/* Brand Header */}
      <div className="px-6 mb-6 flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded bg-primary flex items-center justify-center text-white shadow-sm">
            <Cloud className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-semibold text-primary uppercase text-sm tracking-wider font-space">Aliyun Ops</h1>
            <p className="text-[11px] text-secondary-ink font-medium">生产环境 • 华东 1 (cn-hangzhou)</p>
          </div>
        </div>

        {/* Deploy New Resource Button */}
        <button
          onClick={onDeployTrigger}
          className="mt-5 w-full bg-primary hover:bg-primary-container text-white py-2 px-4 rounded font-medium text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm duration-150"
        >
          <Plus className="w-4 h-4" />
          <span>部署新资源</span>
        </button>
      </div>

      {/* Main Navigation Items */}
      <ul className="flex-1 flex flex-col gap-1 px-3">
        {menuItems.map((item) => {
          const IconComponent = item.icon;
          const isActive = activeTab === item.id;

          return (
            <li key={item.id}>
              <button
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded transition-all cursor-pointer text-left relative group ${
                  isActive
                    ? 'bg-emphasis-layer text-primary font-semibold'
                    : 'text-on-surface-variant hover:bg-emphasis-layer/50 hover:text-primary-ink'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded"
                    transition={{ type: 'spring', stiffness: 380, damping: 30 }}
                  />
                )}
                <IconComponent className={`w-4 h-4 shrink-0 transition-colors ${isActive ? 'text-primary' : 'text-outline'}`} />
                <div className="flex flex-col">
                  <span className="text-xs font-medium leading-tight">{item.label}</span>
                  <span className="text-[10px] text-secondary-ink font-mono tracking-wide leading-none">{item.subLabel}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {/* Support and Docs footer menu */}
      <div className="mt-auto px-3 border-t border-hairline-divider pt-4">
        <ul className="flex flex-col gap-1">
          <li>
            <a
              href="#docs"
              className="flex items-center gap-3 px-3 py-2 rounded text-on-surface-variant hover:bg-emphasis-layer/50 hover:text-primary-ink transition-colors cursor-pointer"
            >
              <FileQuestion className="w-4 h-4 text-outline" />
              <div className="flex flex-col">
                <span className="text-xs">帮助文档</span>
                <span className="text-[9px] text-secondary-ink font-mono tracking-wide">Documentation</span>
              </div>
            </a>
          </li>
          <li>
            <a
              href="#support"
              className="flex items-center gap-3 px-3 py-2 rounded text-on-surface-variant hover:bg-emphasis-layer/50 hover:text-primary-ink transition-colors cursor-pointer"
            >
              <Headphones className="w-4 h-4 text-outline" />
              <div className="flex flex-col">
                <span className="text-xs">技术支持</span>
                <span className="text-[9px] text-secondary-ink font-mono tracking-wide">Technical Support</span>
              </div>
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
}
