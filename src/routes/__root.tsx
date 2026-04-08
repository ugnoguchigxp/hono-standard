import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@repo/design-system';
import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router';
import { LogOut, Settings2, User, X } from 'lucide-react';
import { DesignSystemProvider } from '../hooks/use-design-system';
import type { useAuth } from '../lib/auth';

interface RouterContext {
  queryClient: QueryClient;
  auth: ReturnType<typeof useAuth>;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => {
    const { auth } = Route.useRouteContext();
    return (
      <DesignSystemProvider>
        <div className="min-h-screen bg-background">
          <nav className="flex items-center gap-4 border-b border-border px-6 py-3 sticky top-0 bg-background/80 backdrop-blur-sm z-50">
            <Link
              to="/"
              className="text-lg font-bold tracking-tight text-foreground hover:opacity-80 transition-opacity"
            >
              健康記録ダッシュボード
            </Link>
            <div className="flex-1" />
            {auth.user ? (
              <Dialog.Root>
                <Dialog.Trigger asChild>
                  <button
                    type="button"
                    className="rounded-full ring-offset-background transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="h-9 w-9 rounded-full border-2 border-primary/10 bg-primary/5 text-primary flex items-center justify-center">
                      <User className="h-5 w-5" />
                    </div>
                  </button>
                </Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
                  <Dialog.Content className="fixed right-0 top-0 h-full w-full max-w-[320px] bg-background p-6 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right overflow-y-auto">
                    <Dialog.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2">
                      <X className="h-4 w-4" />
                    </Dialog.Close>

                    <div className="border-b pb-6 mb-6">
                      <div className="flex flex-col items-center gap-4 text-center">
                        <div className="h-20 w-20 rounded-full border-4 border-primary/5 bg-primary/5 text-primary flex items-center justify-center">
                          <User className="h-10 w-10" />
                        </div>
                        <div className="space-y-1">
                          <Dialog.Title className="text-xl font-semibold">
                            {auth.user.email.split('@')[0]}
                          </Dialog.Title>
                          <Dialog.Description className="text-xs text-muted-foreground break-all">
                            {auth.user.email}
                          </Dialog.Description>
                        </div>
                      </div>
                    </div>

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

                    <div className="border-t pt-6 bg-background sticky bottom-0">
                      <Button
                        variant="destructive"
                        className="w-full justify-center gap-2 h-11 shadow-md hover:shadow-lg transition-all active:scale-95"
                        onClick={() => auth.logout()}
                      >
                        <LogOut className="h-4 w-4" />
                        ログアウト
                      </Button>
                    </div>
                  </Dialog.Content>
                </Dialog.Portal>
              </Dialog.Root>
            ) : (
              <Link
                to="/login"
                className="text-sm font-medium hover:text-primary transition-colors"
              >
                ログイン
              </Link>
            )}
          </nav>
          <main className="p-4">
            <Outlet />
          </main>
        </div>
      </DesignSystemProvider>
    );
  },
});
