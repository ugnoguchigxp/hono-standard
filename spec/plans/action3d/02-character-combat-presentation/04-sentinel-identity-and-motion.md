# Delivery A2-4: Sentinel Identity and Motion 実装計画

| 項目 | 内容 |
| --- | --- |
| 対応Track | Action3D / Stage A2 |
| 状態 | In Progress |
| 主対象 | Sentinel concept/DCC source、enemy content contract、enemy presentation controller |
| 依存 | A2-1 asset pipeline、A1 enemy state machine |

## 1. 目的

「赤い多面体」から、遺跡を守るAether Sentinelだと一目で分かるenemyへ置き換える。playerは説明文を読まなくても、正面、視線、weapon、攻撃範囲、wind-up、危険frame、stagger、撃破を形とmotionから判断できるようにする。

## 2. Enemy design

- 石と金属の人型automaton。胸部にAether core、頭部に一つのvisor、片腕にblade/polearm、反対側にguard plateを持つ。
- 大きな肩、細い腰、重い前腕、接地した脚でplayerと異なるsilhouetteにする。
- coreはstate indicatorだが、colorだけでなくbrightness、aperture shape、pose、soundを変える。
- front/backを頭、肩、weapon、heel shapeで区別する。
- Verdant/Amber/Azureは同じarchetypeのmaterial/crest variantとし、A2では異なるcombat ruleを追加しない。
- playerより約1.25–1.4倍高くし、lock-on markerが頭やweaponと重ならないsocketを用意する。

## 3. Rig and required clips

| State | Clip | Readability requirement |
| --- | --- | --- |
| idle | SentinelIdle | core呼吸と周囲scan、完全静止しない |
| chase | SentinelWalk | 重い接地とweaponの方向が分かる |
| windup | SentinelWindup | 400 ms前後の大きいbackswingとground cue |
| attack | SentinelAttack | weapon arcと危険方向が一致する |
| recover | SentinelRecover | 攻撃後の隙をsilhouetteで示す |
| stagger | SentinelStagger | attack cancel/被弾を明確にする |
| defeated | SentinelDefeat | core消灯、膝/部品落下、collision消滅と同期する |

clip名とduration rangeをasset contractで検証する。wind-upからdamageまでのtimingはA1 domain fixtureを正本とし、animationだけを長くして不可視damageを作らない。

## 4. Runtime presentation

- enemy ID→root/skeleton/weapon/core/lock socketをstable contractでresolveする。
- state transitionをcrossfadeし、chase中に毎snapshot Walkをrestartしない。
- wind-up開始時にpose、ground decal、audio cue、core apertureの最低3 channelを出す。
- stagger/defeatはsemantic eventで一度だけ開始し、HP stateと表示を矛盾させない。
- defeat clip後のmesh cleanupはpresentationだけで行い、domainのdefeated stateを変更しない。
- 3体はmaterial instanceまたはvariantを共有し、mesh/skeletonの不要な複製costを測る。

## 5. Encounter composition

- A1の3体配置を維持しつつ、一画面で全員が同時に重なってtelegraphを隠さないようspawn/approach spacingを調整する。
- lock-on targetはoutline、marker、name/HPを併用し、非target enemyのwind-upも見落とせない。
- wallや別enemy越しのattack cueを不正に表示しない。
- camera近接時にenemy meshが全面を塞ぐ場合はfadeではなくcamera distance/collisionとspacingを先に調整する。

## 6. Acceptance Criteria

- textureとcolorを外したsilhouette reviewでもplayerとSentinel、front/back、weapon sideを識別できる。
- Idle、Chase、Windup、Attack、Recover、Stagger、Defeatを1秒以内のclipから説明できる。
- wind-up開始からdamageまでにpose、ground cue、soundがあり、不可視の即時damageを発生させない。
- 3体が同時に動いてもtarget marker、weapon arc、player silhouetteを継続して読める。
- defeat後にmesh、particle、audio、lock targetが残らず、Continue後も正しいdefeated/active stateを表示する。
- Sentinel assetがtriangle、bone、material、texture、transfer budgetを通す。

## 7. Verification

```bash
bun run validate:action3d-models -- --asset aether-sentinel
bunx vitest run shared/action3d web/src/action3d/presentation/enemies
bun run test:e2e -- tests/e2e/action3d-visual.spec.ts --grep "Sentinel states"
```
