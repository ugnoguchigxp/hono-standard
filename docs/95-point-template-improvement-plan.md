# 95-Point Template Improvement Plan

この計画は `hono-standard` を Hono + React + Vite + Bun + Drizzle ベースの再利用可能なテンプレートとして、現状の 86 点相当から 95 点以上へ引き上げるための実装計画です。

## Goals

- GitHub template / branch variant / archive snapshot として安全に再利用できる状態にする。
- Drizzle 前提を維持したまま、SQLite / Turso / PostgreSQL variant を作りやすくする。
- DI コンテナは導入せず、composition root と明示的な dependency object で依存を注入できる形にする。
- `verify` がテンプレート品質を実際に保証する状態にする。
- 初回導入、本番起動、variant 選択、auth あり/なしの判断を README と docs だけで追える状態にする。

## Non-Goals

- SSR / RSC / SSG の導入。
- ORM の抽象化や Drizzle 以外への対応。
- multi-tenant、RBAC 本格化、OAuth provider 追加。
- 全 DB variant を `main` の runtime config だけで動的に切り替える万能実装。
- DI コンテナ導入。
- product 固有の画面、seed、branding、業務ドメイン追加。

## Baseline

現状で確認済みの強み:

- `bun run verify` は typecheck / lint / format / test / build を通す。
- Hono dev server と Vite が同一 origin で統合されている。
- `AppType` と `hono/client` による API 型共有がある。
- Drizzle + SQLite の auth user / refresh token 保存がある。
- httpOnly Cookie、refresh rotation、CORS、CSRF、CSP が入っている。
- `docs/template-variant-management.md` に branch / tag / snapshot の方針がある。

主な不足:

- SQLite 実装が app / CLI / service 層に直接見えている。
- coverage threshold はあるが `verify` で実行されていない。
- E2E smoke test がない。
- production runtime / migration / deploy 前提の README が薄い。
- package / archive / GitHub template の配布方針が明確でない。
- Turso / PostgreSQL variant が満たす contract が未定義。

## Architecture Direction

### Lightweight Dependency Injection

DI コンテナは使わず、依存は composition root で組み立てて明示的に渡す。

目標形:

```ts
export type AppDeps = {
  env: AppEnv;
  dbRuntime: DbRuntime;
  authService: AuthService;
};

export async function createApp(deps = await createDefaultAppDeps()) {
  const app = new Hono();
  // middleware and routes receive deps explicitly.
  return app;
}
```

`api/app/hono.ts` は「app を組み立てる場所」に寄せ、driver 固有実装は直接 import しない。

### Drizzle Variant Boundary

`main` は SQLite baseline のままにする。ただし呼び出し口を揃え、variant branch で差し替える範囲を限定する。

共通にしたい契約:

```ts
export type DbRuntime = {
  db: AppDatabase;
  close: () => void | Promise<void>;
};

export function createDbRuntime(env: AppEnv): DbRuntime {
  return createSqliteDbRuntime(env);
}
```

variant ごとの差分:

| Variant | 差し替え対象 | 共通維持 |
| --- | --- | --- |
| `variant/sqlite` | `api/db/sqlite.ts`, SQLite migration runner, `drizzle.config.ts` sqlite dialect | app/routes/auth API contract |
| `variant/turso` | libSQL client, Turso env, migration workflow, local fallback | app/routes/auth API contract |
| `variant/postgres` | postgres driver, pg schema, pg migration workflow, Docker compose | app/routes/auth API contract |
| `variant/pgvector` | postgres + pgvector schema/migration, vector-specific docs | base app/auth contract |

無理に `main` で全 driver を runtime switch しない。variant branch は driver / schema / migration / docs / smoke test を責務として持つ。

## Implementation Plan

### A1. Define App Dependency Boundary

変更内容:

- `api/app/hono.ts` の app composition を `createApp(deps)` に寄せる。
- default runtime 作成を `createDefaultAppDeps()` に分離する。
- route factory は既存通り dependency object を受け取る形を維持する。

変えないこと:

- route path、response shape、auth cookie behavior。
- Hono / Vite dev server の入口。

確認方法:

```bash
bun run verify
```

期待結果:

- typecheck / lint / format / test / build が成功する。
- 既存 API route tests が通る。

失敗時対応:

- Hono app の default export と test import の互換性を優先して修正する。

### A2. Introduce DbRuntime Boundary

変更内容:

- `api/db/index.ts` に `DbRuntime` と `createDbRuntime(env)` を定義する。
- SQLite 固有処理を `api/db/sqlite.ts` へ移す。
- `createDbConnection(databasePath)` は SQLite helper として残すか、compat export にする。

変えないこと:

- `DATABASE_URL=sqlite.db` の baseline behavior。
- Drizzle schema の内容。

確認方法:

```bash
bun run test -- api/db/path.test.ts api/app/env.test.ts api/app/hono.test.ts
bun run verify
```

期待結果:

- SQLite file path validation が維持される。
- Hono runtime が SQLite db を作成できる。

失敗時対応:

- まず public exports の互換性を戻し、内部移動だけに縮小する。

### A3. Reduce Driver-Specific Types in Domain Services

変更内容:

- auth service / token service が `BunSQLiteDatabase<typeof schema>` を直接要求しないよう `AppDatabase` type alias を作る。
- driver 固有 import を `api/db` 境界へ寄せる。
- 必要なら refresh token 操作を小さな repository に切り出す。

変えないこと:

- Drizzle query builder の利用。
- refresh token rotation の挙動。

確認方法:

```bash
bun run test -- api/modules/auth
bun run verify
```

期待結果:

- auth service / token service tests が成功する。
- service 層の import に SQLite driver 型が出ない。

失敗時対応:

- repository 分離を最小化し、まず type alias 化だけで成立させる。

### A4. Make Verify Enforce Coverage

変更内容:

- `test:coverage` script を追加する。
- `scripts/verify.ts` に coverage step を追加する。
- coverage 対象外にするファイルは理由が明確なものだけに限定する。

変えないこと:

- 既存 threshold の 80% 方針。

確認方法:

```bash
bun run test:coverage
bun run verify
```

期待結果:

- coverage threshold を満たす。
- `verify` が coverage 失敗を検出できる。

失敗時対応:

- threshold を安易に下げず、未テストの重要 path を追加する。

### A5. Add E2E Smoke Tests

変更内容:

- Playwright を導入する。
- smoke test を追加する。
  - app starts.
  - home renders.
  - login page renders.
  - unauthenticated `/protected` shows login-required state.
  - login succeeds with created admin.
  - protected page calls server protected API.
  - logout clears session.

変えないこと:

- E2E で過剰な visual regression をしない。
- product 固有 fixture を入れない。

確認方法:

```bash
bun run test:e2e
bun run verify
```

期待結果:

- fresh local SQLite で smoke test が通る。
- verify に E2E を含めるか、少なくとも `verify:e2e` として明示される。

失敗時対応:

- まず smoke 範囲を login/protected の最小導線に絞る。

### A6. Clarify Distribution Mode

変更内容:

- `package.json` の `files` を見直す。
- GitHub template / tag clone / archive snapshot を主配布とするなら、npm package 配布ではないことを README に明記する。
- npm package としても配るなら `api`, `web`, `shared`, `scripts`, `drizzle`, config files を含める。

推奨:

- この repo は GitHub template / branch variant / archive snapshot を主配布とする。
- `files` は削除するか、npm publish を非目標として明記する。

確認方法:

```bash
bun pm pack
tar -tzf *.tgz | head
```

期待結果:

- 配布方針と成果物内容が矛盾しない。

失敗時対応:

- npm package 配布を非目標に戻し、README と package metadata を整理する。

### B1. Document Variant Contract

変更内容:

- `docs/template-variant-management.md` に variant contract を追加する。
- SQLite / Turso / PostgreSQL が満たすべき共通項目を定義する。

contract:

- `bun install --frozen-lockfile`
- `bun run bootstrap` または variant 固有 bootstrap
- `bun run db:migrate`
- `bun run verify`
- auth admin creation
- login/protected smoke
- production start command documented

確認方法:

```bash
bun run verify
```

期待結果:

- docs に各 variant の完了条件が明記される。

失敗時対応:

- contract を実装済み baseline と将来 variant の must/should に分ける。

### B2. Split Migration Runner Responsibility

変更内容:

- SQLite migration runner と共通 CLI の責務を分ける。
- `api/cli/migrate.ts` は `runMigrations(env)` を呼ぶだけに寄せる。
- SQLite implementation は `api/db/migrate-sqlite.ts` に置く。

変えないこと:

- `bun run db:migrate` のコマンド名。
- `drizzle/*.sql` の baseline migration。

確認方法:

```bash
bun run db:migrate
bun run verify
```

期待結果:

- migration が idempotent に成功する。
- variant branch で migration runner を差し替えやすい。

失敗時対応:

- CLI entrypoint の互換性を戻し、内部関数分離だけにする。

### B3. Pin Dependency Versions

変更内容:

- `^` 付き dependency を固定 version にする。
- lockfile を更新する。

確認方法:

```bash
bun install --frozen-lockfile
bun run verify
```

期待結果:

- lockfile と package manifest が一致する。
- clean install で再現性がある。

失敗時対応:

- 依存解決が壊れる package だけ個別に調整する。

### B4. Improve Runtime Documentation

変更内容:

- README に production runtime 手順を追加する。
- `JWT_SECRET`, `APP_URL`, `AUTH_COOKIE_SECURE`, `SECURITY_HEADERS_MODE`, SQLite persistence path を説明する。
- migration を start 前に実行することを明記する。

確認方法:

```bash
bun run build
bun run db:migrate
NODE_ENV=production JWT_SECRET=<32+ chars> bun run start
```

期待結果:

- README だけで production 起動の最低条件が分かる。

失敗時対応:

- production 手順を SQLite baseline に限定して書き直す。

### B5. Add Template Usage Recipes

変更内容:

- README または docs に次を追加する。
  - clone 後 checklist。
  - protected API / protected page の追加方法。
  - shared schema 追加の流れ。
  - auth を使わない場合の削除対象。

確認方法:

```bash
bun run verify
```

期待結果:

- docs 変更のみでも verify が通る。
- 利用者が route/API/schema の追加点を追える。

失敗時対応:

- README が肥大化する場合は `docs/usage-recipes.md` へ分ける。

### C1. Add CI Workflow

変更内容:

- GitHub Actions で Bun install と `bun run verify` を実行する。
- 必要に応じて E2E を別 job にする。

確認方法:

```bash
bun run verify
```

期待結果:

- local verify と CI verify が同じ成功条件を持つ。

失敗時対応:

- E2E が CI で不安定な場合は smoke job を分離する。

### C2. Add Docker / Compose Sample

変更内容:

- SQLite baseline を local で試すための Dockerfile / compose sample を追加する。
- PostgreSQL variant の compose は variant branch 側に持たせる。

確認方法:

```bash
docker compose up --build
```

期待結果:

- app が起動し、persistent volume が使われる。

失敗時対応:

- baseline では Docker を optional docs に留める。

### C3. Add README Screenshots

変更内容:

- Home / Login / Protected / Showcase のスクリーンショットを追加する。
- 生成物の保存先と更新手順を docs に書く。

確認方法:

```bash
bun run test:e2e
```

期待結果:

- README でテンプレートの画面イメージが分かる。

失敗時対応:

- スクリーンショットは release asset か docs image として最小限にする。

### C4. Add Dev-Only Seed Flow

変更内容:

- demo admin 作成を dev-only helper として整理する。
- production では demo credential を作らない。

確認方法:

```bash
bun run bootstrap
bun run auth:create-admin -- --email admin@example.com --name "Admin User"
```

期待結果:

- 初回体験が明確で、production に demo user が混ざらない。

失敗時対応:

- helper を追加せず、README recipe のみに留める。

## Suggested Execution Order

1. A1: app dependency boundary
2. A2: `DbRuntime` boundary
3. A3: remove driver-specific service type leakage
4. B2: migration runner split
5. B1: variant contract docs
6. A4: coverage gate
7. A5: E2E smoke tests
8. A6: distribution mode clarification
9. B3: dependency pinning
10. B4: production runtime docs
11. B5: template usage recipes
12. C1: CI workflow
13. C2: Docker / compose sample
14. C3: screenshots
15. C4: dev-only seed flow

## Final Acceptance Criteria

- `bun run verify` succeeds from a clean checkout.
- `bun run test:coverage` is included in `verify` and passes thresholds.
- E2E smoke test verifies login and protected route behavior.
- app composition accepts explicit dependencies without a DI container.
- SQLite driver implementation is isolated behind `DbRuntime`.
- service/domain code does not import SQLite driver-specific database types directly.
- migration CLI has a variant-replaceable implementation boundary.
- README explains setup, production runtime, template usage, and distribution mode.
- `docs/template-variant-management.md` defines SQLite / Turso / PostgreSQL variant contract.
- optional C items are either implemented or explicitly documented as optional with clear follow-up scope.
