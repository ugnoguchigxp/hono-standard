# LLM Context: Hono Standard

この文書は、`hono-standard` を clone した直後に作業入口を決めるための圧縮コンテキストです。現行 branch は local SQLite auth/showcase template です。RAG、pgvector、agentic search、wiki ingestion は含みません。

## Repository Snapshot

- Bun + Hono backend と React + Vite frontend を同一 origin で動かす template。
- DB は local SQLite。Drizzle schema は `api/db/schema.ts`、migration は `drizzle/`。
- Backend app composition は `api/app/hono.ts`、server bootstrap は `api/app/server.ts`。
- DB runtime の public entry は `api/db/index.ts`。SQLite baseline は `api/db/sqlite.ts`、migration runner は `api/db/migrate.ts` から `api/db/migrate-sqlite.ts` を呼ぶ。
- Frontend entry は `web/src/App.tsx`、router は `web/src/router.tsx`、API client は `web/src/api.ts`。
- Auth 実装は `api/modules/auth/`、route は `api/routes/auth.route.ts`、login UI は `web/src/domains/auth/login-domain.tsx`。
- Shared API schema/object は `shared/schemas/`。Backend は `zValidator`、frontend は `hono/client` + `AppType` で同じ契約を参照する。
- Home と Showcase は未ログインでも表示する。ログイン状態がある場合だけ header に user chip と logout button を表示する。
- Protected sample は `/protected` と `/api/protected/profile`。frontend guard と server-side `requireAuth` の両方を示す。
- Package manager / runtime は Bun。`bun run dev`はmigrationとdevelopment seedを適用してからViteを起動する。
- Quality gates は `bun run verify`、`bun run verify:e2e`、`bun run verify:dashboard-release`。CI も同じ入口を使う。
- Dashboard overlay は `overlay/dashboard` に実装され、DB非依存のregistry/normalizerとroute-level lazy UIを提供する。
- `main` は SQLite baseline。Turso / PostgreSQL / pgvector は `variant/*` branch で driver、schema、migration、docs、smoke setup を差し替える。

## Top-Level Map

| Path | Role |
| --- | --- |
| `api/app/hono.ts` | Hono middleware、API route、static fallback、`AppType` export |
| `api/app/server.ts` | Bun server bootstrap |
| `api/app/env.ts` | environment parsing and defaults |
| `api/config/appDefaults.ts` | non-secret app defaults |
| `api/db/index.ts` | DB runtime public entry and variant boundary |
| `api/db/sqlite.ts` | SQLite baseline Drizzle runtime |
| `api/db/migrate.ts` | migration runner public entry |
| `api/db/migrate-sqlite.ts` | SQLite baseline migration runner |
| `api/db/schema.ts` | SQLite baseline Drizzle schema |
| `api/routes/auth.route.ts` | `/api/auth/*` route module |
| `api/routes/health.route.ts` | health route |
| `api/routes/protected.route.ts` | server-side protected API sample |
| `api/modules/auth/` | Auth service、JWT、cookies、password hashing |
| `api/modules/dashboard/` | Dashboard registry、変数依存、normalizer、executor、demo handlers |
| `api/routes/dashboard.route.ts` | 認証保護されたDashboard manifest/options/query API |
| `api/middleware/auth.ts` | access-token auth middleware |
| `shared/schemas/` | Zod schema and public API object types shared by api and web |
| `web/src/App.tsx` | React Query and Router providers |
| `web/src/router.tsx` | TanStack Router tree |
| `web/src/api.ts` | browser API client and auth refresh handling |
| `web/src/auth-context.tsx` | frontend auth state |
| `web/src/routes/` | route definitions |
| `web/src/routes/dashboard-route*.tsx` | Dashboard route shell とlazy import |
| `web/src/domains/dashboard/` | search、React Query、layout、grid、chart/table、inspector |
| `web/src/views/` | Home/Login/Showcase views |
| `web/src/showcase-*` | showcase state and URL search helpers |
| `drizzle/` | SQL migrations |
| `scripts/verify.ts` | verification pipeline |
| `scripts/e2e-server.ts` | Playwright smoke server with isolated SQLite DB |
| `tests/e2e/` | Playwright smoke tests |
| `scripts/verify-dashboard-bundle.ts` | initial bundleへDashboard chart/gridが混入しないことのgate |
| `.github/workflows/verify.yml` | CI verification |
| `Dockerfile`, `docker-compose.yml` | Optional SQLite baseline container runtime |

## Task Routing

| Task | Start here | Usually also read | Defer unless touched |
| --- | --- | --- | --- |
| Change auth API | `api/routes/auth.route.ts`, `api/modules/auth/`, `api/middleware/auth.ts`, `shared/schemas/auth.schema.ts` | `web/src/api.ts`, `web/src/auth-context.tsx` | showcase UI |
| Change protected sample | `api/routes/protected.route.ts`, `web/src/views/protected-view.tsx`, `web/src/routes/protected-route.tsx` | `api/middleware/auth.ts`, `shared/schemas/protected.schema.ts`, `web/src/api.ts` | showcase UI |
| Change login UI | `web/src/views/login-view.tsx`, `web/src/domains/auth/login-domain.tsx` | `web/src/auth-context.tsx`, `web/src/api.ts` | DB schema |
| Change app shell/routing | `web/src/routes/root-route.tsx`, `web/src/router.tsx` | `web/src/App.tsx`, affected view | auth service internals |
| Change showcase UI | `web/src/views/showcase-view.tsx`, `web/src/showcase-settings-context.tsx`, `web/src/showcase-table-search.ts` | `web/src/styles.css` | backend auth |
| Change Dashboard | `docs/dashboard-overlay/00-concept.md`, `docs/dashboard-overlay/01-contracts.md`, `docs/dashboard-overlay/02-backend.md`, `docs/dashboard-overlay/03-frontend.md`, `docs/dashboard-overlay/04-testing-and-delivery.md`, `docs/dashboard-overlay/05-cartesian-visualizations.md`, `docs/dashboard-overlay/06-composition-relationship-hierarchy-flow.md`, `docs/dashboard-overlay/07-kpi-goal-status-visualizations.md`, `docs/dashboard-overlay/08-distribution-heatmap-statistical-visualizations.md`, `docs/dashboard-overlay/09-state-timeline-status-annotations.md`, `docs/dashboard-overlay/progress.md` | `shared/schemas/dashboard.schema.ts`, `api/modules/dashboard/`, `api/routes/dashboard.route.ts`, `web/src/domains/dashboard/`, `web/src/routes/dashboard-route.lazy.tsx` | DB schema/migration |
| Change env/config | `api/app/env.ts`, `api/config/appDefaults.ts`, `.env.example` | `drizzle.config.ts`, Docker/Compose if bind host or port changes | frontend views |
| Change DB runtime/variant boundary | `api/db/index.ts`, `api/db/sqlite.ts`, `api/db/migrate.ts`, `api/db/migrate-sqlite.ts` | `api/cli/migrate.ts`, `api/cli/auth-create-admin.ts`, `docs/template-variant-management.md` | showcase UI |
| Change DB schema/migration | `api/db/schema.ts`, `drizzle/`, `api/db/migrate*.ts` | `api/modules/auth/auth.service.ts`, `api/modules/auth/token.service.ts` | showcase UI |
| Change build/dev tooling | `package.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `scripts/verify.ts` | `.github/workflows/verify.yml`, failing config-specific output | feature code |
| Change docs | `README.md`, `LLM_CONTEXT.md`, `docs/` | `.gitignore` when generated output changes | feature code |

## Implementation Contracts

- Keep backend routes on Hono; do not introduce a parallel API framework.
- Keep `/api/*` on Hono and non-API paths on Vite/static frontend.
- `web/src/api.ts` owns browser fetch behavior, credential inclusion, refresh retry, and unauthorized events.
- `web/src/api.ts` must use `hc<AppType>` from `api/app/hono.ts`; do not duplicate API request/response types by hand.
- Shared request/response validation should use schemas under `shared/schemas/` when the shape is used on both sides.
- `/api/auth/me` is protected by `requireAuth`; public pages should not require login by default.
- `/api/protected/*` must stay protected by `requireAuth`; `/protected` should demonstrate server-backed auth, not only client auth state.
- Auth cookies and tokens live under `api/modules/auth/`.
- DB defaults, `.env.example`, and Drizzle config must agree.
- `HOST` / `PORT` are runtime env. Keep Docker bind host at `0.0.0.0`, local default at `127.0.0.1`.
- `JWT_SECRET` is optional only for local development; production must fail closed when it is missing or still set to the dev default.
- `docker compose` requires `COMPOSE_JWT_SECRET` from the caller environment and maps it to container `JWT_SECRET`; do not put a reusable production secret in `docker-compose.yml`.
- `drizzle.config.ts` should resolve `DATABASE_URL` from process env first, then local `.env`, then app defaults.
- Keep DI lightweight: use explicit dependency objects and composition roots. Do not add a DI container.
- Keep SQLite driver-specific imports inside DB adapter/migration files. Service modules should depend on exported DB types from `api/db`.
- `main` should not become a runtime switch for every DB. Put Turso / PostgreSQL / pgvector differences in `variant/*` branches.
- Do not track local DBs, coverage, Playwright reports, test results, build output, or `.env` secrets.
- Do not reintroduce RAG, pgvector, wiki, provider, or agentic-search docs unless the implementation is restored in code.
- Dashboard handlerだけがDB固有集計を担当し、共通層からSQLを生成しない。API/UIの入出力は共有Zod schemaを通す。
- Dashboard Data Source Adapterは`api/modules/dashboard/v2/adapters/`にあり、Record[]を共通入口としてDrizzle read queryと固定origin HTTP JSONを接続する。列・型・roleを明示し、SQL生成、dialect import、response保存を共通層へ入れない。
- `/dashboard` は必要時だけlazy routeを読み込み、Recharts/react-grid-layoutを通常ページのinitial bundleへ入れない。
- `/dashboard/gallery` は認証保護された126 preset + state/integration fixtureの決定的Galleryで、全core presetとPanel stateを確認する。新renderer追加時はcatalog、Gallery、component/a11y/visual/bundle gateを同時に更新する。
- Cartesian catalogは`core.timeseries` 8 preset、`core.bar` 9 preset、`core.composed/dual-axis` 1 presetの計18種類。shared strict contractは`shared/schemas/dashboard/cartesian-visualizations.schema.ts`にある。
- KPI catalogは`core.stat` 5、`core.gauge` 3、`core.bar-gauge` 4、`core.bullet` 3、`core.progress` 3、`core.traffic-light` 3の計21 preset。`previous` / `delta` / `goal` role、range/overflow、semantic state、summary、native SVGは`shared/schemas/dashboard/kpi-visualizations.schema.ts`と`web/src/domains/dashboard/v2/visualizations/kpi/`を正本とする。
- Distribution catalogは`core.histogram`、`core.heatmap`、`core.box-plot`、`core.calendar-heatmap`を各5 preset、計20 preset。Histogramのbrowser-only transformation、R7/Tukey統計、timezone-aware calendar、Table/summary/a11y fallbackは`shared/schemas/dashboard/distribution-visualizations.schema.ts`と`web/src/domains/dashboard/v2/visualizations/distribution/`を正本とする。
- State catalogは`core.state-timeline`、`core.status-history`、`core.uptime-grid`を各6 preset、計18 preset。state interval/sample、typed state mapping、gap/overlap/DST-aware uptime、point/line/region/badge annotation、semantic Table/summaryは`shared/schemas/dashboard/state-visualizations.schema.ts`、`shared/schemas/dashboard/annotation.schema.ts`、`web/src/domains/dashboard/v2/visualizations/state/`を正本とする。
- Specialized observability catalogは`core.node-graph`、`core.candlestick`、`observability.logs`、`observability.trace-waterfall`、`observability.flame-graph`、`geo.map`を各5 preset、計30 preset。厳格な入力契約、graph/trace/profile/geo model、Table/summary/a11y fallback、lazy rendererは`shared/schemas/dashboard/specialized-visualizations.schema.ts`、`web/src/domains/dashboard/v2/visualizations/specialized/`、`docs/dashboard-overlay/10-specialized-observability-visualizations.md`を正本とする。
- filters、range、timezone、refreshはTanStack Routerのsearch objectに保持し、layoutはlocalStorageのlayoutVersion付きで保存する。

## Verification Matrix

| Change type | Minimum useful verification |
| --- | --- |
| Auth/backend | `bun run typecheck` and targeted Vitest when tests are touched |
| Frontend UI | `bun run typecheck` and `bun run build` |
| Dashboard | `bun run verify`, `bun run verify:e2e`, `bun run verify:dashboard-release` |
| Env/DB/docs | `bun run typecheck`, `bun run lint`, `bun run format:check` |
| DB runtime / migration boundary | `bun run verify` and `bun run verify:e2e` |
| E2E / Playwright | `bun run verify:e2e` |
| Docker runtime | `docker compose build`, then optional `/api/health` smoke |
| Broad template change | `bun run verify` and `bun run verify:e2e` |

## Commands

| Command | Purpose |
| --- | --- |
| `bun run bootstrap` | Prepare `.env`, dependencies, migrations, and deterministic development admin seed |
| `bun install` | Install dependencies |
| `bun run dev` | Run migrations and deterministic development seed, then start Vite + Hono |
| `bun run db:migrate` | Apply SQL migrations |
| `bun run auth:create-admin -- --email <email> --name <name>` | Create admin user |
| `bun run seed:dev` | Create or reset the configured development admin; fails in production |
| `bun run typecheck` | TypeScript check |
| `bun run test` | Vitest |
| `bun run test:coverage` | Vitest coverage with global threshold |
| `bun run test:e2e` | Playwright smoke test |
| `bun run build` | Vite production build |
| `bun run verify` | Typecheck, lint, format check, Vitest, coverage, build |
| `bun run verify:e2e` | Playwright smoke test |
| `bun run verify:dashboard-bundle` | Dashboard lazy bundle gate |
| `bun run verify:dashboard-release` | contract、coverage、Gallery、bundle、functional/visual/a11y/performance/securityのfail-fast gate |
| `bun run verify:dashboard-coverage` | Dashboard backend focused coverage |
| `bun run verify:dashboard-adapter-sqlite` | Dashboard Drizzle adapterのread-only SQLite integration |
| `bun run verify:dashboard-variants` | 05 V12 prerequisiteとcanonical variant適用可否 |
| `bun run verify:all` | `verify` and `verify:e2e` |

## Clone Adaptation Checklist

- Set `DATABASE_URL` when using a non-default SQLite database path.
- Set a production-grade `JWT_SECRET`.
- Set `APP_URL`, `CORS_ORIGINS`, cookie secure mode, and security headers for the deployment protocol.
- Create an admin user before expecting login to succeed.
- Rename package metadata and README copy for the target app.
- If auth/showcase are too heavy for the target app, keep the removal as `variant/minimal` or `overlay/authless` and require fresh `bootstrap`, `verify`, and updated E2E scope.

## Generated Files Policy

- Commit: source files, `drizzle/*.sql`, `.env.example`, and docs.
- Do not commit: `.env`, `.env.*`, `data/`, `*.db`, `*.sqlite`, `*.sqlite3`, `coverage/`, `playwright-report/`, `test-results/`, `dist/`, `dist-web/`, `build/`, `*.tgz`.
- If a new tool creates output, update `.gitignore`, README, and this file together so generated-file policy stays consistent.
