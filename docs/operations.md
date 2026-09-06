# PostgreSQLとHTTPサーバーの運用

## 停止

SIGINT / SIGTERMを受けると新しい接続の受付を止め、処理中のHTTPリクエストを待ってからDBの書き込みキューと接続プールを閉じます。期限は10秒で、超過時は接続を強制終了して終了コード1を返します。DockerはBunをPID 1として起動し、Composeの停止猶予は15秒です。

## 生存確認と準備確認

| Endpoint | 200になる条件 | 用途 |
| --- | --- | --- |
| `/api/health` | HTTPハンドラーが応答できる | プロセスの生存確認 |
| `/api/ready` | PostgreSQLへの接続、書き込みトランザクション、必須テーブル、全SQL migrationの適用を確認できる | トラフィックの受け入れ判断 |

`/api/ready`は準備不足を503で返し、内部エラーは公開しません。確認用トランザクションは必ずROLLBACKし、同時に来た準備確認は同じプローブを共有します。Docker HEALTHCHECKもこのendpointを使います。

## バックアップ

PostgreSQL client toolsをインストールした環境でcustom formatの論理バックアップを作成します。出力先は新規ファイルに限り、作成途中のファイルは検証完了まで公開しません。`pg_restore --list`に通ったファイルだけを権限600で確定します。

```bash
DATABASE_URL=postgres://... bun run db:backup backups/2026-09-06.dump
bun run db:verify-backup backups/2026-09-06.dump
```

定期バックアップはDBと別の障害領域へ暗号化して保管し、ジョブ失敗を監視してください。保持期間と頻度はRPOに合わせます。大規模DBではWAL archivingとpoint-in-time recoveryも併用します。

## 復元

誤上書きを避けるため、復元先URLと確認フラグの両方が必要です。先に空の検証用databaseを作り、そこで復元、migration、readiness、代表データ、ログインを確認してから接続先を切り替えます。

```bash
RESTORE_DATABASE_URL=postgres://.../hono_standard_restore \
  ALLOW_DB_RESTORE=1 bun run db:restore backups/2026-09-06.dump
DATABASE_URL=postgres://.../hono_standard_restore bun run db:migrate
DATABASE_URL=postgres://.../hono_standard_restore bun run start
curl --fail http://127.0.0.1:5173/api/ready
```

`db:restore`は`pg_restore --clean --if-exists --exit-on-error`を使うため、復元先の既存objectを変更します。本番URLを直接指定せず、切り替え前後の復旧時点と照合結果を記録してください。

## ブラウザーと負荷の検証

```bash
bunx playwright install --with-deps chromium firefox webkit
bun run verify:e2e
bun run verify:load --requests 200 --concurrency 8 --runs 3 --max-p95-ms 500 --output /tmp/load-check.json
```

E2Eは3ブラウザーとモバイル2構成で、認証、複数タブのrefresh排他、Dialog/Drawer/Tabsのkeyboard操作、狭いviewportの横溢れを確認します。負荷検証の既定値はローカル回帰用です。本番SLOは対象環境と実データ量で別に定義してください。
