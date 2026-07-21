# Implementation Context: Hono Standard

この文書はリポジトリ一覧ではなく、実装開始用の索引である。構成確認だけを目的とした `pwd`、`ls`、`find`、`rg --files`、`package.json` の読み直しは原則不要。タスクに対応する Working Set から対象、近接テスト、直接依存を読み、実装へ進む。

記載パスが存在しない、横断変更を行う、新しい基盤を追加する場合だけ対象を限定して探索する。文書とコードが矛盾するときはコードを正とし、同じ変更でこの文書も直す。

## Runtime

- `variant/turso`。Bun + Hono API + React/Vite frontendを同一originで提供し、Turso/libSQLを利用する。
- API composition rootは `api/app/hono.ts`、Bun server entryは `api/app/server.ts`。
- Frontend entryは `web/src/main.tsx`、providerは `web/src/App.tsx`、route compositionは `web/src/router.tsx`。
- DB public entryとlibSQL runtimeは `api/db/index.ts`、schemaは `api/db/schema.ts`、SQL migration runnerは `api/db/migrate.ts`、migrationは `drizzle/`。local file URLとremote Turso URLの両方を扱う。
- API契約は `shared/schemas/` のZod schemaと、`api/app/hono.ts`がexportする `AppType` を共有する。
- package manager/runtimeはBun。品質ゲートは `bun run verify`、E2Eは `bun run verify:e2e`。

## Implementation Map

| Path | 実装上の役割 |
| --- | --- |
| `api/app/hono.ts` | middleware、依存生成、domain routeのmount、`AppType` export |
| `api/modules/<domain>/` | backendの新規ドメイン実装 |
| `api/db/` | Turso/libSQL runtime、schema、migration境界 |
| `api/middleware/auth.ts` | access token認証 |
| `shared/schemas/` | APIとfrontendが共有するvalidation/contract |
| `web/src/modules/<domain>/` | frontendの新規ドメイン実装 |
| `web/src/routes/` | URL、search parameter、route guard |
| `web/src/styles.css` | Tailwind v4、global token、既存component class |
| `scripts/verify.ts` | `bun run verify` の実行内容 |
| `tests/e2e/` | browser smoke test |

生成物、coverage、report、local DBは実装対象ではない。通常は探索も編集もしない。

## Working Sets

最初に「Start」を読み、必要になった直接依存だけへ広げる。同階層の `*.test.ts(x)` は実装と同時に確認する。

| Task | Start | Add when needed |
| --- | --- | --- |
| 新しいbackend domain | `api/app/hono.ts`, `api/modules/<domain>/`, `shared/schemas/` | `api/db/schema.ts`, `drizzle/`（永続化時のみ） |
| Auth API/session | `api/routes/auth.route.ts`, `api/modules/auth/`, `api/middleware/auth.ts`, `shared/schemas/auth.schema.ts` | `web/src/api.ts`, `web/src/auth-context.tsx` |
| Protected API/UI | `api/routes/protected.route.ts`, `web/src/routes/protected-route.tsx`, `web/src/views/protected-view.tsx` | `api/middleware/auth.ts`, `shared/schemas/protected.schema.ts` |
| 新しいfrontend domain | `web/src/router.tsx`, `web/src/routes/`, `web/src/modules/<domain>/` | 対応する `shared/schemas/`, `api/modules/<domain>/` |
| Login UI | `web/src/views/login-view.tsx`, `web/src/domains/auth/login-domain.tsx`, `web/src/auth-context.tsx` | `web/src/api.ts`, `web/src/routes/login-*` |
| App shell/routing | `web/src/routes/root-route.tsx`, `web/src/router.tsx`, `web/src/App.tsx` | 対象viewとroute test |
| Showcase/style | `web/src/views/showcase-view.tsx`, `web/src/showcase-settings-context.tsx`, `web/src/showcase-table-search.ts`, `web/src/styles.css` | `web/src/main.tsx`, `vite.config.ts`（style pipeline変更時のみ） |
| DB/schema/migration | `api/db/index.ts`, `api/db/schema.ts`, `api/db/migrate.ts`, `drizzle/` | DBを使うdomain repository、`api/app/env.ts`, `drizzle.config.ts` |
| Env/runtime | `api/app/env.ts`, `api/config/appDefaults.ts`, `.env.example` | DB、Docker、Viteのうち変更値を消費する箇所だけ |
| Build/quality | `package.json`, `scripts/verify.ts`, 該当config | `.github/workflows/verify.yml` |

## Backend Domain Standard

新規機能は技術レイヤー別の共通ディレクトリへ散らさず、ドメイン単位で配置する。

```text
api/modules/<domain>/
  routing.ts       # Hono、validation、HTTP入出力
  service.ts       # use case、業務ルール
  repository.ts    # DB query、永続化
  types.ts         # domain内部型。必要な場合だけ
  index.ts         # domain外への公開面
```

依存方向は `api/app/hono.ts → routing → service → repository → api/db` とする。

- routingはrequest/response、status、cookieをserviceの入出力へ変換する。業務判断やqueryを書かない。
- serviceはHono、Drizzle、DB schemaをimportしない。
- repositoryだけがDB client、Drizzle、`api/db/schema.ts`を参照する。
- DBを使わないdomainにrepositoryを作らない。entity/value objectも規則が存在するときだけ追加する。
- 他domainの内部やrepositoryを直接importせず、`index.ts`の公開面または明示的なportを使う。
- dependencyはcomposition rootで明示的に組み立て、DI containerは追加しない。

## Frontend Domain Standard

```text
web/src/modules/<domain>/
  api.ts           # hc<AppType>による型付きendpoint呼び出し
  hooks/           # React Queryのquery、mutation、cache制御
  components/      # domain専用UI
  views/           # hooksとcomponentsの画面構成
  types.ts         # frontend固有型。必要な場合だけ
  index.ts         # domain外への公開面
```

- route fileはURL、search parameter、guard、view選択だけを持つ。
- 素のAPI呼び出しとReact hookを分離する。componentから直接 `fetch` しない。
- credential、401 refresh、error変換などの共通transportは一箇所に保ち、domain固有APIを共通clientへ集約しない。
- API request/response型を手書きで複製せず、`AppType`と `shared/schemas/` を使う。
- domain専用componentをglobal `components/`へ置かない。複数domainで実際に共有されるUIだけを共通化する。

## Current Migration Boundaries

現在の `api/routes/`、`web/src/domains/`、feature API/hooksを含む `web/src/api.ts` は移行前の配置であり、新規domainの見本にはしない。

- 新規backend domainは最初から `api/modules/<domain>/` 内でrouting/service/repositoryを分ける。
- 既存domainを大きく変更するときは、変更する責務をmodule内へ寄せる。無関係なdomainまで同時移動しない。
- `web/src/api.ts` の共通transportは再利用可能なまま切り出し、feature API/hooksは触れたdomainから `web/src/modules/<domain>/` へ移す。
- 新規frontend domainは `web/src/domains/` ではなく `web/src/modules/<domain>/` に置く。

## Invariants

- `/api/*` はHono、非API pathはVite/static frontendが所有する。
- `requireAuth`で保護されたAPIをfrontend guardだけの保護へ弱めない。
- public pageは要件がない限りlogin必須にしない。
- auth cookie/token処理はauth domainに閉じる。
- DB adapter固有importをserviceへ漏らさない。
- DB default、`.env.example`、Drizzle configの値を一致させる。
- productionでdev用 `JWT_SECRET` を許可しない。secretをrepositoryへ保存しない。
- DB runtimeの違いをmainの巨大なruntime switchにせず、variant branchへ局所化する。

## Verification

| Change | Minimum |
| --- | --- |
| backend logic/API | `bun run typecheck` + 対象Vitest |
| frontend/domain UI | `bun run typecheck && bun run build` + 対象Vitest |
| shared contract | `bun run typecheck` + API/frontend双方の対象Vitest |
| DB runtime/schema/migration | `bun run verify && bun run verify:e2e` |
| build/config/security | `bun run verify` |
| broad template change | `bun run verify:all` |

失敗した検証を省略して完了扱いにしない。無関係な既存失敗がある場合は、実行コマンドと対象外である根拠を報告する。
