# Implementation Context: Hono Standard

この文書はリポジトリ一覧ではなく、実装開始用の索引である。構成確認だけを目的とした `pwd`、`ls`、`find`、`rg --files`、`package.json` の読み直しは原則不要。タスクに対応する Working Set から対象、近接テスト、直接依存を読み、実装へ進む。

記載パスが存在しない、横断変更を行う、新しい基盤を追加する場合だけ対象を限定して探索する。文書とコードが矛盾するときはコードを正とし、同じ変更でこの文書も直す。

## Runtime

- `variant/rag`。Bun + Hono API + React/Vite frontend、PostgreSQL + pgvectorを基盤に、source ingestion、hybrid retrieval、chat、agentic search、artifact、wiki連携を提供する。
- API composition rootは `api/app/hono.ts`、Bun server entryは `api/app/server.ts`。
- Frontend entryは `web/src/main.tsx`、providerは `web/src/App.tsx`、route compositionは `web/src/router.tsx`。
- PostgreSQL/Drizzle runtimeは `api/db/index.ts`、vector/RAG schemaは `api/db/schema.ts`、migration資産は `drizzle/`。migration実行経路を変えるときは `api/cli/migrate.ts` と `api/db/migrate*.ts` を一緒に確認する。
- API契約は `shared/schemas/` のZod schemaと、`api/app/hono.ts`がexportする `AppType` を共有する。
- package manager/runtimeはBun。通常の品質ゲートは `bun run verify`。

## Implementation Map

| Path | 実装上の役割 |
| --- | --- |
| `api/app/hono.ts` | middleware、依存生成、domain routeのmount、`AppType` export |
| `api/modules/<domain>/` | backendの新規ドメイン実装 |
| `api/modules/sources/` | source repository、Markdown/wiki ingestion |
| `api/modules/rag/` | retrievalとsearch evidence |
| `api/modules/chat/` | chat use case |
| `api/modules/agentic-search/` | runner、LLM adapter、tool registry |
| `api/modules/artifacts/`, `api/modules/settings/` | artifact parsingとsettings persistence |
| `api/providers/` | embedding、LLM、外部provider adapter |
| `api/db/` | PostgreSQL + pgvector runtime、schema、migration境界 |
| `api/middleware/auth.ts` | access token認証 |
| `shared/schemas/` | APIとfrontendが共有するvalidation/contract |
| `web/src/modules/<domain>/` | frontendの新規ドメイン実装 |
| `web/src/domains/chat/`, `knowledge/`, `search/` | 現行RAG frontend domain UI |
| `web/src/styles.css` | Tailwind v4、global token、既存component class |
| `scripts/verify.ts` | `bun run verify` の実行内容 |
| `tests/e2e/` | タスクと実行環境が適合するときだけ使うbrowser smoke test |

生成物、coverage、report、local DBは実装対象ではない。通常は探索も編集もしない。

## Working Sets

最初に「Start」を読み、必要になった直接依存だけへ広げる。同階層の `*.test.ts(x)` は実装と同時に確認する。

| Task | Start | Add when needed |
| --- | --- | --- |
| 新しいbackend domain | `api/app/hono.ts`, `api/modules/<domain>/`, `shared/schemas/` | `api/db/schema.ts`, `drizzle/`（永続化時のみ） |
| Auth/admin | `api/routes/auth.route.ts`, `api/routes/admin-users.route.ts`, `api/modules/auth/`, `api/middleware/auth.ts` | `shared/schemas/auth.schema.ts`, `web/src/api.ts`, `web/src/admin-user-management.tsx` |
| Source ingestion/wiki | `api/modules/sources/`, `api/routes/sources.route.ts` | `api/cli/import-markdown.ts`, `api/modules/sources/wiki/`, `api/providers/` |
| Retrieval/search | `api/modules/rag/`, `api/routes/search.route.ts`, `shared/schemas/rag.schema.ts` | `api/db/schema.ts`, `api/providers/`, `web/src/domains/search/` |
| Chat | `api/modules/chat/`, `api/routes/chat.route.ts`, `api/modules/rag/search-evidence.ts` | `api/providers/`, `web/src/domains/chat/` |
| Agentic search | `api/modules/agentic-search/`, `api/routes/agentic-search.route.ts` | `api/modules/settings/`, `api/providers/`, `web/src/agentic-markdown.ts` |
| Artifact/settings | `api/modules/artifacts/`, `api/modules/settings/`, `api/routes/artifacts.route.ts`, `api/routes/settings.route.ts` | `api/db/schema.ts`, `web/src/knowledge-workspace.tsx` |
| RAG frontend | `web/src/domains/chat/`, `web/src/domains/knowledge/`, `web/src/domains/search/`, `web/src/api.ts` | `web/src/router.tsx`, `web/src/knowledge-workspace.tsx`, `web/src/showcase.css` |
| DB/schema/migration | `api/db/index.ts`, `api/db/schema.ts`, `api/db/migrate*.ts`, `api/cli/migrate.ts`, `drizzle/` | repository、`docker-compose.yml`, `drizzle.config.ts` |
| Env/provider | `api/app/env.ts`, `api/providers/`, `.env.example` | settings、Docker、Viteのうち変更値を消費する箇所だけ |
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
- retrieval結果はsource/chunkの根拠を保持し、LLM生成結果だけを検索事実として扱わない。
- provider SDKをroutingやdomain UIへ直接漏らさず、adapter境界に閉じる。
- DB default、`.env.example`、Drizzle configの値を一致させる。
- productionでdev用 `JWT_SECRET` を許可しない。secretをrepositoryへ保存しない。
- DB runtimeの違いをmainの巨大なruntime switchにせず、variant branchへ局所化する。

## Verification

| Change | Minimum |
| --- | --- |
| backend logic/API | `bun run typecheck` + 対象Vitest（必須） |
| frontend/domain UI | `bun run typecheck && bun run build` + 対象Vitest（必須） |
| shared contract | `bun run typecheck` + API/frontend双方の対象Vitest（必須） |
| ingestion/retrieval/chat/agentic | `bun run typecheck` + 対象Vitest（必須）。経路横断時は `bun run verify` |
| DB runtime/schema/migration | `bun run verify` + 対象repository/migrationのVitest |
| build/config/security | `bun run verify` |
| broad template change | `bun run verify` |

変更対象に対応するUnitテストは必須。既存テストがなければ、業務ロジック、変換、validation、repositoryの振る舞いを検証するテストを追加する。

E2Eは通常の完了条件にしない。ユーザーが求めた場合、または変更がbrowser/API/DBを横断し、必要な実行環境も利用できる場合だけ `bun run verify:e2e` を行う。実行できない場合は未実施理由とUnit/typecheck/buildの結果を報告し、E2E未実施だけをblockerにしない。`bun run verify:all` はE2Eを行うと判断した場合だけ使う。

選択した検証が失敗した場合は省略して完了扱いにしない。無関係な既存失敗がある場合は、実行コマンドと対象外である根拠を報告する。
