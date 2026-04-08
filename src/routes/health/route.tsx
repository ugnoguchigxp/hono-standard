import { TreeMenu, type TreeMenuItem } from '@repo/design-system';
import { createFileRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import {
  BarChart3,
  Bell,
  FileText,
  History,
  LayoutDashboard,
  Settings,
  Target,
} from 'lucide-react';

export const Route = createFileRoute('/health')({
  component: HealthLayoutRoute,
});

function HealthLayoutRoute() {
  const navigate = useNavigate();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  // Map current path to menu item ID
  const getSelectedId = () => {
    if (currentPath === '/health') return 'dashboard';
    if (currentPath === '/health/summary') return 'summary';
    if (currentPath === '/health/history') return 'history';
    if (currentPath === '/health/goals') return 'goals';
    if (currentPath === '/health/alerts') return 'alerts';
    if (currentPath === '/health/reports') return 'reports';
    if (currentPath === '/health/settings') return 'settings';
    return 'dashboard';
  };

  const menuItems: TreeMenuItem[] = [
    {
      id: 'overview',
      label: '概要',
      children: [
        {
          id: 'dashboard',
          label: 'ダッシュボード',
          icon: <LayoutDashboard className="h-4 w-4" />,
        },
        {
          id: 'summary',
          label: '週次サマリ',
          icon: <BarChart3 className="h-4 w-4" />,
        },
        {
          id: 'history',
          label: '履歴',
          icon: <History className="h-4 w-4" />,
        },
      ],
    },
    {
      id: 'management',
      label: '予防・管理',
      children: [
        {
          id: 'goals',
          label: '健康目標',
          icon: <Target className="h-4 w-4" />,
        },
        {
          id: 'alerts',
          label: 'アラート',
          icon: <Bell className="h-4 w-4" />,
        },
        {
          id: 'reports',
          label: '週次レポート',
          icon: <FileText className="h-4 w-4" />,
        },
      ],
    },
    {
      id: 'settings',
      label: '設定・エクスポート',
      icon: <Settings className="h-4 w-4" />,
    },
  ];

  const handleSelect = (id: string) => {
    const pathMap: Record<string, string> = {
      dashboard: '/health',
      summary: '/health/summary',
      history: '/health/history',
      goals: '/health/goals',
      alerts: '/health/alerts',
      reports: '/health/reports',
      settings: '/health/settings',
    };

    const path = pathMap[id];
    if (path) {
      navigate({ to: path });
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-120px)]">
      <aside className="hidden w-64 border-r bg-card md:block">
        <TreeMenu
          title="健康記録"
          items={menuItems}
          selectedId={getSelectedId()}
          onSelect={handleSelect}
          defaultExpandedIds={['overview', 'management']}
          hideControlBar
        />
      </aside>

      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
