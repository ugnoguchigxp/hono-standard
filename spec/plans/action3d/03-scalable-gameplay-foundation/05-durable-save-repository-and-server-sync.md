# Delivery A3-5: Durable Save Repository and Server Sync 実装計画

| 項目 | 内容 |
| --- | --- |
| 対応Track | Action3D / Stage A3 |
| 状態 | Planned |
| 主対象 | Action3D save application service、local/server repository、Hono route、shared API schema、DB migration |
| 依存 | Delivery A3-2 migration、Delivery A3-3/A3-4 stable checkpoint semantics |

## 1. 目的とプレイヤー価値

認証userのAction3D checkpointを別browserからContinueできるようにする。localStorageを削除せず、即時backupとoffline queueとして維持し、serverを正本とする。通信失敗、重複送信、複数端末競合でcheckpointをsilent overwriteしない。

## 2. Repository boundary

domain codecはStorage、fetch、Honoを知らない。application serviceが次のportを使う。

```text
Action3dSaveRepository
├ load(slotId): SaveLoadResult
├ save(expectedRevision, idempotencyKey, envelope): SaveWriteResult
└ clear(expectedRevision): SaveDeleteResult

implementations
├ LocalAction3dSaveRepository
├ ServerAction3dSaveRepository
└ ResilientAction3dSaveRepository
```

2Dのserver save protocolを利用する場合は、game ID、slot、ownership、revision、idempotency、payload size、error分類がAction3Dと一致する部分だけを共有する。2D save envelopeやmigrationを流用しない。

## 3. Sync policy

- login後はserver slotを取得し、serverが空ならvalid local saveを一度だけuploadする。
- server saveがある場合はrevisionを比較せずserverを正本とし、localをbackupとして更新する。
- saveは`expectedRevision`と`idempotencyKey`を必須にする。
- timeout/5xx/offline時は同じidempotency keyのpending writeをlocal queueへ保持する。
- 409 conflict時は自動上書きせず、server/localのworld、checkpoint、savedAtを表示して選択させる。
- corrupt local payloadをserverへuploadしない。unsupported saveも元payloadを保持する。
- logout時はmemory stateを破棄するが、同一端末のlocal backup削除は別操作にする。

## 4. API and storage

- Action3D用game IDとcheckpoint slotをserver側allowlistで検証する。
- routeは認証middlewareを必須にし、user IDをrequest bodyから受け取らない。
- payloadはshared schemaとAction3D codecの両方で検証する。
- DBはuser ID、game ID、slot IDにunique constraintを持ち、revision、payload、savedAt、idempotency keyを保存する。
- payload size上限とrequest body上限を設け、invalid/oversized requestを4xxで拒否する。
- server logへsave payload、email、tokenを出力しない。

## 5. Implementation steps

1. Action3D save application serviceとrepository contractをfake repositoryでtestする。
2. API request/response/error schemaを追加する。
3. DB migration、transactional revision/idempotency処理、ownership testを追加する。
4. `ServerAction3dSaveRepository`とlocal pending queueを実装する。
5. Launcherのload/new/continue/autosaveをapplication serviceへ接続する。
6. local-only user、初回migration、offline、retry、409 conflict UIを追加する。
7. 二つのbrowser contextで同じaccountを使うE2Eを追加する。
8. logout/login、expired token refresh、duplicate request、server corruptionを検証する。

## 6. Acceptance Criteria

- 認証user Aがuser Bのcheckpointをread/write/deleteできない。
- 同じidempotency keyの再送はrevisionを一度だけ進め、同じ結果を返す。
- stale revisionは409となり、clientがsilent last-write-winsを行わない。
- offline victory後にlocal Continueでき、online復帰後に同じpending writeを同期できる。
- server slotが空の場合だけV1/V2 local checkpointを自動移行する。
- 別browser contextでserver checkpointから第二worldをContinueできる。
- storage/fetch/API failureを保存成功として表示しない。
- 2D saveのroute、slot、payload、migration testが回帰しない。

## 7. Verification

```bash
bunx vitest run api/modules/game-save api/routes shared/schemas web/src/action3d/save
bun run typecheck
bun run test:coverage
bun run test:e2e -- tests/e2e/action3d.spec.ts --grep "server checkpoint|offline|conflict|separate browser"
bun run verify
```

DB integration testは同時writeを含め、SQLite single-writer contract上でrevisionが単調増加することを確認する。

## 8. Rollback

server syncをfeature flagで停止してlocal repositoryへ切り替えられるようにする。serverに保存済みの新checkpointは削除せず、同期再開まで保持する。DB migrationを破壊的にdown migrationせず、旧clientが未認識game IDを無視できることを確認する。
