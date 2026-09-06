# SQLiteとHTTPサーバーの運用

## 停止

SIGINT / SIGTERMを受けると新しい接続の受付を止め、処理中のHTTPリクエストを待ちます。完了後にDBの書き込みキューと接続を閉じ、終了コード0で終了します。待機中の追加シグナルは同じ停止処理にまとめます。

受付停止からDB終了までの期限は10秒です。超過や停止失敗は構造化ログの`server_shutdown_failed`に記録し、接続を強制終了して終了コード1を返します。DockerはBunをPID 1として起動し、Composeの停止猶予は15秒です。長時間の処理やストリームを追加する場合はアプリ側の10秒と運用側の猶予を一緒に見直してください。イベントループ自体を塞ぐ同期処理はアプリ内タイマーでも中断できないため、コンテナ側の期限も必要です。

この順序は[Bunのserver.stop](https://bun.sh/docs/runtime/http/server)に従います。回帰テストでは実際のHTTPリクエスト中にSIGTERMを送り、応答とSQLiteへの書き込みが完了すること、期限超過で接続が切れることを確認します。

## 生存確認と準備確認

| Endpoint | 200になる条件 | 用途 |
| --- | --- | --- |
| `/api/health` | HTTPハンドラーが応答できる | プロセスの生存確認 |
| `/api/ready` | DBの読み取り、書き込みトランザクションの開始、移行履歴、現在のschemaの表・列を確認できる | トラフィックの受け入れ判断 |

`/api/ready`は準備不足を503で返し、内部のSQLやファイル名を公開しません。レスポンスは`Cache-Control: no-store`です。DBへのデータ追加は行わず、書き込みロックの確認後にROLLBACKします。移行前、DB終了後、外部プロセスによる書き込みロック中も503になります。書き込みキューの待機は1秒でHTTP応答を打ち切り、並行する準備確認は同じDBプローブを共有します。

Docker HEALTHCHECKは`/api/ready`を使います。Kubernetes等ではlivenessに`/api/health`、readinessに`/api/ready`を指定します。ディスク残量、実データの全件検査、復旧可能性はこの軽量な準備確認の対象外です。ディスク・バックアップ失敗・継続する503を別途監視してください。

## バックアップ

稼働中のSQLite本体だけをコピーすると、WAL内のコミット済みデータを取りこぼす可能性があります。`db:backup`は[SQLiteのVACUUM INTO](https://www.sqlite.org/lang_vacuum.html)で一貫したスナップショットを作ります。元DBは変更しません。

プロジェクトルートで実行します。`DATABASE_URL`の既定値は`./data/sqlite.db`です。

```bash
bun run db:backup backups/2026-09-06.sqlite
bun run db:verify-backup backups/2026-09-06.sqlite
```

作成後に`integrity_check`と`foreign_key_check`を実行し、サイズとSHA-256をJSONで出力します。出力ファイルは新規作成限定です。既存ファイルやSQLiteのsidecarがある出力先は拒否します。作成途中のファイルは同じファイルシステム内の非公開ディレクトリに置き、検査成功後に公開するため、失敗したバックアップを完成品として残しません。完了ファイルは権限600、新規ディレクトリは700です。既存ディレクトリの権限は変更しません。

DockerではアプリのUIDで実行します。

```bash
docker compose exec app bun run db:backup /data/backups/2026-09-06.sqlite
docker compose cp app:/data/backups/2026-09-06.sqlite ./backups/2026-09-06.sqlite
bun run db:verify-backup backups/2026-09-06.sqlite
```

バックアップにも利用者情報が含まれます。DBとは別の障害領域へ暗号化して保管し、SHA-256も別途記録してください。バックアップ頻度と保持期間は許容するデータ損失（RPO）に合わせて設定し、定期ジョブの失敗を監視します。`backups/`はGitとDocker build contextから除外されます。

## 復元と切り戻し

1. 対象アプリを停止し、利用するバックアップのSHA-256を保管時の値と照合します。
2. `db:verify-backup`を実行します。DB本体・WAL・SHMがある稼働DBを復元元に指定せず、完成したスナップショットを使用します。
3. **新しいファイル名**へ復元します。稼働DBへの上書きはできません。
4. 復元したDBを`DATABASE_URL`に指定して移行を適用し、同じ設定でアプリを起動します。
5. `/api/ready`、アプリの代表データ、認証を含む構成ではログインと保護画面を確認してからトラフィックを戻します。

```bash
bun run db:restore backups/2026-09-06.sqlite data/restored-2026-09-06.sqlite
DATABASE_URL=./data/restored-2026-09-06.sqlite bun run db:migrate
DATABASE_URL=./data/restored-2026-09-06.sqlite bun run start
```

Dockerでは`DATABASE_URL`を新しい`/data/...`のパスへ変更します。復元ファイルの所有者をアプリUIDに合わせてください。元DBとsidecarは切り戻し確認が完了するまで保持します。切り戻す場合もアプリを停止してから旧`DATABASE_URL`へ戻します。復元後に新しい書き込みが発生した場合は、その差分を失わない移行方法を決めてから切り戻します。

実行時間、復元時点、データ照合の結果を記録し、要求する復旧時間（RTO）に収まるか確認してください。自動テストでは、未チェックポイントのコミット済みWALが復元され、未コミット・取得後の更新は含まれず、復元後に書き込みと外部キー制約が機能することを確認します。環境固有の容量・権限・保管先も含めた復旧訓練は、運用環境で別途実施します。

## ブラウザーと負荷の検証

```bash
bunx playwright install --with-deps chromium firefox webkit
bun run verify:e2e
bun run verify:load --requests 200 --concurrency 8 --runs 3 --max-p95-ms 500 --output /tmp/load-check.json
```

E2EはChromium・Firefox・WebKitのデスクトップ、ChromiumのPixel 5、WebKitのiPhone 13の5構成です。モバイルはエミュレーションであり、実機試験を置き換えるものではありません。認証を含む構成では、ログイン・ログアウト・複数タブ更新に加え、Drawer/Dialogのフォーカス・Escape・復帰、[Tabsの矢印/Home/End操作](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/)、320/390/768pxの横溢れも確認します。

`verify:load`は一時DBとlocalhostの空きポートを使い、終了時に削除します。認証付き構成では利用者ごとに独立したセッションを持つワーカーで、認証・DB読み取りを通るprofile取得と、DB書き込みを伴うrefresh token更新を測ります。認証なし構成ではhealthとDB readinessを測ります。ウォームアップ後に複数回測り、p50/p95/p99、毎秒リクエスト数、エラー件数、各回終了時のRSSを出力します。

既定の200件・同時8件・3回とp95 500msはローカルで異常を見つける目安です。エラーが1件でもある場合、または指定したp95上限を超えた場合は終了コード1です。この小規模な閉ループ負荷は、ネットワーク・TLS・実データ量・大量ログイン・長時間の飽和状態を再現しません。本番のSLOは対象環境と想定データで別に定義し、同一条件の変更前後の測定値と比較してください。
