# 実装計画 05: ページ画面へのエディタ統合と手動保存

状態: 未実装

依存: [計画 02](./plate-notion-plan-02-sidebar.md) の画面、[計画 03](./plate-notion-plan-03-editor.md) の `PageEditor`、[計画 04](./plate-notion-plan-04-content-api.md) の保存 API が完成していること。

## ゴール

`/pages/$pageId` で本文を編集し、「保存」を押すとサーバーに残る状態を作る。保存済み・未保存・保存中・失敗・競合を区別して表示する。**自動保存はこの計画に含めず、計画 06 に回す。** 先に手動保存で通信とデータ損失の境界を確かめる。

## 画面の契約

1. `GET /api/pages/:id` が成功するまでエディタを表示しない。成功したら `content.value` を `PageEditor.initialValue`、`content.revision` を保存時の revision に渡す。
2. 初期状態は「保存済み」。`PageEditor.onChange` で本文が変わったら、ページ固有のローカル下書きを更新し「未保存」にする。本文を TanStack Query のサーバー応答キャッシュへ書き戻さない。
3. 「保存」を押したら `PUT /api/pages/:id/content` に `{ revision, value: 下書き }` を送る。送信中はエディタを読み取り専用、保存ボタンを無効にして、送信中の追加入力を発生させない。
4. 成功時に応答の `content.revision` と `content.value` をそのページの詳細 query キャッシュへ反映し、「保存済み」にする。再読み込み後、同じ本文が表示される。
5. 通信失敗時は下書きを維持し、「保存できませんでした」と「再試行」を表示する。再試行は同じ revision と下書きで行う。成功したふりをしない。
6. `409` のときは下書きを維持し、「別の場所で更新されています」と表示する。自動的に新 revision で上書きしない。「サーバー版を読み込み直す」は破棄確認の後にだけ実行し、GET を再取得する。

保存状態の正本は、最後にサーバーから確認できた `content` とローカル下書き、mutation の実行結果から導く。表示専用の別の「保存済み」フラグを持たない。下書きはページ ID ごとに分け、別ページの本文へ混ぜない。

## ページを離れるとき

未保存、保存失敗、競合の状態では TanStack Router の `useBlocker` でページ切替を確認する。「破棄して移動」を選んだ場合だけ移動し、「戻る」なら編集を続ける。保存中は移動・ログアウトを無効にし、完了を待つ。タブを閉じる・再読み込みする場合は `enableBeforeUnload` を使い、未保存または保存中ならブラウザーの標準確認を出す。

既存の共通ヘッダーにあるログアウト操作も、未保存時には破棄確認を通す。これはページ画面とヘッダーで同じ未保存状態を参照する小さな context を置いて実現する。context は編集の可否と離脱確認にだけ使い、本文やサーバー応答のコピーを保持しない。ブラウザーやプロセスの強制終了時の下書き復元は今回扱わず、完了報告で制約として明記する。

## 実装順序

1. `git status --short --branch`、`bun run typecheck`、`bun run test` を実行し、変更前の状態を記録する。計画 02〜04 の成果物がなければ仮実装で埋めず、欠けている契約を報告する。
2. `web/src/api.ts` に保存 API 関数と TanStack Query mutation を追加する。既存の認証付き `client` を使う。`409` は HTTP status と `currentRevision` を保持したエラーとして扱い、メッセージ文字列から推測しない。新しい query key を増やさず、計画 02 の `['pages', userId, 'detail', pageId]` を使う。
3. `web/src/views/pages-view.tsx` の詳細領域に `PageEditor` を置く。ページ ID と取得した revision を境界にエディタを再生成し、取得失敗時はエディタを出さない。下書きは最初に GET の値をコピーして開始する。
4. 保存ボタンと状態表示を追加する。保存中はエディタを読み取り専用にするため、`PageEditor` に `readOnly?: boolean` を追加する。成功時だけ query キャッシュと revision を更新する。失敗時は下書きを残す。
5. `web/src/routes/root-route.tsx` とページ画面の間に、未保存・保存中を共有する小さな context を置き、ログアウト前の確認と保存中の無効化を実装する。TanStack Router の [navigation blocking](https://tanstack.com/router/latest/docs/guide/navigation-blocking) をページ画面に適用する。
6. `web/src/views/pages-view.test.tsx`、`web/src/api.test.ts`、必要な `PageEditor` テストを更新する。保存の状態遷移とページ切替を UI から検証する。

## 必須テスト

| ケース | 合格条件 |
| --- | --- |
| GET 成功 | 本文と revision がエディタの初期値になる |
| 編集後の保存 | PUT にページ ID、旧 revision、編集済み JSON が入り、成功後に「保存済み」となる |
| 再読み込み | GET の保存済み本文が表示される |
| 保存中 | ボタンは無効、本文は編集不可、離脱もできない |
| 通信失敗 | 下書きが残り、「再試行」で再送できる |
| `409` | 下書きが残り、勝手に再送せず、破棄確認後だけサーバー版を読む |
| 未保存で別ページへ移動・ログアウト・タブを閉じる | 確認なしに内容を失わない |
| A から B にログインし直す | A の本文が B の画面や query キャッシュに残らない |

## 検証コマンド

順に `bun run test -- web/src/views/pages-view.test.tsx web/src/api.test.ts web/src/components/page-editor.test.tsx`、`bun run typecheck`、`bun run lint`、`bun run format:check`、`bun run build:web`、`bun run verify`、`git diff --check` を実行する。すべてエラーなしを合格とする。ブラウザーでも編集→保存→再読み込み、保存失敗、競合、未保存でのページ切替を確認する。失敗時は対象を修正し、対象テストから再実行して最後に全体ゲートを通す。

## 引き継ぎと非目標

完了報告には保存状態ごとの確認結果、変更ファイル、未確認事項を記載する。計画 06 はこの手動保存の正しい状態遷移を保ったまま、自動保存と連続入力の制御を追加する。

自動保存、localStorage や sessionStorage による下書き復元、スラッシュメニュー、リスト、共同編集、AI 機能、DB/API 契約変更は今回行わない。
