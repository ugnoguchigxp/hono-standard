# Delivery A2-1: Visual Target and Asset Pipeline 実装計画

| 項目 | 内容 |
| --- | --- |
| 対応Track | Action3D / Stage A2 |
| 状態 | Implemented |
| 主対象 | `art/action3d`、`scripts/action3d`、`shared/action3d/content`、`web/public/assets/action3d` |
| 依存 | A1 Action3D gate、A1 decision `continue-web` |

## 1. 目的

「コードからprimitiveを出力すればasset完成」というA1の仮workflowを終了し、concept、DCC source、rig、clip、material、export、validation、runtime assetまでを再現可能なpipelineにする。player/enemy制作を始める前に、何を作り、どの名前と単位で渡し、何を機械検証するかを固定する。

## 2. Visual target

- original designとしてAether RunnerとAether Sentinelのfront/side/back、color palette、material breakup、weapon、scale chartを作る。
- 既存A1画面と同じcamera/FOV/light条件でgraybox、shaded、final候補を比較する。
- 128px silhouette、grayscale、color-vision simulation、390px viewportでreadabilityを確認する。
- conceptはmodelingの寸法・material・socketを決められるorthographic referenceと、gameplay moodを決める一枚絵を分ける。
- 「anime風」の語だけで判断せず、頭身、輪郭、面密度、色数、roughness、emissive量を数値またはswatchで記録する。

## 3. DCC baseline

baseline DCCはBlender LTSとglTF 2.0/GLB exportとする。現workspaceではBlender CLIが検出できていないため、実装開始時にversion固定、install/preflight、headless export可否を最初のgateにする。

候補directory:

```text
art/action3d/
├ concepts/
├ player/aether-runner.blend
├ enemies/aether-sentinel.blend
├ shared/export-presets/
└ README.md

web/public/assets/action3d/
├ characters/aether-runner.glb
├ enemies/aether-sentinel.glb
├ textures/
└ audio/
```

`.blend`をrepositoryへ保存する場合はGit LFS、clone容量、CI取得を決定記録へ残す。source assetを外部保管する場合も、version/hash/export metadataなしでruntime GLBだけを置かない。

## 4. Asset contract

content manifestへ次をversioned dataとして追加する。

- model ID、URL、bytes、license、source、source revision、export tool/version
- logical root node、skeleton root、mesh collection
- required clip名、loop、expected duration range
- required socket: `socket.weapon.right`、`socket.hit.center`、`socket.vfx.feet`
- material slot: body、skin、hair、cloth、metal、core、weapon
- expected skeleton数、bone上限、triangle上限、material上限、texture上限
- authored forward axis、up axis、unit scale、ground offset、bounding dimensions
- optional variant material mapping

runtimeはGLB内部名を推測しない。registryがstable semantic IDをGLB node/clip/materialへ解決し、contract違反時はfield開始前に分類したerrorを出す。

## 5. Export and validation

1. Blender versionとaddon/export optionをpreflightする。
2. transform適用、meter scale、Y-up変換、tangent、skin、animation sampling、NLA clip export presetを固定する。
3. sourceからtemporary GLBへheadless exportし、validator通過後だけpublic assetを更新する。
4. validatorでJSON/binary shape、scene数、mesh、triangle、primitive、material、texture、skeleton、bone influence、animation、duration、socket、boundsをreportする。
5. manifestのbytes/hash/source metadataと実ファイルを照合する。
6. Babylon Sandboxまたはlocal inspection routeで全clipをturntable確認する。
7. export結果の差分reportをCI artifactとして残す。

既存`generate-action3d-assets`は`generate-action3d-diagnostic-assets`へ役割を限定し、production manifestから参照しない。

## 6. Acceptance Criteria

- clean checkoutからdocumented commandで同じasset contractを持つGLBをexportできる。
- rest pose、scale、forward、ground contactがplayer/enemyで一致する。
- required clip、socket、materialが一つでも欠けるとvalidatorが失敗する。
- bone influence、triangle、texture、file size budgetをreportし、超過をwarningだけで通さない。
- license/source/export version/hashがmanifestにあり、由来不明assetを置かない。
- GLBを直接手修正せず、source→exportの一方向workflowになる。
- conceptとruntime screenshotを並べ、A1 primitiveよりsilhouetteとmaterial breakupが改善したことをvisual reviewで承認する。

## 7. Verification

```bash
blender --version
bun run export:action3d-assets -- --check
bun run validate:action3d-models
bun run validate:action3d-content
bunx vitest run shared/action3d/content scripts/action3d
```

## 8. Implementation record

2026-08-11にBlender 5.2 LTS、headless GLB export、Git LFS、manifest v2 model contract、GLB inspector/budget validator、SHA-256照合を実装した。Aether RunnerとAether Sentinelのconcept、`.blend`、GLB、全required clip/socket/materialを同じcommandで再生成できる。数値と回帰結果は[A2 Implementation Evidence](A2-implementation-evidence.md)へ統合する。
