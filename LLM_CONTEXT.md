# LLM Context: Hono Standard

この文書は、`hono-standard` を clone した直後に作業入口を決めるための圧縮コンテキストです。現行 branch は minimal auth/showcase template です。RAG、pgvector、agentic search、wiki ingestion は含みません。

## Repository Snapshot

- Bun + Hono backend と React + Vite frontend を同一 origin で動かす template。
- DB は PostgreSQL。Drizzle schema は `src/db/schema.ts`、migration は `drizzle/`。
- Backend app composition は `src/app/hono.ts`、server bootstrap は `src/app/server.ts`。
- Frontend entry は `web/src/App.tsx`、router は `web/src/router.tsx`、API client は `web/src/api.ts`。
- Auth 実装は `src/modules/auth/`、route は `src/routes/auth.route.ts`、login UI は `web/src/domains/auth/login-domain.tsx`。
- Home と Showcase は未ログインでも表示する。ログイン状態がある場合だけ header に user chip と logout button を表示する。
- Package manager / runtime は Bun。dev server は `bunx --bun vite` で起動する。

## Top-Level Map

| Path | Role |
| --- | --- |
| `src/app/hono.ts` | Hono middleware、API route、static fallback |
| `src/app/server.ts` | Bun server bootstrap |
| `src/app/env.ts` | environment parsing and defaults |
| `src/config/appDefaults.ts` | non-secret app defaults |
| `src/db/` | PostgreSQL connection and Drizzle schema |
| `src/routes/auth.route.ts` | `/api/auth/*` route module |
| `src/routes/health.route.ts` | health route |
| `src/modules/auth/` | Auth service、JWT、cookies、password hashing |
| `src/middleware/auth.ts` | access-token auth middleware |
| `web/src/App.tsx` | React Query and Router providers |
| `web/src/router.tsx` | TanStack Router tree |
| `web/src/api.ts` | browser API client and auth refresh handling |
| `web/src/auth-context.tsx` | frontend auth state |
| `web/src/routes/` | route definitions |
| `web/src/views/` | Home/Login/Showcase views |
| `web/src/showcase-*` | showcase state and URL search helpers |
| `drizzle/` | SQL migrations |
| `scripts/verify.ts` | verification pipeline |

## Task Routing

| Task | Start here | Usually also read | Defer unless touched |
| --- | --- | --- | --- |
| Change auth API | `src/routes/auth.route.ts`, `src/modules/auth/`, `src/middleware/auth.ts` | `web/src/api.ts`, `web/src/auth-context.tsx` | showcase UI |
| Change login UI | `web/src/views/login-view.tsx`, `web/src/domains/auth/login-domain.tsx` | `web/src/auth-context.tsx`, `web/src/api.ts` | DB schema |
| Change app shell/routing | `web/src/routes/root-route.tsx`, `web/src/router.tsx` | `web/src/App.tsx`, affected view | auth service internals |
| Change showcase UI | `web/src/views/showcase-view.tsx`, `web/src/showcase-settings-context.tsx`, `web/src/showcase-table-search.ts` | `web/src/styles.css` | backend auth |
| Change env/config | `src/app/env.ts`, `src/config/appDefaults.ts`, `.env.example` | `docker-compose.yml`, `drizzle.config.ts` | frontend views |
| Change DB schema/migration | `src/db/schema.ts`, `drizzle/`, `src/cli/migrate.ts` | `src/modules/auth/auth.service.ts`, `src/modules/auth/token.service.ts` | showcase UI |
| Change build/dev tooling | `package.json`, `vite.config.ts`, `vitest.config.ts`, `scripts/verify.ts` | failing config-specific output | feature code |

## Implementation Contracts

- Keep backend routes on Hono; do not introduce a parallel API framework.
- Keep `/api/*` on Hono and non-API paths on Vite/static frontend.
- `web/src/api.ts` owns browser fetch behavior, credential inclusion, refresh retry, and unauthorized events.
- `/api/auth/me` is protected by `requireAuth`; public pages should not require login by default.
- Auth cookies and tokens live under `src/modules/auth/`.
- DB defaults, Docker compose DB name, `.env.example`, and Drizzle config must agree.
- `JWT_SECRET` is optional only for local development; production must fail closed when it is missing or still set to the dev default.
- `drizzle.config.ts` should resolve `DATABASE_URL` from process env first, then local `.env`, then app defaults.
- Do not reintroduce RAG, pgvector, wiki, provider, or agentic-search docs unless the implementation is restored in code.

## Verification Matrix

| Change type | Minimum useful verification |
| --- | --- |
| Auth/backend | `bun run typecheck` and targeted Vitest when tests are touched |
| Frontend UI | `bun run typecheck` and `bun run build` |
| Env/DB/docs | `bun run typecheck`, `bun run lint`, `bun run format:check` |
| Broad template change | `bun run verify` |

## Commands

| Command | Purpose |
| --- | --- |
| `bun install` | Install dependencies |
| `bun run dev` | Start Vite + Hono dev server |
| `docker compose up -d db` | Start local PostgreSQL |
| `bun run db:migrate` | Apply SQL migrations |
| `bun run auth:create-admin -- --email <email> --name <name>` | Create admin user |
| `bun run typecheck` | TypeScript check |
| `bun run test` | Vitest |
| `bun run build` | Vite production build |
| `bun run verify` | Full local verification pipeline |

## Clone Adaptation Checklist

- Set `DATABASE_URL` if not using the default local compose DB.
- Set a production-grade `JWT_SECRET`.
- Set `APP_URL`, `CORS_ORIGINS`, cookie secure mode, and security headers for the deployment protocol.
- Create an admin user before expecting login to succeed.
- Rename package metadata and README copy for the target app.
