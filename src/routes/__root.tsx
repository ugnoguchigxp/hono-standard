import {
  Avatar,
  AvatarFallback,
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@repo/design-system';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router';
import { LogOut, Settings2, User } from 'lucide-react';
import { useDesignSystem } from '../hooks/use-design-system';
import type { useAuth } from '../lib/auth';

interface RouterContext {
  queryClient: QueryClient;
  auth: ReturnType<typeof useAuth>;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => {
    const { auth } = Route.useRouteContext();
    // Initialize design system settings on load
    useDesignSystem();

    return (
      <div className="min-h-screen bg-background">
        <nav className="flex items-center gap-4 border-b border-border px-6 py-3 sticky top-0 bg-background/80 backdrop-blur-sm z-50">
          <Link
            to="/"
            className="text-lg font-bold tracking-tight hover:opacity-80 transition-opacity"
          >
            健康記録ダッシュボード
          </Link>
          <div className="flex-1" />
          {auth.user ? (
            <Drawer>
              <DrawerTrigger
                render={
                  <button
                    type="button"
                    className="rounded-full ring-offset-background transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Avatar className="h-9 w-9 border-2 border-primary/10">
                      <AvatarFallback className="bg-primary/5 text-primary">
                        <User className="h-5 w-5" />
                      </AvatarFallback>
                    </Avatar>
                  </button>
                }
              />
              <DrawerContent side="right" className="sm:max-w-[320px] overflow-y-auto">
                <DrawerHeader className="border-b pb-6 mb-6">
                  <div className="flex flex-col items-center gap-4 text-center">
                    <Avatar className="h-20 w-20 border-4 border-primary/5">
                      <AvatarFallback className="bg-primary/5 text-primary">
                        <User className="h-10 w-10" />
                      </AvatarFallback>
                    </Avatar>
                    <div className="space-y-1">
                      <DrawerTitle className="text-xl">{auth.user.email.split('@')[0]}</DrawerTitle>
                      <DrawerDescription className="text-xs break-all">
                        {auth.user.email}
                      </DrawerDescription>
                    </div>
                  </div>
                </DrawerHeader>

                <div className="flex-1 space-y-8 px-2 pb-8 pt-4">
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-4 w-1 bg-primary rounded-full" />
                      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/70">
                        アカウント
                      </h3>
                    </div>
                    <div className="space-y-1">
                      <Link
                        to="/health/settings"
                        className="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-all hover:bg-accent hover:translate-x-1"
                      >
                        <User className="h-4 w-4" />
                        プロフィール・デザイン設定
                      </Link>
                      <button
                        type="button"
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium transition-all hover:bg-accent hover:translate-x-1"
                      >
                        <Settings2 className="h-4 w-4" />
                        システム詳細設定
                      </button>
                    </div>
                  </section>
                </div>

                <DrawerFooter className="border-t pt-6 bg-background sticky bottom-0">
                  <Button
                    variant="destructive"
                    className="w-full justify-center gap-2 h-11 shadow-md hover:shadow-lg transition-all active:scale-95"
                    onClick={() => auth.logout()}
                  >
                    <LogOut className="h-4 w-4" />
                    ログアウト
                  </Button>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>
          ) : (
            <Link to="/login" className="text-sm font-medium hover:text-primary transition-colors">
              ログイン
            </Link>
          )}
        </nav>
        <main className="p-4">
          <Outlet />
        </main>
      </div>
    );
  },
});
