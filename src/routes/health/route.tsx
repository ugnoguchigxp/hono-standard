import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import {
  Activity,
  AlertTriangle,
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
  return (
    <div className="flex min-h-[calc(100vh-120px)]">
      <aside className="hidden w-64 border-r bg-card p-4 md:block">
        <nav className="space-y-1">
          <Link
            to="/health"
            activeProps={{ className: 'bg-accent text-accent-foreground' }}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent/50"
          >
            <LayoutDashboard className="h-4 w-4" />
            ダッシュボード
          </Link>
          <Link
            to="/health/summary"
            activeProps={{ className: 'bg-accent text-accent-foreground' }}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent/50"
          >
            <BarChart3 className="h-4 w-4" />
            週次サマリ
          </Link>
          <Link
            to="/health/history"
            activeProps={{ className: 'bg-accent text-accent-foreground' }}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent/50"
          >
            <History className="h-4 w-4" />
            履歴
          </Link>

          <div className="pt-4 pb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 px-3">
            予防・管理
          </div>

          <Link
            to="/health/goals"
            activeProps={{ className: 'bg-accent text-accent-foreground' }}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent/50"
          >
            <Target className="h-4 w-4" />
            健康目標
          </Link>
          <Link
            to="/health/alerts"
            activeProps={{ className: 'bg-accent text-accent-foreground' }}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent/50"
          >
            <Bell className="h-4 w-4" />
            アラート
          </Link>
          <Link
            to="/health/reports"
            activeProps={{ className: 'bg-accent text-accent-foreground' }}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent/50"
          >
            <FileText className="h-4 w-4" />
            週次レポート
          </Link>
          <Link
            to="/health/settings"
            activeProps={{ className: 'bg-accent text-accent-foreground' }}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent/50"
          >
            <Settings className="h-4 w-4" />
            設定・エクスポート
          </Link>
        </nav>
      </aside>

      <main className="flex-1 overflow-y-auto p-4 md:p-6">
        <Outlet />
      </main>
    </div>
  );
}
