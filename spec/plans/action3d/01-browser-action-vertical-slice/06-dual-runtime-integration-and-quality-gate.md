# Delivery A1-6: Dual Runtime Integration and Quality Gate 実装計画

| 項目 | 内容 |
| --- | --- |
| 対応Track | Action3D / Stage A1 |
| 状態 | Planned |
| 主対象 | router、launcher UI、E2E、performance/visual evidence、delivery docs |
| 依存 | Delivery A1-1〜A1-5完了 |

## 1. 目的とプレイヤー価値

2D RPGとAction3Dを同じapplication内の独立した選択肢として安全に提供し、操作性、性能、loading、保存、回帰の証拠を揃える。A1完了を機能数ではなく、WebGL基盤を継続するか判断可能になった状態として定義する。

## 2. Scope

- Homeまたは認証後launcherに2DとAction3Dを区別した導線を追加し、Action3Dがtechnical previewであることを明示する。
- `/game`と`/games/action-3d`のlogin redirect、back navigation、runtime exit、save summaryを統合確認する。
- route別bundle/asset requestを記録し、PhaserとBabylonが相互routeで不要にloadされないことを検証する。
- 2D full playable pathとAction3D full playable pathを別E2E scenarioとして維持する。
- keyboard/mouse、gamepad、pointer lock、pause、reduced motion、volume、focus recoveryのaccessibility/UXを確認する。
- DOM上に操作説明、HP/stamina/target、loading/error、pause/exitを提供する。
- desktop/mobile-class reference環境でframe time、long task、draw calls、active meshes、texture/asset容量、JS heap、load時間を複数回記録する。
- WebGL context loss、asset failure、save failure、low-performance fallbackをfailure injectionで確認する。
- `docs/delivery-quality-gates.md`のDQ-PERF-001とDQ-SEC-001 triggerを評価し、dependency/CSP/asset URL変更を対象に必要な診断を実行する。
- A1 decision recordへ`continue-web`、`revise-scope`、`re-evaluate-engine`のいずれかと根拠を記録する。

## 3. Required scenario matrix

| Scenario | 2D | Action3D |
| --- | --- | --- |
| 未login accessとsame-origin redirect | 必須 | 必須 |
| New Game / Continue | 必須 | 必須 |
| main playable loop | Field→Event→Battle→Field | Move→Combat→Checkpoint |
| reload recovery | 既存checkpoint | stable 3D checkpoint |
| corrupt/unsupported save | 必須 | 必須 |
| asset load failureとRetry | 必須 | 必須 |
| runtime mount/unmount leak | Phaser | Babylon/WebGL |
| route-specific bundle isolation | Babylon非load | Phaser非load |

## 4. Performance and quality gate

計測はdebug overlay自身のcostを除外したproduction buildでも行う。少なくとも3回のrunから中央値とp95を残し、最良値だけを採用しない。

合格条件:

- Stage READMEのprovisional performance budgetを満たすか、満たせない項目に再現条件とblocking判断がある。
- 2D routeのload、bundle、runtime performanceにAction3D導入前baselineから説明不能な回帰がない。
- Action3D route離脱後にrender loopが停止し、Canvas、listener、observer、GPU resourceが解放される。
- Action3D assetは必要時にだけ取得し、初期sliceの容量内訳と最大assetを特定できる。
- reduced motion時にcamera shake、強いflash、過剰なFOV変化を抑制する。
- WebGL未対応/低性能時に無限loadingせず、説明とExitを提供する。

## 5. Security and privacy

- Action3D asset/content URLをsame-origin allowlistに限定し、path traversalと任意remote fetchを拒否する。
- glTF metadataやcontent textをHTMLとして挿入しない。
- pointer lock、fullscreen、audio開始はuser gestureから行う。
- CSP変更が必要な場合はAction3Dに必要なdirectiveだけを追加し、`unsafe-eval`を一括許可しない。
- save keyへ生のemailを置かず、既存policyと同じ正規化/encoding contractを使う。
- diagnostics、screenshot、performance logへtoken、cookie、個人情報、local save本文を出力しない。

## 6. Non-goals

- 2DまたはAction3Dを既定gameとして置き換えること
- Action3D previewをproduction完成版と表示すること
- A1中に発見した全performance問題の一般engine化
- native package、app store、console certification
- server save、analytics、crash reporting serviceの先行導入
- 継続判断前のcontent量産

## 7. Implementation steps

1. Delivery A1-1で採取した2D baselineと現在値を比較する。
2. launcher導線、route access、runtime exitを仕上げる。
3. 2D/Action3Dの独立E2Eとfailure injectionを実装する。
4. route別bundle/network/memory evidenceを取得する。
5. reference環境でperformanceと操作性を複数回計測する。
6. accessibility、CSP、dependency、asset securityを確認する。
7. full repository gateを実行する。
8. decision recordを作り、A2を開始するかscope/engineを見直す。

## 8. Verification

```bash
bun run validate:game-content
bun run validate:action3d-content
bun run validate:domain-boundaries
bun run verify
bun run verify:e2e
```

追加evidence:

```text
Commit:
Production build:
Reference devices / browsers:
2D baseline vs current:
Action3D median / p95 frame time:
Long tasks:
Route bundle requests:
Asset bytes / draw calls / active meshes:
Runtime leak check:
Accessibility check:
DQ-PERF-001:
DQ-SEC-001:
Decision: continue-web | revise-scope | re-evaluate-engine
Reason:
```

## 9. Stage completion

すべての必須gateがpassし、blocking findingがなく、decision recordが保存された場合だけStage A1をCompleteとする。Web継続を選ばなくても、再現可能な証拠と移行判断を残せた場合は技術検証として完了できる。ただし、未達項目を隠して`continue-web`にしない。
