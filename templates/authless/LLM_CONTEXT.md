# Project Context: Hono Standard Authless Baseline

- Bun runtime上でHono APIとReact/Vite frontendを同一originから提供する。
- Backend composition rootは`api/app/hono.ts`、server entryは`api/app/server.ts`。
- Frontend entryは`web/src/main.tsx`、route compositionは`web/src/router.tsx`。
- DB public entryとTurso/libSQL runtimeは`api/db/index.ts`、application schemaは`api/db/schema.ts`。
- auth、protected route、login UI、component showcaseは含まない。

## Placement Contract

- Hono routeは`api/routes/`へ置き、`api/app/hono.ts`で登録する。
- 共有する業務ロジックは`api/modules/<domain>/`へ置く。
- API request / responseをfrontendと共有するときは`shared/schemas/`へZod schemaを追加する。
- Frontend routeは`web/src/routes/`、page UIは`web/src/views/`へ置く。
- DB変更は`api/db/schema.ts`と`drizzle/*.sql`を同時に更新する。

## Verification Contract

- source変更後の正本品質ゲートは`bun run verify`。
- dependency vulnerabilityは`bun run audit`。
- browser smokeは`bun run verify:e2e`。
