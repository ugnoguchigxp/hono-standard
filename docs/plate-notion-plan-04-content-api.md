# 実装計画 04: ページ本文の保存 API

状態: 未実装

依存: [計画 01](./plate-notion-plan-01-pages-api.md) のページ API と [計画 03](./plate-notion-plan-03-editor.md) の `PageEditor` が完成していること。

## ゴール

認証済みのページ所有者だけが Plate JSON の本文を保存できる API を追加する。保存時には現在の `revision` を要求し、古い編集による上書きを `409` で防ぐ。今回はサーバー側だけを実装する。ページ画面への接続と手動保存は計画 05、自動保存は計画 06 に分ける。

## 作業前に固定する入力例

計画 03 のテストで実際に得られた `onChange` の値を確認し、次の4種類を `shared/schemas/page-content.schema.test.ts` の fixture に置く: 空の段落、見出し1、太字を含む段落、斜体を含む段落。fixture にあるキーを下記の許可範囲と照合する。差がある場合は API 実装前にこの文書の許可範囲と fixture を一致させ、差の理由を報告する。Plate の実際の値を確認せずに別形式を発明しない。

この計画で受け付けるトップレベルノードは `p`, `h1`, `h2`。各ノードは `type` と `children` を持ち、Plate が付ける場合だけ `id` も許す。`children` は `{ text: string, bold?: boolean, italic?: boolean }` の配列に限る。任意の HTML、URL、埋め込み、未知のノード種別や属性は受け付けない。サポートするブロックが増えたときは、その計画でスキーマを拡張する。

## API 契約

`PUT /api/pages/:id/content`

```json
{
  "revision": 0,
  "value": [{ "type": "p", "children": [{ "text": "hello" }] }]
}
```

成功時は `200` と次の形を返す。`revision` は保存前より必ず1増える。返す `value` は保存した値と同じ JSON データにする。

```json
{
  "content": {
    "revision": 1,
    "value": [{ "type": "p", "children": [{ "text": "hello" }] }]
  }
}
```

| 条件 | HTTP status | 応答 |
| --- | --- | --- |
| 未ログイン | `401` | 既存形式 `{ "message": "Unauthorized" }` |
| 不正な UUID、本文、revision、未知のキー | `400` | `{ "message": "..." }` |
| ページがない、削除済み、別ユーザーが所有 | `404` | 同じ `{ "message": "Not found" }` |
| 送信した revision が現在値と異なる | `409` | `{ "message": "Content revision conflict", "currentRevision": 数値 }` |

本文は空配列にせず、1〜1000ブロック。各ブロックの `children` は1〜200件。各 text は最大100,000文字。JSON 文字列化後の本文は最大1 MiB。`revision` は0以上の整数。これらの上限超過は `400` とし、DB を変更しない。タイトルやページ階層の更新には影響しない。

`GET /api/pages/:id` は計画 01 のまま使う。その `content.revision` と `content.value` を編集開始時の値とし、新しい GET endpoint は作らない。入力・成功応答は `shared/schemas/page-content.schema.ts` の Zod schema を正本とする。

## 保存の順序

1. `zValidator` で URL の ID と JSON 本文を検証する。
2. `getAuthContextUser(c).userId` を取得する。クライアントから `ownerId` は受け取らない。
3. `dbRuntime.client.write.execute()` の中でトランザクションを開始する。
4. 所有者と `deleted_at IS NULL` の条件でページを探す。なければ `404`。別ユーザーのページの存在を区別しない。
5. 現在の `page_contents.revision` と入力 `revision` を比較する。違えば `409` と現在値を返し、書き込まない。
6. 一致したら `page_contents.value_json`、`revision + 1`、`updated_at` を同一トランザクションで更新する。更新件数が1件であることを確認する。
7. 更新後の値を `200` で返す。保存失敗時に `revision` だけ進めない。

既存の単一 writer を迂回して直接 DB に書かない。`value_json` は Plate JSON 配列を JSON 文字列として保存する。Markdown や HTML に変換しない。

## 変更ファイルと順序

1. `shared/schemas/page-content.schema.ts`: 受け入れる Plate JSON、request、response の schema と型を定義する。未知の属性は拒否する。
2. `shared/schemas/page-content.schema.test.ts`: 計画 03 の fixture と、無効値・サイズ上限の検証を追加する。
3. `api/modules/pages/pages.service.ts`: 既存サービスに所有者確認と revision 付き更新を追加する。所有者判定を route 側だけに置かない。
4. `api/routes/pages.route.ts`: `PUT /:id/content` を追加する。`409` の応答だけは `currentRevision` を含むので route から明示的に返す。
5. `api/app/hono.ts`: CORS の `allowMethods` に `PUT` を加える。既存の `/api/pages` 認証 middleware が新ルートにも掛かることを確認する。
6. `api/modules/pages/pages.integration.test.ts` と必要な既存テストを更新する。

DB schema と migration は変更しない。計画 01 の `page_contents` に保存する。

## 統合テスト

計画 01 と同じ一時 SQLite DB + Bun 子プロセス + Hono `app.request()` を使う。mock DB だけのテストでは完了にしない。

| ケース | 合格条件 |
| --- | --- |
| A が自分のページへ revision 0 で保存 | `200`、revision 1、再取得した本文が一致 |
| A が続けて revision 1 で保存 | `200`、revision 2 |
| 古い revision 0 を再送 | `409`、currentRevision 2、保存済み本文は変わらない |
| B が A のページに保存 | `404`、A の本文と revision は不変 |
| 未ログインで保存 | `401`、DB 不変 |
| 不正 UUID、空配列、未知のノード、HTML 属性、巨大本文 | `400`、DB 不変 |
| `page_contents` 更新に失敗 | `500`、本文と revision が共に不変 |
| ブラウザーの CORS preflight で PUT を確認 | `Access-Control-Allow-Methods` に `PUT` がある |

## 検証と報告

順に `bun run test -- shared/schemas/page-content.schema.test.ts api/modules/pages/pages.integration.test.ts`、`bun run typecheck`、`bun run lint`、`bun run format:check`、`bun run verify`、`git diff --check` を実行し、すべてエラーなしを合格とする。失敗時は該当実装を修正して対象テストから再実行し、最後に全体ゲートを再実行する。

完了報告には、実際の Plate fixture と API schema の一致、変更ファイル、テスト結果、未確認項目を記載する。計画 05 へは `GET /api/pages/:id` と `PUT /api/pages/:id/content` の契約を渡す。

## 今回の非目標

ページ画面へのエディタ統合、自動保存、ローカル下書き、共同編集、Markdown変換、AI 機能。既存の認証方式と他の API 契約は変更しない。
