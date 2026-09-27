# Spatial 第1弾: 動的 Mock Signal Server 実装計画

## 1. 目的と開始条件

[Spatial 全体コンセプト](./11-spatial-observability-concept.md)で定めた、意味のある変化を発生させる Mock Signal Server を先に実装する。Three.js の見た目を考える前に、「何が起きたか」「現在どうなっているか」を同じ入力で繰り返し再現できる状態にする。単なる JSON fixture endpoint ではなく、時間と scenario に応じて Task、Boundary、Health、Event が変わる小さな Simulation とする。

開始時に `overlay/dashboard` 由来の現在ブランチで、既存 Dashboard API test、`bun run typecheck`、`bun run verify:dashboard-bundle` の結果を記録する。既知の失敗は実装による回帰と混同しない。作業状況と実行結果は [進捗台帳](./progress.md) に専用の区画を設けて記録する。

### この計画の完了時にできること

1. 認証済みの利用者が現在の完全 Snapshot を REST で取得できる。
2. 同じ利用者が SSE に接続し、時間経過に伴う Telemetry と Event、Scenario 変更を受け取れる。
3. 開発・テスト環境で許可された Scenario に切り替え、同じ seed と simulation tick なら同じ状態とイベント列を再現できる。
4. 信号喪失と通信切断を別の事象として判定できる。再接続した利用者は完全 Snapshot から現在状態を回復できる。
5. これらを Three.js、Frontend、実 Provider、データベースなしで検証できる。

## 2. 範囲と境界

### 対象

- 共通の version 付き wire schema: Snapshot、Telemetry、Event、Scenario ID、エラー。
- 注入可能な clock と seed を使う in-memory Simulation Engine。
- REST Snapshot、Scenario 一覧・切替、SSE stream と heartbeat。
- 既存 Hono app の認証・CSRF・CORS 境界への接続。
- 正常、活動増加、Task 増加、Runtime/Boundary 異常、信号喪失、復旧を示す最小シナリオ。

### 対象外

- Spatial Scene、Three.js、Dashboard shell、Client reducer、HTML summary、Drawer。
- 実 SAAA / LARM / ContextStill / OpenTelemetry Provider、履歴 replay、永続化、複数プロセス同期、WebSocket。
- Dashboard v2 の Data Frame schema や既存 Visualization Registry の変更。
- 13 種すべての Scenario と自動デモ timeline。今回の基盤上に追加する後続計画に分ける。

### 変更してよい場所

`shared/schemas/observatory/`、`api/modules/observatory/`、`api/routes/observatory.route.ts`、`api/app/hono.ts` とその近傍の test、文書・進捗台帳。必要な場合のみ `api/app/env.ts` に明示的な設定を追加する。認証方式、DB schema、既存 Dashboard route を変更しない。

## 3. コンポーネントと責務

```text
Clock + Seed + Scenario
          │
          ▼
Pure scenario rules ──→ Simulation Engine ──→ Current Snapshot
                              │                       │
                              ├─ Telemetry / Event    └─ REST /state
                              │
                              └─ bounded subscriber fan-out ──→ SSE /stream

POST /scenario ── validated command ──→ Engine transition
```

| 層 | 責務 | 持たせないもの |
| --- | --- | --- |
| `shared/schemas/observatory` | wire schema、ID、健康状態、Event 種別、version と上限 | Hono や Three.js への依存 |
| Scenario rule | 指定 tick の意味上の状態・遷移を純粋に計算 | wall clock、network、global mutable state |
| Simulation Engine | 現在の scenario、seed、tick、revision、購読者を管理 | HTML や描画判断 |
| Hono route | 入力検証、認証境界、レスポンス、SSE cleanup | 状態生成ロジック |

Engine はアプリ起動時に一つ作り、`AppDeps` から注入できるようにする。test ごとに独立した Engine を作成し、global singleton の状態が test 間に漏れないようにする。`normal` を初期 Scenario とする。開発環境では接続中の利用者が同じ Simulation を見る。複数 process の共有は保証しない。

## 4. 最小 wire contract

実装時に Zod schema と型を同じ場所で定義する。名前や細部は contract test とともに確定してよいが、次の意味は維持する。

| データ | 必須の意味 |
| --- | --- |
| Snapshot | `schemaVersion`、`instanceId`、`revision`、`scenario`、`seed`、`tick`、`generatedAt`、Entity/Boundary/Task/Pipeline の全体 |
| Entity | 安定 ID、kind、表示名、独立した health、activity、`expectedIntervalMs`、`lastSeenAt` |
| Boundary | 安定 ID、source/target、独立した health、activity、latency と観測時刻 |
| Task | 安定 ID、実工程の state、現在の action、完了工程、最終更新時刻。推測進捗率は持たない |
| Pipeline | stage の `kind`、`activeTaskId`、queue depth、稼働・停止状態、明示的な `links`。ContextStill Mock では3段階のみ接続し、Review / Knowledge Queue は独立させる。移管 Event はタスクが次の段階へ移った時に一度だけ発行する |
| Telemetry | 対象 ID、観測時刻、metric ごとの有限な数値。`queue-depth` は stage ID が Pipeline 内でのみ一意なため `pipelineId` も持つ |
| Event | `instanceId` と単調増加 sequence から作る ID、timestamp、kind、source/target、任意の `correlationId`・`taskId`・`traceId` |

Node と Boundary の health を別に持つ。Entity/Boundary の参照先が存在すること、ID が重複しないこと、数値が有限・許容範囲内であることを生成時に確認する。外部入力の上限を schema で制限する。Payload に secret、token、Cookie、SQL、内部 stack を含めない。

Snapshot は Engine の現在状態を丸ごと置き換えられるデータとする。Telemetry/Event は Snapshot 以降の更新を表す。Event に View の色、座標、粒子速度などの描画属性を入れない。将来の実 Provider も同じ意味へ変換できる余地を残すが、未使用の Provider interface を先に広げない。

## 5. 時間、再現性、Scenario

Engine は `clock.now()` と `advance(ticks)` を注入可能にする。test では scheduler を使わず、明示的な tick 進行で State、Telemetry、Event の列を検証する。実動作では一定間隔の scheduler が同じ `advance` を呼ぶ。seed を固定した擬似乱数を使う場合も生成順を固定し、`Math.random()` を直接呼ばない。同じ `seed + 初期時刻 + Scenario 切替履歴 + tick 列` の出力は一致させる。

第1弾の Scenario は以下に限る。

| Scenario | 観察可能な変化 |
| --- | --- |
| `normal` | Core、Runtime、Boundary が健康で、少量の Task/Event が進む |
| `high-activity` | activity と実 Event 数が増える。健康状態は変えない |
| `task-heavy` | 複数 Task が離散工程を進み、待機と処理中を区別できる |
| `runtime-degraded` | Runtime またはその Boundary に異常が現れる。Node/Boundary の独立性を検証する |
| `total-signal-loss` | 対象からの観測が止まり、時間経過で stale / disconnected へ進む。SSE 接続自体は維持する |
| `recovery` | 観測が再開し、状態と Boundary が正常へ戻る |

Scenario 切替では `revision` を進め、現在の完全 Snapshot を配信する。旧 Scenario の予定 Event が混入しないよう、Engine の内部 queue を切り替える。後続シナリオ（pipeline-backlog、pipeline-stalled、boundary-latency、task-blocked 等）を追加できるようにするが、未実装の値は一覧に含めず、切替要求を拒否する。

## 6. API と stream の振る舞い

| API | 権限と結果 |
| --- | --- |
| `GET /api/observatory/mock/state` | 認証必須。現在の完全 Snapshot。cache しない |
| `GET /api/observatory/mock/stream` | 認証必須。SSE で接続時の完全 Snapshot、以後の Telemetry/Event、heartbeat を送る |
| `GET /api/observatory/mock/scenarios` | 認証必須。切替可能な Scenario と説明を返す |
| `POST /api/observatory/mock/scenario` | 認証必須。開発・テスト環境のみ。許可済み Scenario へ切り替え、変更後の Snapshot/revision を返す |

本番では Snapshot と stream は読み取り専用の Mock デモとして動かし、Scenario 変更は 404 とする。公開可否を `NODE_ENV` 以外の条件で制御する必要が出た場合は、設定とテストを加える前にその要件を明記する。既存の `requireAuth`、`csrf()`、CORS 設定を迂回しない。SSE は cookie による同一 origin の認証を想定する。

SSE は Hono の stream 機構を使い、接続時の Snapshot 登録と購読開始の間に更新を落とさない。`instanceId` と sequence を送信し、順序不明・欠番・再起動を Client が判定できるようにする。第1弾では Event 履歴を replay しない。再接続時は新しい完全 Snapshot を送って同期する。heartbeat は通信路の生存を示すもので、Entity の `lastSeenAt` を更新しない。

接続が閉じたら購読・timer・Abort listener を解放する。遅い接続が Engine 全体を止めないよう、購読者数と送信待ち件数に上限を置き、超過した接続は切って Snapshot から再接続させる。無制限の Event 保持はしない。stream の status、Content-Type、cache header、heartbeat 間隔は route test で固定する。

## 7. 作業順と完了判定

| WP | 成果物 | 次へ進む条件 |
| --- | --- | --- |
| M0 基準値 | Dashboard/API の既存 test、型、bundle の結果を進捗台帳に記録 | 実行条件と既知の失敗が分かる |
| M1 契約 | Zod schema、型、固定 fixture、整合性 test | 正常・欠落・重複・範囲外・未知 version を判定できる |
| M2 Engine | clock/seed/tick、6 Scenario、Task/Health/Boundary の純粋遷移 | 同じ入力は同じ Snapshot と Event 列になる。旧 Scenario の Event が残らない |
| M3 REST と権限 | Engine 注入、state/scenarios/scenario route、認証 | 未認証 401、不正入力 400、本番の変更 404、既存 API 回帰なし |
| M4 SSE | Snapshot → 更新 → heartbeat、切断 cleanup、再接続 | 欠落なし、順序あり、購読者解放、遅い接続の上限を確認 |
| M5 統合 | 実 scheduler、進捗記録、最終 gate | 時間経過で REST と SSE が同じ状態を示し、全 gate 成功 |

各 WP は同時に一つを `in_progress` とし、成功した検証コマンドと件数を記録してから `complete` にする。実装途中で contract を変える場合は fixture と文書を先に更新する。

## 8. 検証

| 実行・確認 | 期待結果 |
| --- | --- |
| `bunx vitest run shared/schemas/observatory api/modules/observatory api/routes/observatory.route.test.ts` | schema、seed、Scenario、heartbeat、SSE、認証、失敗系が固定 clock で成功する |
| `bun run typecheck` | 新規 contract と既存コードに型エラーがない |
| `bun run verify` | lint、format、unit、build を含む既存全体 gate が成功する |
| `bun run verify:dashboard-contract` | Dashboard v2 共有契約に回帰がない |
| `bun run verify:dashboard-bundle` | Mock 基盤によって通常 route / Grid の frontend bundle が増えない |
| `git diff --check` | 空白・改行のエラーがない |

API 統合 test では、Snapshot 取得、stream 接続、手動 tick、Scenario 変更、再接続を一つの Engine 上で順に実行する。`total-signal-loss` 中も heartbeat は届き、Entity/Boundary の観測だけが止まることを確認する。接続断では新しい Event を受けられず、再接続後に完全 Snapshot で追いつけることを確認する。実時間で長く待つ test や外部認証情報を必要とする test は必須 lane に入れない。

検証に失敗した WP は修正して同じ条件で再実行する。環境起因と判断した場合も、コマンド、症状、再実行結果を台帳に残し、未確認の成功を記さない。

## 9. 後続計画への引き渡し

完了時に、API の例、固定 seed の Snapshot、Scenario ごとの Event 列、SSE 再接続の例、未実装 Scenario、接続数・保持数の上限を文書化する。次の計画ではこの contract を使って Dashboard shell と Spatial Client を作り、Scene Model と Three.js を段階的に接続する。
