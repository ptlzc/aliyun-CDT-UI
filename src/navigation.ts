import {Cpu, KeyRound, LayoutDashboard, Server, Settings, type LucideIcon} from 'lucide-react';

/**
 * Navigation tab ids — the five top-level pages of the console.
 * Used by the tab-state transitional phase; after the routing refactor
 * completes, active-page detection is path-driven (see `path`).
 */
export type AppTabId = 'dashboard' | 'accounts' | 'instances' | 'workflows' | 'settings';

export interface NavItem {
  /** Tab id (transitional — kept until the router drives the layout shell). */
  id: AppTabId;
  /** Route path for the page. */
  path: string;
  /** Chinese menu label. */
  label: string;
  /** Lucide icon component. */
  icon: LucideIcon;
}

/**
 * Single source of truth for the main navigation menu.
 * Both the desktop Sidebar and the mobile drawer menu render from this list,
 * so menu entries can never drift apart.
 */
export const menuItems: NavItem[] = [
  {id: 'dashboard', path: '/dashboard', label: '仪表盘', icon: LayoutDashboard},
  {id: 'accounts', path: '/accounts', label: '账户管理', icon: KeyRound},
  {id: 'instances', path: '/instances', label: 'ECS 实例列表', icon: Server},
  {id: 'workflows', path: '/workflows', label: '自动化工作流', icon: Cpu},
  {id: 'settings', path: '/settings', label: '系统设置', icon: Settings},
];
