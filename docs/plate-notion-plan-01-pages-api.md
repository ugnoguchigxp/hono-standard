# 実装計画 01: ページのデータモデル・API・認可

状態: 未実装。Grok / Muse へはこのファイル全体を渡し、完了条件まで実行させる。

前提: `codex/plate-notion-app` ブランチ、[コンセプト](./plate-notion-concept.md)
対象: バックエンドと共有スキーマ。画面・Plate・TanStack Query の実装は後続計画。

## この計画のゴール

ログイン済みユーザーが、自分のページを作成・一覧・取得・改名できる API を作る。ページは親ページを持てる。別ユーザーのページは ID を知っていても取得・更新できず、その下に子ページも作れない。今後の本文保存に使う `page_contents` の空レコードをページ作成時に同時作成する。

この計画の完了時点では UI は変わらない。API テストから、作成したページと空の本文レコードが再取得できることを確認する。

## 作業前の確認

1. `git status --short --branch` でブランチと既存変更を確認する。他人の変更を消さない。
2. `api/db/schema.ts`、`api/db/client.ts`、`api/db/sqlite.ts`、`api/app/hono.ts`、`api/middleware/auth.ts`、`api/modules/auth/context.ts`、`api/routes/auth.route.ts` を読む。
3. `bun run typecheck` と `bun run test` を実行し、変更前の成否を記録する。元から失敗する場合はその内容を記録し、今回の変更と混同しない。
4. `drizzle/` と `drizzle/meta/` の既存 migration を確認する。既存 SQL と snapshot を書き換えない。

## 固定する API 契約

すべて `/api/pages` 配下。既存の `requireAuth` をルート全体へ適用する。リクエスト・レスポンスの JSON は `shared/schemas/pages.schema.ts` の Zod スキーマを正本にする。ID は UUID 文字列、時刻は ISO 8601 UTC 文字列で返す。`ownerId` はサーバーが認証コンテキストから決め、クライアント入力を受け取らない。失敗レスポンスは既存の `{ "message": "..." }` 形式を使う。

| 操作 | 入力 | 成功 | 主な失敗 |
| --- | --- | --- | --- |
| `POST /api/pages` | `{ "title": "無題", "parentId": null }`。`parentId` 省略時は `null` | `201 { "page": Page }` | 未ログイン `401`、入力不正 `400`、親ページが自分のものではない/存在しない `404` |
| `GET /api/pages` | なし | `200 { "pages": PageSummary[] }`。本人の削除されていないページのみ | 未ログイン `401` |
| `GET /api/pages/:id` | URL に UUID | `200 { "page": Page, "content": { "revision": 0, "value": [...] } }` | 未ログイン `401`、他人のページ/存在しない ID `404`、不正な ID `400` |
| `PATCH /api/pages/:id` | `{ "title": "新しいタイトル" }` | `200 { "page": Page }` | 未ログイン `401`、他人のページ/存在しない ID `404`、入力不正 `400` |

`PageSummary` は `id`, `parentId`, `title`, `createdAt`, `updatedAt`。`Page` は同じ項目に `ownerId` を加える。`GET /api/pages` は `createdAt` 昇順、同時刻なら `id` 昇順で返す。階層の組み立ては計画 02 の UI 側で行う。初期段階では順序変更 API や `sortOrder` 列は作らない。

タイトルは前後の空白を除き、1〜200文字とする。空文字や空白のみは `400`。`parentId` は `null` または UUID。子ページの作成時には、親が存在し、削除されておらず、認証ユーザーが所有することを確認する。別ユーザーの存在を推測させないため、他人のページは存在しないページと同じ `404` にする。`POST` の `title` は必須、`parentId` は省略可。`PATCH` は `title` だけを受け付け、`parentId` や `ownerId` などの追加キーを拒否する。

空の本文は Plate で扱える段落ノード配列 `[{ "type": "p", "children": [{ "text": "" }] }]` として保存する。ただし Plate の導入前なので、ここではこの初期値の読み出しまでを実装し、任意の本文を受け取る更新 API は作らない。本文ノードの詳細な検証、編集保存、競合時の応答は計画 03・04 で定義する。

## データモデル

`api/db/schema.ts` に次を追加し、新しい SQL migration を `bun run db:generate` で生成する。既存の `users` と `refresh_tokens` は変更しない。

| テーブル | 列 | 制約・用途 |
| --- | --- | --- |
| `pages` | `id` text | UUID、主キー |
|  | `owner_id` text | `users.id` 参照、必須、所有者判定に使用 |
|  | `parent_id` text nullable | `pages.id` 参照。root は `null` |
|  | `title` text | 必須。アプリ側でも長さを検証 |
|  | `created_at`, `updated_at` integer timestamp | 必須 |
|  | `deleted_at` integer timestamp nullable | 将来のゴミ箱用。今回の API に削除操作はない |
| `page_contents` | `page_id` text | `pages.id` 参照、主キー。ページ削除時に連動削除 |
|  | `value_json` text | Plate JSON 配列の文字列。初期値をページ作成時に保存 |
|  | `revision` integer | 必須、初期値 `0`。後続計画の競合判定用 |
|  | `updated_at` integer timestamp | 必須 |

`pages(owner_id, parent_id)` と `pages(parent_id)` に検索用インデックスを設ける。`owner_id` と `parent_id` の組み合わせだけでは親子の同一所有者制約は保証できないため、サービス層で親の所有を検証する。DB 外部キーは有効になっている。`page_contents.value_json` は JSON として解析できない場合に黙って空本文へ置き換えず、内部エラーとして扱う。

ページ作成は `dbRuntime.client.write.execute()` 内のトランザクションで親の所有者確認、`pages` と `page_contents` の挿入を行う。途中で失敗した場合はどちらも残さない。読み込みは `client.read` を使用する。既存の単一 writer の境界を迂回して DB に直接書かない。`PATCH` も writer 内で `owner_id` と `deleted_at IS NULL` を更新条件に含め、更新件数が 0 なら `404` を返す。先に読み取ってから所有者条件なしで更新しない。

## 変更対象と順序

1. `api/db/schema.ts`: 2 テーブルとインデックスを追加する。生成された `drizzle/*.sql` と `drizzle/meta/*` もコミット対象にする。
2. `shared/schemas/pages.schema.ts`: 入力・レスポンスの Zod スキーマと型を定義する。入力には Zod の strict object を使い、未知のキー、特に `ownerId` を拒否する。
3. `api/modules/pages/pages.service.ts`: DB 操作と所有者判定を実装する。`ownerId` は各メソッドの明示的な引数にし、どの読み書きも所有者条件を付ける。`createPagesService(client: AppDatabaseClient)` という factory にし、グローバル DB を参照しない。
4. `api/routes/pages.route.ts`: `zValidator` で JSON/param を検証し、`getAuthContextUser(c).userId` をサービスへ渡す。例外は既存の `HttpError` とアプリのエラーハンドラを使う。
5. `api/app/hono.ts`: `createApiRoutes` に `/pages` を登録し、`/pages/*` と `/pages` の両方で `requireAuth` が確実に適用されるようにする。`AppType` に route の型が載ることを型チェックで確認する。
6. `api/db/schema.test.ts`、`shared/schemas/pages.schema.test.ts`、`api/modules/pages/pages.integration.test.ts`: 制約、入力検証、正常系、認可、トランザクションを検証する。既存テストが新しい schema や route の追加で失敗した場合は、対応する fixture と mock だけを更新する。

`web/src`、既存認証の仕組み、既存 API のレスポンス、README のセットアップ手順、他 variant ブランチは変更しない。Plate と TanStack Query の新しい画面コードや依存パッケージも、この計画では追加しない。

## テストケース

`api/modules/pages/pages.integration.test.ts` は一時 SQLite DB と実際の migration を使い、Hono の `app.request()` で HTTP 契約まで確認する。Vitest の `node` プロジェクトからは、既存の `api/db/migrate-sqlite.integration.test.ts` と同じ `spawnSync("bun", ["-e", script])` 方式を使う。Bun 側で migration、ユーザー A/B 作成、アクセストークン生成、アプリへのリクエストを実行し、結果を assertion で検証する。既存の `createApp` は import 時に既定 runtime を初期化するので、統合テストでは一時 DB を指す環境変数を設定してから dynamic import する。DB を mock するユニットテストだけで認可完了としない。

| ケース | 期待結果 |
| --- | --- |
| A が root ページを作る | `201`、`parentId=null`、`ownerId=A`、空の `page_contents` が1件 |
| A が自分のページの子を作る | `201`、親 ID が保存され、一覧と詳細から読める |
| A が自分のページを改名する | `200`、一覧と詳細が新タイトルを返す |
| 未ログインで各 API を呼ぶ | すべて `401`、書き込みなし |
| B が A のページを取得・改名する | どちらも `404`、A のデータは変わらない |
| B が A のページを親として指定する | `404`、子も本文レコードも作られない |
| 空白タイトル、不正 UUID、未知の入力キー | `400`、書き込みなし |
| ページ作成中に本文挿入が失敗する | トランザクションがロールバックし、孤立したページがない |
| A と B のページが混在する | 一覧には本人のページだけが返る |

## 検証コマンドと合格条件

| 順序 | コマンド | 合格条件 |
| --- | --- | --- |
| 1 | `bun run db:generate` | 新しい migration が作られ、既存 migration が変更されない |
| 2 | `bun run test -- api/modules/pages/pages.integration.test.ts shared/schemas/pages.schema.test.ts api/db/schema.test.ts` | 追加した対象テストがすべて成功 |
| 3 | `bun run typecheck` | TypeScript エラーなし |
| 4 | `bun run lint` と `bun run format:check` | lint・フォーマットエラーなし |
| 5 | `bun run verify` | 既存の全体ゲートが成功 |
| 6 | `git diff --check` | whitespace エラーなし |

新しい migration は空の一時 DB と、既存 migration 適用済みの一時 DB の両方で試す。`PRAGMA foreign_key_check` が空であることも確認する。既存の開発 DB や本番 DB へ検証目的で migration を直接適用しない。失敗時は該当実装・テストを直して対象テストから再実行し、最後に全体ゲートを再実行する。環境上実行できないコマンドがあれば、実行できなかった理由と未確認の条件を完了報告に残す。

## 完了条件と引き継ぎ

- 上表の API 契約とテストケースを満たす。
- migration と Drizzle schema が一致し、孤立した `page_contents` が発生しない。
- 既存の認証、health、ready、protected API のテストが通る。
- 変更ファイル、検証結果、残った制約を実装報告に記載する。
- 計画 02 はこの API を使ってサイドバーを作る。計画 03 は Plate 本文の形を確定し、計画 04 は `revision` を用いた本文更新 API と TanStack Query の自動保存を実装する。

## 差し戻し方法

未適用の段階では、この計画で追加したファイルと schema 変更を戻す。migration を適用済みの環境では、ページデータを含む DB バックアップを先に取り、依存テーブルの扱いを確認してから rollback migration を別途作る。既存 migration の編集や DB ファイルの削除で戻さない。
