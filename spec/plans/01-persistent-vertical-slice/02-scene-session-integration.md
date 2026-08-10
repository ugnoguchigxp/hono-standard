# Delivery 2: Scene Session Integration 実装計画

| 項目 | 内容 |
| --- | --- |
| 状態 | Complete |
| 主対象 | `shared/game`、`web/src/game` |
| 依存 | Delivery 1 Game Session Core |

## 目的

Field、Event、Battleが個別にdemo stateを作る状態を終わらせ、Reactが生成した一つの`GameSession`をPhaser全Sceneで共有する。Scene内のstateは描画用snapshotとし、rule適用と正規state更新はSession Commandを経由する。

## Scope

- Field StateをGame Stateへ含める。
- Field移動、Battle開始・tick・command・完了をGame Session Commandへ追加する。
- Battle EventをGame Sessionのsemantic event envelopeへ変換する。
- Phaser registryを介して全Sceneへ同じSessionを渡す。
- Boot SceneがSession modeから開始Sceneを決定する。
- Battle勝利後にparty HP、Story Flag、checkpointをGame Stateへ反映する。

## Non-goals

- save repositoryと開始UI
- map/eventのdata駆動化
- 新しいBattle rule、reward、growth

## Acceptance Criteria

- Field移動でSession内Field Stateが更新される。
- Event開始時にmodeが`event`になる。
- Battle中のHPとgaugeがSession内Battle Stateに存在する。
- 勝利後にBattle Stateが閉じ、persistent party HPが更新される。
- Field→Event→Battle→FieldでSession IDが変化しない。
- 既存playable pathとStrictMode cleanupが維持される。

## 検証

```bash
bunx vitest run shared/game web/src/game
bun run typecheck
bun run verify
```

## 実装結果

- `GameState`へfield位置、向き、party追従、event triggerを追加し、移動を`field.move` Commandへ統合した。
- Battle開始、tick、command、完了をGame Session Commandとして実装し、Battle Eventをsemantic eventとして購読可能にした。
- Reactが生成した一つの`GameSession`をBoot、Field、Event、Battleの各Sceneへ注入した。
- Boot Sceneは保存されたmodeとstateから開始Sceneを選択する。
- Signal Ruins勝利後はpersistent party HPとStory Flagを更新し、Battle Stateを閉じてFieldへ戻す。
- Session unit test、Scene test、typecheck、repository全体の品質ゲートが成功した。
