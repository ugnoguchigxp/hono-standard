# Delivery A2-2: Rigged Player and Locomotion 実装計画

| 項目 | 内容 |
| --- | --- |
| 対応Track | Action3D / Stage A2 |
| 状態 | In Progress |
| 主対象 | player DCC source、Action3D asset contract、`web/src/action3d/presentation/animation` |
| 依存 | A2-1 asset pipelineとapproved Aether Runner concept |

## 1. 目的

A1のprimitive bodyとroot transform animationを廃止し、造形、骨格、skin weight、pose、timingを持つAether Runnerへ置き換える。入力の反応性を落とさず、身体の重心、足接地、剣とcapeのsecondary motionから移動状態を読めるようにする。

## 2. Character model

- 6〜7頭身のstylized humanoidとし、頭、髪、顔面plane、上半身、腰、腕、手、脚、靴、cape、belt、片手剣を独立して造形する。
- gameplay cameraで消える微細detailより、髪、肩、cape、剣の外形を優先する。
- body、cloth、hair、metal、skin、energy accentをmaterial value/roughnessでも区別する。
- faceはA2では固定表情または最小のeye/mouth textureとし、facial rigは導入しない。
- weaponは右手socketへattachし、trail用blade root/tip markerを持つ。
- cape/hairはcloth physicsを使わず、少数boneのauthored secondary animationまたは軽量spring presentationに限定する。

## 3. Rig and clips

最低限のdeformation chain:

```text
root → hips → spine → chest → neck → head
              ├ shoulder.L → upper_arm.L → lower_arm.L → hand.L
              ├ shoulder.R → upper_arm.R → lower_arm.R → hand.R
hips → upper_leg.L/R → lower_leg.L/R → foot.L/R → toe.L/R
```

required clip:

| Clip | 目安 | Loop | 主な品質条件 |
| --- | ---: | --- | --- |
| Idle | 1.8–2.4 s | Yes | 呼吸、重心、手と剣が静止しすぎない |
| Walk | 0.9–1.2 s | Yes | 左右contactが明確、4.2 unit/sへspeed match |
| Run | 0.65–0.85 s | Yes | 7 unit/sへspeed match、cape follow-through |
| JumpStart | 0.18–0.3 s | No | 踏切poseが入力直後に読める |
| JumpLoop | 0.4–0.8 s | Yes | 上昇/下降を極端に固定しない |
| Land | 0.16–0.28 s | No | 落下量に応じた軽いcompression |
| Dodge | 0.38–0.5 s | No | 移動方向と身体方向が一致する |
| Hit | 0.22–0.36 s | No | silhouetteで被弾方向が読める |
| Defeat | 0.8–1.3 s | No | ground penetrationを起こさない |

Attack 1–3はA2-3で仕上げるが、同じrigとrest poseでexportできることを本Deliveryで確認する。

## 4. Runtime animation controller

`AnimationGroup`を直接locomotionごとにstop/playする現実装を置き換え、presentation controllerを作る。

- logical stateを`grounded locomotion`、`airborne`、`one-shot`、`combat overlay`へ分類する。
- Idle/Walk/Runはweight crossfadeし、同一clipをsnapshotごとにrestartしない。
- move speedからWalk/Run playback ratioを狭い範囲で調整し、foot slidingを抑える。
- JumpStart→JumpLoop→Landはdomainのgrounded/velocity transitionで選び、clip完了をjump authorityにしない。
- Dodge/Hit/Defeatはrevision/event IDで一度だけ開始し、StrictModeやsnapshot再送で重複しない。
- lock-on中は上体/weapon方向と下半身移動の見え方を調整するが、A2ではfull animation layeringを必須にしない。
- model rootのscale/offset補正を毎frame適用せず、asset contractのunit/ground offsetで正規化する。

## 5. Camera and presentation alignment

- shoulder、head、weaponが通常camera distanceで重ならないFOV/offsetを再調整する。
- camera obstacle短縮時もplayer全身または上半身とweaponを見失わない。
- lock-on recenterが急にcharacterを反転させず、turn rateとanimationを整合させる。
- reduced motion時はcamera bob、landing impulse、cape springを抑える。

## 6. Acceptance Criteria

- playerがskinned meshとpose-bone animationを持ち、A1のroot-only clipをproduction pathで使用しない。
- 360度turntableでskin collapse、elbow/knee inversion、cape/weapon penetrationがblocking levelにない。
- Idle↔Walk↔Runを30秒反復してrest pose pop、T-pose、毎frame restart、目立つfoot slidingがない。
- Jump、Dodge、Hit、Defeatがdomain timingと矛盾せず、低fpsでもone-shotを飛ばさない。
- keyboard/mouseとgamepadで同じlogical animation transitionを得る。
- player GLB、triangle、bone、material、texture budgetをvalidatorが通す。
- fixed cameraのA1/A2比較で、顔、髪、衣装、cape、剣、正面、移動状態を128px silhouetteでも説明できる。

## 7. Verification

```bash
bun run validate:action3d-models -- --asset aether-runner
bunx vitest run web/src/action3d/presentation/animation shared/action3d
bun run test:e2e -- tests/e2e/action3d-visual.spec.ts --grep "player locomotion"
```

visual evidenceはturntable、全clip contact sheet、通常速度と0.25倍速のtransition captureを残す。
