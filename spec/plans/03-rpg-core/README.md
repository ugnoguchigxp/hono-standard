# Stage 3: RPG Core

| 項目 | 内容 |
| --- | --- |
| 対応計画 | Character Growth・Inventory・Equipment / Battle Reward |
| 状態 | Complete |

## 目的とプレイヤー価値

戦闘をその場限りのdemoから、経験値、成長、Ability、所持品、装備へ結果が残るRPG loopへ移行する。プレイヤーは戦闘前にpartyを整え、勝利で強くなり、その状態をcheckpoint saveから継続できる。

## 実装範囲

- character、ability、item、equipment、enemy、encounter rewardをcontent masterへ追加した。
- EXPからLevelを一意に導出し、Levelごとの成長値と装備補正からHP、MP、Attack、Defense、Speedを再計算する。
- Level到達時のAbility習得、MP消費、回復の泉によるHP/MP全回復を実装した。
- field menuのStatus、Items、EquipmentをGame Stateへ接続し、item使用と装備交換をCommand経由で操作可能にした。
- 勝利時のEXP、Level、Ability習得、item dropをGame Stateへ反映し、敗北時のRetryを同じencounterから再構築する。
- Game State schemaをv5へ更新し、v1–v4 saveをinventory、equipment、MP、Abilityを含む現行stateへ移行する。

## State・Command・Event

正本は引き続き`GameSession`が所有する。画面はstateを直接変更せず、次のCommandを送る。

| Command | 主なSemantic Event |
| --- | --- |
| `party.item.use` | `party.item.used` |
| `party.equipment.change` | `party.equipment.changed` |
| `battle.complete` | `party.experience.gained`、`party.level.gained`、`party.ability.learned`、`party.reward.received` |
| `battle.retry` | `battle.started` |

能力値計算は`shared/game/progression-engine.ts`だけが担当し、field menuとbattle stateは同じ計算結果を利用する。装備交換では現在HP/MPの減少量を保ち、最大値だけが変わって不自然な全回復にならないようにする。

## UXと失敗時の扱い

- StatusはLevel、HP/MP、EXP、次Levelまでの値、能力値、習得Abilityを表示する。
- Itemsは所持数と説明を表示し、対象memberを選んでfieldで使用する。効果のない対象やkey itemは消費しない。
- Equipmentはmemberとslotを選び、装備可能者・slot・在庫を検証して交換する。
- 戦闘不能時は確認入力でencounterをRetryする。逃走可能戦ではEscape後のHP/MP/item消費を継続stateへ同期する。
- 不明なmaster ID、負数在庫、不正loadoutはcontent validator、save decoder、Game State invariantの各境界で拒否する。

## Verification

```bash
bun run validate:game-content
bunx vitest run shared/game/progression-engine.test.ts shared/game/game-session.test.ts shared/game/save-codec.test.ts
bun run verify
```

完了条件:

- reward、level up、Ability習得、dropが同一Game Stateへ入り、save/load後も維持される。
- menuからitemを使用し、装備交換後の能力値がbattleでも一致する。
- current saveのround-tripとv1–v4 migrationが成功する。
- 不正なitem使用、装備、reward参照がstateを部分更新しない。

## Non-goals

- shop、craft、character固有skill tree、Level 50以降の成長
- 複数save slotとserver save
- gamepad、touch、key configurationを含むStage 5の共通UI
