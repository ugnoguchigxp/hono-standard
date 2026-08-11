# Delivery A1-5: Action3D Content and Save 実装計画

| 項目 | 内容 |
| --- | --- |
| 対応Track | Action3D / Stage A1 |
| 状態 | Implemented |
| 主対象 | `shared/action3d/content`、`shared/action3d/save`、`web/public/action3d-content`、`web/src/action3d`、scripts |
| 依存 | Delivery A1-4完了、playable test arena |

## 1. 目的とプレイヤー価値

hard-codeされたtest arenaを検証済みAction3D contentから構築し、checkpointで保存してbrowser reload後に再開できるようにする。2D content/saveとの互換を作らず、破損やversion不一致をgameごとに安全に扱う。

## 2. Scope

- `Action3dContentManifestV1`、world、spawn、static collider、actor、enemy encounter、asset definitionをZod schemaで定義する。
- sourceを`web/public/action3d-content/<contentVersion>/`、assetを`web/public/assets/action3d/`へ分離する。
- GLB、texture、audioのsame-origin path、size metadata、license/source metadata、stable ID、参照整合性を検証する。
- build時とruntimeで同じvalidator/registryを使い、`validate:action3d-content`を`verify`へ追加する。
- loading progress、fetch/parse/reference/asset/GPU upload errorを分類し、RetryとExitを提供する。
- Action3D専用save envelope、state schema、codec、migration entryを実装する。
- save keyを`action3d:<game-id>:<player-id>:<slot-id>`相当の別namespaceにし、2D keyを読まない・上書きしない。
- checkpoint saveはworld ID、spawn/checkpoint ID、player progression、defeated encounter等のstable stateを保存し、camera、velocity、active attack、physics contactは保存しない。
- raw stringのlocal slot read/write/removeだけを`web/src/game-platform`へ抽出し、2D/3D codecは各domainに残す。
- 2D repositoryを共有raw adapterへ接続する場合は既存keyとdecode結果のcompatibility testを先に作り、key migrationを発生させない。

## 3. Content outline

```text
Action3dContentManifestV1
├ contentVersion
├ entryPoint { worldId, spawnId }
├ worlds[]
│  ├ sceneAssetId
│  ├ spawns[] / checkpoints[]
│  ├ staticColliders[]
│  └ encounters[]
├ actors[] / enemies[]
└ assets[] { id, type, url, bytes, license, source }
```

GLB node名をruntimeの永久IDとして直接使わない。manifestのstable IDからimport時にnode/colliderへ解決し、欠落をload時に拒否する。

## 4. Save boundary

Action3D saveは2D `GameSaveEnvelope`をgeneric化して流用しない。format version、state version、content version、game ID、slot IDをAction3D codecが検証する。local storage adapterはraw payloadを知らず、codecはStorage APIを知らない。

active combat中のautosaveは行わない。checkpoint到達またはcombat完了後のsafe stateだけを保存する。破損、unsupported、incompatible content、storage unavailableを区別し、New Gameで既存payloadを暗黙削除しない。

## 5. Non-goals

- 2D content manifestの拡張・統合
- 2D saveからAction3D saveへのmigration
- remote CDN、patch download、user-generated asset
- cloud/server save、複数device同期
- arbitrary JavaScript content、runtime eval
- 3D editor、Blender addon、automatic LOD generator
- 任意地点のexact physics snapshot保存

## 6. Implementation steps

1. content/saveのversion、ID、failure分類をschema testで固定する。
2. test arenaをAction3D manifestとasset treeへ移す。
3. registry、cross-reference validation、CLI validatorを実装する。
4. runtime loader、progress/error/retry UIを接続する。
5. Action3D save codecとseparate local keyを実装する。
6. checkpoint、victory、reload、Continueを接続する。
7. raw local slot adapterの共有可否を2D compatibility test付きで判断する。
8. corrupt/unsupported/missing asset fixtureとE2Eを追加する。

## 7. Acceptance Criteria

- duplicate ID、missing node/reference、unsafe URL、asset size不一致、license metadata欠落をvalidatorが拒否する。
- Action3D runtimeは未検証raw JSONをtype assertionで利用しない。
- 2DとAction3Dのcontent URL、registry、save envelope、storage keyが衝突しない。
- checkpoint後にreload/Continueするとstable spawnからHP/progression/world stateを復元する。
- active attack、enemy wind-up、camera角度、velocity、contact manifoldをsaveしない。
- corrupt/unsupported/incompatible saveを分類し、既存payloadを保持したままNew Gameを選べる。
- storage unavailableまたはquota errorをUIで通知し、保存成功と表示しない。
- 2Dの既存save fixtureが同じkeyと結果でdecodeできる。

## 8. Verification

```bash
bun run validate:action3d-content
bunx vitest run shared/action3d/content shared/action3d/save web/src/action3d web/src/game-platform
bun run validate:game-content
bun run validate:domain-boundaries
bun run typecheck
bun run test:e2e -- --grep "Action3D save"
```

3D assetの容量、texture寸法、triangle/material/draw call数をmanifestまたはbuild reportへ残す。validatorを通すためにasset欠落をplaceholder無視へ変えず、明示したdevelopment placeholderだけを許可する。
