# Hono Standard Authless Baseline

Hono APIとReact/Vite frontendを同一originで配信する、認証・protected sample・component showcaseを含まないSQLite baselineです。

## Setup

```bash
bun run bootstrap
bun run dev
```

## Verification

```bash
bun run audit
bun run verify
bun run verify:e2e
```

`verify`はtypecheck、lint、format check、Vitest、95% coverage、production buildを実行します。`verify:e2e`はpublic homeと`/api/health`と`/api/ready`を5つのブラウザー・モバイル構成で確認します。初回は`bunx playwright install --with-deps chromium firefox webkit`を実行してください。

## API

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/health` | liveness endpoint |
| `GET` | `/api/ready` | DB接続・書き込み開始・移行・schemaの準備確認 |

新しいAPIは`api/routes/`に置いて`api/app/hono.ts`へ登録し、共有contractが必要になった時点で`shared/schemas/`へ追加します。application tableは`api/db/schema.ts`と`drizzle/*.sql`へ追加してください。

スキーマ変更後は`bun run db:generate`でSQLを生成し、SQLと`drizzle/meta/`のsnapshot・journalを一緒にcommitします。適用は`bun run db:migrate`に統一します。`db:migrate:drizzle`も同じrunnerを呼ぶ互換aliasです。初期状態はテーブル・migration・snapshotが空です。各migrationのcommit前に外部キーの整合性を検査し、違反時は変更と適用履歴をrollbackします。`bootstrap`は既存の設定行を保持し、必要なDB設定だけを追加・補正します。

`bun run build`は開発用`.env`の`NODE_ENV`にかかわらずproduction bundleを生成します。サーバー起動時の`NODE_ENV`は別に設定します。

## Docker

```bash
docker compose up --build
```

起動前の`data-init`がrootで`./data`とSQLite本体・WAL・SHMの所有者をUID/GID `10001:10001`へ設定します。Linuxホスト上の対象ファイルの所有者も変わります。その後appは非root userで実行し、`/api/ready`をDocker HEALTHCHECKに利用します。SQLiteの内容は保持され、`./data`へ永続化されます。

DB本体・WAL・SHMと環境変数ファイルはimageへ含めません。必要なsecretは実行時に渡します。

## 運用と負荷試験

停止はHTTP処理完了を最大10秒待ち、DBを閉じます。Composeの停止猶予は15秒です。`bun run db:backup <new-file>`、`bun run db:verify-backup <file>`、`bun run db:restore <snapshot> <new-db>`でWALを含む保存・検査・新規DBへの復元ができます。

`bun run verify:load`は一時DBでhealth / readinessを同時8件・各200件・3回計測します。運用手順、測定条件、結果の見方は[運用ガイド](docs/operations.md)を参照してください。
