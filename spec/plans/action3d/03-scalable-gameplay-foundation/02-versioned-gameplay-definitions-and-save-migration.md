# Delivery A3-2: Versioned Gameplay Definitions and Save Migration 実装計画

| 項目 | 内容 |
| --- | --- |
| 対応Track | Action3D / Stage A3 |
| 状態 | Implemented (2026-08-11) |
| 主対象 | `shared/action3d/content`、`shared/action3d/model`、`shared/action3d/save-codec`、Action3D content |
| 依存 | Delivery A3-1完了、現行simulation golden fixture |

## 1. 目的

player tuning、attack、enemy archetypeをversioned definitionとしてcontent registryへ移し、runtime stateはstable IDと現在値だけを保持する。現行V1 checkpointを失わずV2へ移行し、第二attack/enemyをstate unionの増殖なしで追加できる状態にする。

## 2. Target contracts

```text
Action3dManifestV3
├ tuning.player
│  ├ movement / jump / dodge / stamina
│  └ defaultAttackSetId
├ attackSets[]
│  └ attacks[] { id, input, startupMs, activeMs, recoveryMs,
│                damage, range, arc, staminaCost, animationId }
├ enemyArchetypes[]
│  └ { id, modelAssetId, maxHp, moveSpeed, perception,
│      behaviorId, attacks[], presentationProfileId }
└ worlds[]
   └ enemies[] { instanceId, archetypeId, position, overrides? }
```

save state V2はenemy instanceごとに`instanceId`、`archetypeId`、HP、position、behavior runtimeだけを保存する。attack definition、model URL、damage、clip durationは保存しない。active attackなどcheckpointで正規化される一時stateは保存schemaから除外するか、常にneutralであることをcodecが検証する。

## 3. Compatibility policy

- manifest V2はparse後にinternal V3 definitionへnormalizeし、現行contentの挙動を維持する。
- new contentの正本はmanifest V3とし、V2 writerは追加しない。
- save V1→V2 migrationはpure functionとし、元payloadを変更しない。
- format version、state version、manifest version、content versionを別判定にする。
- 同じdefinition IDの意味を破壊的に変えない。balance変更を許容する項目とsave互換を壊す項目を文書化する。
- migration失敗は`corrupt`へ丸めず、source versionと失敗stepを持つ結果にする。

## 4. Implementation steps

1. 現行定数とworld enemy値を一覧化し、legacy normalizationの期待値fixtureを作る。
2. attack、attack set、player tuning、enemy archetype、enemy instance schemaを追加する。
3. cross-reference、duplicate ID、animation clip、model asset、numeric invariantをregistry validatorへ追加する。
4. simulationへ`Action3dGameplayDefinitions`を渡し、現行light combo/melee behaviorをdefinitionから読む。
5. state V2とsave V1→V2 migrationを追加し、V1 decode後にV2 writerで保存する。
6. Launcherへmigration preview/commit境界を追加し、save成功後だけ旧payloadを置換する。
7. manifest V2の現行contentとmanifest V3へ変換した同一contentでgolden fixtureを比較する。
8. unsupported future version、missing definition、removed archetype、partial migrationのfixtureを追加する。

## 5. Acceptance Criteria

- `simulation.ts`系moduleにplayer speed、damage、attack range、wind-up/recover時間の製品値を直接定義しない。
- 現行light comboとmelee SentinelがV2/V3 definitionでも同じgolden結果を返す。
- world内enemyはinstance IDとarchetype IDを分け、同じarchetypeを複数配置できる。
- missing attack/archetype/model/clip referenceをruntime開始前にvalidatorが拒否する。
- V1 checkpointをV2へmigrationしてContinueでき、元payloadはmigration保存成功まで保持される。
- future saveはunsupported、構造破損はcorrupt、content不足はincompatibleとして区別される。
- save stateへdefinitionのdamage、range、asset URL、animation nameを複製しない。
- migrationは同じ入力に対して同じ出力を返し、二回適用しても追加変換しない。

## 6. Verification

```bash
bun run validate:action3d-content
bunx vitest run shared/action3d/content shared/action3d/save-codec shared/action3d/simulation
bun run typecheck
bun run test:e2e -- tests/e2e/action3d.spec.ts --grep "checkpoint|migration|Continue"
```

V1 fixtureは実際にA1で生成したpayloadを匿名化して固定し、test内でV2 shapeを手作業生成しない。

## 7. Rollback

V2 writerの有効化はfeature flagで分ける。read pathはV1/V2を維持し、問題時はV1 content normalizationと旧simulation adapterへ戻せるようにする。一度V2をserverへ保存した後に旧clientへ戻す場合は、silent downgradeせずunsupportedを表示する。
