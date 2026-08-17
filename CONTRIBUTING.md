# Contributing

`hono-standard` への変更は、clone 直後の利用者と各 variant の両方に影響します。変更前に [`README.md`](README.md) と [`docs/template-variant-management.md`](docs/template-variant-management.md) の契約を確認してください。

## 開発環境

```bash
bun install --frozen-lockfile
bun run bootstrap
```

`.env` や local database、coverage、Playwright の生成物は commit しません。

## 変更時の確認

通常の変更は次を通してください。

```bash
bun run verify
bun run audit
bun run verify:e2e
```

- `verify` は typecheck、lint、format、coverage（unit test を含む）、production build を確認します。
- `audit` は lockfile 上の production / development dependency を確認します。
- `verify:e2e` は public route、login、protected route、logout の smoke test を実行します。
- migration を追加した場合は、空の database へ全 migration を順に適用できることを確認します。
- authless の対象ファイルを変更した場合は、`bun run template:authless -- <new-directory>` の生成物でも同じ確認を行います。

## Pull request

- 変更理由、利用者への影響、実行した検証を記載してください。
- API、環境変数、script、directory contract を変えた場合は README と `LLM_CONTEXT.md` を同じ変更で更新してください。
- breaking change、migration、security fix は [`CHANGELOG.md`](CHANGELOG.md) の `Unreleased` に記録してください。
- 公開済み tag は移動・上書き・削除しません。例外は [`docs/template-variant-management.md`](docs/template-variant-management.md) の方針に従います。

脆弱性の報告は通常の issue ではなく、[`SECURITY.md`](SECURITY.md) の手順を使ってください。
