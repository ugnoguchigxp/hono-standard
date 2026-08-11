# Delivery A2-6: Visual Integration and Quality Gate 実装計画

| 項目 | 内容 |
| --- | --- |
| 対応Track | Action3D / Stage A2 |
| 状態 | Planned |
| 主対象 | visual E2E、asset report、performance evidence、art review、delivery docs |
| 依存 | A2-1〜A2-5完了、A1 repository gate解消 |

## 1. 目的

modelが読み込めたことを「品質改善」と扱わず、造形、motion、combat readability、field統合、failure、accessibility、performanceを同じplayable pathで確認する。自動testと人間のvisual reviewを分け、A2完了を主観だけにもpixel diffだけにも依存させない。

## 2. Required evidence set

### Static capture

- player front/side/back turntable、wireframe、material ID、128px silhouette
- Sentinel front/side/back、weapon side、core state、128px silhouette
- spawn、combat、north beaconのdesktop/compact screenshot
- lock-on、Attack1/2/3 contact、enemy wind-up、hit、stagger、defeat、victory
- high/balanced/fallback、reduced motion、model failure UI

### Motion capture

- player全clip contact sheetと通常速度video
- Idle↔Walk↔Run、Jump、Dodge、lock-on strafe、Hit、Defeat transition
- Sentinel全state transitionと3体同時combat
- 3段comboのinput→startup→contact→impact→recovery

### Machine report

- GLB hash/bytes、triangle、primitive、material、texture、skeleton、bone、influence、clip/duration、socket
- JS chunk/asset request、load duration、shader warm-up、draw call、active mesh、heap、long task
- desktop/compact各3runのmedian/p95/max frame time
- Canvas/listener/audio/particle/shadow resource lifecycle

## 3. Visual review rubric

各項目を0–3で採点し、0が一つでもある場合、または合計80%未満の場合は完了しない。

| 項目 | 0 | 3 |
| --- | --- | --- |
| Player identity | primitive/正面不明 | 顔・髪・衣装・cape・剣・正面が即時に読める |
| Locomotion | root bob/foot slide | 重心・足接地・速度・transitionが自然 |
| Attack clarity | 3段が同じ | startup/contact/recoveryと剣筋を区別できる |
| Enemy identity | 何者か不明 | automaton、core、weapon、front/backが読める |
| Enemy telegraph | damageが突然 | pose/ground/soundから危険方向と時機が読める |
| Hit feedback | HPだけ変化 | trail/impact/pose/audio/camera/HUDが同期する |
| Field integration | characterが浮く | scale、palette、light、shadow、fogが統一される |
| Compact readability | UI/actorが重なる | target、HP、telegraph、playerを追跡できる |

reviewerは「原神に似ているか」ではなく、A2 art directionとrubricへ適合するかで判断する。

## 4. Automated gates

- asset contract test: clip/socket/material/budget/hash欠落をrejectする。
- animation controller test: transition、one-shot dedupe、crossfade、cleanupをfake clockで検証する。
- combat presentation test: semantic event一回にVFX/SFX/camera一回を保証する。
- E2E: actual GLBを使用し、diagnostic fallbackを通常成功として扱わない。
- visual E2E: fixed seed/state/cameraでcaptureする。GPU差が大きいeffectはpixel-perfect thresholdだけで合否を決めない。
- failure injection: player GLB、Sentinel GLB、texture、audio、shader compile、context loss、save failure。
- lifecycle: route出入り10回後にCanvas、render loop、AudioContext、particle system、shadow generatorを重複保持しない。
- accessibility: keyboard/gamepad、pause/mute、reduced motion、focus recovery、DOM HUD、contrast。
- regression: A1 saveをdecode/Continueし、2D `/game`のbundle/save/playable pathを維持する。

## 5. Performance gate

A1 evidenceと同じreference/browser/viewport/計測方法を使う。最良runだけを採用せず3runを保存する。

- desktop p95 20 ms以下、compact p95 33.3 ms以下。
- steady draw calls 60以下、active meshes 100以下。
- 50 ms超long taskをsteady play中に継続発生させない。
- Action3D field初回asset transfer 8 MB以下。
- Home、2D、Action3D launcherでA2 model/texture/audio/shadow runtimeを取得しない。
- model/texture decodeとshader compileのblocking timeを記録し、loading UI終了後に大きなfirst-action hitchを残さない。

超過時はasset/texture/shadow/particleの内訳を特定し、`revise-quality`または`re-evaluate-engine`を記録する。budgetを満たすためにtelegraphやcharacter identityを消さない。

## 6. Acceptance Criteria

- visual rubricが全項目1以上、合計80%以上で、blocking commentがない。
- A1 primitive player/polyhedron enemy/torus-only hit effectが通常production pathに残らない。
- required static/motion/machine evidenceがrevisionとともに保存される。
- Action3D unit/coverage/build/E2E、repository verify、2D E2Eが成功する。
- asset license/source、DCC/export version、制作時間が記録される。
- A2 decision recordに`continue-web-art-pipeline`、`revise-quality`、`re-evaluate-engine`のいずれかを残す。

## 7. Verification

```bash
bun run validate:action3d-models
bun run validate:action3d-content
bun run validate:domain-boundaries
bun run verify
bun run verify:e2e
```

## 8. Completion record template

```text
Revision:
DCC / exporter:
Player GLB report:
Sentinel GLB report:
Texture/audio report:
Visual rubric score:
Desktop median / p95:
Compact median / p95:
Draw calls / active meshes:
Heap / long tasks:
Route isolation:
Failure/lifecycle:
Accessibility:
2D regression:
Decision:
Reason:
```
