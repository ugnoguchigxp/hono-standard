# Action3D Art Source

Action3Dのconcept、Blender source、export設定を管理する。`web/public/assets/action3d`はruntime成果物であり、直接編集しない。

## Baseline

- DCC: Blender 5.2 LTS
- Exchange: glTF 2.0 binary (`.glb`)
- Unit: meter
- Authored axes: Z forward / Y up after glTF export
- Runtime authority: `web/public/action3d-content/*/manifest.json`のmodel contract

## Directories

```text
art/action3d/
├ concepts/                         modeling reference
├ blender/                          deterministic scene builders
├ player/                           generated editable .blend source
└ shared/export-presets/            reviewed export metadata
```

## Rebuild

```bash
bun run preflight:action3d-dcc
bun run export:action3d-assets
bun run validate:action3d-models
```

`build_aether_runner.py`と`build_aether_sentinel.py`はclean sceneから`.blend`とGLBを生成する。生成後はGLBだけを手修正せず、Python builderまたは`.blend`を変更してexportし直す。

## Binary ownership

`.blend`とconcept PNGはGit LFS対象とする。GLBはbrowserで取得するruntime artifactなので通常Git objectとして保持し、manifestのSHA-256とbytesで再現性を検証する。

## Current maturity

Aether RunnerとAether Sentinelは、部位別mesh、armature、socket、完全poseを持つA2 geometry/animation passである。現時点のmanifest maturityは`blockout`のままとし、外部artistによるweight paintとmotion polish前のproduction候補として扱う。

Sentinelの撃破表現は二層構造にする。`SentinelDefeat`が身体の脱力を担当し、runtimeの`EnemyDefeatPresentation`がworld rootを1.2秒で倒して最終姿勢を保持する。これによりGLB one-shotが終了・中断・読込失敗しても、撃破済みの敵が立ち姿勢へ戻らない。
