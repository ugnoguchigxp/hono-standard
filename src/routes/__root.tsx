import type { QueryClient } from '@tanstack/react-query';
import { createRootRouteWithContext, Link, Outlet } from '@tanstack/react-router';
import type { useAuth } from '../lib/auth';

interface RouterContext {
  queryClient: QueryClient;
  auth: ReturnType<typeof useAuth>;
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => {
    const { auth } = Route.useRouteContext();

    return (
      <div>
        <nav
          style={{ padding: '1rem', borderBottom: '1px solid #444', display: 'flex', gap: '1rem' }}
        >
          <Link to="/" style={{ fontWeight: 'bold' }}>
            Home
          </Link>
          <Link to="/bbs">BBS</Link>
          <div style={{ flex: 1 }} />
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
        <main style={{ padding: '1rem' }}>
          <Outlet />
        </main>
      </div>
    );
  },
});
