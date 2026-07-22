# Project Context: Hono Standard

この文書は、`hono-standard` の構造、主要entrypoint、責務の所在、アーキテクチャ上の境界を要約する参照資料である。タスクの進め方、エージェントの探索手順、実装順序、検証条件、完了条件は扱わない。

## Repository Profile

- Bun runtime上でHono APIとReact/Vite frontendを同一originから提供するtemplate。
- `variant/rag` はPostgreSQL + pgvectorを基盤に、source ingestion、hybrid retrieval、chat、agentic search、artifact、wiki連携を含む。
- Backend composition rootは `api/app/hono.ts`、Bun server entryは `api/app/server.ts`。
- Frontend entryは `web/src/main.tsx`、provider構成は `web/src/App.tsx`、route compositionは `web/src/router.tsx`。
- PostgreSQL/Drizzle runtimeは `api/db/index.ts`、vector/RAG schemaは `api/db/schema.ts`、migration assetsは `drizzle/` に配置される。
- API contractは `shared/schemas/` のZod schemaと、`api/app/hono.ts`がexportする `AppType`で表現される。

## Project Map

| Path | Responsibility |
| --- | --- |
| `api/app/` | application composition、runtime env、server bootstrap、security headers |
| `api/modules/<domain>/` | backendのドメイン単位の実装 |
| `api/modules/sources/` | source persistence、Markdown/wiki ingestion |
| `api/modules/rag/` | retrieval、search evidence |
| `api/modules/chat/` | chat use cases |
| `api/modules/agentic-search/` | runner、LLM adapter、tool registry |
| `api/modules/artifacts/`, `api/modules/settings/` | artifact parsing、settings persistence |
| `api/providers/` | embedding、LLM、外部provider adapters |
| `api/db/` | DB runtime、schema、migration境界 |
| `api/middleware/` | 複数routeに適用されるHono middleware |
| `api/routes/` | 現行実装に残るHono route modules |
| `shared/schemas/` | APIとfrontendが共有するvalidation/contract |
| `web/src/modules/<domain>/` | frontendのドメイン単位の実装領域 |
| `web/src/router.tsx` | frontend route composition |
| `web/src/domains/chat/`, `knowledge/`, `search/` | 現行RAG frontend domains |
| `web/src/knowledge-workspace.tsx` | knowledge workspace composition |
| `web/src/styles.css` | Tailwind v4、global token、共通class |
| `drizzle/` | SQL migrations |
| `scripts/` | bootstrap、seed、build、quality関連script |
| `tests/e2e/` | Playwright browser smoke tests |

## Backend Architecture

Backendはドメイン指向のmodular monolithとして構成される。ドメイン実装の配置単位は `api/modules/<domain>/` で、永続化を持つドメインは次の3層で表現される。

```text
api/modules/<domain>/
  routing.ts
  service.ts
  repository.ts
  types.ts
  index.ts
```

| Layer | Responsibility | Main dependencies |
| --- | --- | --- |
| routing | Hono route、validation、HTTP request/response、cookie/status変換 | service、shared contract |
| service | use case、業務ルール、ドメイン上の判断 | repository、domain types |
| repository | query、永続化、DB rowとの変換 | `api/db/`、Drizzle、DB schema |

基本の依存方向は `api/app/hono.ts → routing → service → repository → api/db`。`index.ts`はドメイン外へ公開する境界を表す。DBを持たないドメインではrepository層は存在しない。

## Frontend Architecture

Frontendのドメイン実装領域は `web/src/modules/<domain>/` で、APIアクセス、server state、ドメインUIを同じ機能境界にまとめる構成を取る。

```text
web/src/modules/<domain>/
  api.ts
  hooks/
  components/
  views/
  types.ts
  index.ts
```

| Area | Responsibility |
| --- | --- |
| `api.ts` | `hc<AppType>`を利用する型付きendpoint access |
| `hooks/` | React Queryのquery、mutation、cache state |
| `components/` | ドメイン固有UI |
| `views/` | hooksとcomponentsから構成されるpage-level UI |
| `index.ts` | ドメイン外へ公開するfrontend API |

route filesはURL/search/guardとviewの対応を表す。共通transportはcredential、401 refresh、error変換を担い、request/response contractは `AppType` と `shared/schemas/` に由来する。

## Current Feature Locations

| Area | Current implementation |
| --- | --- |
| Auth/admin | `api/routes/auth.route.ts`, `api/routes/admin-users.route.ts`, `api/modules/auth/`, `api/middleware/auth.ts`, `shared/schemas/auth.schema.ts` |
| Source ingestion/wiki | `api/modules/sources/`, `api/routes/sources.route.ts`, `api/cli/import-markdown.ts` |
| Retrieval/search | `api/modules/rag/`, `api/routes/search.route.ts`, `shared/schemas/rag.schema.ts` |
| Chat | `api/modules/chat/`, `api/routes/chat.route.ts`, `web/src/domains/chat/` |
| Agentic search | `api/modules/agentic-search/`, `api/routes/agentic-search.route.ts`, `web/src/agentic-markdown.ts` |
| Artifact/settings | `api/modules/artifacts/`, `api/modules/settings/`, `api/routes/artifacts.route.ts`, `api/routes/settings.route.ts` |
| Knowledge frontend | `web/src/domains/knowledge/`, `web/src/domains/search/`, `web/src/knowledge-workspace.tsx`, `web/src/api.ts` |
| PostgreSQL/pgvector | `api/db/index.ts`, `api/db/schema.ts`, `api/db/migrate*.ts`, `api/cli/migrate.ts`, `drizzle/` |
| Runtime/provider configuration | `api/app/env.ts`, `api/providers/`, `.env.example`, `drizzle.config.ts` |

## Current Layout Notes

現在のコードには、ドメイン配置へ移行する以前の構造が残っている。

- Hono routingの一部は `api/routes/` に配置されている。
- Auth serviceは `api/modules/auth/` にある一方、routingは `api/routes/auth.route.ts` に分かれている。
- Frontendの機能UIは `web/src/domains/auth/`, `chat/`, `knowledge/`, `search/` とworkspace componentに配置されている。
- `web/src/api.ts` は共通transportとfeature固有API/hooksの両方を含む。

これらは現在の実装配置を示すもので、`api/modules/<domain>/` と `web/src/modules/<domain>/` がドメイン単位のアーキテクチャ境界として定義されている。

## Variant Boundary

DB driver、migration、deploy runtime、RAG/AI機能、SSR/SSGの差分は `variant/*` または `overlay/*` branchに分かれる。各branchでは `api/db/`、runtime entry、固有module、build entryの構成がこのbaselineと異なる。

variantの管理方法と配布形式は `docs/template-variant-management.md`、起動方法とpackage scriptsは `README.md` と `package.json` に記載されている。
