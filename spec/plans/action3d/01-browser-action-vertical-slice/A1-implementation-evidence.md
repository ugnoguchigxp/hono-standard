# Stage A1 Implementation Evidence

| 項目 | 結果 |
| --- | --- |
| Stage | Action3D / A1 Browser Action Vertical Slice |
| 状態 | Action3D implementation complete / Repository gate pending |
| 完了日 | 2026-08-11 |
| Route | `/games/action-3d` |
| Renderer | Babylon.js 9.19.0 / WebGL2 / HTML Canvas |
| Reference | Darwin 25.5.0 arm64、Chromium 149.0.7827.55、Playwright 1.61.1、Bun 1.3.14 |

## 実装結果

| Delivery | 主な成立事項 | 自動検証 |
| --- | --- | --- |
| A1-1 Boundary | `shared/action3d`、`web/src/action3d`、共有runtime lifecycle、`/games/action-3d`、上部Action3D導線を2Dから分離 | domain boundary validator、route/view test |
| A1-2 Runtime | WebGL2判定、fixed-step、lazy Babylon起動、ResizeObserver、DPR上限、visibility pause、context-loss Retry、完全dispose | session unit、context-loss E2E、10回mount/unmount E2E |
| A1-3 Controller | keyboard/mouse/gamepad Action Map、pointer lock、加速/減速、jump/sprint/dodge、stamina、静的AABB、45度slope limit、0.45 step height、camera collision/recenter、6 animation clip | deterministic simulation unit、実WebGL移動E2E |
| A1-4 Combat | 最大3段combo、active window/hit dedupe、lock-onの距離/画面方向/遮蔽判定、dodge無敵、3体のSentinel AI、勝利/敗北、VFX/SFX/camera feedback、DOM HUD | combat/LOS/AI unit、勝利までの実プレイE2E |
| A1-5 Content/Save | Zod manifest/world/asset schema、CLI validator、進捗表示、project-owned GLB生成、別game ID/key/save codec、safe checkpoint、Continue | validator unit/CLI、corrupt/unsupported/storage unit、reload Continue E2E |
| A1-6 Integration | 2D/3D導線、route bundle分離、asset fallback、低fps解像度fallback、reduced motion、mute、pause/retry/exit、性能計測 | failure/route/performance E2E、repository gate |

Domain stateはserializableなplain dataだけで、Babylon、React、DOM、Storage objectを含まない。2Dの`shared/game`とAction3Dのrule/content/saveは共有せず、同じ意味を持つgame IDとbrowser runtime lifecycleだけをplatform層で共有した。

## Playable slice

`Aether Courtyard`は36×36 unitの小規模fieldで、3体のSentinel、3 static collider、許容段差、許容傾斜、6 landmark、south/north checkpointを持つ。New Gameから移動、camera、jump、sprint、dodge、lock-on、3段combo、敵AI、勝利、autosave、reload、Continueまで一つのflowで完結する。

player GLBは`generate:action3d-assets`で再生成できるproject-owned assetで、Idle、Walk、Run、Jump、Dodge、Attackの6 clipを持つ。manifest宣言値と実ファイルは39,712 bytesで一致する。model fetch/GPU import失敗時はprocedural capsuleへfallbackし、simulationを継続する。

## Performance evidence

production buildをHonoから配信し、Playwrightの実WebGL Canvas上でwarm-up後の`requestAnimationFrame`を各3回計測した。CI referenceであり、特定の市販mobile端末の認証値ではない。

| Viewport | Run | Median frame time | p95 | Max |
| --- | ---: | ---: | ---: | ---: |
| 1280×720 | 1 | 16.7 ms | 17.4 ms | 18.4 ms |
| 1280×720 | 2 | 16.7 ms | 17.5 ms | 18.5 ms |
| 1280×720 | 3 | 16.7 ms | 17.6 ms | 18.7 ms |
| 390×844 compact | 1 | 16.7 ms | 18.3 ms | 18.4 ms |
| 390×844 compact | 2 | 16.6 ms | 17.6 ms | 18.6 ms |
| 390×844 compact | 3 | 16.7 ms | 18.0 ms | 18.6 ms |

計測区間の50ms超long taskは0件。runtime snapshotは60 FPS、15.9 ms、22 draw calls/frame、23 active meshes。process全体のCDP値はJS heap used 19,367,220 bytes、heap total 51,396,608 bytes、DOM 809 nodesだった。Action3D開始resourceはgame chunk 443,511 transfer bytes / 5.4 ms、GLB 40,012 transfer bytes / 0.9 ms。

高DPIはdevice pixel ratio 1.5を上限にし、継続的に28 FPS未満を検出した場合は内部解像度を一段下げてDOM warningを出す。強いcamera shakeは`prefers-reduced-motion`で停止する。

## Bundle and isolation

| Artifact | Minified | Vite gzip |
| --- | ---: | ---: |
| Action3dView | 20.89 kB | 6.33 kB |
| Action3dGame + Babylon adapter entry | 443.21 kB | 113.35 kB |
| Project-owned GLB | 39.71 kB | n/a |
| PhaserGame（比較） | 1,432.05 kB | 370.48 kB |

Action3dViewはroute lazy、Action3dGameはNew Game/Continue後の二段目lazy importである。network E2EはHomeとAction3D launcherでBabylon/GLBを取得せず、Action3D開始後もPhaser chunkを取得しないことを確認する。Canvas作成と破棄を10回反復し、各時点のCanvas数が必ず0または1であることも固定した。

## Failure, save, accessibility and security

- manifest HTTP failureはWorld load errorとRetry、GLB 404はprocedural fallback、WebGL context lossは新runtime generationによるcheckpoint Retryへ遷移する。
- saveは`action-3d:checkpoint:<encoded-player-id>`、envelope game IDは`action-3d`で、2D key/schemaを読まない。camera、active attack、velocity、contactはcheckpoint時に正規化する。
- corrupt/unsupported payloadは分類してContinueを無効化する。New Game開始だけでは既存payloadを上書きせず、勝利checkpointが成立した時だけ保存する。Storage例外は成功表示に変換しない。
- HP、stamina、target、敵残数、performance、loading/error、操作説明、pause/mute/retry/exitはCanvas外のDOMにも存在する。focus/pointer-lock喪失時はkeyboard/gamepad edge stateを中立化する。
- content/asset URLはsame-originの`/assets/action3d/`だけを許可し、`..`、encoded traversal、scheme、backslashをschemaで拒否する。content textをHTMLとして挿入せず、CSPへの`unsafe-eval`追加はない。

## Verification commands

```bash
bun run validate:action3d-content
bun run validate:game-content
bun run validate:domain-boundaries
bun run typecheck
bun run test
bun run test:coverage
bun run build
bun run test:e2e -- tests/e2e/action3d.spec.ts
```

Action3D E2Eは、実移動→combat→victory→save→reload Continue、manifest Retry/model fallback/context-loss、bundle isolationと10回lifecycle、corrupt save保全、desktop/compact各3回のperformance budgetを含む。

## Repository gate status

Action3D対象の25 unit test、Statements 98.0% / Branches 95.9% / Functions 96.47% / Lines 98.46%の対象coverage、5 E2E、content/domain validator、lint/format、production buildは成功した。

repository全体では同じworktree上の未完了2D拡張が並行しており、2026-08-11 17:51 JST時点で次が残る。Action3Dの責務外sourceを上書きしないため、本Deliveryでは修正していない。

- `shared/game/battle-engine.test.ts`が、2D modelでまだexportされていない`StatusEffectState`をimportして全体typecheckを停止する。
- 2D progression testは`Number.NaN`正規化の実装途中で一度失敗しており、その後も2Dファイルが更新中である。
- 2D full-play E2Eは新しいgame content loaderが5秒でcancelされ、launcherが`World loading timed out or was cancelled.`へ遷移する。Action3D E2E 5件は独立実行ですべて成功する。

これらが解消した後に`bun run verify:all`を再実行し、Stage状態をCompleteへ変更する。

## A1の境界

A1はCanvas/WebGL基盤を継続判断できるvertical sliceであり、seamless open world、touch UI、dynamic rigid-body physics、climbing/swimming/gliding、element reaction、server save、native package、artist向けvisual editorはStage共通Non-goalsのままである。これらを暗黙に汎用engine化せず、必要になった時点でUnity等との再評価を行う。
