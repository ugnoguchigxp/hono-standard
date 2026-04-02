import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { client } from '../lib/api';
import { useAuth } from '../lib/auth';

export const Route = createFileRoute('/login')({
  component: Login,
});

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate({ to: '/' });
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await client.auth.login.$post({ json: { email, password } });
      if (!res.ok) {
        throw new Error('Login failed');
      }
      const data = (await res.json()) as {
        accessToken: string;
        refreshToken: string;
        user: { id: string; email: string };
      };
      login(data.accessToken, data.refreshToken, data.user);
      navigate({ to: '/' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: '0 auto' }}>
      <h1>Login</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form
        onSubmit={handleLogin}
        style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}
      >
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: '0.5rem' }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: '0.5rem' }}
        />
        <button type="submit">Login</button>
      </form>
      <hr style={{ margin: '2rem 0' }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <a href="/api/auth/oauth/google">
          <button type="button" style={{ width: '100%' }}>
            Login with Google
          </button>
        </a>
        <a href="/api/auth/oauth/github">
          <button type="button" style={{ width: '100%' }}>
            Login with GitHub
          </button>
        </a>
      </div>
    </div>
  );
}
