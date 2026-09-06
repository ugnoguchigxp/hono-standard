# Cloudflare D1、local libSQL、HTTPサーバーの運用

## 停止

local Bun serverはSIGINT / SIGTERMを受けると新しい接続の受付を止め、処理中のHTTPリクエストを待ってからDBの書き込みキューとreader/writer接続を閉じます。期限は10秒です。DockerはBunをPID 1として起動し、Composeの停止猶予は15秒です。Workersではrequest単位の実行モデルを使うため、このprocess signal処理は適用されません。

## 生存確認と準備確認

| Endpoint | 200になる条件 | 用途 |
| --- | --- | --- |
| `/api/health` | HTTPハンドラーが応答できる | プロセスの生存確認 |
| `/api/ready` | D1では必須tableとmigration後のcolumn、local libSQLではwrite transaction・必須table・全SQL migrationを確認できる | トラフィックの受け入れ判断 |

local libSQLの準備確認はwrite transactionをROLLBACKし、データを残しません。同時に来た確認は同じプローブを共有します。D1はread-onlyのschema probeを使います。どちらも準備不足の内部エラーを公開せず503を返します。

## local fileのバックアップと復元

`file:` URLまたはlocal pathを使う環境では、一貫したSQLite snapshotを作成・検証できます。remoteの`libsql://` URLはこのコマンドの対象外です。

```bash
DATABASE_URL=file:./data/cloudflare-local.db bun run db:backup backups/2026-09-06.sqlite
bun run db:verify-backup backups/2026-09-06.sqlite
bun run db:restore backups/2026-09-06.sqlite data/restored-2026-09-06.sqlite
```

backupは`VACUUM INTO`を使い、integrity checkとforeign key checkを通った新規ファイルだけを権限600で確定します。復元も新しいファイルに限定します。復元後は`DATABASE_URL=file:...`を新しいファイルへ向け、migration、`/api/ready`、ログインを確認してから切り替えてください。

## Cloudflare D1の保全

D1は利用中のCloudflare planが提供するbackup・Time Travel・exportの保持期間と権限を確認してください。定期的に別databaseへ復元し、migration、代表データ、認証、`/api/ready`を検証します。このrepositoryのsnapshot commandはlocal libSQL専用であり、D1 bindingやremote databaseの代替にはなりません。

## ブラウザーと負荷の検証

```bash
bunx playwright install --with-deps chromium firefox webkit
bun run verify:e2e
bun run verify:load --requests 200 --concurrency 8 --runs 3 --max-p95-ms 500
```

E2Eは3ブラウザーとモバイル2構成です。負荷検証は一時local libSQL databaseで認証readとrefresh writeを測り、終了後に削除します。本番D1とWorkersのlatency、isolate間競合、rate limitは別に測定してください。
