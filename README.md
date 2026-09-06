# Hono Standard

[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh/)
[![Hono](https://img.shields.io/badge/Hono-%23E36022.svg?style=for-the-badge&logo=hono&logoColor=white)](https://hono.dev/)
[![React](https://img.shields.io/badge/React-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1.svg?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![MIT License](https://img.shields.io/badge/License-MIT-green.svg?style=for-the-badge)](LICENSE.md)

Hono backend と React + Vite frontend を同一 origin で動かす、PostgreSQL対応のWeb app templateです。Drizzleのユーザー認証、httpOnly Cookieによるaccess / refresh token、React Routerベースの画面、コンポーネントshowcaseを含みます。

## 構成

| Path | Role |
| --- | --- |
| `api/app/hono.ts` | Hono app composition。middleware、API route、静的配信、`AppType` を登録 |
| `api/app/server.ts` | Bun server bootstrap |
| `api/app/env.ts` | runtime env parser |
| `api/config/appDefaults.ts` | 非シークレットの既定値 |
| `api/db/index.ts` | DB runtime の public entry。variant はここから差し替える |
| `api/db/schema.ts` | Drizzle PostgreSQL schema |
| `api/db/migrate.ts` | migration runner の public entry |
| `api/routes/auth.route.ts` | `/api/auth/*` route |
| `api/routes/health.route.ts` | `/api/health` route |
| `api/routes/protected.route.ts` | `/api/protected/*` の server-side protected sample |
| `api/modules/auth/` | password hash、JWT、cookie、auth service |
| `api/middleware/auth.ts` | protected API middleware |
| `web/src/` | React frontend |
| `shared/schemas/` | frontend/backend で共有する Zod schema と API object type |
| `drizzle/` | SQL migrations |
| `scripts/verify.ts` | typecheck / lint / format / test:coverage / build の検証 pipeline |

## 前提

| Tool | 用途 |
| --- | --- |
| Bun | package manager、runtime、scripts |
| PostgreSQL 17+ | auth user / refresh token storage |

## セットアップ

```bash
bun run bootstrap
bun run auth:create-admin -- --email admin@example.com --name "Admin User"
bun run dev
```

`bootstrap`は`.env`を用意し、dependencyが未導入なら`bun install --frozen-lockfile`を実行し、PostgreSQLへの接続確認後にmigrationを適用します。

`auth:create-admin` は対話で password を読みます。自動化する場合は次のように標準入力から渡せます。

```bash
printf '%s\n' '<password>' | bun run auth:create-admin -- --email admin@example.com --name "Admin User" --password-stdin
```

開発サーバーは `http://localhost:5173` で起動します。Vite dev server が frontend を配信し、`/api/*` は Hono に渡されます。

初回 clone 後に template の動作確認まで済ませる場合は、次を実行します。

```bash
bun run verify
bun run verify:e2e
```

認証を使う app では `auth:create-admin` または `seed:dev` で admin を作成してから `/login` を確認します。認証を使わない app は、このREADME後半の`template:authless`で別directoryへ生成します。

## 生成物と管理対象

この template では、source と docs は追跡し、local runtime や検証の生成物は追跡しません。

| Path / Pattern | 扱い |
| --- | --- |
| `drizzle/*.sql` | Drizzle migration source。commit 対象 |
| `.env.example` | local development の雛形。commit 対象 |
| `.env*` | local secret / runtime env。`.env.example` 以外は commit しない |
| `backups/`, `*.dump` | PostgreSQL backup。commit しない |
| `coverage/`, `playwright-report/`, `test-results/` | verification output。commit しない |
| `dist/`, `dist-web/`, `build/`, `*.tgz` | build / archive output。commit しない |

## 環境変数

非シークレットの既定値は `api/config/appDefaults.ts` にあります。`.env.example` は local development 向けの値です。

| Variable | Required | Description | Default |
| --- | --- | --- | --- |
| `NODE_ENV` | no | `development` / `test` / `production` | `development` |
| `HOST` | no | HTTP bind host。container では `0.0.0.0` を指定 | `127.0.0.1` |
| `PORT` | no | HTTP server port | `5173` |
| `DATABASE_URL` | no | PostgreSQL connection URL | `postgres://postgres:postgres@localhost:5432/hono_standard` |
| `JWT_SECRET` | production yes | JWT signing secret。32 文字以上。production では未設定または dev default のままだと起動しません | dev default |
| `LOGIN_RATE_LIMIT_MAX_ATTEMPTS` | no | 1アカウント・1windowあたりのlogin試行上限 | `5` |
| `LOGIN_RATE_LIMIT_WINDOW_SECONDS` | no | login試行上限を保持する秒数 | `300` |
| `APP_URL` | no | public origin。cookie secure 既定値と CORS に使う | `http://localhost:5173` |
| `CORS_ORIGINS` | no | 追加許可 origin。カンマ区切り | `http://localhost:5173` |
| `AUTH_COOKIE_SECURE` | no | auth cookie に `Secure` を付けるか | production/HTTPS では `true` |
| `AUTH_COOKIE_SAME_SITE` | no | auth cookie SameSite | `lax` |
| `SECURITY_HEADERS_MODE` | no | HTTPS 前提 header の有効化方針。`auto` / `http` / `https` | `auto` |

`AUTH_COOKIE_SAME_SITE=none` を使う場合は、HTTPS の `APP_URL` または `AUTH_COOKIE_SECURE=true` が必要です。

## Scripts

| Command | Purpose |
| --- | --- |
| `bun run bootstrap` | clone後の初期化。`.env`を用意し、PostgreSQLにmigrationを適用 |
| `bun run seed:dev` | development 専用の demo admin 作成。production では失敗 |
| `bun run template:authless -- <new-directory>` | auth / protected sample / showcaseを除いた新規コピーを生成 |
| `bun run dev` | Vite + Hono dev server |
| `bun run start` | Bun server を直接起動 |
| `bun run auth:create-admin -- --email <email> --name "<name>"` | admin user 作成 |
| `bun run db:migrate` | `drizzle/*.sql` を順番に適用 |
| `bun run db:generate` | Drizzle migration 生成 |
| `bun run db:migrate:drizzle` | drizzle-kit migration。`DATABASE_URL` は process env または `.env` から読む |
| `bun run db:backup -- <new-file>` | `pg_dump` custom formatでバックアップを作成・検証 |
| `bun run db:verify-backup -- <file>` | `pg_restore --list`でバックアップを検証 |
| `bun run db:restore -- <file>` | 明示した別URLへバックアップを復元 |
| `bun run typecheck` | TypeScript check |
| `bun run lint` | Biome lint |
| `bun run format` | Biome format write |
| `bun run format:check` | Biome format check |
| `bun run test` | Vitest。Node backend test と jsdom React component/hook test を一括実行。coverage なしの局所確認用 |
| `bun run test:coverage` | Vitest。全 test を実行し、React TSX を含む global threshold 95% を検証 |
| `bun run test:e2e` | Playwright smoke test。login と protected route を検証 |
| `bun run audit` | lockfile上のproduction / development dependencyの脆弱性監査 |
| `bun run build` | Vite production build |
| `bun run verify:commit` | commit前のtypecheck、lint、format check |
| `bun run verify` | typecheck、lint、format:check、test:coverage、build |
| `bun run verify:e2e` | Playwright smoke test |
| `bun run verify:all` | `verify` と `verify:e2e` |

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | health check |
| `GET` | `/api/ready` | PostgreSQLとmigrationのreadiness check |
| `POST` | `/api/auth/login` | email/password login。httpOnly cookie を設定 |
| `POST` | `/api/auth/refresh` | refresh token rotation。使用済みtokenの再提示時はtoken familyを失効 |
| `POST` | `/api/auth/logout` | refresh token revoke と cookie clear |
| `GET` | `/api/auth/me` | 現在の login user |
| `GET` | `/api/protected/profile` | `requireAuth` を通る protected API sample |
| `GET` | `/api/protected/admin` | `requireAuth` と `requireRole("admin")` を通る role authorization sample |

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

## Build / Runtime

```bash
bun run build
NODE_ENV=production JWT_SECRET='<32+ random chars>' bun run db:migrate
NODE_ENV=production JWT_SECRET='<32+ random chars>' bun run start
```

production では `JWT_SECRET` を必ず強いランダム値に変更してください。未設定または dev default のままの場合、アプリは起動時に失敗します。HTTPS で公開する場合は `APP_URL=https://...` とし、必要に応じて `AUTH_COOKIE_SECURE=true`、`SECURITY_HEADERS_MODE=https` を明示します。

server lifecycle、request summary、server errorは1行JSONで標準出力または標準エラーへ記録します。request logは`requestId`、method、path、status、durationを含み、受信した安全な`X-Request-Id`を引き継ぎます。

`DATABASE_URL`にはTLS、認証、接続数を環境に合わせたPostgreSQL URLを指定し、起動前に`bun run db:migrate`を実行します。停止、readiness、バックアップ、復元の手順は[`docs/operations.md`](docs/operations.md)を参照してください。

## Docker

PostgreSQLとappをcontainerで試す場合:

```bash
COMPOSE_JWT_SECRET='<32+ random chars>' docker compose up --build
```

composeはPostgreSQLのhealthcheck成功後にmigrationとappを起動します。appのDocker HEALTHCHECKは`/api/ready`を確認し、停止時は最大15秒待機します。production公開時はDB password、`COMPOSE_JWT_SECRET`、`APP_URL`、cookie secure mode、security header modeを環境に合わせて変更してください。

## 品質ゲート

通常の closeout は次を通します。

```bash
bun run verify
bun run verify:e2e
```

`verify` は `typecheck`、Biome `lint`、`format:check`、Vitest coverage（unit test と threshold）、production build を含みます。test を coverage とは別に重ねて実行しません。`verify:e2e` は Playwright smoke で public screens、login、protected route、logout を確認します。

dependency auditはnetworkを使うためlocalの`verify`には含めず、GitHub Actionsで`bun run audit`を必須実行します。

pre-commitは`verify:commit`（typecheck / lint / format check）に限定し、test:coverage / buildを含む完全な`verify`はpre-pushとCIで実行します。

Delivery の必須 Gate、リスクに応じて追加する mutation / performance / vulnWorkbench security diagnostics、結果と証拠の扱いは [`docs/delivery-quality-gates.md`](docs/delivery-quality-gates.md) を参照してください。

変更への参加手順は [`CONTRIBUTING.md`](CONTRIBUTING.md)、利用者に影響する変更は [`CHANGELOG.md`](CHANGELOG.md)、脆弱性の非公開報告手順は [`SECURITY.md`](SECURITY.md) を参照してください。

## Template Notes

- この repo は npm package 配布ではなく、GitHub template / branch clone / tag clone / archive snapshot を主配布にします。
- この branch は RAG / pgvector / agentic search template ではありません。
- Drizzle は前提です。DB driver / schema / migration の大きな差分は `variant/*` branch で管理します。
- `main` は SQLite baseline です。Turso / PostgreSQL / pgvector は `docs/template-variant-management.md` の contract に沿って branch を分けます。
- 認証は optional UI として残しています。Home と Showcase は未ログインでも表示されます。
- `/protected` と `/api/protected/profile` は protected route の最小サンプルです。新しい login-required 画面や API を追加するときの起点にしてください。
- PostgreSQLはauth userとrefresh token保存に使います。
- clone 後は `package.json` の name / description、README、`.env.example`、DB 名、cookie/CORS/security 設定を利用先に合わせて見直してください。
- さらに小さいstarterが必要な場合は、`bun run template:authless -- ../my-app`でauth/showcaseを除いた新規コピーを生成してください。元のcheckoutは変更しません。

## Template Usage Checklist

clone 後に見直す項目:

- `package.json` の `name` / `version` / `description` / repository metadata。
- README のプロジェクト名、セットアップ手順、production 手順。
- `.env.example` と deployment secret。
- `DATABASE_URL`、DB backup、migration実行タイミング。
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

roleで制限するAPIは`requireAuth`の後に`requireRole("admin")`などを適用します。baselineのlogin rate limitはアカウント単位・プロセス内の固定windowです。複数process / hostやIP単位の制限が必要な公開環境では、共有storeまたはedge / reverse proxy側のrate limitを追加してください。

authを使わないtemplateは、手作業で削除対象を追従する代わりに次のgeneratorを使います。

```bash
bun run template:authless -- ../my-authless-app
cd ../my-authless-app
bun install --frozen-lockfile
bun run verify
bun run verify:e2e
```

generatorは現在のworktreeにあるGit管理対象と未追跡・非ignoreのsourceを新規directoryへコピーし、`api/modules/auth/`、auth/protected route、login/protected/showcase UI、admin CLI、auth migrationと関連dependencyを除去します。既存directoryへの上書きと元checkoutの変更は拒否し、生成途中で失敗した場合は不完全な出力先を削除します。

生成したauthless templateを保守対象へ昇格する場合は、次を最低限の完了条件にします。

- `bun run bootstrap` が fresh clone で通る。
- `bun run verify` が通る。
- E2E は残した public route と API health check を確認する。
- README、`.env.example`、DB migration、Template Usage Checklist から auth 前提を外す。

development の demo admin は次で作成できます。

```bash
bun run seed:dev
```

既定値は `admin@example.com` / `password123456` です。変更する場合は `DEV_ADMIN_EMAIL`、`DEV_ADMIN_NAME`、`DEV_ADMIN_PASSWORD` を使います。この command は `NODE_ENV=production` では失敗します。
