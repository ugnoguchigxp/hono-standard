# Hono Standard テンプレート

Hono、Drizzle ORM、React、TanStack Router を活用した、モダンで堅牢、かつ型安全なフルスタック・モノリス ウェブアプリケーションのテンプレートです。

## 目次
- [技術スタック](#技術スタック)
- [クイックスタート](#クイックスタート)
- [主要コマンド](#主要コマンド)
- [主な機能](#主な機能)
- [アーキテクチャ・プロジェクト構成](#アーキテクチャプロジェクト構成)
- [テンプレート保守](#テンプレート保守)
- [セキュリティ](#セキュリティ)
- [ライセンス](#ライセンス)

---

## 技術スタック

### バックエンド
- **コア**: [Hono](https://hono.dev/) (Bun runtime), TypeScript
- **API ドキュメント**: [@hono/zod-openapi](https://github.com/honojs/middleware/tree/main/packages/zod-openapi) (Swagger UI 同梱)
- **ミドルウェア**: CORS, Secure Headers, Timing, logger, rateLimiter, CSRF

### データベース
- **ORM**: [Drizzle ORM](https://orm.drizzle.team/)
- **DB**: SQLite / libSQL (`@libsql/client`)

### フロントエンド
- **フレームワーク**: React 19, Vite
- **ルーティング**: [TanStack Router](https://tanstack.com/router)
- **状態管理/データ取得**: [TanStack Query](https://tanstack.com/query)
- **UI/スタイリング**: Tailwind CSS v4 + `@repo/design-system` (CSS変数テーミング、Pencil 同期)

### テスト・品質管理
- **ユニット/統合テスト**: [Vitest](https://vitest.dev/)
- **E2E テスト**: [Playwright](https://playwright.dev/)
- **静的解析・整形**: [Biome](https://biomejs.dev/)

---

## クイックスタート

### 前提条件
- Bun (v1.3+)

### セットアップ手順

1. **依存関係のインストール**
   ```bash
   bun install
   ```

2. **環境変数の設定**
   ```bash
   cp .env.example .env
   # .env 内の変数を環境に合わせて更新
   ```
   `AUTH_MODE` ごとの必須設定:
   - `local`: OAuth設定は不要
   - `oauth`: `APP_URL` と、`GOOGLE_*` または `GITHUB_*` のどちらか1組が必須
   - `both`: `APP_URL` は必須（OAuthを使う場合は `GOOGLE_*` または `GITHUB_*` のどちらか1組を設定）
   - `COOKIE_SAME_SITE=none` を使う場合は HTTPS (`APP_URL` が `https://...`) であることが必須

   `VITE_ENABLE_MSW=true` を設定すると、開発時に MSW モックを有効化できます（デフォルトは `false`）。
   リバースプロキシ配下（Nginx / Cloudflare など）で動かす場合は `TRUST_PROXY=true` を設定してください。

3. **データベースの初期化**
   ```bash
   bun run db:migrate # 既存マイグレーションを適用
   bun run db:seed   # テストデータの投入
   ```

4. **開発サーバーの起動**
   ```bash
   bun run dev
   ```

アプリケーション、API、ドキュメントはすべて `http://localhost:5173` 経由でアクセス可能です。

---

## 主要コマンド

| コマンド | 説明 |
|---|---|
| `bun run dev` | 開発サーバーの起動 |
| `bun run build` | プロダクションビルド (FE & BE) |
| `bun run start` | Bun でコンパイル済みバックエンドを実行 |
| `bun run test` | Vitest によるテスト実行 |
| `bun run test:e2e` | Playwright による E2E テスト実行 |
| `bun run test:e2e:smoke` | `@smoke` タグ付きE2Eのみ実行 |
| `bun run test:e2e:regression` | `@regression` タグ付きE2Eのみ実行 |
| `bun run test:coverage` | Vitest カバレッジレポート生成 |
| `bun run lint` | Biome によるコードチェック |
| `bun run typecheck` | TypeScript 型チェック |
| `bun run verify` | typecheck / lint / format / test / build を静かな出力で一括実行 |
| `bun run design-system:sync -- <repo-url> [ref]` | 指定した外部 design system repo から `designSystem/` を同期 |
| `bun run design-system:storybook` | Design System の Storybook 起動 |
| `bun run design-system:storybook:build` | Design System の Storybook ビルド |
| `bun run db:generate` | マイグレーションSQLを生成 |
| `bun run db:migrate` | マイグレーションを DB に適用 |
| `bun run db:push` | 開発用途でスキーマを直接反映（本番非推奨） |
| `bun run db:studio` | Drizzle Studio の起動 |
| `bun run db:seed` | シードデータの投入 |

### E2Eタグ運用
- `@smoke`: 主要導線の高速確認用（PRごとに実行推奨）
- `@regression`: 回帰確認用のフルスイート（定期実行/マージ前推奨）

### マイグレーション運用（推奨）
1. スキーマ変更後に `bun run db:generate` で SQL を生成
2. 生成された `drizzle/migrations/*.sql` をレビューしてコミット
3. ローカル・CI・本番で `bun run db:migrate` を実行して適用
4. `bun run db:push` は試作や検証時のみ利用し、本番フローには使わない

---

## 主な機能

- **型安全な API (Hono RPC)**: バックエンドの型定義をフロントエンドで共有。
- **OpenAPI ドキュメント**: `/api/doc` (JSON) と `/api/ui` (Swagger UI) を自動生成。
- **認証システム**: JWT (Access/Refresh) と OAuth 2.0 (Google/GitHub) に対応。
  - `GET /api/auth/methods` で有効なログイン方式（local/OAuth provider）を取得可能。
- **死活監視の分離**: liveness (`/api/health/live`) と readiness (`/api/health/ready`) を提供。
- **パフォーマンスプロファイリング**: `Server-Timing` ヘッダーによる処理時間の可視化。

---

## アーキテクチャ・プロジェクト構成

本プロジェクトはフロントエンドとバックエンドを統合した「モジュラー・モノリス」構造を採用し、ドメインベースでコードを凝集させることでメンテナンス性を高めています。エンドツーエンドの型安全性を実現するため、Hono RPC と Zod スキーマを共有しています。

### ディレクトリ構成

- **`api/` (バックエンド)**
  - `routes/`: Hono / OpenAPI のルーティング、リクエストバリデーション、レスポンスの返却。
  - `services/`: 認証、ユーザー、トークン、OAuth などのビジネスロジック。
  - `db/`, `middleware/`, `lib/`: DB接続、共通ミドルウェア、エラー、ログ、OpenAPI、Cookie、セキュリティ補助。
  - 新しい大きめのドメインを追加する場合は、必要に応じて `api/modules/<domain>/` へ `routes / service / repository` を近接配置します。

- **`src/` (フロントエンド)**
  - `routes/`: TanStack Router によるファイルベースのルーティング。
  - `lib/`: Hono RPC API client、認証 context、共通 utility。
  - `mocks/`: MSW の開発用 mock。
  - 画面が増えて `routes/` だけでは見通しが悪くなった場合は、`src/modules/<domain>/` に components / hooks / repositories / services を近接配置します。

- **`shared/` (共有コード)**
  - `schemas/`: Zod によるバリデーションスキーマ群。フロントエンドの入力検証と、バックエンドの引数検証で全く同じスキーマを再利用することで DRY な設計を実現。

- **`drizzle/`**
  - DBのマイグレーション設定およびシードデータ生成スクリプト。

---

## テンプレート保守

`hono-standard` を複数のテンプレート variant として保守する場合は、[docs/template-variant-management.md](docs/template-variant-management.md) を参照してください。

この repo は NightWorkers などの外部ツールから必要時に clone して使う標準 starter として扱い、利用側 repo にテンプレート本体を vendoring しない方針です。SQLite、PostgreSQL、pgvector などの差分は `variant/*` branch で継続保守し、固定配布点は tag / snapshot で管理します。

---

## セキュリティ

### トークン管理
JWT (Access/Refresh) は `httpOnly Cookie` に保存されます。
- **メリット**: JavaScript から直接参照できないため、トークン窃取系XSSに強い構成です。
- **補足**: CSRF対策として `csrf()` ミドルウェアを併用し、`Origin/Referer` を検証します。

### セキュリティミドルウェア
- **CSRF**: Hono 標準の `csrf()` による Origin/Referer チェック。
- **セキュリティヘッダー**: `Secure Headers` による CSP、HSTS 等の設定（本番では `unsafe-inline` / `unsafe-eval` を無効化）。
- **レート制限**: ブルートフォース攻撃を防ぐための `rateLimiter` (メモリベース) を全 API に適用。
- **CORS**: ワイルドカード不許可の明示オリジン許可リスト方式を採用。

---

## ライセンス
MIT
