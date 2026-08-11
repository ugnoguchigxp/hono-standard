# Delivery A3-1: Runtime and Simulation Seams 実装計画

| 項目 | 内容 |
| --- | --- |
| 対応Track | Action3D / Stage A3 |
| 状態 | Implemented (2026-08-11) |
| 主対象 | `shared/action3d/simulation`、`web/src/action3d/runtime`、`web/src/action3d/presentation` |
| 依存 | A1 full playable、A2 animation/model contract |

## 1. 目的

現行の挙動、content、save schemaを変更せず、541行のsimulationと836行のBabylon runtimeにある責務を、次Deliveryでdefinitionを注入できる小さな境界へ分ける。行数削減ではなく、変更理由を一つにすることを目的とする。

## 2. Scope

domain側を次の責務へ分割する。

```text
shared/action3d/simulation/
├ step-action3d-state.ts   # step順序とphaseだけを調停
├ movement.ts              # 加速、jump、dodge、ground/collision
├ targeting.ts             # lock-on候補、LOS、解除条件
├ player-combat.ts         # player attack stateとhit event
├ enemy-behavior.ts        # 現行Sentinel state transition
└ world-query.ts           # ground、block、LOSのpure query
```

runtime側を次へ分割する。

```text
web/src/action3d/runtime/
├ Action3dGame.ts          # engine/scene lifecycleとframe orchestration
├ BabylonWorldPresenter.ts # ground、surface、collider、landmark
├ BabylonActorPresenter.ts # player/enemy rootとanimation同期
├ BabylonCameraRig.ts      # camera追従、collision、shake
├ BabylonAssetCache.ts     # GLB load、cache、instance、release
└ Action3dAudioBus.ts      # semantic eventからaudio feedback
```

公開APIは必要最小限にし、具体Babylon型を`shared/action3d`へ公開しない。`Action3dGame`は各adapterの生成・frame順序・disposeだけを所有する。

## 3. Implementation steps

1. 現行の代表入力列をfixture化し、revision、position、HP、enemy state、event列をgolden testとして固定する。
2. `simulation.ts`内部関数を一つずつmoduleへ移し、各移動後に同じfixtureが一致することを確認する。
3. runtimeのworld、actor、camera、audio処理を順にclass/functionへ抽出し、`Action3dGame`の公開contractを変えない。
4. enemy GLBを一度loadし、Babylonのasset containerまたはclone/instance経路で各enemyへ展開する。
5. asset cacheに同時load dedupe、reference countまたはscene単位release、失敗時fallbackを実装する。
6. world boundsからfield edge寸法を計算し、36固定値を除く。
7. start中abort、部分初期化失敗、context loss、複数回disposeをadapter単位でtestする。
8. 3体と12体fixtureでload回数、mesh数、heap、simulation時間を比較する。

## 4. Acceptance Criteria

- A1/A2の代表入力fixtureが分割前後でdeep equalになる。
- Action3D state、save format、manifest version、content versionを変更しない。
- `Action3dGame`がworld geometryやenemy stateごとのanimation分岐を直接構築しない。
- 同じmodel asset URLを使う3体のenemyでGLB parse/importが一度だけ実行される。
- 一体のasset load失敗がfallbackを有効にし、他actorとsimulationを停止しない。
- arbitrary world boundsでground、field edge、camera clampが同じboundsを使用する。
- retry/unmount後にscene、engine、asset container、AudioContext、listenerが残らない。
- 12 enemiesのfixtureで固定stepの平均処理時間がbaselineから2倍を超えない。

## 5. Verification

```bash
bunx vitest run shared/action3d web/src/action3d/runtime web/src/action3d/presentation
bun run validate:domain-boundaries
bun run typecheck
bun run build
bun run test:e2e -- tests/e2e/action3d.spec.ts --grep "movement|combat|lifecycle|fallback"
```

実機captureでA2のidle、combo、defeat settle、camera距離が変わっていないことを比較する。見た目を変える必要が出た場合はこのDeliveryへ混ぜず、差分理由をA2へ戻す。

## 6. Rollback

抽出は責務単位のcommitに分ける。golden testが変わったcommitはmergeせず、対象moduleだけを旧実装へ戻せる状態を維持する。asset cacheで回帰した場合はinterfaceを残してuncached adapterへ差し替え、後続Deliveryを止める。
