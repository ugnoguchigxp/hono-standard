# LLM Context: Hono Standard

この文書は、`hono-standard` をテンプレートとして clone した直後に、広い構造確認をせず作業の入口を決めるための圧縮コンテキストです。

README は人間向けの説明、`docs/` はテンプレート保守や設計背景向けです。通常の実装作業では、この文書で作業領域を絞ってから必要なファイルだけを読むと十分です。

## Repository Snapshot

- Bun + Hono backend と React + Vite frontend を持つ full-stack monolith template。
- DB は SQLite / libSQL。Drizzle schema は `api/db/schema.ts`、migration は `drizzle/migrations/`。
- Backend entry は `api/app.ts` と `api/index.ts`。
- Frontend entry は `src/App.tsx`、route は `src/routes/`、API client は `src/lib/api.ts`。
- Hono RPC 型は `api/app.ts` の `AppType` を `src/lib/api.ts` で参照する。
- Route validation / OpenAPI は `@hono/zod-openapi` を使う。
- Auth は local password + optional OAuth の実装が入っている。auth なしの最小 starter が必要な場合は、この実装を overlay 化して外す対象。
- Package manager / runtime は Bun。主要コマンドは `package.json` scripts に集約。
- UI component は `@repo/design-system` workspace を使う。

## Top-Level Map

| Path | Role |
| --- | --- |
| `api/app.ts` | Hono app composition、middleware、API route mounting、production static serving |
| `api/index.ts` | Bun server bootstrap |
| `api/config.ts` | Environment parsing and validation |
| `api/db/` | SQLite/libSQL client and Drizzle schema |
| `api/routes/` | HTTP API boundary and OpenAPI route definitions |
| `api/services/` | Auth, user, token, OAuth business logic |
| `api/middleware/` | auth, logger, error handler, rate limiter |
| `api/lib/` | shared backend helpers such as cookies, errors, OpenAPI, password, sanitizer |
| `shared/schemas/` | Zod schemas shared by frontend and backend |
| `src/App.tsx` | React app root and router provider |
| `src/routes/` | TanStack Router file routes |
| `src/lib/api.ts` | Hono RPC client and auth refresh behavior |
| `src/lib/auth.tsx` | AuthProvider and frontend auth state |
| `designSystem/` | workspace UI components and styles |
| `drizzle/` | SQLite migrations and seed script |
| `tests/` | Vitest unit/integration tests and Playwright E2E tests |

## Task Routing

| Task | Start here | Usually also read | Defer unless touched |
| --- | --- | --- | --- |
| Add or change API endpoint | `api/routes/*`, `api/app.ts` | related service, route test | frontend routes |
| Change DB schema | `api/db/schema.ts`, `drizzle/migrations/` | repository/service using the table | UI files until API shape is known |
| Change auth API | `api/routes/auth.ts`, `api/services/auth.service.ts`, `api/services/token.service.ts` | `api/lib/auth-cookies.ts`, auth tests | design system |
| Change login UI | `src/routes/login.tsx`, `src/lib/auth.tsx`, `src/lib/api.ts` | `tests/e2e/auth.spec.ts` | backend services unless API contract changes |
| Change OAuth | `api/routes/oauth.ts`, `api/services/oauth/*`, `src/routes/oauth.callback.tsx` | auth methods UI in `src/routes/login.tsx` | DB schema unless account linking changes |
| Change app navigation | `src/routes/__root.tsx`, `src/routes/index.tsx` | E2E navigation tests | backend services |
| Change API client behavior | `src/lib/api.ts` | route files serving the endpoint | unrelated UI routes |
| Change env/config | `api/config.ts`, `.env.example` | config-dependent tests | feature files not using the setting |
| Change build/dev tooling | `package.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts` | failing config-specific tests | app feature modules |
| Change template policy | `docs/template-variant-management.md`, snapshot scripts | README clone/setup sections | feature implementation files |

## Implementation Contracts

- Backend API routes use `createOpenApiRouter()` and `createRoute()` from the local OpenAPI helper stack.
- Frontend calls backend through the Hono RPC client in `src/lib/api.ts`.
- Shared request/response validation should use schemas under `shared/schemas/` when the shape is used on both sides.
- SQLite/libSQL is the main branch DB assumption. Do not introduce PostgreSQL-specific code into `main`.
- Auth cookies are httpOnly and are set/cleared in `api/lib/auth-cookies.ts`.
- Frontend auth state lives in `src/lib/auth.tsx`; route-level UI should use that provider rather than duplicating session state.
- Protected backend routes should use `api/middleware/auth.ts`.
- Keep local/test env defaults self-contained in test setup instead of relying on a developer's `.env`.
- Avoid adding `any` casts when a local type, Zod schema, or API response type can represent the shape.

## Verification Matrix

| Change type | Minimum useful verification |
| --- | --- |
| Auth service/token logic | targeted Vitest tests under `tests/services.*.test.ts` |
| Auth routes/cookies | `tests/auth.test.ts`, `tests/routes.auth.cookies.test.ts`, `tests/middleware.auth.test.ts` |
| Login UI | Playwright auth flow or `bun run test:e2e:smoke` |
| API route behavior | targeted route/service Vitest test |
| Frontend route/navigation | targeted Playwright test |
| DB/schema | migration review plus service test using the changed shape |
| Broad template change | `bun run verify` |

## Commands

| Command | Purpose |
| --- | --- |
| `bun install` | Install dependencies |
| `bun run dev` | Build `designSystem` dist, then start Vite + Hono dev server |
| `bun run typecheck` | TypeScript check |
| `bun run test` | Vitest tests |
| `bun run test:e2e` | Playwright E2E tests |
| `bun run lint` | Biome check |
| `bun run format:check` | Biome format check |
| `bun run build` | Frontend + backend build |
| `bun run verify` | Full verification pipeline |
| `bun run db:migrate` | Apply Drizzle migrations |
| `bun run db:seed` | Seed SQLite DB |

`bun run db:seed` creates `test@example.com` / `password123` when the users table is empty.

## Expensive Areas

- `designSystem/**`: read only for component implementation, styling tokens, Storybook, or visual behavior.
- `drizzle/migrations/**`: read only for DB changes or migration failures.
- `tests/e2e/**`: read when browser behavior, auth flows, or navigation are involved.
- `docs/**`: read for template policy, variant management, or historical design context.
- `src/routeTree.gen.ts`: generated TanStack Router output. Usually inspect routes instead.

## Clone Adaptation Checklist

When this template becomes a new app, common adaptation points are:

- `package.json` name, description, repository metadata, and keywords.
- README project name and setup steps.
- `.env.example` and actual `.env` values.
- Whether auth should be kept, removed, or applied later as an overlay.
- SQLite DB path, migrations, and seed data.
- App routes and sample pages to keep or remove.
- Branding and navigation text under `src/routes/`.
- Deployment target and runtime assumptions.
