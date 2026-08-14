# Contributing

## 開発環境

```bash
bun install --frozen-lockfile
bun run bootstrap
```

`.env` や local database、coverage、Playwright の生成物は commit しません。

## 変更時の確認

```bash
bun run verify
bun run audit
bun run verify:e2e
```

API、環境変数、script、directory contract を変えた場合は README と `LLM_CONTEXT.md` を同じ変更で更新してください。利用者に影響する変更は [`CHANGELOG.md`](CHANGELOG.md) の `Unreleased` に記録します。

脆弱性の報告は通常の issue ではなく、[`SECURITY.md`](SECURITY.md) の手順を使ってください。
