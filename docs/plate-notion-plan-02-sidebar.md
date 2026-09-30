# 実装計画 02: サイドバーとページ階層

状態: 未実装。計画 01 の完了後に実行する。

前提: [計画 01](./plate-notion-plan-01-pages-api.md) のページ API が動き、テストが通っていること。

## ゴール

ログインしたユーザーが `/pages` を開き、自分のページを階層で見られるようにする。ルートページと子ページを作成し、名前をクリックして選択できる。選択中のページは URL で表し、再読み込み後も同じページが開く。

## 今回作る画面

- `/pages`: 左にページツリー、右に「ページを選択してください」。ページが0件なら「ページがありません」と「新しいページ」ボタンを表示する。
- `/pages/$pageId`: 同じページツリーと、右に選択したページのタイトルを表示する。本文は空欄のまま。「本文編集は次の計画で追加」のような実装説明は画面に出さない。
- 未ログインの場合は、既存の `/protected` と同じログイン案内を表示する。`/login?redirect=...` へ進めるようにする。

サイドバーではページのタイトルを表示し、子があるページにだけ開閉ボタンを置く。ルートは計画 01 の `GET /api/pages` の順序で並べ、子も同じ順序にする。展開状態はこの画面内の React state とし、ページの正本は TanStack Query の API データだけに置く。最初はすべて展開する。作成した子ページの親は必ず展開し、その新ページへ移動する。

## 操作と通信

| 操作 | 通信 | 成功時 | 失敗時 |
| --- | --- | --- | --- |
| ページ一覧を開く | `GET /api/pages` | 本人のページをツリー表示 | エラー文と「再試行」ボタンを表示 |
| ルートページを作る | `POST /api/pages`、`{ title: "無題", parentId: null }` | 一覧を再取得し、`/pages/$pageId` に移動 | ボタンを再度押せるようにし、エラーを表示 |
| 子ページを作る | `POST /api/pages`、`{ title: "無題", parentId: 親ID }` | 親を展開し、一覧を再取得し、新ページへ移動 | 同上。ツリーに仮のページを残さない |
| ページ名をクリック | `GET /api/pages/:id` | 右側にそのページのタイトルを表示 | `404` は「ページが見つかりません」、その他は再試行可能なエラーを表示 |

作成ボタンは送信中だけ無効にし、連打による重複作成を防ぐ。作成に失敗しても入力前の画面を維持する。タイトル変更、並べ替え、親の変更、削除は今回実装しない。

## 実装手順

1. `git status --short --branch` を確認し、計画 01 の API と共有型があることを確認する。`bun run typecheck` と `bun run test` の変更前結果を記録する。計画 01 が未実装なら、仮 API を作らずここで止めて依存不足を報告する。
2. `web/src/api.ts` に、既存の `client`、`customFetch`、`parseJsonResponse` を使うページ一覧・詳細・作成の関数と TanStack Query hook を追加する。ページ API の型は `shared/schemas/pages.schema.ts` と `AppType` から取る。詳細取得の `404` は HTTP status を保持したエラーとして扱い、エラー文の文字列比較で判定しない。
3. query key は `['pages', userId, 'list']` と `['pages', userId, 'detail', pageId]` に固定する。`userId` がないときは query を実行しない。読み込み関数には query の `AbortSignal` を渡す。作成成功後はそのユーザーの一覧 query を invalidate する。
4. `web/src/api.ts` の `setSessionUser` を更新し、ログイン・ログアウト・セッション失効時に `pages` 配下の進行中 query を cancel してキャッシュを remove する。他ユーザーのページが次のログインで表示されないようにする。
5. `web/src/components/page-tree.tsx` にページツリーを作る。`parentId` が `null` のページをルートにし、子は親 ID で結ぶ。再帰表示はこのコンポーネント内で行い、DB やグローバル state にツリーのコピーを保存しない。
6. `web/src/views/pages-view.tsx` に共通の画面を作る。ページ ID を受け取り、ツリー、作成ボタン、右側の選択状態を表示する。`web/src/routes/pages-route.tsx` と `web/src/routes/page-detail-route.tsx` からこの画面を使い、`web/src/router.tsx` に `/pages` と `/pages/$pageId` を登録する。
7. `web/src/routes/route-access.ts` に `/pages` とその配下を追加し、既存の `AuthProvider` がセッション確認を実行するようにする。既存の共通ヘッダーにログイン済みのときだけ「Pages」リンクを追加する。既存の `/`, `/showcase`, `/login`, `/protected` は残す。
8. `web/src/styles.css` に必要最小限のレイアウトを追加する。幅が狭い画面でもページツリーと選択ページへ到達できるようにする。ボタンには名前、展開ボタンには `aria-expanded` を付ける。

## テスト

`web/src/components/page-tree.test.tsx` と `web/src/views/pages-view.test.tsx` を各コンポーネントの近くに置く。`web/src/routes/route-access.test.ts` に `/pages` の判定を追加する。既存の React Testing Library とテスト用 QueryClient を使い、HTTP は mock する。実装の関数名ではなく、画面の結果を検証する。

| ケース | 期待結果 |
| --- | --- |
| ページ 0 件 | 空表示とルート作成ボタンが見える |
| root A、子 B、孫 C | A の下に B、B の下に C が表示される |
| ページの開閉 | 子が隠れ、再度開くと表示される。`aria-expanded` が一致する |
| ルート・子ページの作成 | それぞれ正しい `parentId` で POST し、新しい URL に移る |
| 作成失敗 | エラーが見え、再試行できる。偽のページは残らない |
| ページ取得の `404` | 「ページが見つかりません」と表示される |
| ログアウト後に別ユーザーでログイン | 前ユーザーのページ query が表示されない |
| 未ログイン | ページ API を呼ばず、ログイン案内が出る |

## 検証と完了条件

順に `bun run test -- web/src/components/page-tree.test.tsx web/src/views/pages-view.test.tsx`、`bun run typecheck`、`bun run lint`、`bun run format:check`、`bun run verify`、`git diff --check` を実行する。すべてエラーなしを合格とする。加えてブラウザーでログイン→ルート作成→子作成→ページを開く→再読み込みを試し、選択した URL とツリーが維持されることを確認する。失敗したら対象を修正し、失敗したコマンドから再実行した後、全体ゲートを再実行する。

完了報告には変更ファイル、テスト結果、手動確認結果、未確認事項を記載する。計画 03 は、このページ詳細領域へ Plate エディタを追加する。

## 今回の非目標

Plate、本文の保存、タイトル変更、ページの移動・削除、ドラッグ操作、検索、共有、AI 機能は実装しない。DB schema と API 契約も変更しない。計画 01 の API に不足が見つかった場合は、仕様を推測して拡張せず、具体的な不足と影響を報告する。
