# Changelog

このファイルには、利用者に影響する変更を記録します。リリース時に `Unreleased` の内容を version と日付の見出しへ移してください。

## Unreleased

### Added

- login のアカウント単位 rate limit。
- refresh token rotation の再利用検知と token family 失効。
- role-based admin authorization の共通 middleware。
- request ID を含む構造化 JSON log と Docker health check。
- CI の dependency audit gate。

### Changed

- `LLM_CONTEXT.md` の directory contract を現行実装へ同期。
- pre-commit を typecheck、lint、format check に限定し、完全な検証は pre-push と CI で実行。
- 公開済み tag を不変のリリース記録として保持する方針へ明確化。
- 脆弱性 advisory に対応した依存関係へ更新。
- vendor code splittingでproduction chunkを分割。

### Security

- refresh token の逐次・並行再提示時に同じ family を失効し、失効後の子token発行も拒否するよう変更。
- login の総当たり試行を制限。
