import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { client } from '../lib/api';
import { useAuth } from '../lib/auth';

export const Route = createFileRoute('/oauth/callback')({
  component: OAuthCallback,
});

function OAuthCallback() {
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');

    async function processTokens() {
      if (accessToken && refreshToken) {
        // Remove sensitive hash params from URL immediately.
        window.history.replaceState(null, '', window.location.pathname + window.location.search);

        // Temporarily store tokens to make the /me request
        localStorage.setItem('access_token', accessToken);
        localStorage.setItem('refresh_token', refreshToken);

        try {
          const res = await client.auth.me.$get({});
          if (res.ok) {
            const data = (await res.json()) as { userId: string; email: string };
            login(accessToken, refreshToken, { id: data.userId, email: data.email });
          } else {
            console.error('Failed to fetch user during OAuth callback');
          }
        } catch (err) {
          console.error('Error during OAuth callback:', err);
        } finally {
          navigate({ to: '/' });
        }
      } else {
        navigate({ to: '/login' });
      }
    }

    processTokens();
  }, [login, navigate]);

  return <div>Logging in via OAuth...</div>;
}
