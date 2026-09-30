# 実装計画 03: Plate エディタの土台

状態: 未実装

依存: [計画 01](./plate-notion-plan-01-pages-api.md) と [計画 02](./plate-notion-plan-02-sidebar.md)

## この計画の範囲

前版は Plate 導入、リスト、スラッシュメニュー、ページ画面への統合を一度に求め、保存できないエディタを利用者に表示する仕様だった。今回は**再利用可能なエディタ部品**だけを作る。保存 API は計画 04、ページ画面への組み込みと手動保存は計画 05、自動保存は計画 06 で行う。実装が先に進んでいる必要はないが、計画 01・02 の成果物を確認してから着手する。

対応するのは段落、見出し1・2、太字、斜体のみ。スラッシュメニュー、リスト、引用、区切り線、ドラッグ操作、画像は保存の土台ができた後に別計画で追加する。機能を一度に増やさない。

## 作る部品とデータ契約

`web/src/components/page-editor.tsx` に `PageEditor` を作る。Plate の構造化 JSON を受け取り、編集後の JSON を親へ渡す。この段階では `/pages` の画面に表示しない。

```ts
type PageEditorProps = {
  pageId: string;
  initialValue: Value; // platejs の Value
  onChange: (value: Value) => void;
};
```

- `initialValue` はページ詳細 API の `content.value` に対応する。計画 01 の空本文 `[{ type: 'p', children: [{ text: '' }] }]` を表示できること。部品内でダミー本文を作らない。
- `onChange` は本文ノードの変更時だけ呼ぶ。選択位置の移動だけでは呼ばない。保存処理は計画 05 の責務。
- `pageId` が変わると古いエディタを破棄し、新しい `initialValue` で作り直す。親の通常の再レンダリングでは編集内容を初期値で上書きしない。
- 境界で初期値を確認し、配列でない・空配列・`children` のないノードは明確なエラーにする。黙って空本文に置き換えない。

| 操作 | 確認する Plate JSON |
| --- | --- |
| 段落に `hello` と入力 | `type: 'p'` の text が `hello` |
| 同じ段落を H1/H2 に変更 | text を保ち、type が `h1` / `h2` |
| 文字列を選択して太字/斜体 | 選択部分の text leaf に `bold: true` / `italic: true` |
| 装飾を解除 | 該当 mark が消える、または false になる |

見出し切替ボタンは「段落」「見出し1」「見出し2」の3つ。装飾ボタンは「太字」「斜体」の2つ。すべて `type="button"` とアクセシブルな名前を付ける。現在のブロック種類と装飾状態を表示し、操作後も続けて入力できるようフォーカスを保つ。

## 実装順序

1. `git status --short --branch` を確認し、`bun run typecheck` と `bun run test` の変更前結果を記録する。計画 01・02 が未実装なら仮 API や仮画面を作らず、欠けているファイルを報告する。
2. [Plate の手動導入](https://platejs.org/docs/installation/manual)に従って `platejs` と `@platejs/basic-nodes` を `bun add` で導入し、`package.json` と `bun.lock` を更新する。React 用 import は `platejs/react` と `@platejs/basic-nodes/react` を使う。shadcn 一括導入や別の UI ライブラリ追加はしない。
3. `PageEditor` を段落だけで作る。`Plate`、`PlateContent`、`usePlateEditor` は採用バージョンの公式例に合わせる。空本文の表示、`onChange`、ページ ID の切替を先に確認する。
4. H1/H2 のプラグインと表示を追加する。次に太字・斜体のプラグインとボタンを追加する。各段階で `bun run typecheck` を通す。
5. `web/src/components/page-editor.test.tsx` を追加する。Plate 自体は mock せず、入力・表示・`onChange` に渡る JSON を検証する。jsdom で再現できない選択操作だけは既存の Playwright で検証する。
6. 手動確認には既存の `/showcase` に一時的な確認枠を置いてよい。最終差分ではその枠を削除し、エディタ部品とテストだけを残す。未保存のエディタを `/pages` に公開しない。

## 必須テストと合格条件

| ケース | 合格条件 |
| --- | --- |
| 空本文と文字入力 | 段落を編集でき、`onChange` に `hello` を含む JSON が渡る |
| 見出し切替 | H1/H2 の表示と JSON の type が一致する |
| 太字・斜体 | 選択部分だけに mark が付き、解除もできる |
| ページ ID 切替 | 前ページの入力が次ページの初期値に混ざらない |
| 親の再レンダリング | 入力途中の文字が初期値に戻らない |
| 不正な初期値 | 明確なエラーとなり、別の本文として `onChange` に送られない |

次の順で実行し、すべてエラーなしを合格とする。

1. `bun run test -- web/src/components/page-editor.test.tsx`
2. `bun run typecheck`
3. `bun run lint` と `bun run format:check`
4. `bun run build:web`
5. `bun run verify`
6. `git diff --check`

失敗した場合は該当段階を直し、対象テストと型チェックから再実行する。最後に全体ゲートを再実行する。Plate の API 差分で実現できない項目は推測で別ライブラリに置き換えず、使用バージョン、該当 API、未達項目を報告する。

## 完了報告と引き継ぎ

導入した Plate パッケージの固定バージョン、変更ファイル、対応ノード、テスト結果を報告する。計画 04 は対応ノードを受け付ける保存 API を作る。計画 05 はエディタをページ詳細に接続して手動保存と競合・失敗表示を実装する。

DB、Hono API、認証、ページ一覧、AI 機能は変更しない。本文を localStorage や一時的な独自形式に保存しない。
