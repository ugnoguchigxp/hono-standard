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
| `api/middleware/auth.ts` | protected API middleware |
| `web/src/` | React frontend |
| `shared/schemas/` | frontend/backend で共有する Zod schema と API object type |
| `drizzle/` | SQL migrations |
| `scripts/verify.ts` | typecheck / lint / format / test:coverage / build の検証 pipeline |

## 前提

| Tool | 用途 |
| --- | --- |
| Bun | package manager、runtime、scripts |
| SQLite | auth user / refresh token storage |

## セットアップ

```bash
bun run bootstrap
bun run auth:create-admin -- --email admin@example.com --name "Admin User"
bun run dev
```

`bootstrap` は `.env` を用意し、dependency が未導入なら `bun install --frozen-lockfile` を実行し、SQLite database に migration を適用します。既存の設定は保持し、必要な場合だけ `DATABASE_URL` の追加・テンプレート既定値の補正を行います。引用符、コメント、秘密値は書き換えません。

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
| `drizzle/meta/*.json` | 差分生成用のsnapshotとjournal。SQLと同じcommitに含める |
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
| `bun run bootstrap` | clone 後の初期化。`.env` を用意し、SQLite database に migration を適用 |
| `bun run seed:dev` | development 専用の demo admin 作成。production では失敗 |
| `bun run template:authless -- <new-directory>` | auth / protected sample / showcaseを除いた新規コピーを生成 |
| `bun run dev` | Vite + Hono dev server |
| `bun run start` | Bun server を直接起動 |
| `bun run auth:create-admin -- --email <email> --name "<name>"` | admin user 作成 |
| `bun run db:migrate` | `drizzle/*.sql` を順番に適用 |
| `bun run db:generate` | Drizzle migration 生成 |
| `bun run db:migrate:drizzle` | 旧コマンド名の互換alias。`db:migrate`と同じBun用runnerを実行 |
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
| `bun run verify:e2e` | Chromium / Firefox / WebKit / mobileのE2E |
| `bun run verify:load` | 一時DBでprofile読取・refresh書込を3回計測 |
| `bun run db:backup <new-file>` | WALを含むオンラインスナップショット |
| `bun run db:verify-backup <file>` | DB整合性・SHA-256の確認 |
| `bun run db:restore <snapshot> <new-db>` | 検査後に新しいDBへ復元 |
| `bun run verify:all` | `verify` と `verify:e2e` |

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | liveness check |
| `GET` | `/api/ready` | DB接続・書き込み開始・移行・schemaの準備確認（失敗は503） |
| `POST` | `/api/auth/login` | email/password login。httpOnly cookie を設定 |
| `POST` | `/api/auth/refresh` | refresh token rotation。使用済みtokenの再提示時はtoken familyを失効 |
| `POST` | `/api/auth/logout` | refresh token revoke と cookie clear |
| `GET` | `/api/auth/me` | 現在の login user |
| `GET` | `/api/protected/profile` | `requireAuth` を通る protected API sample |
| `GET` | `/api/protected/admin` | `requireAuth` と `requireRole("admin")` を通る role authorization sample |

`/api/auth/me` は access token が必要です。frontend client は 401 を受けると `/api/auth/refresh` を一度試し、成功した場合だけ元の request を再実行します。

セッション確認の`/api/auth/me`も更新対象です。login・logout・refresh自体は自動更新しません。同一ページの並行requestは更新処理を共有します。タブ間では [Web Locks](https://developer.mozilla.org/en-US/docs/Web/API/Web_Locks_API) でlogin・logout・refreshを直列化し、ロック取得後にセッションを再確認します。別タブが復元済みならrefreshを省略します。自動更新はWeb Locksが利用できるHTTPSまたはlocalhostで有効です。未対応ブラウザーや安全でないHTTP環境では、access token失効時に再ログインが必要です。更新の401は未ログインとして扱い、通信障害・サーバーエラーは表示します。

保護データのquery keyには利用者IDを含めます。login成功・logout成功・セッション失効時に`auth`/`protected`配下の進行中queryを取り消し、`protected`のキャッシュを消去します。新しい保護queryもこのprefixを使用し、query functionでAbortSignalを受け渡してください。logout失敗時は認証状態を保持し、エラーを表示して再試行できるようにします。

パスワードはscrypt（`N=16384, r=8, p=5`）の`s2`形式で保存します。旧`s1`形式（`p=1`）も検証でき、パスワード認証に成功した時点で`s2`へ更新します。利用者によるパスワード再設定やDBの一括書き換えは不要です。

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

`bun run build`と`build:web`は、開発用`.env`の`NODE_ENV`にかかわらずproduction bundleを生成します。server起動時の`NODE_ENV`は別に設定してください。

```bash
bun run build
NODE_ENV=production JWT_SECRET='<32+ random chars>' bun run db:migrate
NODE_ENV=production JWT_SECRET='<32+ random chars>' bun run start
```

production では `JWT_SECRET` を必ず強いランダム値に変更してください。未設定または dev default のままの場合、アプリは起動時に失敗します。HTTPS で公開する場合は `APP_URL=https://...` とし、必要に応じて `AUTH_COOKIE_SECURE=true`、`SECURITY_HEADERS_MODE=https` を明示します。

server lifecycle、request summary、server errorは1行JSONで標準出力または標準エラーへ記録します。request logは`requestId`、method、path、status、durationを含み、受信した安全な`X-Request-Id`を引き継ぎます。

SQLite baseline では `DATABASE_URL` は永続化される file path にしてください。container や VM で動かす場合は、DB file を volume に置き、起動前に `bun run db:migrate` を実行します。`PORT` は platform 側が指定する値に合わせて上書きできます。

### DBスキーマを変更する

1. `api/db/schema.ts`を変更する。
2. `bun run db:generate`を実行し、生成されたSQLを確認する。
3. SQLと`drizzle/meta/`の変更を一緒にcommitする。
4. `bun run db:migrate`で適用する。

スキーマに変更がなければSQLは生成されません。適用済みSQLの名前・内容とsnapshotを削除または書き換えず、新しいmigrationを追加してください。既存の`0001_auth.sql`と`0002_refresh_token_reuse_detection.sql`、およびDB内の`hono_standard_schema_migrations`履歴を維持しています。Drizzle Kitは差分生成に使用し、適用はBun用runnerに統一しています。`drizzle-kit migrate`を別途実行して二重の適用履歴を作らないでください。

マイグレーションはファイルごとのtransactionで適用し、commit前に`PRAGMA foreign_key_check`で整合性を検査します。違反があればデータ変更と適用履歴をともにrollbackします。SQLiteの[テーブル再構築手順](https://www.sqlite.org/lang_altertable.html#making_other_kinds_of_table_schema_changes)に従い、migration専用connectionではforeign key enforcementを無効にして検査するため、親テーブルの作り直しによる意図しないcascade削除も防ぎます。

### SQLite concurrency contract

SQLite runtime は1プロセスにつき1つの writable connection だけを作り、すべての書き込みを共通の `SingleWriterClient` でFIFO実行します。アプリケーションコードは writable Drizzle database を直接保持せず、`dbRuntime.client.write.execute((db) => ...)` を使って書き込みます。読み取りは `dbRuntime.client.read` を使います。

file database では WAL、`busy_timeout`、foreign key enforcement を有効にし、reader は物理的に read-only で開きます。`:memory:` database はDB自体がconnection単位なので、同じconnectionをreaderとwriterで共有します。SQLite fileを複数のapp processや複数hostから同時利用する構成はこのcontractの対象外です。その場合はTursoやPostgreSQLなど、複数processを前提とするvariantを選んでください。

DBの監視、バックアップ・復元、停止、負荷試験の手順は[運用ガイド](docs/operations.md)を参照してください。

## Docker

imageには実行・buildに必要なディレクトリだけをコピーします。`.env`、`.env.*`（`.env.example`以外）、`data/`、SQLiteのDB本体・WAL・SHMはbuild contextから除外し、DBとsecretは実行環境から渡します。

SQLite baseline を container で試す場合:

```bash
COMPOSE_JWT_SECRET='<32+ random chars>' docker compose up --build
```

compose は `./data` を永続 volume として mount します。先に一度だけ動く`data-init`がrootで保存先ディレクトリとSQLite本体・WAL・SHMの所有者をUID/GID `10001:10001`へ設定します。成功後にappを同UIDの非root userで起動し、migration後にBunサーバーをPID 1として実行します。Linuxホスト側の対象ファイルの所有者も変わります。既存のDBはそのまま利用され、内容やアクセス権の範囲は変更しません。Docker HEALTHCHECKはcontainer内からDBの`/api/ready`を確認します。停止はHTTP完了を10秒待ち、Composeの猶予は15秒です。`COMPOSE_JWT_SECRET` は compose 実行時の必須環境変数で、container 内では `JWT_SECRET` として渡されます。production 公開時は `COMPOSE_JWT_SECRET`、`APP_URL`、cookie secure mode、security header mode を必ず環境に合わせて変更してください。

## 品質ゲート

通常の closeout は次を通します。

```bash
bun run verify
bun run verify:e2e
```

`verify` は `typecheck`、Biome `lint`、`format:check`、Vitest coverage（unit test と threshold）、production build を含みます。test を coverage とは別に重ねて実行しません。`verify:e2e` は Playwrightでpublic screens、login、protected route、logout失敗と再試行、アカウント切替、複数タブの更新、Dialog・Drawer・Tabsのキーボード操作とモバイルの横溢れを確認します。対象はChromium・Firefox・WebKitとモバイル2構成です。初回は`bunx playwright install --with-deps chromium firefox webkit`を実行してください。

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
- SQLite は auth user と refresh token 保存に使います。
- clone 後は `package.json` の name / description、README、`.env.example`、DB 名、cookie/CORS/security 設定を利用先に合わせて見直してください。
- さらに小さいstarterが必要な場合は、`bun run template:authless -- ../my-app`でauth/showcaseを除いた新規コピーを生成してください。元のcheckoutは変更しません。

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
