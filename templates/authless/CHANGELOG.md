# Changelog

このファイルには、利用者に影響する変更を記録します。リリース時に `Unreleased` の内容を version と日付の見出しへ移してください。

## Unreleased

- HTTPの処理完了を待つ停止、10秒の期限、重複シグナルの統合を追加。
- DB readinessとSQLiteのオンラインバックアップ・検査・新規パスへの復元を追加。
- デスクトップ3ブラウザー・モバイル2構成のE2Eと再現可能な負荷計測を追加。運用手順を文書化。


### Added

### Changed

### Fixed

- DB差分生成と適用の手順を統一し、開発用NODE_ENVでもproduction bundleを生成。

### Security

- DB本体・WAL・SHMと環境変数ファイルの配布除外を強化。

- migrationの外部キー整合性検査とrollback、bootstrapの既存.env保全、Composeの保存先所有権初期化に対応。
