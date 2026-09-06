# Changelog

このファイルには、利用者に影響する変更を記録します。リリース時に `Unreleased` の内容を version と日付の見出しへ移してください。

## Unreleased
- Showcaseのモバイル横溢れとDrawer・Tabsのキーボード操作を修正。


- HTTPの処理完了を待つ停止、10秒の期限、重複シグナルの統合を追加。
- DB readinessとSQLiteのオンラインバックアップ・検査・新規パスへの復元を追加。
- デスクトップ3ブラウザー・モバイル2構成のE2Eと再現可能な負荷計測を追加。運用手順を文書化。


### Added

- login のアカウント単位 rate limit。
- refresh token rotation の再利用検知と token family 失効。
- `requireRole` と admin authorization sample。
- request ID を含む構造化 JSON log と Docker health check。
- auth、protected sample、showcase を除き、途中失敗時も不完全な出力を残さない非破壊の authless generator。
- CI の dependency audit gate。

### Changed

- DB適用をBun用runnerへ統一し、`db:migrate:drizzle`を互換aliasに変更。差分生成用のDrizzle snapshotとjournalをSQLとともに管理。
- `build:web`は開発用NODE_ENVにかかわらずproduction bundleを生成。

- `verify` が test と coverage を二重実行しないよう、テスト工程を `test:coverage` に一本化。
- unit coverage から db / server / web routes を除外しないよう対象を広げ、Biome でテストファイルも lint / format する。
- `LLM_CONTEXT.md` の directory contract を現行実装へ同期。
- pre-commit を typecheck、lint、format check に限定し、完全な検証は pre-push と CI で実行。
- 公開済み tag を不変のリリース記録として保持する方針へ明確化。
- 脆弱性 advisory に対応した依存関係へ更新。
- optionalなshowcaseを遅延読込し、vendor code splittingでproduction chunkを分割。

### Fixed

- 利用者IDごとのquery keyと認証変更時のキャッシュ消去・query取消で、前の利用者のプロフィール表示を防止。
- logout失敗時は認証状態を保持し、エラー表示と再試行に対応。
- Web Locksでタブ間の認証更新を直列化し、正規の同時更新によるtoken family失効を防止。未対応環境では再ログインを要求。
- SQLite migrationのcommit前に外部キー整合性を検査。違反時のrollbackと親テーブル再構築時の子データ保持に対応。
- bootstrapによる既存.envの引用符・コメント・秘密値の書き換えを防止。
- Docker Composeに保存先の所有者を設定する一度限りの初期化serviceを追加し、LinuxのUID差による起動失敗を解消。

- access Cookie失効時に`/api/auth/me`からセッションを復元し、同一ページの並行requestでrefreshを共有。
- Showcaseのdialogをnative modalへ変更し、フォーカス移動・背景の操作制限・Esc・閉じた後のフォーカス復帰に対応。

### Security

- imageのコピー対象を限定し、DB本体・WAL・SHMと環境変数ファイルを配布から除外。
- パスワードのscryptをp=5へ強化。旧s1 hashは認証成功時にs2へ更新し、同時のパスワード更新を上書きしない。

- refresh token の逐次・並行再提示時に同じ family を失効し、失効後の子token発行も拒否するよう変更。
- login の総当たり試行を制限。
