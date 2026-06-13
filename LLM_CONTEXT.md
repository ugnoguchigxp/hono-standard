# LLM Context: Hono Standard RAG

この文書は、`variant/rag` をテンプレートとして clone した直後に、広い構造確認をせず作業の入口を決めるための圧縮コンテキストです。

README は人間向けの説明です。通常の実装作業では、この文書で作業領域を絞ってから必要なファイルだけを読むと十分です。

## Repository Snapshot

- Bun + Hono backend と React + Vite frontend を持つ RAG application template。
- DB は PostgreSQL。Drizzle schema は `src/db/schema.ts`、migration は `drizzle/`。
- Backend app composition は `src/app/hono.ts`、server bootstrap は `src/app/server.ts`。
- Frontend entry は `web/src/App.tsx`、API client は `web/src/api.ts`。
- RAG core は `src/core/`、retrieval は `src/modules/rag/`、agentic search は `src/modules/agentic-search/`。
- Auth は admin/user login 前提。ログイン UI は `web/src/domains/auth/login-domain.tsx`。
- Wiki/Markdown source handling は `src/modules/sources/` と `wiki-knowledge/`。
- Package manager / runtime は Bun。dev server は Bun runtime で Vite を起動する。

## Top-Level Map

| Path | Role |
| --- | --- |
| `src/app/hono.ts` | Hono app composition, middleware, route mounting |
| `src/app/server.ts` | Bun server bootstrap |
| `src/config/` | Environment defaults and parsing |
| `src/db/` | PostgreSQL connection and Drizzle schema |
| `src/routes/` | HTTP API route modules |
| `src/modules/auth/` | Auth service, cookies, tokens, password hashing |
| `src/modules/rag/` | Retrieval and search evidence logic |
| `src/modules/agentic-search/` | Agentic search runner, tools, LLM adapters |
| `src/modules/sources/` | Markdown/wiki source import, blob sync, content repo |
| `web/src/App.tsx` | React app shell and authenticated workspace routing |
| `web/src/api.ts` | Browser API client, auth refresh, unauthorized event handling |
| `web/src/domains/auth/` | Login UI |
| `web/src/domains/chat/` | Chat workspace UI |
| `web/src/domains/knowledge/` | Knowledge workspace UI |
| `web/src/domains/search/` | Search UI |
| `drizzle/` | PostgreSQL migrations |
| `scripts/verify.ts` | Variant verification pipeline |

## Task Routing

| Task | Start here | Usually also read | Defer unless touched |
| --- | --- | --- | --- |
| Change auth/login | `src/routes/auth.route.ts`, `src/modules/auth/`, `web/src/domains/auth/login-domain.tsx`, `web/src/api.ts` | auth tests | RAG retrieval modules |
| Change RAG retrieval | `src/modules/rag/`, `src/repositories/RagRepository.ts` | `src/core/RagEngine.ts`, search tests | admin UI |
| Change agentic search | `src/modules/agentic-search/` | provider adapter tests, tool registry | auth UI |
| Change chat | `src/routes/chat.route.ts`, `src/modules/chat/`, `web/src/domains/chat/` | artifacts module | source import |
| Change wiki/markdown import | `src/modules/sources/`, `src/cli/import-markdown.ts`, `src/cli/wiki-*` | `wiki-knowledge/` sample files | login UI |
| Change admin users | `src/routes/admin-users.route.ts`, `web/src/admin-user-management.tsx` | auth service | RAG retrieval |
| Change env/config | `src/config/readEnv.ts`, `src/config/appDefaults.ts`, `.env.example` | affected route/service tests | frontend domains not using it |
| Change build/dev tooling | `package.json`, `vite.config.ts`, `tsup.config.ts`, `vitest.config.ts` | failing config-specific tests | app features |

## Implementation Contracts

- Do not treat this branch as the minimal SQLite starter. This is the RAG app template.
- PostgreSQL is required for normal RAG operation; keep DB changes aligned with `src/db/schema.ts` and `drizzle/`.
- API unauthorized handling is centralized in `web/src/api.ts`; initial `/api/auth/me` checks should not show session-expired UI.
- Auth cookies and tokens live under `src/modules/auth/`; frontend auth state lives in `web/src/App.tsx`.
- Agentic search tools must stay registered through `src/modules/agentic-search/tools/registry.ts`.
- Fetch-heavy LLM behavior should be guided through indexed wiki/search tools before broad fetches.
- Keep provider-specific secrets in env only; do not hard-code OpenAI/Azure/Web Search credentials.

## Verification Matrix

| Change type | Minimum useful verification |
| --- | --- |
| Auth/login | targeted auth tests plus browser login check |
| RAG retrieval | `src/modules/rag/*.test.ts` and search evidence tests |
| Agentic search | `src/modules/agentic-search/*.test.ts` and tool tests |
| Markdown/wiki import | source module tests plus import CLI smoke if data changes |
| Frontend domain UI | browser smoke for the affected workflow |
| Broad template change | `bun run verify` |

## Commands

| Command | Purpose |
| --- | --- |
| `bun install` | Install dependencies |
| `bun run dev` | Start Vite + Hono dev server with Bun runtime |
| `bun run typecheck` | TypeScript check |
| `bun run test` | Vitest test suite |
| `bun run build` | Server and web build |
| `bun run verify` | Variant verification pipeline |
| `bun run db:migrate` | Apply PostgreSQL migrations |
| `bun run auth:create-admin -- --email <email>` | Create admin user |
| `bun run db:seed:users -- <file>` | Seed users from JSON |

## Expensive Areas

- `src/modules/agentic-search/**`: read when changing LLM/tool behavior.
- `src/modules/sources/wiki/**`: read when changing wiki storage, indexing, or markdown source behavior.
- `wiki-knowledge/**`: sample corpus; inspect only when source data or retrieval examples matter.
- `web/src/knowledge-workspace.tsx`: large UI surface; read only for knowledge workspace changes.
- `drizzle/**`: read for DB schema/migration changes.

## Clone Adaptation Checklist

- Configure `DATABASE_URL` for PostgreSQL.
- Configure `JWT_SECRET`, `APP_URL`, and `CORS_ORIGINS`.
- Create an admin user before expecting UI login.
- Configure Azure OpenAI or OpenAI provider env before running embedding/agentic workflows.
- Decide whether wiki storage is local or Azure Blob.
- Replace or remove sample `wiki-knowledge/` content.
