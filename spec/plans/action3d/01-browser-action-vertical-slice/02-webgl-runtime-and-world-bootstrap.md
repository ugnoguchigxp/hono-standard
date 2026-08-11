# Delivery A1-2: WebGL Runtime and World Bootstrap 実装計画

| 項目 | 内容 |
| --- | --- |
| 対応Track | Action3D / Stage A1 |
| 状態 | Planned |
| 主対象 | `web/src/action3d/runtime`、`web/src/action3d/Action3dScreen.tsx` |
| 依存 | Delivery A1-1完了、`BrowserGameRuntime` contract |

## 1. 目的とプレイヤー価値

Action3D専用CanvasへWebGL2 worldを描画し、loading、error、retry、resize、route離脱を含むruntime lifecycleを成立させる。まだ完成characterは操作しないが、ブラウザ3Dを安全に起動できる最小基盤を作る。

## 2. Scope

- Babylon.js coreとglTF loaderをAction3D専用dependencyとして追加する。
- `loadAction3dRuntimeFactory()`からBabylon adapterをdynamic importする。
- engine、scene、camera、light、debug groundを生成し、Canvasをruntime host内だけに所有する。
- Action3D domainに最小の`Action3dState`、`Action3dSession`、schema/content version/revisionを定義する。
- fixed simulation clockとrender loopを分離し、inactive tabのdeltaをclampする。
- ResizeObserver、device pixel ratio上限、visibility change、WebGL context lost/restoredを扱う。
- boot/loading/runtime/context-loss errorを分類し、DOM上にRetryとExitを表示する。
- dispose時にrender loop、observer、event listener、scene、engine、Canvasを破棄する。
- development時だけFPS、frame time、draw call、active meshを確認できるdiagnostic overlay contractを用意する。
- production buildでBabylon chunkをAction3D route以外から参照しないことを確認する。

## 3. Runtime boundary

```text
React Action3dScreen
  → BrowserGameRuntime.start(host, signal)
    → BabylonEngineAdapter
      → Scene / Camera / Light / Canvas
      → fixed update(Action3dSession)
      → render(snapshot)
  ← semantic diagnostics / runtime error
```

Babylon adapterはAction3D domainのpublic APIだけを利用する。domain側はBabylon、Canvas、Vector3 classをimportせず、tupleまたはplain objectのserializable valueを使う。

## 4. Non-goals

- playable character、camera follow、collision、combat
- glTF production asset、animation graph
- physics engine、WASM、WebGPU
- content manifest、save/load
- post processing、shadow品質調整、terrain streaming
- React stateへのframeごとのposition/FPS同期

## 5. Failure and recovery

- WebGL2未対応またはengine作成失敗時は、白画面にせず非対応理由とExitを表示する。
- context loss中はsimulationをpauseし、restore成功時だけ再開する。restore不能時はruntimeを破棄してRetry可能にする。
- start中にroute離脱した場合はAbortSignalで後続asset/scene生成を停止する。
- diagnostic取得失敗をgameplay停止理由にしない。
- fatal error後に同じCanvas/engineを再利用せず、新しいruntime instanceを生成する。

## 6. Implementation steps

1. dependency追加前後のHome、2D、Action3D bundle baselineを取得する。
2. minimal Action3D state/sessionとfixed clockをunit testで実装する。
3. dynamic loaderとBabylon engine adapterを実装する。
4. debug worldとloading/error UIを接続する。
5. resize、visibility、context loss、dispose testを追加する。
6. development diagnosticsとperformance capture手順を追加する。
7. production buildとbrowser smokeでchunk/runtime lifecycleを確認する。

## 7. Acceptance Criteria

- `/games/action-3d`で一つのCanvasとdebug worldが表示される。
- simulation step数はrender fpsに依存せず、過大deltaを安全にclampする。
- window resizeとdevice pixel ratio変更後もaspectとinput座標が一致する。
- routeを10回出入りしてもCanvas、listener、render loopが増えない。
- WebGL context lossをsimulation pauseとして扱い、復帰または明示errorへ遷移する。
- Homeと2D routeのnetwork取得にBabylon chunkが現れない。
- Babylon型が`shared/action3d`のpublic型、State、save候補へ漏れない。
- desktop baselineのframe time、draw calls、JS heap、GPU resource相当値を記録する。

## 8. Verification

```bash
bunx vitest run shared/action3d web/src/action3d web/src/game-platform
bun run validate:domain-boundaries
bun run typecheck
bun run build
bun run test:e2e -- --grep "Action3D runtime"
```

headless browserだけでWebGL性能を合否判定しない。E2Eはlifecycleとvisible resultを検証し、性能baselineはGPUが有効な同一実機browserで取得する。
