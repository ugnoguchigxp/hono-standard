# Stage A2 Implementation Evidence

| 項目 | 内容 |
| --- | --- |
| 日付 | 2026-08-11 |
| Stage | A2 Character & Combat Presentation |
| 状態 | A2-1 Implemented / A2-2 and A2-4 Geometry Quality Pass Implemented / A2-3 Sword Motion and Trail Pass Implemented, feedback polish In Progress |
| DCC | Blender 5.2.0 LTS / glTF Blender I/O 5.2.39 |

## Implemented

- Aether Runner / Sentinelのoriginal turnaround conceptを`art/action3d/concepts`へ保存した。
- HomebrewでBlender 5.2 LTSとGit LFSを導入し、DCC preflightを追加した。
- clean sceneから`.blend`とGLBを生成するheadless Blender builderをplayer/enemyそれぞれに追加した。
- manifest version 2へmodel contractを追加し、source revision、exporter、SHA-256、root、skeleton、mesh、clip、socket、material、transform、budgetを固定した。
- GLB 2.0 binary inspectorとbuild validatorを追加し、node/clip/material欠落、duration、bounds、triangle、primitive、texture、bone、influence、bytes/hashに加え、各clipが全boneのrotation/locationをresetできることを検証する。
- A1のBabylon procedural generatorをdiagnostic専用pathへ移し、production contentから参照しないようにした。
- playerは21-bone skinと12 clips、Sentinelは16-bone skinと7 clipsを持つDCC assetへ置換した。
- player/enemy用のrenderer非依存animation controllerを追加し、logical clip ID解決、120 ms crossfade、one-shot revision dedupe、disposeをunit testした。
- Runnerを角丸が焼き込まれた人体、固定顔、非対称hair、ivory tunic、split cape、belt/pouch/bracer/boot、pointed swordへ作り直した。背面にもgold edge、cyan center trim、claspを置き、通常cameraで前後を判別できる。
- Sentinelをwedge helmet、visor、同心amber core、layered shoulder/limb armor、joint、shield、spear bladeを持つ人型automatonとして作り直した。meshをmaterial単位のprimitiveへ統合してdraw call budgetを維持した。
- 旧builderで結合時に消えていたbevelを実geometryへbakeし、UV sphere、tapered limb、extruded profile、torusを使う再利用可能な造形helperへ置換した。
- 全clip・全boneを毎frame bakeせず、手付けしたframeだけを書き出す構成へ変更した。一方で各frameに21/16 boneのrotation/location reset channelを持たせ、JumpLoopの脚やAttackの腰が次のIdleへ残留しない契約にした。
- Idle/Walk/Run/Jump/Dodgeで肩・肘・手首を剣の保持姿勢へ固定し、武器腕が空手のように振られる状態を解消した。Attack1–3は上段からの斜め斬り、下段からの斬り上げ、上段からのfinishへ再構成し、横方向の腰・胸回転を抑えて通常の背面cameraでも剣がcape外へ見える姿勢にした。
- 全周torusだったattack effectを、comboごとに傾きが変わる身体前方の短いtube trailへ置換した。damage authorityとactive windowはA1 domainのまま維持した。
- browser内の内部render scaleをdevicePixelRatio対応で調整し、3体のskinned Sentinelとplayerを同時表示してもdesktop/compact performance gateを通す構成にした。
- spawn直後にcameraを遮っていたsouth crystalを画面中央から移動した。

## Asset report

| Asset | Transfer | Triangles | Primitives | Materials | Bones | Influences | Clips |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Aether Runner | 441,108 bytes | 3,122 | 8 | 8 | 21 | 4 | 12 |
| Aether Sentinel | 248,776 bytes | 1,836 | 5 | 5 | 16 | 4 | 7 |

完全なmachine-readable値は`art/action3d/reports/model-validation.json`を正本とする。

## Verification

```text
PASS preflight:action3d-dcc
PASS validate:action3d-content — 1 world / 2 assets
PASS validate:action3d-models — player and Sentinel
PASS A2 targeted unit — 8 files / 31 tests
PASS repository typecheck
PASS production build
PASS Action3D browser E2E — 5 / 5
PASS runtime capture — landing reset and 3-stage combo / 60 FPS / 41 draw calls / 45 active meshes
```

## Visual review

- `art/action3d/reviews/a2-blockout-before.png`: 596/484 triangle blockoutの修正前gameplay capture。
- `art/action3d/reviews/aether-runner-quality-pass-v2.png`: Runnerのneutral pose DCC review。
- `art/action3d/reviews/aether-sentinel-quality-pass-v2.png`: Sentinelのneutral pose DCC review。
- `art/action3d/reviews/a2-production-pass-after.png`: geometry quality pass後のactual GLBを使った1280×720 gameplay capture。
- `art/action3d/reviews/a2-sword-ready-after.png`: 手首を返し、刃を身体前へ構えたIdle pose。
- `art/action3d/reviews/a2-sword-attack1-contact-after.png` / `a2-sword-attack2-contact-after.png` / `a2-sword-attack3-windup-after.png`: 3段の剣筋と溜めを比較するDCC review。
- `art/action3d/reviews/a2-sword-attack-runtime-after.png`: actual GLBと短いcombo別trailを使った攻撃中の1280×720 gameplay capture。
- `art/action3d/reviews/a2-jump-land-reset-runtime.png`: JumpLoop後に脚・腰がneutralへ戻り、両足がgroundへ接地したactual runtime capture。
- `art/action3d/reviews/a2-combo-runtime-v2-attack-1.png` / `-attack-2.png` / `-attack-3.png`: 横倒しを除いた3段comboのactual runtime連続capture。
- SentinelはA1の赤いpolyhedronから、visor/core/blade/shield/frontを通常cameraで識別できる人型automatonへ置き換わった。
- Aether Runnerは顔、髪、teal/ivoryの衣装面、split cape、関節、剣を持ち、背面cameraでもclaspとenergy trimからplayer silhouetteを識別できる。

## Remaining before A2-2 / A2-4 completion

- Runnerの連続skin weight、foot contact、cape secondary motionをpolishする。
- JumpStart→JumpLoop→Landのruntime transitionとlock-on strafeを追加する。
- Sentinelのweapon arc、wind-up ground cue、stagger/defeat cleanupをpolishする。
- actual motion capture/contact sheetをrubric reviewし、blockout表記をproductionへ更新する。
