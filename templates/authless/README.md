# Hono Standard Authless Baseline

Hono APIとReact/Vite frontendを同一originで配信する、認証・protected sample・component showcaseを含まないTurso/libSQL baselineです。

## Setup

```bash
bun run bootstrap
bun run dev
```

## Verification

```bash
bun run audit
bun run verify
bun run verify:e2e
```

`verify`はtypecheck、lint、format check、Vitest、95% coverage、production buildを実行します。`verify:e2e`はpublic homeと`/api/health`を確認します。

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | liveness endpoint |

新しいAPIは`api/routes/`に置いて`api/app/hono.ts`へ登録し、共有contractが必要になった時点で`shared/schemas/`へ追加します。application tableは`api/db/schema.ts`と`drizzle/*.sql`へ追加してください。

## Docker

```bash
docker compose up --build
```

containerは非root userで実行し、`/api/health`をDocker HEALTHCHECKに利用します。local libSQL fileは`./data`へ永続化されます。
