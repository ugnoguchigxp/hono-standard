# 計画08 タイトル編集の実装・レビュー引き継ぎ

作業場所: `/Users/y.noguchi/Code/hono-standard`。基準設計は `docs/plate-notion-plan-08-title-edit.md`。
ブランチは `codex/plate-notion-app`、HEADは `7fdf0e45e7087608e18b80945f31d43eed86d209`。未コミットの並行作業を含む。コミット・push・PR・デプロイは実施していない。

## 08の変更範囲

- `web/src/api.ts`: タイトルPATCH、詳細・一覧の項目別更新、GETキャンセル、本文revision後退防止、QueryClientごとのセッション世代。
- `web/src/components/page-title-editor.tsx` と `.test.tsx`: 手動保存、共有Zod検証、IME、キャンセル、失敗時の下書き保持。
- `web/src/views/pages-view.tsx` と `.test.tsx`: タイトル部品の接続と本文・タイトルの離脱状態合算。
- `web/src/api.test.ts`: PATCHのHTTP契約と404。
- `web/src/styles.css`: タイトル入力の最小限の表示。
- `tests/e2e/page-title.spec.ts`: 作成・改名・本文保存・子ページ・再読み込み・通信失敗。

`page-edit-guard.tsx`、本文自動保存hook、既存エディタ、DB/API実装、依存は08では変更していない。検証中、別担当によるguard・自動保存停止制御・エディタテストの変更が入った。既存変更を保全し、その統合状態で検証した。

## 今回だけの差分の確認

`/tmp/title-edit-08.patch` は上記8コードファイルの08差分。既存の未コミット差分を含む通常の `git diff` だけでは08を分離できないため、現在の統合コードから08の追加箇所を逆変換した比較用ベースに対して生成した。着手時点の保存済みスナップショットではない。既存の004対応などは比較用ベースにも保持している。新規3ファイルは全文が08の差分。この検証記録はパッチに含まれない。

確認コマンド: `less /tmp/title-edit-08.patch`。行番号は現在の実ファイルを `nl -ba` で確認する。

## レビュー重点箇所

`web/src/api.ts:410`〜433では、送信前にGETをキャンセルし、成功時にも再度キャンセルしてからタイトルだけを書き込む。

```ts
if (epoch !== cacheSessionEpoch(queryClient)) return;
void queryClient.cancelQueries({ queryKey: detailKey });
queryClient.setQueryData<GetPageResponse>(detailKey, (current) =>
  current ? { ...current, page: { ...current.page, title: body.page.title } } : current,
);
```

`web/src/api.ts:444`〜456は本文の世代・revision保護。本文応答はcontentだけを更新する。`api.ts:479`でセッション変更時に世代を進める。`api.ts:342`付近ではGETの本文revisionが現在のキャッシュより古ければ現在のcontentを維持する。改名と本文PUTの両応答順、および同一ユーザーの再ログイン後に新しいキャッシュが存在する場合の遅延応答をテストした。

`web/src/views/pages-view.tsx:107`〜113でguardを一度だけ登録する。

```ts
const unsaved = bodyUnsaved || titleGuard.unsaved;
const saving = phase === "saving" || titleGuard.saving;
useSyncPageEditGuard({ unsaved, saving });
```

`web/src/components/page-title-editor.tsx:43`〜63は共有スキーマによる正規化と送信中の重複防止。catchでは下書きを消さない。114〜115行の `isComposing` / `keyCode === 229` とcomposition refでIME確定時のEnterを除外する。認可は既存のAPI所有者チェックを維持し、既存APIルートテストを回帰確認した。

## 検証結果

環境はmacOS arm64、Bun 1.4.2。結果ログは `/tmp/title-*.log`。

- 最新の08対象4ファイル: 53テスト通過 (`/tmp/title-final-target.log`)。
- 対象・本文自動保存・エディタ・API認可の7ファイル: 85テスト通過 (`/tmp/title-target.log`)。
- タイトル部品・競合境界: 13テスト通過 (`/tmp/title-extra.log`)。同一ユーザー再ログイン後のキャッシュを維持するテストを最後に強化した。
- typecheck、lint、format、独立build:web、diffチェック: 通過。buildはvendor chunkが500kB超の既存警告を出す。
- E2E: Chromium、Firefox、WebKit、mobile Chromium、mobile WebKitの5構成すべて通過 (`/tmp/title-e2e-isolated.log`)。
- E2Eは既存サーバーを停止せず、`/tmp/hono-title-e2e.sqlite`、5198ポート、`/tmp/title-playwright.config.ts`、`/tmp/title-e2e-server.ts`で隔離した。標準の5174構成はsandbox内listenに失敗した。制限外では隔離構成で起動できた。
- mutation: タイトルの不正入力拒否を無効化した一時変異を対象テストが検出 (`/tmp/title-mutation.log`)。元コードに復元済み。網羅的なmutation scoreは未測定。
- verify: 一度354テストが全通過したが、branches93.02%で95%閾値未達。statements96.16%、functions97.05%、lines96.84%。その後の並行テスト追加を含む最終実行では357件中355通過・2件失敗。失敗は既存エディタのスラッシュメニューの新しい2テスト。最終verifyは不合格 (`/tmp/title-final-verify.log`)。
- audit: 18件（high4、moderate11、low3）。既存Hono、Vitest/mocker、brace-expansion、undiciが対象。08は依存を変更していない。監査不合格を親へ報告済み (`/tmp/title-audit.log`)。
- verify:load: 一時DBでprofile-read / refresh-writeを各3回、各200リクエスト。全エラー0。p95は読取1.14〜1.65ms、書込5.26〜5.90ms。タイトル操作のSLOや性能回帰を保証する測定ではない (`/tmp/title-load.log`)。
- vulnWorkbench: 呼び出せる診断ツールがなく未実行。安全性の合格根拠として扱っていない。

## Android入力の切り分け

改名直後に本文をクリックせず `pressSequentially` のfocusのみで入力した初期E2Eでは、入力文字が欠けた。80msのキー間隔でも再現したため待ちで解消したとは判断しない。本文を明示的にクリックして選択位置を確立すると、Android相当Chromiumで0ms高速入力・80ms入力・`keyboard.insertText`の3方式すべてDOMとPUT JSONが一致した。desktop Chromiumでも一致した (`/tmp/title-input-diagnostic.log`)。最終E2Eはクリック＋0ms高速入力で5構成通過した。実機AndroidのIMEは未検証であり、実機の製品不具合とは断定しない。

## 残る制約と引き継ぎ

08機能は実装済みだが、独立レビューと親のコード確認が未完了。全体coverage・スラッシュメニューテスト・依存監査の残課題は別担当へ引き継ぐ。リリース完了とは扱わない。タイトルPATCHにrevisionがない既存契約のため、複数端末の改名は後勝ち。強制終了時のローカル下書き復元は対象外。
