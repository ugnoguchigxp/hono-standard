import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useAuth } from '../lib/auth';
import { authRpc } from '../lib/auth-rpc';

export const Route = createFileRoute('/oauth/callback')({
  component: OAuthCallback,
});

function OAuthCallback() {
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    async function finalizeOAuthLogin() {
      try {
        const res = await authRpc.me.$get({});
        if (!res.ok) {
          navigate({ to: '/login' });
          return;
        }

        const data = (await res.json()) as { userId: string; email: string };
        login({ id: data.userId, email: data.email });
        navigate({ to: '/' });
      } catch (err) {
        console.error('Error during OAuth callback:', err);
        navigate({ to: '/login' });
      }
    }

    finalizeOAuthLogin();
  }, [login, navigate]);

  return <div>Logging in via OAuth...</div>;
}
