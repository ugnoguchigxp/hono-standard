# Delivery 03: Session and Scene Decomposition 実装計画

| 項目 | 内容 |
| --- | --- |
| 状態 | Complete (2026-08-12) |
| 優先度 | P1: behavior-preserving maintainability |
| 主対象 | `shared/game/game-session.ts`、`shared/game/content/registry.ts`、`web/src/game/scenes` |
| 依存 | Delivery 01のsave/conflict state契約 |

## 1. 目的

1,000行を超えた`GameSession`、`BattleScene`、content registryの責務を、public contractとplayable pathを変えずに分割する。新しいmap、battle command、menuを追加するときに一つの巨大classを同時変更せずに済み、listenerやScene lifecycleの障害がcommit済みGame Stateを不明確にしない構造へ移す。

プレイヤーに見える機能追加は行わないが、Scene遷移や通知処理の一箇所の失敗で進行が二重適用されたり、次のcontent追加で既存経路が壊れたりする確率を下げる。

## 2. 原則

- rewriteではなくcharacterization test付きの段階的extractを行う。
- Game State/save format、Command/Event union、`GameSession` public facadeを維持する。
- domain reducerはPhaser、React、audio、timerへ依存しない。
- Sceneは正規stateを所有せず、input coordinationとpresentationに限定する。
- 一つのcommitでは一つの責務だけを移し、各commitで`bun run verify`を通す。

現状は`GameSession`がclone、content compatibility、全command reducer、cross-mode orchestration、lifecycle、publicationを所有し、`BattleScene`が入力、layout、HUD、animation、audio、clockを所有する。本DeliveryはGame State authorityを移さず、ownershipだけを明示する。

### Scope

- GameSession clone、compatibility、mode別reducer、publicationの分割
- listener failure contractとdiagnostics sink
- Battle Sceneのinput/HUD/animation/layout分割
- Field/Event/Menu lifecycle responsibilityの整理
- content registryのparse/validation/index分割
- public importとserialized contractのcharacterization test

## 3. Target structure

```text
shared/game/session/
├ state-clone.ts
├ state-compatibility.ts
├ reducer.ts
├ field-reducer.ts
├ event-reducer.ts
├ battle-reducer.ts
├ party-reducer.ts
└ game-session.ts

web/src/game/scenes/battle/
├ BattleScene.ts
├ BattleInputController.ts
├ BattleHud.ts
├ BattleAnimationDirector.ts
└ battle-layout.ts
```

既存の`shared/game/game-session.ts`と`web/src/game/scenes/BattleScene.ts` import pathはbarrelまたは薄いfacadeで維持し、consumerを一括変更しない。実装中に最終directory名を調整してもownership境界は維持する。

## 4. GameSession分割

1. snapshot isolation、command transition、error、sequenceを現行挙動のcharacterization testとして追加する。
2. clone処理を`state-clone`へ移し、全nested stateの独立性をtable-driven testで固定する。
3. contentVersion、map、party、event、battle参照検証を`state-compatibility`へ移す。
4. Field、Event、Battle、Party/Story commandを個別reducerへ移す。
5. root reducerはCommand unionのexhaustive dispatchとcross-mode orchestrationだけを所有する。
6. `GameSession` facadeはlifecycle、state authority、revision、event envelope、subscriptionだけを所有する。

### Listener failure contract

- state compatibility確認とcommitが完了した後、各listenerを個別に呼び出す。
- 一つのlistener例外で後続listenerを停止しない。
- listener例外を`GameSessionListenerErrorSink`へ渡し、`dispatch()`のrule結果を失敗としてthrowしない。
- error sink自身の例外もstate transitionへ逆流させない。
- runtime adapterはerror code、session ID、sequenceだけをdiagnosticsへ送り、Game State全文を送らない。

## 5. Scene分割

### Battle

- `BattleScene`: Phaser lifecycle、subcomponent生成・破棄、GameSession接続だけを担当する。
- `BattleInputController`: menu layer、cursor、target、Game ActionからCommandへの変換を担当する。
- `BattleHud`: text/window生成とdirty state描画を担当する。
- `BattleAnimationDirector`: semantic Battle Eventを順序付きpresentationへ変換する。
- `battle-layout`: viewportから座標を計算するpure functionとする。

### Field / Event / Menu

- Fieldのmap loading/retryを専用runtime loaderへ抽出する。
- Eventのdialogue progressionとactor presentationを分離する。
- Field Menuのparty/item/equipment/settings画面を共通window rendererとmenu modelへ分離する。
- Scene shutdownでInputManager、timer、tween、loader abort、subscriptionが一箇所から破棄されるようlifecycle ownerを明示する。

### Content Registry

- schema parse、cross-reference validation、event graph validation、runtime index/queryを別moduleへ分離する。
- validation issueのcode、documentPath、dataPathは互換維持する。
- build validatorとbrowser loaderが同じregistry builderを使う契約を維持する。

## 6. Acceptance Criteria

- refactor前後で固定snapshot・command列・seedから得られる最終Game Stateとsemantic Event列が同値である。
- save serialization結果とv1–v4 migration結果が変化しない。
- `GameSession` public importと既存consumerの呼出方法が維持される。
- listener Aがthrowしてもlistener Bへ同じtransitionが一回届き、state revisionは一回だけ増える。
- listener failure後に同じCommandを再送しても、呼び出し側が未commitと誤認するAPIにならない。
- Scene restart、route離脱、React StrictMode remount後にkeyboard listener、timer、tween、audio、canvasが残らない。
- content validation issueのcodeとpathが既存fixtureで一致する。
- `game-session` facadeと`BattleScene` coordinatorがそれぞれorchestration中心の規模となり、新機能ruleまたはHUD詳細を直接持たない。

## 7. UX・State・Schemaへの影響

- Field、Event、Battle、Menuの画面、操作、演出速度、音声、save timingを変更しない。
- `GameState`、save format、content schema、Game Command、Semantic Eventのserialized shapeを変更しない。
- module配置とinternal interfaceだけを変更し、`@shared/game` public exportを維持する。
- DOM focus、keyboard/gamepad/touch mapping、high contrast、reduced motionの挙動を維持する。
- snapshot cloneとcompatibility checkはdomain、listener error adapterはapplication boundary、Phaser object lifecycleは各Scene coordinatorが所有する。

## 8. Failure・Recovery・Security・Performance

- extract途中の例外でstateを部分commitしないよう、reducerは新stateを返し、root facadeがcompatibility確認後に一度だけcommitする。
- listener failureはdiagnosticsへ隔離し、Game State全文や個人情報をerror sinkへ渡さない。
- refactor前後のclone回数、dispatch回数、bundle sizeを記録し、10%以上の退行がある場合は原因を解消してからmergeする。
- Scene shutdown failureをdevelopment testで検出し、残ったcanvas/listenerを次起動へ再利用しない。
- accessibility treeと入力contextをScene分割の外部contractとして維持する。

## 9. Migration・Rollout

save/data migrationはない。code migrationは次の順で行う。

1. 現行pathにcharacterization testを追加する。
2. internal moduleを追加し、既存facadeから呼び出す。
3. consumer importを変えずにownershipを移す。
4. 全consumer移行後に旧private method/rendererだけを削除する。
5. Delivery 04 baselineを採取し、旧毎frame pathがまだ同じであることを確認する。

各Rollout checkpointでE2E playable pathを通し、問題時はそのextract commitだけをrevertする。新旧reducerをruntime flagで長期併存させない。

## 10. 検証

```bash
bunx vitest run shared/game/game-session.test.ts shared/game/content/registry.test.ts
bunx vitest run web/src/game/GameScreen.test.tsx web/src/game/presentation web/src/game/menu
bun run validate:domain-boundaries
bun run verify
bunx playwright test tests/e2e/smoke.spec.ts --grep "field map|choices|checkpoint"
```

## 11. Rollout checkpoints

1. clone/compatibility extract
2. reducer extract
3. listener isolation
4. BattleScene presentation extract
5. Field/Event/Menu/Registry extract

各checkpointは単独でrevertできなければならない。performance変更はこのDeliveryへ混ぜず、Delivery 04のbaseline比較対象を維持する。

## 12. Non-goals

- gameplay rule、content、save、UI designの変更
- state management、dependency injection、event bus libraryの追加
- SceneをReact componentへ置換すること
- performanceのためにcompatibility validationを無効化すること

## 13. 未決事項と不採用案

- 未決: content registry分割を本Deliveryの最後まで含めるか。GameSession/Scene変更量がreview上限を超える場合は独立checkpointへ分ける。
- 未決: facade/coordinatorの行数上限。数値だけを目的にせず、public responsibilityと変更理由の数でreviewする。
- 不採用: `GameSession`の全面rewrite。save/command互換性を同時に検証できない。
- 不採用: generic event busへの置換。型付きCommand/Event契約とlistener commit問題を解決せず、追跡を難しくする。
- 不採用: Phaser SceneごとにGame Stateを分ける。単一Session authorityを壊す。

## 14. 実装結果

- `GameSession`を212行のauthority facadeとclone/compatibility/reducer moduleへ分離し、selector subscriptionとlistener failure isolationを追加した。
- contentのruntime registryとcondition評価をvalidation builderから分離し、public importとissue contractを維持した。
- `BattleScene`を488行のcoordinatorへ縮小し、input controller、dirty HUD、animation director、pure layout、fixed clockを独立module化した。
- Scene shutdown時のInputManager、content abort、Phaser runtime/audio/canvas破棄契約を維持し、StrictMode/component/E2Eで回帰を確認した。
- 残存risk: Field/Event/Menuは現状500–700行だが、個別lifecycle ownerが明確で1,000行超の責務集中は残っていない。
