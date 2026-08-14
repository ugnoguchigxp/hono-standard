# Project Context: Hono Standard

この文書は、`hono-standard` の構造、主要entrypoint、責務の所在、アーキテクチャ上の境界を要約する参照資料である。タスク固有の進め方、探索手順、実装順序、検証計画、完了条件は扱わない。ただし、Projectが恒常的に提供する正本品質ゲートと、その構成scriptの関係はProject contractとして記載する。

## Repository Profile

- Bun runtime上でHono APIとReact/Vite frontendを同一originから提供するtemplate。
- `variant/pgvector` はPostgreSQL + pgvectorを既定とするvector search基盤variant。
- Backend composition rootは `api/app/hono.ts`、Bun server entryは `api/app/server.ts`。
- Frontend entryは `web/src/main.tsx`、provider構成は `web/src/App.tsx`、route compositionは `web/src/router.tsx`。
- PostgreSQL/Drizzle runtimeのpublic entryは `api/db/index.ts`、vector schemaは `api/db/schema.ts`、migration entryは `api/db/migrate.ts`。
- API contractは `shared/schemas/` のZod schemaと、`api/app/hono.ts`がexportする `AppType`で表現される。

## Project Map

| Path | Responsibility |
| --- | --- |
| `api/app/` | application composition、runtime env、server bootstrap、security headers |
| `api/modules/<domain>/` | backendのservice、domain type、補助ロジック |
| `api/db/` | DB runtime、schema、migration境界 |
| `api/middleware/` | 複数routeに適用されるHono middleware |
| `api/routes/` | Hono route、validation、HTTP request/response変換 |
| `shared/schemas/` | APIとfrontendが共有するvalidation/contract |
| `web/src/domains/<domain>/` | frontendのドメイン固有UIとフォームロジック |
| `web/src/routes/` | URL、search parameter、route guard |
| `web/src/views/` | page-level UI |
| `web/src/styles.css` | Tailwind v4、global token、共通class |
| `drizzle/` | SQL migrations |
| `scripts/` | bootstrap、seed、authless copy生成、build、quality関連script |
| `tests/e2e/` | Playwright browser smoke tests |

## Backend Architecture

Backendはcomposition、HTTP route、domain service、DB境界を分離する。現行baselineで新しいAPI機能を追加するときは、HTTP境界を`api/routes/<domain>.route.ts`へ置き、routeから再利用する業務ロジックを`api/modules/<domain>/`へ置く。

```text
api/routes/<domain>.route.ts
api/modules/<domain>/
  service.ts
  types.ts
  errors.ts
```

| Layer | Responsibility | Main dependencies |
| --- | --- | --- |
| route | Hono route、validation、HTTP request/response、cookie/status変換 | service、shared contract |
| service | use case、業務ルール、ドメイン上の判断 | `api/db/` public contract、domain types |
| DB boundary | query、migration、DB rowとの変換 | `api/db/`、Drizzle、DB schema |

基本の依存方向は `api/app/hono.ts → api/routes → api/modules → api/db`。単純なread-only sampleはrouteから`api/db`を直接利用してもよいが、認証・状態遷移・複数routeで共有する判断はserviceへ置く。新しい`routing.ts`やrepository層を一律には作らない。

## Frontend Architecture

Frontendはroute、page view、ドメイン固有UIを分離する。現行baselineでは共通transportとserver state hookを`web/src/api.ts`、URL/search/guardを`web/src/routes/`、page-level UIを`web/src/views/`、フォームなどのドメイン固有UIを`web/src/domains/<domain>/`へ置く。

```text
web/src/api.ts
web/src/routes/<feature>-route.tsx
web/src/views/<feature>-view.tsx
web/src/domains/<domain>/
```

| Area | Responsibility |
| --- | --- |
| `web/src/api.ts` | `hc<AppType>`を利用する型付きendpoint access、React Query hook、401 refresh |
| `web/src/routes/` | URL、search parameter、route guardとviewの対応 |
| `web/src/views/` | hookとcomponentから構成されるpage-level UI |
| `web/src/domains/` | ドメイン固有のフォーム、表示部品、UIロジック |

route filesはURL/search/guardとviewの対応を表す。共通transportはcredential、401 refresh、error変換を担い、request/response contractは `AppType` と `shared/schemas/` に由来する。

## Current Feature Locations

| Area | Current implementation |
| --- | --- |
| Auth API/session | `api/routes/auth.route.ts`, `api/modules/auth/`, `api/middleware/auth.ts`, `shared/schemas/auth.schema.ts` |
| Vector document API | `api/routes/documents.route.ts`, `api/db/schema.ts`, `drizzle/0002_documents.sql` |
| Protected sample | `api/routes/protected.route.ts`, `shared/schemas/protected.schema.ts`, `web/src/routes/protected-route.tsx`, `web/src/views/protected-view.tsx` |
| Frontend auth state | `web/src/api.ts`, `web/src/auth-context.tsx` |
| Login UI | `web/src/domains/auth/login-domain.tsx`, `web/src/views/login-view.tsx`, `web/src/routes/login-*` |
| App shell/routing | `web/src/App.tsx`, `web/src/router.tsx`, `web/src/routes/root-route.tsx` |
| Showcase | `web/src/views/showcase-view.tsx`, `web/src/showcase-settings-context.tsx`, `web/src/showcase-table-search.ts`, `web/src/styles.css` |
| PostgreSQL/pgvector | `api/db/index.ts`, `api/db/schema.ts`, `api/db/migrate.ts`, `drizzle/`, `docker-compose.yml` |
| Runtime configuration | `api/app/env.ts`, `api/config/appDefaults.ts`, `.env.example`, `drizzle.config.ts` |

## Placement Contract

- Backendの新規Hono routeは`api/routes/`へ置き、`api/app/hono.ts`で登録する。
- Backendの共有業務ロジックは`api/modules/<domain>/`へ置く。
- Frontendの共通API transport / hookは、規模が小さい間は`web/src/api.ts`へ追加する。
- Frontendのrouteとpage viewは`web/src/routes/`、`web/src/views/`へ分ける。
- 1ファイルが複数の独立したfeatureを抱える段階になった場合だけ、別タスクでmodule境界を導入し、この文書とREADMEを同時に更新する。

## Verification Contract

- 正本品質ゲートは`bun run verify`であり、typecheck、Biome lint/format check、Vitest unit/contract/integration test、coverage threshold、production buildを内包する。
- 内包scriptを事前検証として重ねず、失敗工程の診断・修正に限って個別commandを使う。source変更後は`bun run verify`全体を再実行し、その成功だけを完了の証跡とする。
- `bun run format`は修正操作であり検証証跡ではない。E2Eは通常の`verify`に含めず、要求された場合だけ`bun run verify:e2e`または`bun run verify:all`を使う。

## Variant Boundary

DB driver、migration、deploy runtime、RAG/AI機能、SSR/SSGの差分は `variant/*` または `overlay/*` branchに分かれる。各branchでは `api/db/`、runtime entry、固有module、build entryの構成がこのbaselineと異なる。

variantの管理方法と配布形式は `docs/template-variant-management.md`、起動方法とpackage scriptsは `README.md` と `package.json` に記載されている。
