import {createBrowserRouter, Navigate, type RouteObject} from 'react-router-dom';

import App from './App';
import AccountsPage from './pages/Accounts';
import DashboardPage from './pages/Dashboard';
import DeploymentPage from './pages/Deployment';
import InstancesPage from './pages/Instances';
import ProtectionRecordsPage from './pages/ProtectionRecords';
import SettingsPage from './pages/Settings';
import SshTerminalPage from './pages/SshTerminal';
import WorkflowsPage from './pages/Workflows';

/**
 * Single routing table for the console. The layout route mounts App as the
 * shell (Sidebar + header + instance drawer + <Outlet/>) and every page is a
 * child. /accounts/new is matched by the :accountId route with value 'new'
 * (standard create-route pattern); the page discriminates on that value.
 *
 * Instances intentionally has no sub-route: the governance drawer stays
 * mounted by the layout shell and is triggered through the Outlet context.
 */
export const appRoutes: RouteObject[] = [
  {
    // Pure full-screen SSH terminal: intentionally outside the App layout so
    // it has no sidebar/header/global chrome.
    path: '/ssh/:accountId/:instanceId',
    element: <SshTerminalPage />,
  },
  {
    path: '/',
    element: <App />,
    children: [
      {index: true, element: <Navigate to="/dashboard" replace />},
      {path: 'dashboard', element: <DashboardPage />},
      {path: 'accounts', element: <AccountsPage />},
      {path: 'accounts/:accountId', element: <AccountsPage />},
      {path: 'instances', element: <InstancesPage />},
      {path: 'protection-records', element: <ProtectionRecordsPage />},
      {path: 'deployment', element: <DeploymentPage />},
      {path: 'workflows', element: <WorkflowsPage />},
      {path: 'settings', element: <SettingsPage />},
      {path: '*', element: <Navigate to="/dashboard" replace />},
    ],
  },
];

const basename = import.meta.env.BASE_URL.replace(/\/$/, '') || '/';

export const router = createBrowserRouter(appRoutes, {basename});
