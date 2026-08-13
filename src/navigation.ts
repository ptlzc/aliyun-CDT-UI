import {Cpu, KeyRound, LayoutDashboard, Server, Settings, type LucideIcon} from 'lucide-react';

export interface NavItem {
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
  {path: '/dashboard', label: '仪表盘', icon: LayoutDashboard},
  {path: '/accounts', label: '账户管理', icon: KeyRound},
  {path: '/instances', label: 'ECS 实例列表', icon: Server},
  {path: '/workflows', label: '自动化工作流', icon: Cpu},
  {path: '/settings', label: '系统设置', icon: Settings},
];
