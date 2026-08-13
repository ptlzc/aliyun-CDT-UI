import {createBrowserRouter, Navigate, type RouteObject} from 'react-router-dom';

import App from './App';
import AccountsPage from './pages/Accounts';
import DashboardPage from './pages/Dashboard';
import InstancesPage from './pages/Instances';
import SettingsPage from './pages/Settings';
import WorkflowsPage from './pages/Workflows';

/**
 * Single routing table for the console. The layout route mounts App as the
 * shell (Sidebar + header + instance drawer + <Outlet/>) and every page is a
 * child. /accounts/new is a static segment and outranks /accounts/:accountId
 * regardless of declaration order.
 *
 * Instances intentionally has no sub-route: the governance drawer stays
 * mounted by the layout shell and is triggered through the Outlet context.
 */
export const appRoutes: RouteObject[] = [
  {
    path: '/',
    element: <App />,
    children: [
      {index: true, element: <Navigate to="/dashboard" replace />},
      {path: 'dashboard', element: <DashboardPage />},
      {path: 'accounts', element: <AccountsPage />},
      {path: 'accounts/new', element: <AccountsPage />},
      {path: 'accounts/:accountId', element: <AccountsPage />},
      {path: 'instances', element: <InstancesPage />},
      {path: 'workflows', element: <WorkflowsPage />},
      {path: 'settings', element: <SettingsPage />},
      {path: '*', element: <Navigate to="/dashboard" replace />},
    ],
  },
];

export const router = createBrowserRouter(appRoutes);
