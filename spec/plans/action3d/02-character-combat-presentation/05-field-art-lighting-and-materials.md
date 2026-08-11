# Delivery A2-5: Field Art, Lighting and Materials 実装計画

| 項目 | 内容 |
| --- | --- |
| 対応Track | Action3D / Stage A2 |
| 状態 | Planned |
| 主対象 | Aether Courtyard art asset、Babylon scene presentation、quality profile |
| 依存 | A2-2 player material、A2-4 Sentinel material、A1 performance baseline |

## 1. 目的

character assetだけを高密度にしてfieldから浮かせず、Aether Courtyard全体を同じpalette、material、light、fog、scale languageで整える。combat silhouetteとframe budgetを守りながら、床、遺跡、beacon、樹木、背景に空間の意味と奥行きを与える。

## 2. Field art pass

- flat ground一枚をstone tile、湿り、苔、edge wearの大きなvalue variationへ分ける。
- colliderと見た目を一致させたruin wall、step、ramp、arch、beacon plinthを作る。
- south spawn→中央combat→north beaconへ視線を導くprop、light、色温度を配置する。
- tree/arch/crystalのprimitive placeholderをstylized modular propへ置き換える。
- walkable boundaryを透明wallではなくterrain edge、collapsed ruin、fog、vegetationで説明する。
- combat area中央はdecal/prop密度を下げ、characterの足元とtelegraphを読めるnegative spaceを残す。

## 3. Material and lighting

- StandardMaterial中心の現実装から、必要なassetをPBRMaterialへ移す。
- player skin/cloth/hair/metal、Sentinel stone/metal/core、field stone/foliage/crystalのroughness/metallic/emissive rangeをpalette sheetで固定する。
- main directional light、hemispheric fill、beacon emissiveを基本とし、無制限にdynamic lightを増やさない。
- player、enemy、主要propへshadowを追加する。shadow map size、PCF/PCSS、caster数をdesktop/compact quality profileで比較する。
- ambient occlusionやcontact表現はbundle/frame costを測り、必須にしない。まずshadow、value separation、ground contactで解決する。
- fog/sky/backgroundは遠景を整理し、enemy coreやattack trailと同じ明度へ上げすぎない。
- tone mapping、exposure、contrastを固定し、monitor依存の黒つぶれを避ける。

## 4. Quality profiles

```text
high:
  DPR cap 1.5 / filtered shadow / full character particles
balanced:
  DPR cap 1.25 / smaller shadow map / reduced particles
fallback:
  DPR cap 1.0 / blob or no dynamic shadow / essential hit cue only
```

低fps fallbackは突然全materialを交換せず、shadow map、particle count、DPRの順で段階的に下げる。quality変更はDOM warningまたはsettings summaryで観測可能にする。

## 5. Performance discipline

- static modular propはmerge/instance候補を測り、編集性を失う全面mergeを先に行わない。
- transparent material、overdraw、real-time light、shadow casterをreportする。
- texture atlas/KTX2はsource workflowとvisual differenceを測ってから導入する。
- shader compile hitchをfield開始後へ持ち込まず、loading中のwarm-upまたはfirst-use planを用意する。
- Action3D route開始前にfield texture、environment、shadow codeをloadしない。

## 6. Acceptance Criteria

- fixed screenshotでspawn、combat area、north beaconの三地点を構図とlightから区別できる。
- player/enemy silhouetteがground、fog、shadow、emissiveに埋もれず、grayscaleでもtargetを追える。
- colliderとvisible ruin/ramp/stepに、player一人分を超える不自然なずれがない。
- dynamic shadow追加後もdesktop p95 20 ms、compact p95 33.3 ms、draw call 60以下を守る。
- quality fallback後もwind-up、target、HP、hit、boundaryを失わない。
- 2D route/HomeがA2 texture、environment、shader chunkを取得しない。

## 7. Verification

```bash
bun run validate:action3d-content
bun run build
bun run test:e2e -- tests/e2e/action3d-visual.spec.ts --grep "field art"
bun run test:e2e -- tests/e2e/action3d.spec.ts --grep "performance"
```

spawn/combat/beaconをhigh/balanced/fallback、desktop/compact、reduced-motionでcaptureし、同じexposure基準で比較する。
