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
    setError('');
    try {
      const res = await client.auth.login.$post({ json: { email, password } });
      if (!res.ok) {
        throw new Error('Login failed');
      }
      const data = (await res.json()) as {
        user: { id: string; email: string };
      };
      login(data.user);
      navigate({ to: '/' });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <h1>Login</h1>
      {error && <p className="text-red-500">{error}</p>}
      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="rounded border border-border bg-background px-2 py-2"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="rounded border border-border bg-background px-2 py-2"
        />
        <button type="submit" className="rounded border border-border px-3 py-2">
          Login
        </button>
      </form>
      <hr className="my-8 border-border" />
      <div className="flex flex-col gap-4">
        <a href="/api/auth/oauth/google">
          <button type="button" className="w-full rounded border border-border px-3 py-2">
            Login with Google
          </button>
        </a>
        <a href="/api/auth/oauth/github">
          <button type="button" className="w-full rounded border border-border px-3 py-2">
            Login with GitHub
          </button>
        </a>
      </div>
    </div>
  );
}
