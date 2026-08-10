# Delivery 1: Game Session Core 実装計画

| 項目 | 内容 |
| --- | --- |
| 対応Stage | Stage 1: Persistent Vertical Slice |
| 状態 | Complete |
| 実装範囲 | `shared/game` |
| 依存 | 既存Game State、field rule、battle rule |

## 1. 目的とプレイヤー価値

Field、Event、Battleをまたいでも失われない単一Game Stateのauthorityを作る。今回のDelivery単体では画面の見え方を変更しないが、次DeliveryでSceneを接続し、以後のsave/load、成長、Story Flagを安全に積み上げる土台となる。

## 2. 現状と問題

- `createInitialGameState()`は存在するが、状態を所有するSessionがない。
- 各Phaser Sceneが個別のdemo stateを生成している。
- State変更の入口となるGame Commandと、確定結果を表すGame Eventがない。
- State revisionとEvent sequenceがなく、保存競合やreconnectへ接続できない。
- 再現可能なseed付きRNG stateがない。

実装前baselineは次のとおり。

```text
bunx vitest run shared/game
Test Files  2 passed
Tests       12 passed
```

## 3. Scope

- Game Stateへcontent version、revision、RNG stateを追加する。
- seed付き決定論RNGをpure functionとして実装する。
- Game Session CommandとSemantic Eventをdiscriminated unionで定義する。
- SessionがStateをprivateに所有し、cloneしたsnapshotだけを返すようにする。
- active、paused、closedのlifecycleを実装する。
- Event sequenceをSession単位で単調増加させる。
- Command適用、no-op、invalid transition、snapshot isolationをunit testする。
- 既存field/battle testを維持する。

## 4. Non-goals

- Phaser SceneへのSession注入
- React UI変更
- localStorage、IndexedDB、SQLiteへの保存
- save schema migration
- Battle StateとGame Stateの実運用上の接続
- WebSocket、message envelope、server sequence
- inventory、growth、event scriptなど新しいRPG機能

## 5. 設計判断

### 5.1 Authority

`GameSession`だけが実行中Game Stateを所有する。constructorへ渡されたstateと、外部へ返すsnapshotはdeep cloneし、参照共有による直接mutationを防ぐ。

### 5.2 State revisionとEvent sequence

- `revision`はGame Stateが実際に変化したCommandごとに1増加する。
- no-op Commandでは増加しない。
- `sequence`はSessionが発行する各Event envelopeごとに1増加する。
- pause/resume/closeはruntime lifecycleであり、Game State revisionを増加させない。

### 5.3 Command

最初のCommandは、Session Coreの境界を検証する最小集合に限定する。

- `mode.enter`
- `checkpoint.reached`
- `story.flag.set`

BattleやEvent固有Commandは、所有するruleと統合するDeliveryで追加する。

### 5.4 RNG

RNGはseed、現在state、draw countをJSON化可能なdataとして持つ。`Math.random()`をdomain ruleで直接利用せず、`nextRandom()`が新しいRNG stateと値を返す。

## 6. 実装手順

1. `model.ts`へGame State metadata、Command、Event、Session型を追加する。
2. `deterministic-rng.ts`へseed正規化と次値生成を実装する。
3. `game-session.ts`へclone、Command reducer、lifecycle、sequence発行を実装する。
4. `createInitialGameState()`を新metadataへ対応させる。
5. public exportを追加する。
6. RNGとGame Sessionのunit testを追加する。
7. shared/gameのbaseline testとrepository gateを再実行する。

## 7. Acceptance Criteria

- 同じseedから同じ乱数列を取得でき、入力RNG stateを変更しない。
- 異なるseedは異なる乱数列を生成する。
- `GameSession.snapshot()`の戻り値を変更しても内部stateは変化しない。
- 有効Commandでrevisionが1増え、対応Eventが発行される。
- 同じ値を設定するCommandはno-opとなり、revisionとsequenceを増やさない。
- pausedまたはclosed SessionはCommandを受け付けない。
- resume後はCommandを再び受け付ける。
- Event sequenceはlifecycle eventを含めて単調増加する。
- StateはJSON round-trip後も同値である。
- 既存12 testを含むすべてのshared/game testが成功する。

## 8. 検証

変更中:

```bash
bunx vitest run shared/game
bun run typecheck
```

完了時:

```bash
bun run verify
```

期待結果は全commandの終了code 0とする。既存testまたは下流typecheckが失敗した場合、PhaserやReactへ互換処理を追加せず、変更を`shared/game`内へ戻して後方互換性を修正する。検証通過後のみScene Session Integrationへ進む。

## 9. 実装結果

- `GameState`へcontent version、revision、serializable RNG stateを追加した。
- `GameSession`がprivate stateを所有し、cloneしたsnapshotだけを公開するようにした。
- `mode.enter`、`checkpoint.reached`、`story.flag.set`を実装した。
- semantic event envelopeへsession ID、sequence、state revisionを追加した。
- active、paused、closed lifecycleと不正transitionの拒否を実装した。
- LCGによるseed付き決定論RNGをpure functionとして実装した。
- shared/game testは12件から22件へ増加し、4 test fileすべて成功した。
- 全体coverageはstatements 98.42%、branches 95.59%、functions 98.39%、lines 98.62%だった。
- `bun run verify`が成功した。

次のDeliveryはScene Session Integrationである。Game Session Coreの完了時点ではPhaser Sceneのstate生成方法を変更していない。
