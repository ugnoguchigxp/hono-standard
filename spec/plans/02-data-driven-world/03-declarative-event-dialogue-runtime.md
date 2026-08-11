# Delivery 3: Declarative Event and Dialogue Runtime 実装計画

| 項目 | 内容 |
| --- | --- |
| 対応Stage | Stage 2: Data-driven World |
| 状態 | Complete |
| 主対象 | `shared/game/event`、`shared/game/game-session.ts`、`web/src/game/scenes/EventScene.ts` |
| 依存 | Delivery 1、Delivery 2のtrigger event contract |

## 1. 目的とプレイヤー価値

会話を送るだけの固定Sceneを、人物の台詞、動き、表情、選択、Story Flag、Relationship、戦闘開始を宣言的に組み合わせられるevent runtimeへ移行する。プレイヤーの選択が後の反応に残る最初の物語systemを提供する。

## 2. 満たす設計原則

- 5.2 人物関係が残る会話
- 8.2 EventとDialogue
- 11.1 単一のGame State
- 11.2 RuleとPresentationの分離
- 11.3 CommandとEvent
- 11.5 決定論と再現可能性

## 3. 現状と問題

- `EventScene`がdialogue配列、title、actor配置、flag ID、encounter factoryを直接所有する。
- 会話の途中状態がGame Stateにないため、event ruleをScene外でtestできない。
- Story Flagは設定できるが、条件分岐を共通評価する仕組みがない。
- Relationshipsは初期値を保存するだけで、変更command/eventがない。
- Sceneが直接複数commandを発行するため、event進行のatomicityと再現性が弱い。

## 4. Scope

- 許可済みnodeだけを扱うpure `advanceEvent` interpreterを実装する。
- event nodeは`line`、`wait`、`actor.move`、`actor.expression`、`choice`、`flag.set`、`relationship.adjust`、`battle.start`、`map.enter`、`checkpoint.reach`、`end`を対象にする。
- `ActiveEventState`をGame State schema v4へ追加し、event ID、current node ID、awaiting state、presentation actor stateを保存可能にする。
- Game State v3からv4へのsave migrationを同時に追加し、既存v2 saveはv2→v3→v4と順に移行する。
- `event.start`、`event.advance`、`event.choose`をGame Session Commandへ追加する。
- dialogue表示、選択肢focus、actor presentationをsemantic eventから行うgeneric EventSceneへ切り替える。
- Signal Ruins eventをEvent Definitionへ移し、既存battleへencounter ID経由で接続する。
- Relationship値を`-100..100`へclampし、変更をsemantic eventとして発行する。

## 5. Non-goals

- 任意JavaScript、式language、plugin script
- inventory/item操作。Item state導入後のStage 3でcommandを追加する。
- voice playback、lip sync、localization system
- branching history UI、会話log、skip mode、auto mode
- battle contentとEnemy master dataの全面data化
- cutscene専用timeline editor

## 6. UX flowとAcceptance Criteria

```text
field.triggered
→ event.start(eventId)
→ interpreterが自動nodeを安全上限まで処理
→ line / choice / presentation eventで入力待ち
→ CONFIRMまたは選択
→ flag・relationship・location・battleをGame Stateへ反映
→ event終了またはmode遷移
```

Acceptance Criteria:

- Signal Ruinsの既存2台詞とbattle開始がEvent Definitionだけから再現される。
- dialogue lineはspeaker IDとtextを分離し、Sceneが`"Mira:"`をparseしない。
- 使用可能なchoiceだけが条件に応じて表示され、上下入力とConfirmで選べる。
- choice確定は一度だけ適用され、Story FlagとRelationshipがrevision付きstateへ残る。
- event途中snapshotをJSON round-tripしても同じnodeから再開できる。
- node graph loopまたは自動node過多は上限で停止し、typed errorを返す。
- 不正なchoice ID、event外でのadvance、重複入力を拒否する。

## 7. State・Command・Event・Content schemaへの影響

予定するstate:

```text
GameState.event: ActiveEventState | null
ActiveEventState
├ eventId
├ nodeId
├ status: running | awaiting-confirm | awaiting-choice
├ visibleLine
├ choices[]
└ actors[] { actorId, slot, expression }
```

主なsemantic event:

- `event.started`
- `dialogue.presented`
- `choice.presented`
- `choice.selected`
- `event.actor.moved`
- `event.actor.expression.changed`
- `story.flag.changed`
- `story.relationship.changed`
- `event.completed`

Battle nodeはraw `BattleState`をcontentへ持たず、安定した`encounterId`を発行する。既存battle生成は`EncounterProvider`境界で解決し、Stage 3–4のmaster data化までBattle ruleを変更しない。

## 8. Ownershipとsystem境界

- Event Definition: node graph、文言、条件、presentation instruction。
- Event interpreter: node遷移、choice validation、state operationの決定。
- Game Session: interpreter結果をGame Stateへatomic適用し、semantic eventをsequence付きで公開。
- Event Scene: text、portrait/sprite、cursor、transition animation。flagやrelationshipを直接変更しない。
- Encounter Provider: eventのstable encounter IDと既存Battle State factoryの限定的adapter。

## 9. 依存関係と導入順序

1. ActiveEventState、event command/event、Game State schema v4とv3→v4 migrationを追加する。
2. condition evaluatorをDelivery 2と共有し、二重実装を避ける。
3. pure interpreterとexecution budgetを実装する。
4. Session reducerへatomic event進行を統合する。
5. generic EventSceneを旧Sceneと並行実装する。
6. Signal Ruins event dataをconsumerとして切り替える。
7. component、integration、save round-trip、E2Eを更新する。
8. 旧dialogue配列とSceneからの直接flag/battle操作を削除する。

## 10. Failure・recovery・security

- 一commandあたりの自動実行node数に上限を設定し、循環graphによるmain thread停止を防ぐ。
- 未知node type、未知actor、未知encounterはvalidatorで拒否し、runtimeでもtyped errorにする。
- choice IDは表示中の候補だけを受け付け、隠しoptionや古いUIからの入力を拒否する。
- node処理途中で失敗した場合はGame Stateを部分更新せず、直前stateを維持する。
- event中のautosaveは今回追加しない。checkpoint node到達時だけStage 1の保存契機を使う。

## 11. Unit・integration・E2E・visual検証

```bash
bunx vitest run shared/game web/src/game
bun run validate:game-content
bun run verify
bun run verify:e2e
```

- unit: 各node、条件分岐、choice、clamp、invalid transition、execution budget、input immutability。
- integration: field trigger→event→battle start、event→map transition、checkpoint semantic event。
- save: line待ちとchoice待ちのJSON round-trip、v2→v3 migration後のevent null。
- E2E: Signal Ruins会話からbattleへの既存経路を維持。
- visual: 長文wrap、2–4 choice、focus、speaker、320×192でのoverflowを確認。

## 12. Performanceとaccessibilityへの影響

- 自動node処理は同期budgetを持ち、animation完了待ちはsemantic cueで区切る。
- DialogueはConfirmで全文表示後に次へ進む二段階入力を許容できる構造にする。
- choice focusを色だけでなくcursorと枠で示す。
- textは最低7–8px internal sizeと既存contrastを維持し、長文はdata validationでも文字数上限を確認する。
- key repeatでchoiceが多重確定しないinput lockを設ける。

## 13. Rollout・削除する旧経路・完了条件

- 最初のconsumerはSignal Ruins event一件に限定する。
- `EventScene`の`dialogue`配列、固定title、固定actor配置、直接flag設定、直接battle factory呼出しを削除する。
- event途中stateをsave codecが検証できる状態にするが、autosave policyは変更しない。
- Signal Ruins E2E、event interpreter全node test、invalid graph testが通過して完了とする。

## 14. 未決事項と採用しなかった代替案

- 採用: ID付きnode graph。choice分岐と再開位置をserializableに表現できる。
- 不採用: generator/functionでeventを書く。save、validation、非信頼data境界と相性が悪い。
- 不採用: dialogue専用配列とcutscene専用systemの分離。現段階では共通commandの方が小さい。
- 未決: text typewriter速度、auto/skip、会話履歴はStage 5のInput/Accessibility計画で決める。
