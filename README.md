# Hono Standard

[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh/)
[![Hono](https://img.shields.io/badge/Hono-%23E36022.svg?style=for-the-badge&logo=hono&logoColor=white)](https://hono.dev/)
[![React](https://img.shields.io/badge/React-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)](https://react.dev/)
[![SQLite](https://img.shields.io/badge/SQLite-003B57.svg?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE.md)

Hono backend と React + Vite frontend を同一 origin で動かす、local SQLite 対応の Web app template です。Drizzle のユーザー認証、httpOnly Cookie による access / refresh token、React Router ベースの画面、コンポーネント showcase を含みます。

## 構成

| Path | Role |
| --- | --- |
| `api/app/hono.ts` | Hono app composition。middleware、API route、静的配信、`AppType` を登録 |
| `api/app/server.ts` | Bun server bootstrap |
| `api/app/env.ts` | runtime env parser |
| `api/config/appDefaults.ts` | 非シークレットの既定値 |
| `api/db/index.ts` | DB runtime の public entry。variant はここから差し替える |
| `api/db/sqlite.ts` | SQLite baseline の Drizzle runtime |
| `api/db/client.ts` | 単一 writer client と read/write DB access contract |
| `api/db/schema.ts` | Drizzle SQLite schema |
| `api/db/migrate.ts` | migration runner の public entry |
| `api/db/migrate-sqlite.ts` | SQLite baseline の migration runner |
| `api/routes/auth.route.ts` | `/api/auth/*` route |
| `api/routes/health.route.ts` | `/api/health` route |
| `api/routes/protected.route.ts` | `/api/protected/*` の server-side protected sample |
| `api/modules/auth/` | password hash、JWT、cookie、auth service |
| `api/modules/dashboard/` | Dashboard registry、query execution、normalization、demo panels |
| `api/routes/dashboard.route.ts` | 認証保護された `/api/dashboards/*` API |
| `api/middleware/auth.ts` | protected API middleware |
| `web/src/` | React frontend |
| `web/src/routes/dashboard-route*.tsx` | Dashboard route shell と route-level lazy load |
| `web/src/domains/dashboard/` | search params、React Query、Grid、Chart/Table、Inspector |
| `web/src/domains/dashboard/v2/visualizations/` | 126 preset（Cartesian / composition / hierarchy / flow / KPI / distribution / heatmap / statistical / state / specialized observability）、shared model、lazy renderer family |
| `shared/schemas/` | frontend/backend で共有する Zod schema と API object type |
| `drizzle/` | SQL migrations |
| `scripts/verify.ts` | typecheck / lint / format / test / coverage / build の検証 pipeline |
| `scripts/verify-dashboard-bundle.ts` | Dashboard依存が通常ページの初期bundleへ混入しないことの検証 |

## 前提

| Tool | 用途 |
| --- | --- |
| Bun | package manager、runtime、scripts |
| SQLite | auth user / refresh token storage |

## セットアップ

```bash
bun run bootstrap
bun run dev
```

`bootstrap` は `.env` を用意し、dependency が未導入なら `bun install --frozen-lockfile` を実行し、SQLite database に migration とdevelopment用admin seedを適用します。

development用の初期認証情報は `admin@example.com` / `password123456` です。`DEV_ADMIN_EMAIL`、`DEV_ADMIN_NAME`、`DEV_ADMIN_PASSWORD` で変更できます。`bootstrap`または`seed:dev`を再実行すると、対象development adminは指定した表示名・パスワード・admin権限・active状態へ戻ります。

`auth:create-admin` は対話で password を読みます。自動化する場合は次のように標準入力から渡せます。

```bash
printf '%s\n' '<password>' | bun run auth:create-admin -- --email admin@example.com --name "Admin User" --password-stdin
```

開発サーバーは `http://localhost:5173` で起動します。Vite dev server が frontend を配信し、`/api/*` は Hono に渡されます。

初回 clone 後に template の動作確認まで済ませる場合は、次を実行します。

```bash
bun run verify
bun run verify:e2e
bun run verify:dashboard-release
```

認証を使う app では `bootstrap` がdevelopment adminまで準備するため、そのまま `/login` を確認できます。追加adminが必要なら `auth:create-admin`、初期adminを設定値へ戻すなら `seed:dev` を使います。認証を使わない app では、この README 後半の auth removal checklist に沿って auth route、DB table、login/protected screen、E2E scope をまとめて削ります。

## 生成物と管理対象

この template では、source と docs は追跡し、local runtime や検証の生成物は追跡しません。

| Path / Pattern | 扱い |
| --- | --- |
| `drizzle/*.sql` | Drizzle migration source。commit 対象 |
| `.env.example` | local development の雛形。commit 対象 |
| `.env*` | local secret / runtime env。`.env.example` 以外は commit しない |
| `data/`, `*.db`, `*.sqlite`, `*.sqlite3` | local SQLite database。commit しない |
| `coverage/`, `playwright-report/`, `test-results/` | verification output。commit しない |
| `dist/`, `dist-web/`, `build/`, `*.tgz` | build / archive output。commit しない |

## 環境変数

非シークレットの既定値は `api/config/appDefaults.ts` にあります。`.env.example` は local development 向けの値です。

| Variable | Required | Description | Default |
| --- | --- | --- | --- |
| `NODE_ENV` | no | `development` / `test` / `production` | `development` |
| `HOST` | no | HTTP bind host。container では `0.0.0.0` を指定 | `127.0.0.1` |
| `PORT` | no | HTTP server port | `5173` |
| `DATABASE_URL` | no | SQLite database file path | `data/sqlite.db` |
| `DEV_ADMIN_EMAIL` | no | `bootstrap` / `seed:dev`で作成・更新するdevelopment admin | `admin@example.com` |
| `DEV_ADMIN_NAME` | no | development adminの表示名 | `Admin User` |
| `DEV_ADMIN_PASSWORD` | no | development adminのパスワード。productionでは使用しない | `password123456` |
| `JWT_SECRET` | production yes | JWT signing secret。32 文字以上。production では未設定または dev default のままだと起動しません | dev default |
| `APP_URL` | no | public origin。cookie secure 既定値と CORS に使う | `http://localhost:5173` |
| `CORS_ORIGINS` | no | 追加許可 origin。カンマ区切り | `http://localhost:5173` |
| `AUTH_COOKIE_SECURE` | no | auth cookie に `Secure` を付けるか | production/HTTPS では `true` |
| `AUTH_COOKIE_SAME_SITE` | no | auth cookie SameSite | `lax` |
| `SECURITY_HEADERS_MODE` | no | HTTPS 前提 header の有効化方針。`auto` / `http` / `https` | `auto` |

`AUTH_COOKIE_SAME_SITE=none` を使う場合は、HTTPS の `APP_URL` または `AUTH_COOKIE_SECURE=true` が必要です。

## Scripts

| Command | Purpose |
| --- | --- |
| `bun run bootstrap` | clone 後の初期化。`.env`、依存、migration、development admin seedを適用 |
| `bun run seed:dev` | development専用adminを設定値どおりに作成または更新。productionでは失敗 |
| `bun run dev` | migrationとdevelopment admin seedを確認してからVite + Hono dev serverを起動 |
| `bun run start` | Bun server を直接起動 |
| `bun run auth:create-admin -- --email <email> --name "<name>"` | admin user 作成 |
| `bun run db:migrate` | `drizzle/*.sql` を順番に適用 |
| `bun run db:generate` | Drizzle migration 生成 |
| `bun run db:migrate:drizzle` | drizzle-kit migration。`DATABASE_URL` は process env または `.env` から読む |
| `bun run typecheck` | TypeScript check |
| `bun run lint` | Biome lint |
| `bun run format` | Biome format write |
| `bun run format:check` | Biome format check |
| `bun run test` | Vitest |
| `bun run test:coverage` | Vitest coverage。global threshold 80% を検証 |
| `bun run test:e2e` | Playwright smoke test。login と protected route を検証 |
| `bun run build` | Vite production build |
| `bun run verify:dashboard-bundle` | DashboardのRecharts/Gridがlazy chunkだけに入ることを検証 |
| `bun run verify:dashboard-gallery` | core renderer / presetの決定的Gallery網羅を検証 |
| `bun run verify:dashboard-variants` | 05 V12 prerequisiteとcanonical variant適用可否を判定 |
| `bun run verify:dashboard-e2e` | Dashboard functional suite（operations / Gallery） |
| `bun run verify:dashboard-visual` | Chromium canonical Gallery screenshotとの差分を検証 |
| `bun run verify:dashboard-a11y` | axe serious/critical、keyboard、reduced-motion、forced-colors、200% zoomを検証 |
| `bun run verify:dashboard-performance` | Gallery long-task / panel readiness / SVG node budget smoke |
| `bun run verify:dashboard-security` | production assetのtest markerとunsafe HTMLを検証 |
| `bun run verify:dashboard-adapter-sqlite` | Drizzle adapterをread-only SQLite接続で検証 |
| `bun run verify:dashboard-release` | Dashboard release gateをfail-fastで順番に実行 |
| `bun run verify:dashboard-coverage` | Dashboard backend focused coverage（branch 60%以上を含む） |
| `bun run verify` | typecheck、lint、format:check、test、coverage、build |
| `bun run verify:e2e` | Playwright smoke test。Dashboard期間/API連動とChart/Tableも検証 |
| `bun run verify:all` | `verify` と `verify:e2e` |

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | health check |
| `POST` | `/api/auth/login` | email/password login。httpOnly cookie を設定 |
| `POST` | `/api/auth/refresh` | refresh token rotation |
| `POST` | `/api/auth/logout` | refresh token revoke と cookie clear |
| `GET` | `/api/auth/me` | 現在の login user |
| `GET` | `/api/protected/profile` | `requireAuth` を通る protected API sample |
| `GET` | `/api/dashboards/:dashboardId/manifest` | Dashboard定義とvariables/panelsの公開契約 |
| `GET` | `/api/dashboards/:dashboardId/variables/:variableId/options` | static/query variable options |
| `POST` | `/api/dashboards/:dashboardId/panels/:panelId/query` | panel単位の集計結果。共有Zod envelope |

`/api/auth/me` は access token が必要です。frontend client は 401 を受けると `/api/auth/refresh` を一度試し、成功した場合だけ元の request を再実行します。

`/api/protected/*` は server-side で `requireAuth` を適用しています。画面だけで保護しているわけではないことを確認するサンプルとして、`/protected` から `/api/protected/profile` を呼び出します。

API request / response の共有 schema は `shared/schemas/` に置きます。Backend route はその schema を `zValidator` で使い、frontend は `api/app/hono.ts` から export される `AppType` を `hono/client` に渡して API 型を共有します。

## Frontend Routes

| Path | Access | Description |
| --- | --- | --- |
| `/` | public | Home |
| `/showcase` | public | Component showcase |
| `/login` | public/session-aware | Login。`?redirect=/protected` のような same-origin path redirect を受け付ける |
| `/protected` | login required | Protected route sample。ログイン後だけ表示し、server protected API も呼び出す |
| `/dashboard` | login required | Dashboard overlay demo。URL filters、編集可能Grid、Chart/Table |
| `/dashboard/gallery` | login required | 126 preset + state/integration fixture、empty/partial/stale/truncated/multi-frameの決定的Gallery |

## Dashboard overlay

Grafanaの全機能を取り込まず、server-sideの静的registryとpanel handlerだけを差し替えて使う軽量スターターです。共通層はSQLを生成せず、handlerがDB固有の集計を行い、normalizerがChart/Table共通のPanelDataへ検証・整形します。

State Timeline、Status History、Uptime Gridはstate interval/sample shapeを共有し、annotation frameのpoint/line/region/badgeを時系列オーバーレイとして扱います。詳細な契約、モデル、Gallery、検証手順は`docs/dashboard-overlay/09-state-timeline-status-annotations.md`と`docs/dashboard-overlay/progress.md`を参照してください。

Node Graph、Candlestick、Logs、Trace Waterfall、Flame Graph、Geomapの専門可視化は、厳格な共有契約とlazy rendererを使う30 presetとして追加されています。詳細は`docs/dashboard-overlay/10-specialized-observability-visualizations.md`を参照してください。

`Record[]`、Drizzle select、固定originのHTTP JSONは、server-side Data Source Adapterから同じData Frame契約へ接続できます。列は明示登録制で、SQL生成、browser SQL editor、webhook、保存層は追加しません。導入例は[`data-source-adapters-quickstart.md`](docs/dashboard-overlay/data-source-adapters-quickstart.md)を参照してください。

- 共有契約: [`shared/schemas/dashboard.schema.ts`](shared/schemas/dashboard.schema.ts)
- Backend: [`api/modules/dashboard/`](api/modules/dashboard/)、[`api/routes/dashboard.route.ts`](api/routes/dashboard.route.ts)
- Frontend: [`web/src/domains/dashboard/`](web/src/domains/dashboard/)、[`web/src/routes/dashboard-route.lazy.tsx`](web/src/routes/dashboard-route.lazy.tsx)
- Visualization Platformの目的・境界・長期カタログ: [`docs/dashboard-overlay/00-concept.md`](docs/dashboard-overlay/00-concept.md)
- Data Source Adapter Quickstart: [`docs/dashboard-overlay/data-source-adapters-quickstart.md`](docs/dashboard-overlay/data-source-adapters-quickstart.md)
- Data Source Adapter P0実装計画: [`docs/dashboard-overlay/data-source-adapters-p0.md`](docs/dashboard-overlay/data-source-adapters-p0.md)
- 初期v1実装計画とA1〜A8の完了条件: [`docs/dashboard-overlay-implementation-plan.md`](docs/dashboard-overlay-implementation-plan.md)
- 継続実装の台帳: [`docs/dashboard-overlay/progress.md`](docs/dashboard-overlay/progress.md)

KPI / Goal / Status familyは`core.stat` 5、`core.gauge` 3、`core.bar-gauge` 4、`core.bullet` 3、
`core.progress` 3、`core.traffic-light` 3 presetを提供します。`previous` / `delta` / `goal` role、
range overflow、semantic state、native SVG primitiveを共有し、KPI rendererからRechartsを参照しません。

Distribution / Heatmap / Statistical familyは`core.histogram`、`core.heatmap`、`core.box-plot`、
`core.calendar-heatmap`を各5 preset、計20 preset提供します。Histogramはbrowser-onlyの
`core.histogram` transformationで決定的binningを行い、Heatmap / Box Plot / Calendar Heatmapは
native SVGとTable / summary / accessibility fallbackを共有します。

別variantへ適用する場合は、まず対象branchの`api/db/*`と`api/app/*`差分を確認し、このbranchのDashboard変更をpatch/cherry-pick相当で取り込みます。DB schemaやmigrationは持ち込まず、`demo-dashboard.ts`のhandlerだけを対象variantのread APIへ置き換えてください。適用後は次を実行します。

```bash
bun run verify
bun run verify:e2e
bun run verify:dashboard-bundle
```

## Build / Runtime

```bash
bun run build
NODE_ENV=production JWT_SECRET='<32+ random chars>' bun run db:migrate
NODE_ENV=production JWT_SECRET='<32+ random chars>' bun run start
```

production では `JWT_SECRET` を必ず強いランダム値に変更してください。未設定または dev default のままの場合、アプリは起動時に失敗します。HTTPS で公開する場合は `APP_URL=https://...` とし、必要に応じて `AUTH_COOKIE_SECURE=true`、`SECURITY_HEADERS_MODE=https` を明示します。

SQLite baseline では `DATABASE_URL` は永続化される file path にしてください。container や VM で動かす場合は、DB file を volume に置き、起動前に `bun run db:migrate` を実行します。`PORT` は platform 側が指定する値に合わせて上書きできます。

### SQLite concurrency contract

SQLite runtime は1プロセスにつき1つの writable connection だけを作り、すべての書き込みを共通の `SingleWriterClient` でFIFO実行します。アプリケーションコードは writable Drizzle database を直接保持せず、`dbRuntime.client.write.execute((db) => ...)` を使って書き込みます。読み取りは `dbRuntime.client.read` を使います。

file database では WAL、`busy_timeout`、foreign key enforcement を有効にし、reader は物理的に read-only で開きます。`:memory:` database はDB自体がconnection単位なので、同じconnectionをreaderとwriterで共有します。SQLite fileを複数のapp processや複数hostから同時利用する構成はこのcontractの対象外です。その場合はTursoやPostgreSQLなど、複数processを前提とするvariantを選んでください。

## Docker

SQLite baseline を container で試す場合:

```bash
COMPOSE_JWT_SECRET='<32+ random chars>' docker compose up --build
```

compose は `./data` を永続 volume として mount し、container 起動時に migration 後 `bun run start` を実行します。`COMPOSE_JWT_SECRET` は compose 実行時の必須環境変数で、container 内では `JWT_SECRET` として渡されます。production 公開時は `COMPOSE_JWT_SECRET`、`APP_URL`、cookie secure mode、security header mode を必ず環境に合わせて変更してください。

## 品質ゲート

通常の closeout は次を通します。

```bash
bun run verify
bun run verify:e2e
```

`verify` は `typecheck`、Biome `lint`、`format:check`、Vitest、coverage threshold、production build を含みます。`verify:e2e` は Playwright smoke で public screens、login、protected route、logout を確認します。

## Template Notes

- この repo は npm package 配布ではなく、GitHub template / branch clone / tag clone / archive snapshot を主配布にします。
- この branch は RAG / pgvector / agentic search template ではありません。
- Drizzle は前提です。DB driver / schema / migration の大きな差分は `variant/*` branch で管理します。
- `main` は SQLite baseline です。Turso / PostgreSQL / pgvector は `docs/template-variant-management.md` の contract に沿って branch を分けます。
- 認証は optional UI として残しています。Home と Showcase は未ログインでも表示されます。
- `/protected` と `/api/protected/profile` は protected route の最小サンプルです。新しい login-required 画面や API を追加するときの起点にしてください。
- SQLite は auth user と refresh token 保存に使います。
- clone 後は `package.json` の name / description、README、`.env.example`、DB 名、cookie/CORS/security 設定を利用先に合わせて見直してください。
- さらに小さい starter が必要な場合は、この branch を直接削るより `variant/minimal` または `overlay/authless` として auth/showcase removal を固定化してください。

## Template Usage Checklist

clone 後に見直す項目:

- `package.json` の `name` / `version` / `description` / repository metadata。
- README のプロジェクト名、セットアップ手順、production 手順。
- `.env.example` と deployment secret。
- `DATABASE_URL`、DB 永続化 path、migration 実行タイミング。
- cookie / CORS / CSRF / CSP / security header の本番設定。
- sample route と showcase を残すか削るか。
- license / author。

protected API を追加する最小手順:

1. request / response schema を `shared/schemas/` に追加する。
2. Hono route を `api/routes/` に追加し、必要なら `requireAuth` を適用する。
3. `api/app/hono.ts` の `createApiRoutes` に route を登録する。
4. `web/src/api.ts` に `hono/client` 経由の fetch function / hook を追加する。
5. React route / view を `web/src/routes/` と `web/src/views/` に追加する。
6. unit test と E2E smoke の必要箇所を追加する。

auth を使わない template にする場合は、`api/modules/auth/`、`api/routes/auth.route.ts`、`api/middleware/auth.ts`、auth cookies/token schema、login/protected route、admin CLI、auth DB tables をまとめて削ります。削除後は `bun run verify` と `bun run verify:e2e` の smoke scope を更新してください。

auth/showcase を削った軽量 variant を保守する場合は、削除差分を `variant/minimal` または `overlay/authless` に固定し、次を最低限の完了条件にします。

- `bun run bootstrap` が fresh clone で通る。
- `bun run verify` が通る。
- E2E は残した public route と API health check を確認する。
- README、`.env.example`、DB migration、Template Usage Checklist から auth 前提を外す。

development の demo admin は次で作成できます。

```bash
bun run seed:dev
```

既定値は `admin@example.com` / `password123456` です。変更する場合は `DEV_ADMIN_EMAIL`、`DEV_ADMIN_NAME`、`DEV_ADMIN_PASSWORD` を使います。既存ユーザーがある場合も指定した認証情報・admin権限・active状態へ更新します。この command は `NODE_ENV=production` では失敗します。
