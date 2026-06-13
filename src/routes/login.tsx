import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { ArrowRight, AtSign, Database, KeyRound, Shield } from 'lucide-react';
import type { FormEvent } from 'react';
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
  const [busy, setBusy] = useState(false);
  const [authMethods, setAuthMethods] = useState<{
    local: boolean;
    oauth: {
      enabled: boolean;
      providers: {
        google: boolean;
        github: boolean;
      };
    };
  }>({
    local: true,
    oauth: {
      enabled: false,
      providers: {
        google: false,
        github: false,
      },
    },
  });
  const { login, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate({ to: '/' });
    }
  }, [user, navigate]);

  useEffect(() => {
    let active = true;

    const loadAuthMethods = async () => {
      try {
        const res = await client.auth.methods.$get({});
        if (!res.ok || !active) return;
        const data = (await res.json()) as {
          local: boolean;
          oauth: {
            enabled: boolean;
            providers: {
              google: boolean;
              github: boolean;
            };
          };
        };
        setAuthMethods(data);
      } catch {
        // Keep safe default: local only
      }
    };

    loadAuthMethods();
    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await client.auth.login.$post({
        json: { email: email.trim(), password },
      });
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
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="grid min-h-[calc(100vh-65px)] place-items-center bg-[linear-gradient(160deg,#f7f9fc_0%,#eef3f8_48%,#dfe9f3_100%)] px-4 py-8">
      <section className="w-full max-w-[560px] overflow-hidden rounded-lg border border-slate-200/90 bg-white/90 shadow-[0_24px_64px_rgba(15,23,42,0.16),0_6px_18px_rgba(15,23,42,0.10)] backdrop-blur">
        <div className="bg-[linear-gradient(130deg,rgba(255,255,255,0.94)_0%,rgba(239,246,255,0.92)_56%,rgba(236,253,245,0.88)_100%)] px-6 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-[linear-gradient(140deg,#0f766e,#0ea5e9)] text-white shadow-[0_10px_22px_rgba(15,118,110,0.32)]">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-[22px] font-semibold leading-tight text-slate-950">
                Hono Standard
              </h1>
              <p className="mt-0.5 text-sm text-slate-600">Login</p>
            </div>
          </div>
          <div className="mt-4 h-px bg-[linear-gradient(90deg,#0f766e,#0ea5e9,transparent)]" />
        </div>

        <div className="px-6 py-6">
          {error ? (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
              {error}
            </div>
          ) : null}

          {authMethods.local ? (
            <form onSubmit={handleLogin} className="flex flex-col gap-3">
              <label htmlFor="login-email" className="text-xs font-semibold text-slate-700">
                Email
              </label>
              <div className="flex h-12 items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 shadow-[inset_0_1px_0_rgba(15,23,42,0.02)] transition focus-within:border-teal-700 focus-within:shadow-[0_0_0_3px_rgba(15,118,110,0.15)]">
                <AtSign className="h-[15px] w-[15px] shrink-0 text-slate-500" />
                <input
                  id="login-email"
                  type="email"
                  placeholder="test@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                  className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] text-slate-950 outline-none placeholder:text-slate-400"
                />
              </div>

              <label htmlFor="login-password" className="mt-1 text-xs font-semibold text-slate-700">
                Password
              </label>
              <div className="flex h-12 items-center gap-3 rounded-lg border border-slate-300 bg-white px-3 shadow-[inset_0_1px_0_rgba(15,23,42,0.02)] transition focus-within:border-teal-700 focus-within:shadow-[0_0_0_3px_rgba(15,118,110,0.15)]">
                <KeyRound className="h-[15px] w-[15px] shrink-0 text-slate-500" />
                <input
                  id="login-password"
                  type="password"
                  placeholder="********"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-[15px] text-slate-950 outline-none placeholder:text-slate-400"
                />
              </div>

              <button
                type="submit"
                disabled={busy}
                className="mt-2 inline-flex h-[46px] items-center justify-center gap-2 rounded-lg bg-[linear-gradient(135deg,#0f766e_0%,#0284c7_100%)] px-4 text-[15px] font-bold text-[#ffffff] shadow-[0_14px_28px_rgba(3,105,161,0.28),0_6px_12px_rgba(15,118,110,0.20)] transition hover:-translate-y-px hover:saturate-[1.08] hover:shadow-[0_18px_34px_rgba(3,105,161,0.34),0_8px_18px_rgba(15,118,110,0.26)] active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-65"
              >
                <Shield className="h-4 w-4 text-white" />
                <span className="text-white">{busy ? 'Signing in...' : 'Login'}</span>
                <ArrowRight className="h-4 w-4 text-white" />
              </button>
            </form>
          ) : null}

          {authMethods.local && authMethods.oauth.enabled ? (
            <div className="my-6 h-px bg-slate-200" />
          ) : null}

          {authMethods.oauth.enabled ? (
            <div className="flex flex-col gap-3">
              {authMethods.oauth.providers.google ? (
                <a
                  href="/api/auth/oauth/google"
                  className="inline-flex h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                >
                  <AtSign className="h-4 w-4" />
                  <span>Login with Google</span>
                </a>
              ) : null}
              {authMethods.oauth.providers.github ? (
                <a
                  href="/api/auth/oauth/github"
                  className="inline-flex h-[44px] items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                >
                  <KeyRound className="h-4 w-4" />
                  <span>Login with GitHub</span>
                </a>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
