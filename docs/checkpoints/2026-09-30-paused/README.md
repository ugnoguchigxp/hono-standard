# 09・10の統合前ソース保存

2026-09-30にHono-standardの追加実装を中止し、現時点のソースを保存した。原本は `codex/plate-notion-app` に保存する。このディレクトリには、09・10を統合する前の隔離ソースを保存した。その後ユーザーの明示依頼で09・10のbaseline差分を原本へ統合した。アーカイブ自体は通常のビルド・テスト対象外で、最終統合状態とは区別する。

コード上ではPlateを使用しているが、ユーザーは期待したWYSIWYGの編集体験と実際の操作、タイトルの付け方に違いがあると説明し、作業中止を希望した。この記録は停止理由であり、UXを作り直したという意味ではない。

## 保存元と基準

| 計画 | 保存元 | 比較基準 |
| --- | --- | --- |
| 09 ページ移動 | `/tmp/hono-standard-page-move-09` | Git HEAD `f1c791da82b2c99d70ffd5b196d3f07056fefd61`（当時の原本の未コミット状態を隔離保存したbaseline） |
| 10 ページ複製 | `/tmp/hono-standard-design10-work` | `/tmp/hono-standard-design10-baseline` のファイルスナップショット。work側のGitは初回commit前なのでHEAD差分では比較できない |

各計画は、基準ソースの `NN-baseline.tar.gz`、基準からの `NN-implementation.patch.gz`、変更済み・新規ソースの `NN-changed-sources.tar.gz`、全ファイルのSHA-256と削除一覧を記録した `NN-manifest.json` を持つ。09は17ファイル変更、10は22ファイル変更、両計画とも削除なし。正確なパス一覧はmanifestにある。

秘密ファイル、実DB、ログ、node_modules、Git内部情報、ビルド・coverage・Playwright出力を除外した。`.env.example` と検証用の固定値はソースとして保存する。秘密鍵・主要アクセストークンの高確度パターン検査で一致はなかった。これは網羅的な秘密スキャンの保証ではない。

## 再適用

原本に直接適用せず、空の作業ディレクトリで基準を復元してからパッチを適用する。例（09）:

```sh
mkdir /tmp/hono-paused-09-restore
tar -xzf 09-baseline.tar.gz -C /tmp/hono-paused-09-restore
gzip -dc /absolute/path/to/09-implementation.patch.gz | git -C /tmp/hono-paused-09-restore apply -
```

10はファイル名の09を10に置き換える。パッチには未追跡の新規ソースも含めた。baseline＋patchを一時ディレクトリへ再適用し、変更ファイルのSHA-256と削除状態がmanifestに一致することを確認済み。`changed-sources.tar.gz`はパッチとは別の復旧手段であり、単独では削除を反映しない。

## 停止時点の検証情報

以下は各担当からの引き継ぎであり、保存担当によるこのアーカイブの全体検証結果ではない。

- 09: 372テスト成功、branches91.62%。baseline93.02%から低下し、既定95%を満たさない。最終E2E未実施。
- 10: 過去の対象Vitest75件など成功。最新E2E9/10、mobile WebKitで複製201応答後にURLが変わらないケースが残る。baselineのSIGTERM中HTTP書込テストにも失敗が報告された。

原本への統合はbaseline対差分で行い、競合11ファイルは原本のauth/draft/guard変更を保全して解消した。統合後の検証結果は docs/verification/2026-09-30-save-checkpoint.md に別途記録する。11以降の新機能やUX再設計は実施していない。
