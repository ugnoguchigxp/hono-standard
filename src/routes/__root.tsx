import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import type { useAuth } from '../lib/auth';

interface RouterContext {
  queryClient: QueryClient;
  auth: ReturnType<typeof useAuth>;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => {
    const { auth } = Route.useRouteContext();
    const { t } = useTranslation();

    return (
      <div>
        <nav className="flex gap-4 border-b border-border p-4">
          <Link to="/" className="font-bold">
            {t('home', 'Home')}
          </Link>
          <Link to="/bbs">{t('bbs', 'BBS')}</Link>
          <Link to="/questionnaire">{t('medicalQuestionnaire', '医療問診')}</Link>
          <div className="flex-1" />
          {auth.user ? (
            <>
              <span>{auth.user.email}</span>
              <button type="button" onClick={() => auth.logout()}>
                Logout
              </button>
            </>
          ) : (
            <Link to="/login">Login</Link>
          )}
        </nav>
        <main className="p-4">
          <Outlet />
        </main>
      </div>
    );
  },
});
