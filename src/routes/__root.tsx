import { Button, DropdownMenu } from '@repo/design-system';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router';
import { Home, LayoutGrid, LogOut } from 'lucide-react';
import { useAuth } from '../lib/auth';

interface RouterContext {
  queryClient: QueryClient;
  auth: ReturnType<typeof useAuth>;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => {
    const auth = useAuth();

    return (
      <div className="min-h-screen bg-background">
        <nav className="flex items-center gap-6 border-b border-border px-6 py-3 bg-card/50 backdrop-blur-md sticky top-0 z-50">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="bg-primary p-1.5 rounded-lg">
              <Home className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-xl tracking-tight">Hono Standard</span>
          </Link>

          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild size="sm">
              <Link to="/showcase" className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" />
                Showcase
              </Link>
            </Button>
          </div>

          <div className="flex-1" />

          <div className="flex items-center gap-4">
            {auth.user ? (
              <DropdownMenu
                align="end"
                trigger={
                  <button
                    type="button"
                    className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    test accountt
                  </button>
                }
                items={[
                  {
                    label: 'Logout',
                    icon: <LogOut className="h-4 w-4" />,
                    onClick: () => auth.logout(),
                  },
                ]}
              />
            ) : (
              <Button asChild size="sm">
                <Link to="/login">Login</Link>
              </Button>
            )}
          </div>
        </nav>
        <main>
          <Outlet />
        </main>
      </div>
    );
  },
});
