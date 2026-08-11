# Delivery 2: Data-driven Field Runtime 実装計画

| 項目 | 内容 |
| --- | --- |
| 対応Stage | Stage 2: Data-driven World |
| 状態 | Complete |
| 主対象 | `shared/game`、`web/src/game/scenes/FieldScene.ts`、save migration |
| 依存 | Delivery 1 Content Contract and Validation |

## 1. 目的とプレイヤー価値

Signal Ruins固有の壁、入口、event tile、背景をField ruleとSceneから取り除き、Map Definitionを差し替えるだけで別の場所を歩けるruntimeへ移行する。場所ごとの入口、checkpoint、条件付き進路が一貫して保存・再開されることを保証する。

## 2. 満たす設計原則

- 5.1 世界を読む探索
- 8.1 Field
- 11.1 単一のGame State
- 11.2 RuleとPresentationの分離
- 11.6 データ駆動と安定ID
- 11.7 段階的な置き換え

## 3. 現状と問題

- `FIELD_MAP_WIDTH`、`FIELD_MAP_HEIGHT`、`FIELD_EVENT_TILE`、`wallTiles`がSignal Ruins専用である。
- `moveFieldParty`はmap引数を持たず、別mapへ再利用できない。
- `FieldState.eventTriggered`はどのtriggerが起きたかを表せない。
- `currentMap.checkpoint`が座標だけで、入口やcheckpointの安定IDがない。
- `FieldScene`が背景key、location label、event auraを直接知っている。
- `GameSession`が`signal-ruins-cleared`を特別扱いしてtrigger再発火を抑止している。

## 4. Scope

- `moveFieldParty`へ解決済みMap Definitionを渡し、collision regionから移動可否を判定する。
- entrance、checkpoint、on-enter trigger、map transitionをpure ruleで解決する。
- trigger条件をStory FlagとRelationshipから評価する限定的な`ContentCondition`として実装する。
- `FieldState.eventTriggered`を`pendingTriggerId: string | null`へ置き換える。
- `currentMap`を`mapId`、`entranceId`、`checkpointId`で識別するlocation stateへ移行する。
- `GameSession`へ`GameContentRegistry`を注入し、`field.move`と`field.trigger.resolve`で定義を参照する。
- `FieldScene`を現在mapの背景、label、visual markersから構築するgeneric presenterへ変更する。
- Game State schema v3とsave v2→v3 migrationを実装する。

## 5. Non-goals

- random encounterとencounter table
- terrain効果、段差、乗り物、斜め移動
- scrolling tilemap、巨大map、streaming chunk
- NPC pathfindingとfield AI
- Event Definitionの実行
- 新しいBattle rule

## 6. UX flowとAcceptance Criteria

```text
Continue / New Game
→ locationのmapIdをregistryで解決
→ entranceまたは保存済みparty位置へ配置
→ collisionに従って移動
→ trigger条件を満たすとsemantic eventを発行
→ Eventまたは別mapへ遷移
```

Acceptance Criteria:

- Signal Ruinsの外周壁と内部障害物が現在と同じ座標で機能する。
- `signal-ruins-entry`からparty追従位置を決定できる。
- trigger eventにtrigger ID、kind、target IDが含まれる。
- cleared flagがある場合のtrigger無効化をdata条件で表現し、Sessionから固有flag名を除去する。
- map transition後は新mapのentrance位置と向きへpartyを配置する。
- checkpoint IDで保存し、reload後に同じmapと安全な位置から再開する。
- 不存在map、entrance、checkpointでは移動を開始せず、typed errorになる。

## 7. State・Command・Event・Content schemaへの影響

予定する主な変更:

```text
GameState.location
├ mapId
├ entranceId
└ checkpointId

FieldState
├ partyPositions
├ facing
└ pendingTriggerId
```

- `field.move`は`field.moved`に加え、条件成立時に`field.triggered`を発行する。
- `field.trigger.resolve`はpending triggerを消費し、event開始、map移動、checkpoint到達のいずれかを確定する。
- `map.entered`と`checkpoint.reached`はmap ID、entrance/checkpoint ID、配置座標を含む。
- `ContentCondition`は`flag.equals`、`relationship.gte/lte`、`all`、`any`、`not`だけを許可する。
- schema v2の既知座標`(3,6)`と`(14,5)`をstable checkpoint IDへ移すmigration tableを持つ。

## 8. Ownershipとsystem境界

- Map Definition: 地形、入口、trigger、presentation metadataの定義。
- Game State: 現在地、party位置、向き、pending triggerのplayer固有状態。
- shared field rule: collision、条件評価、移動、trigger解決。
- Game Session: command受付、state revision、semantic event発行。
- Field Scene: sprite同期、camera、aura、fade。collisionや条件を独自判定しない。

## 9. 依存関係と導入順序

1. location/field state v3とmigrationを追加する。
2. Map Definitionを受け取るpure field ruleを既存testと並行実装する。
3. Game Sessionへregistry注入と新command/eventを追加する。
4. Signal Ruins Map Definitionを既存定数と同値になるよう作る。
5. FieldSceneをregistry consumerへ切り替える。
6. save/loadとcheckpoint E2Eをv3へ更新する。
7. 旧map定数とScene固有分岐は、同値性確認後に削除する。

## 10. Failure・recovery・security

- saveのmap IDがregistryに存在しない場合はNew Gameへ黙ってfallbackせず、content incompatibilityとしてLauncherへ返す。
- map transitionはtarget解決後にatomicにstateを更新し、中間状態をsnapshotへ出さない。
- pending trigger中は追加moveをno-opにし、二重event開始を防ぐ。
- migration対象外の旧座標はunsupported saveとして扱い、破損扱いと区別する。
- Content Definitionの条件から任意property accessや任意code実行を許さない。

## 11. Unit・integration・E2E・visual検証

```bash
bunx vitest run shared/game web/src/game/scenes
bun run validate:game-content
bun run verify
bun run verify:e2e
```

- unit: wall、境界、追従、各trigger kind、条件true/false、入口配置、atomic transition。
- migration: v2初期saveとSignal Ruinsクリアsaveをv3へ変換して同じ位置へ復元。
- integration: Sessionへregistryを渡し、moveからevent semantic eventまで確認。
- E2E: 既存Signal Ruinsルートとreload後checkpointを維持。
- visual: 320×192と整数scale 2/3で背景、marker、party depth、location labelを確認。

## 12. Performanceとaccessibilityへの影響

- collision regionはregistry構築時にlookup用Setへ正規化し、移動ごとの全配列走査を避ける。
- 条件式のdepthとnode数に上限を設ける。
- markerは色だけでなく形とpulseでinteractionを示し、既存contrastを維持する。
- reduced motion設定導入はStage 5だが、無限tweenを一箇所のpresentation設定から停止可能にする。

## 13. Rollout・削除する旧経路・完了条件

- Signal Ruins一mapだけをconsumerとして切り替え、Delivery中もplayable pathを維持する。
- `FIELD_MAP_WIDTH`、`FIELD_MAP_HEIGHT`、`FIELD_EVENT_TILE`、`wallTiles`を削除する。
- `FieldScene`の固定背景key、固定label、固定event tile座標を削除する。
- `GameSession`の`signal-ruins-cleared`固有分岐を削除する。
- v2 save migration、既存E2E、visual確認が通るまで旧経路削除を完了扱いにしない。

## 14. 未決事項と採用しなかった代替案

- 採用: 背景画像 + logical grid。現在のpixel-art表現を維持しながらruleだけをdata化できる。
- 不採用: この時点でtile-by-tile rendererへ全面移行する。visual regressionと制作量が大きすぎる。
- 採用: checkpointはstable IDで保存する。座標だけよりcontent更新時の意図を保ちやすい。
- 未決: camera zoneは二つ目のmapで必要性を確認し、実例がなければschemaへ追加しない。
