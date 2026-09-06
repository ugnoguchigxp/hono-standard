# Turso/libSQLとHTTPサーバーの運用

## 停止

SIGINT / SIGTERMを受けると新しい接続の受付を止め、処理中のHTTPリクエストを待ってからDBの書き込みキューとreader/writer接続を閉じます。期限は10秒です。DockerはBunをPID 1として起動し、Composeの停止猶予は15秒です。

## 生存確認と準備確認

| Endpoint | 200になる条件 | 用途 |
| --- | --- | --- |
| `/api/health` | HTTPハンドラーが応答できる | プロセスの生存確認 |
| `/api/ready` | libSQLのwrite transaction、必須テーブル、全SQL migrationの適用を確認できる | トラフィックの受け入れ判断 |

準備確認は書込transactionをROLLBACKし、データを残しません。同時に来た確認は同じプローブを共有し、準備不足は内部エラーを公開せず503を返します。

## local fileのバックアップと復元

`file:` URLまたはlocal pathを使う環境では、一貫したSQLite snapshotを作成・検証できます。remoteの`libsql://` URLはこのコマンドの対象外です。

```bash
DATABASE_URL=file:./data/turso.db bun run db:backup backups/2026-09-06.sqlite
bun run db:verify-backup backups/2026-09-06.sqlite
bun run db:restore backups/2026-09-06.sqlite data/restored-2026-09-06.sqlite
```

backupは`VACUUM INTO`を使い、integrity checkとforeign key checkを通った新規ファイルだけを権限600で確定します。復元も新しいファイルに限定します。復元後は`DATABASE_URL=file:...`を新しいファイルへ向け、migration、`/api/ready`、ログインを確認してから切り替えてください。

## remote Tursoの保全

remote databaseは利用中のTurso planが提供するbackup、replica、point-in-time recoveryの設定と保持期間を確認してください。定期的に別databaseへ復元し、migration、代表データ、認証を検証します。provider側のbackup状態、保持期限、復元権限を監視し、local snapshot commandへremote auth tokenを渡さないでください。

## ブラウザーと負荷の検証

```bash
bunx playwright install --with-deps chromium firefox webkit
bun run verify:e2e
bun run verify:load --requests 200 --concurrency 8 --runs 3 --max-p95-ms 500
```

E2Eは3ブラウザーとモバイル2構成です。負荷検証は一時local libSQL databaseで認証readとrefresh writeを測り、終了後に削除します。本番のremote latencyと同じではないため、remote環境のSLOは別に測定してください。
