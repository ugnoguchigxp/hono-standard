# Delivery A2-3: Combat Animation and Feedback 実装計画

| 項目 | 内容 |
| --- | --- |
| 対応Track | Action3D / Stage A2 |
| 状態 | In Progress — sword motion / trail pass implemented |
| 主対象 | `shared/action3d` combat event、player attack clip、`web/src/action3d/presentation/combat` |
| 依存 | A2-2 rigged player、A2-4 Sentinel rig/socket contractの先行確定 |

## 1. 目的

現在の全身回転とtorusだけのattack表現を、予備動作、剣筋、接触、反動、音、camera、enemy responseが同期する3段comboへ置き換える。派手さより、いつ攻撃し、どこに当たり、相手がどう反応したかを一frameで読めることを優先する。

## 2. Combat motion

| Clip | Character | Timing target |
| --- | --- | --- |
| Attack1 | 上段から身体右外側への短い斜め斬り | startup 120–160 ms、active 150–310 ms |
| Attack2 | 下段から上段へ戻す斬り上げ | combo 1より少し広いfollow-through |
| Attack3 | 一歩踏み込む縦/斜めfinish | 長いrecovery、最大のsilhouette変化 |
| Dodge | 身体を低くした方向回避 | invulnerability windowをposeで読める |
| Hit | attack方向と逆へ短く崩れる | control lossを長引かせない |

animationのcontact poseをdomain active windowへ合わせるが、damageはfixed-step ruleが決める。clip編集でdamage frameが暗黙に変わらないよう、timing fixtureとclip contact marker reportを並べてreviewする。

## 3. Semantic event pipeline

現在の`enemy-hit`等をpresentationで推測し続けず、必要最小限のsemantic eventを追加する。

```text
attack-started { revision, comboIndex }
dodge-started { revision, direction }
hit-confirmed { revision, attackerId, targetId, comboIndex, pointHint }
actor-staggered { revision, actorId }
actor-defeated { revision, actorId }
combat-ended { revision, result }
```

- eventはstable revision/event keyでdedupeする。
- VFX、SFX、camera、animationの一つが失敗してもdamage stateを巻き戻さない。
- hit stopをgameplayへ入れる場合は`hitStopMs`をdomain/fixed-stepで管理し、render threadの任意timeoutだけでsimulationを止めない。
- route remount、Continue、Retry後に過去eventを再生しない。

## 4. Feedback layers

- Sword trail: blade root/tip socketから短いribbon/mesh trailを生成し、active windowだけ表示する。
- Impact: hit point hintにslash spark、debris、短いemissive pulseを出す。targetごとに一active window一回。
- Hit stop: Attack1/2は45–65 ms、Attack3は70–90 msを初期値とし、入力遅延と酔いをreviewする。
- Camera: hit confirm時だけ小さなtranslation/rotation impulse。miss時はshakeしない。
- Enemy response: material flashだけに頼らず、stagger pose、core pulse、HP変化を併用する。
- Audio: swing、impact、dodge、player hit、enemy defeatをproject-ownedまたはlicense確認済みaudio assetへ置き換え、現行oscillatorはdiagnostic fallbackにする。
- HUD: combo indexを常設せず、target HP、hit result、remaining enemyを読みやすく更新する。

## 5. Accessibility and comfort

- reduced motionではcamera impulseとhit stopの見た目を弱めるが、damage feedbackはpose、sound、HUDで残す。
- flashは短時間かつ画面全体にしない。high-contrast core pulseを連続点滅させない。
- muteと将来のvolume busを分け、SFX失敗をruntime fatalにしない。
- red/greenだけでhit/miss/defeatを区別しない。

## 6. Acceptance Criteria

- Attack1/2/3を通常速度で見分けられ、各contact poseとdomain active windowがreview表で対応する。
- button連打、30fps、過大deltaでもclip/eventが重複せず、1 targetへ1 active window一回だけfeedbackが出る。
- missにimpact/camera hit feedbackを出さず、hitにはtrail、impact、SFX、stagger、HPの最低4 channelが同期する。
- Dodgeのposeとinvulnerability開始/終了が矛盾しない。
- hit stop導入後もfixed-step replayから同じdamage/勝敗を得る。
- VFX/SFX missing fixtureでもcombatを完走し、分類warningをDOMへ出せる。
- reduced motion、mute、route exit、context loss後にparticle/audio nodeを残さない。

## 7. Verification

```bash
bunx vitest run shared/action3d web/src/action3d/presentation/combat
bun run test:e2e -- tests/e2e/action3d.spec.ts --grep "combat victory"
bun run test:e2e -- tests/e2e/action3d-visual.spec.ts --grep "combo feedback"
```

## Implementation progress

2026-08-11にplayerの右肩・肘・手首をlocomotion中も剣保持姿勢へ固定し、Attack1–3を上段斜め斬り、下段斬り上げ、上段finishの予備動作、contact、follow-throughへ作り直した。横方向の腰・胸回転を小さくしてcapeによる剣の隠れと全身の横倒しを除き、contactは150–310 msのdomain active window内へ配置した。全周torusはcombo別角度の短いfront arcへ置換した。また全clipへ全boneのreset channelを入れ、JumpLoopやAttackの姿勢がIdleへ残留しないことをmodel validatorとactual runtime captureで確認した。semantic event拡張、socket追従ribbon、impact、hit stop、enemy response、project-owned audioは引き続き本Deliveryの未完了項目とする。
