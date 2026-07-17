# 07: KPI・Goal・Status Visualization拡張 実装計画

## 1. 文書の位置づけ

この文書は[00: コンセプト](./00-concept.md)のP4を、Lunaが最後まで実装できる粒度へ分解した正本である。
05はCartesian、06はComposition / Relationship / Hierarchy / Flowを拡張する。07は運用Dashboardで
頻出する「現在値」「前回差」「目標達成」「評価帯」「状態」を、小さいPanelでも判断できる表示へ拡張する。

対象family:

- Stat
- Gauge
- Bar Gauge
- Bullet Chart
- Progress
- Traffic Light

既存`core.stat/value`を含む21 presetを提供する。純増20 preset、新renderer type 5、既存type拡張1である。
06完了時の38 presetへ追加し、catalog全体を58 presetへ増やす。

### 1.1 開始条件

- 01 C0〜C9、02 B0〜B12、03 F0〜F12 complete。
- 04 D0〜D10 complete。
- 05 V0〜V12 complete。
- [06](./06-composition-relationship-hierarchy-flow.md) R0〜R13 complete。
- 38 presetがGallery / bundle / a11y gateでgreen。
- 06のtoken、formatter、summary、responsive patternを利用できる。

06未完了のまま07側へ暫定category model、token resolver、Gallery harnessを複製しない。

### 1.2 実行順

```text
04 D0〜D10 -> 05 V0〜V12 -> 06 R0〜R13 -> 07 K0〜K12 -> 08 S0〜S13 -> 09 T0〜T13
                                                                                     |
                                                                                     v
                                                                           04 D11 -> D12
```

現在のworking treeにある05 candidate向けD11初回matrixは履歴として保持する。07 K12後は
[08](./08-distribution-heatmap-statistical-visualizations.md) S0へhandoffする。既存D11証拠でD12へ進まない。

### 1.3 Lunaへの完了指示

1. progressの07節を読む。
2. 06 R13 completeを確認する。
3. 最初の`pending` K packageだけを`in_progress`にする。
4. contract、model、renderer、Gallery、testをpackage内で完成させる。
5. package固有gateを通す。
6. command、件数、coverage、Gallery、bundle bytesをprogressへ記録する。
7. `complete`にして次へ進む。
8. K12後、08 S0へhandoffする。

見た目だけ異なるpresetを増やさない。用途、入力契約、range/state semantics、responsive挙動の
少なくとも1つをpreset間で明確に変える。

### 1.4 正本の優先順位

1. 製品境界: 00
2. Data Frame / Field Config: 01
3. Backend: 02
4. Frontend runtime: 03
5. 品質/release: 04
6. Cartesian common: 05
7. token/category/summary: 06
8. KPI/Goal/Status: この文書
9. 現在地: progress

## 2. 目的

1. 既存Statを5 presetへ拡張する。
2. Gauge、Bar Gauge、Bullet、Progress、Traffic Lightを追加する。
3. current、previous、delta、goal、min/max、thresholdを共有modelで解決する。
4. range外の値を暗黙clampしない。
5. deltaの正負を`higher-is-better`へ暗黙固定しない。
6. threshold / mapping / fixed tokenの優先順位を全familyで統一する。
7. compact Panelとmobileで情報を段階的に要約する。
8. Table fallbackとsummaryで生値、goal、評価状態を確認可能にする。
9. KPI familyからRechartsと新runtime dependencyを排除する。
10. P5以降がrange/state/native SVG primitiveを再利用できる状態にする。

## 3. 完了後のcatalog

### 3.1 core.stat

| Preset | 表示 | 用途 |
| --- | --- | --- |
| `value` | 単一値 | existingを厳密化 |
| `value-delta` | 現在値 + 差分 | 前回比較 |
| `value-sparkline` | 現在値 + trend | 小型時系列KPI |
| `value-delta-sparkline` | 現在値 + 差分 + trend | 総合KPI |
| `value-list` | 複数KPI list | scorecard |

### 3.2 新type

| Type | Presets | 件数 |
| --- | --- | ---: |
| `core.gauge` | `semi-circle`, `full-circle`, `needle` | 3 |
| `core.bar-gauge` | `horizontal`, `vertical`, `segmented`, `retro-lcd` | 4 |
| `core.bullet` | `horizontal`, `vertical`, `comparative` | 3 |
| `core.progress` | `linear`, `segmented`, `steps` | 3 |
| `core.traffic-light` | `single`, `list`, `matrix` | 3 |

```text
core.stat          = 5  (existing 1 / new 4)
core.gauge         = 3
core.bar-gauge     = 4
core.bullet        = 3
core.progress      = 3
core.traffic-light = 3
07 total           = 21
07 net new         = 20
after 07 total     = 58
```

`core.radial-bar/progress`は複数categoryを円周上で比較するComposition rendererである。
`core.progress`は完了率またはworkflow stageを直線的に示す。aliasにしない。

## 4. Capability audit

- `core.stat/value`はRechartsへ依存しない。
- Field Configにmin/max、threshold、mapping、unit、decimalsがある。
- Data Frameにvalue/min/max/state roleがある。
- v1 stat compatibilityは`previous`と`delta` field keyを生成する。
- 新type ID 5件は01で予約済み。
- Frontend registryはstrict config、shape、lazy loaderを検証できる。

Recharts 3.9.2にはPie/RadialBar/BarがあるがP4では使わない。Gauge needle、Bullet band、Traffic Lightは
custom shapeが中心で、StatだけのためRecharts shared chunkをrequestすべきでない。HTML/CSS/native SVGで
実装し、Sparklineも100点以下のnative SVG pathとする。

固定事項:

- new runtime dependency 0。
- D3、gauge package、canvas packageを追加しない。
- SVG path計算はpure helper。
- CSS/SVG animationなし。

## 5. 対象file

### 5.1 shared

```text
shared/schemas/dashboard/field-config.schema.ts
shared/schemas/dashboard/data-frame.schema.ts
shared/schemas/dashboard/compatibility.ts
shared/schemas/dashboard/compatibility.test.ts
shared/schemas/dashboard/visualization.schema.ts
shared/schemas/dashboard/kpi-visualizations.schema.ts
shared/schemas/dashboard/kpi-visualizations.schema.test.ts
shared/schemas/dashboard/index.ts
```

### 5.2 Frontend common

```text
web/src/domains/dashboard/v2/visualizations/kpi/model.ts
web/src/domains/dashboard/v2/visualizations/kpi/model.test.ts
web/src/domains/dashboard/v2/visualizations/kpi/range.ts
web/src/domains/dashboard/v2/visualizations/kpi/range.test.ts
web/src/domains/dashboard/v2/visualizations/kpi/state.ts
web/src/domains/dashboard/v2/visualizations/kpi/state.test.ts
web/src/domains/dashboard/v2/visualizations/kpi/geometry.ts
web/src/domains/dashboard/v2/visualizations/kpi/geometry.test.ts
web/src/domains/dashboard/v2/visualizations/kpi/primitives.tsx
web/src/domains/dashboard/v2/visualizations/kpi/primitives.test.tsx
web/src/domains/dashboard/v2/visualizations/kpi/summary.ts
web/src/domains/dashboard/v2/visualizations/kpi/summary.test.ts
```

### 5.3 renderer family

```text
core-stat/{definition.ts,renderer.lazy.tsx,renderer.test.tsx}
core-gauge/{definition.ts,renderer.lazy.tsx,renderer.test.tsx}
core-bar-gauge/{definition.ts,renderer.lazy.tsx,renderer.test.tsx}
core-bullet/{definition.ts,renderer.lazy.tsx,renderer.test.tsx}
core-progress/{definition.ts,renderer.lazy.tsx,renderer.test.tsx}
core-traffic-light/{definition.ts,renderer.lazy.tsx,renderer.test.tsx}
```

全て`web/src/domains/dashboard/v2/visualizations/`配下。catalog、Backend Gallery、E2E、visual、a11y、
performance、bundle budget、README、LLM_CONTEXT、progressも更新する。

### 5.4 対象外

- State Timeline / Status History。
- alert evaluation / notification。
- SLO rule engine、period comparison query。
- formula/editor、arbitrary SVG/HTML。
- Canvas/WebGL、animated needle、blink/pulse/sound。
- acknowledgement/action mutation。

## 6. Data contract

### 6.1 shape mapping

| Family | Shape | 必須role |
| --- | --- | --- |
| Stat value/delta/list | scalar / table | value |
| Stat Sparkline | timeseries | time + value |
| Gauge | scalar / category | value、任意min/max |
| Bar Gauge | scalar / category | value、任意category/min/max |
| Bullet | scalar / category | value + goal |
| Progress value | scalar / category | value、任意min/max |
| Progress steps | category | category + state/value |
| Traffic single/list | scalar / category / table | stateまたはvalue |
| Traffic matrix | table | label + state/value fields |

### 6.2 new numeric roles

```text
previous
delta
goal
```

`previous`は同unit比較値、`delta`はhandlerが明示した差分、`goal`は目標値。既存`target` roleはSankey
endpoint用stringなのでnumeric targetへoverloadしない。

```ts
previous: ["number"]
delta: ["number"]
goal: ["number"]
```

schemaVersion 2内のadditive role拡張とし、Backend/Frontendを同じcandidateで更新する。v1 stat変換は
`value->[value]`、`previous->[previous]`、`delta->[delta]`へ変更する。旧v2のwell-known key fallbackは
読み取り互換のため維持し、新native fixtureでは新roleを必須にする。

### 6.3 semantic validation

- primary value field一意。
- current/previous/delta/goal finiteまたはnull。
- min < max。
- unitとrange整合。
- Sparkline time/value alignment。
- item/point/cell上限。
- Bullet goal必須。
- Traffic stateがmapping/thresholdで解決可能。
- steps順序、current一意、duplicate labelなし。

structural Zodだけでなくdefinition `validateFrames`とpure modelで検証する。

## 7. 固定済み設計判断

1. 21 presetを6 familyへ整理する。
2. Stat config versionを2、新typeは1とする。
3. Stat v1 optionsはnormalizerでv2 defaultへ移行する。
4. renderer JSX内でfield探索/range/delta/state解決しない。
5. valueを暗黙clampしない。
6. overflowは`reject`または明示marker。
7. `higher-is-better`を既定にしない。
8. nullを0へ変換しない。
9. percent unit/hundred scaleを混同しない。
10. raw colorをoptions/fixtureへ保存しない。
11. stateを色だけで伝えない。
12. SVG要素を全件tab stopにしない。
13. Tableはraw current/previous/delta/goal/min/maxを隠さない。
14. animation false、Recharts import 0、dependency追加0。
15. limit超過はtruncateせずincompatible。
16. mobileで極端に縮小せずsummaryへ切替。

## 8. Shared config

```ts
type KpiValueBinding = {
  valueFieldKey?: string;
  previousFieldKey?: string;
  deltaFieldKey?: string;
  goalFieldKey?: string;
};

type KpiRangeConfig = {
  min: "field" | "config" | "auto";
  max: "field" | "config" | "auto";
  overflow: "reject" | "show-marker";
};

type DeltaConfig = {
  mode: "absolute" | "percent" | "percent-points";
  sentiment: "neutral" | "higher-is-better" | "lower-is-better";
  zeroTolerance: number;
};
```

Stat:

```ts
type StatConfigV2 = KpiValueBinding & {
  reduce: "last-not-null" | "last";
  delta: DeltaConfig;
  sparkline: { maxPoints: number; showFill: boolean; showMinMax: boolean };
  list: { orientation: "auto" | "rows" | "grid"; maxItems: number };
};
```

Gauge共通:

```ts
type GaugeConfigV1 = KpiValueBinding & {
  range: KpiRangeConfig;
  startAngle: number;
  endAngle: number;
  showThresholdBands: boolean;
  showTicks: boolean;
  tickCount: number;
  showGoal: boolean;
};
```

Bar Gaugeはrange、showUnfilled、showGoal、segmentCount 3..40、itemSortを持つ。Bulletはrange、
showGoalLabel、showValueLabel、showThresholdBands、itemSortを持つ。Progressはrange、showPercentage、
showRemaining、segmentCount、currentStepFieldKey、completedStateValues最大10を持つ。

Traffic:

```ts
type TrafficLightConfigV1 = KpiValueBinding & {
  stateSource: "threshold" | "value-mapping";
  layout: "auto" | "rows" | "grid";
  shape: "circle" | "rounded-square";
  showInactiveStates: boolean;
  stateOrder: Array<"healthy" | "warning" | "critical" | "unknown">;
};
```

全schemaはstrict、field keyはshared schema、unknown key拒否。defaultsと全21 presetをsharedで定義する。

## 9. KPI model

```ts
type KpiDatum = {
  id: string;
  label: string;
  current: number | string | boolean | null;
  numericCurrent?: number;
  previous?: number | null;
  delta?: number;
  deltaPercent?: number | null;
  goal?: number | null;
  min?: number;
  max?: number;
  normalized?: number;
  overflow?: "below" | "above";
  state: "healthy" | "warning" | "critical" | "unknown";
  colorToken?: string;
  formatted: Record<"current" | "previous" | "delta" | "goal" | "min" | "max", string | undefined>;
  sparkline?: Array<{ time: number; value: number | null }>;
};
```

### 9.1 field resolution

1. config field key。
2. 対応role。
3. compatibility対象well-known key。
4. valueだけ最初のnumeric field。

複数role候補でconfig未指定ならincompatible。well-known fallbackは`previous/delta/goal`だけ。

### 9.2 current / previous / delta

- scalarはrow 0。
- `last`は最終row、`last-not-null`は末尾から最初のfinite value。
- previous role/fieldを優先し、なければ時系列の直前non-null point。
- explicit deltaを計算値より優先。
- delta=`current-previous`。
- previous=0のpercent deltaはnull。Infinity禁止。
- percent-pointsはpercent unitのみ。

### 9.3 list

- scalar複数value fieldまたはcategory rowsをitem化。
- stable ID=`frameRefId:fieldKey:category`。
- duplicate category拒否、input order維持、最大12。

## 10. Range / overflow

min/max precedenceはconfig modeに従い、Field Config、role field、autoの順で解決する。auto maxは
current/goalから1/2/5×10^nへ切り上げる。current=0かつgoalなしなら0..1。

```text
normalized = (value - min) / (max - min)
```

- min/max/value finite、min<max。
- rejectならrange外value/goalはincompatible。
- show-markerならgeometryだけ端へclipし、生値はclampしない。
- negative range可。
- percent/unit default 0..1、percent/hundred default 0..100。
- overflowをmarker、summary、Tableへ明示。

## 11. Semantic state / sentiment

State priority:

1. null -> unknown。
2. value mapping color + semantic label。
3. numeric threshold。
4. fixed Field Config colorはstate unknownのまま。
5. semantic default token。

Token名や明度からstateを推論しない。defaultsは`--color-chart-success/warning/danger/muted`。

Delta sentiment:

- neutralは符号だけ。
- higher-is-betterは正=improved。
- lower-is-betterは負=improved。
- tolerance内=unchanged。
- 欠損=unknown。

矢印と色だけにせずsummaryへimproved/worsened/unchangedを含める。

## 12. Native primitives

```text
KpiValueText / KpiDelta / KpiStateBadge
NativeSparkline
GaugeArc / GaugeNeedle
RangeTrack / GoalMarker / OverflowMarker
SegmentTrack
TrafficSignal
```

- fixed viewBox、responsive size。
- geometry helperは0..1 coordinate。
- SVG内textを最小化し主要valueはHTML overlay。
- decorative SVGは`aria-hidden`、`focusable=false`。
- gradient/filter/blinkなし。
- Panel shell size class `xs/sm/md/lg`を使う。
- resizeでData Frame/modelを再計算しない。

## 13. Renderer仕様

### 13.1 Stat

- value: 現行互換、strict config、mapping/threshold/no-value。
- value-delta: current、formatted delta、sentiment、previous detail。
- value-sparkline: timeseries最大100点、null gap、min=max中央line。
- combined: xsではSparkline省略、md以上で表示。
- value-list: 2〜12、desktop 1〜3 columns、mobile 1 column、multi-unit可。

### 13.2 Gauge

- semiは180度、fullは270度、needleはthreshold band + needle。
- threshold stepをnon-overlap arcへ変換。
- tickCount 2..11、角度差30..330。
- goal/overflow marker。
- 最大6 gauges。7件以上incompatible。
- width 160px未満でtick labelを隠す。

### 13.3 Bar Gauge

- 1〜20 items、合計segment最大400。
- horizontalはlong label、verticalは2〜12件。
- segmented filled count=`floor(normalized*count)`、maxだけ全fill。
- retro-lcdは同modelでgap/角丸tokenのみ。glow/filterなし。
- visual sortはTable raw orderを変えない。

### 13.4 Bullet

- value + goal必須、min/max、threshold qualitative bands。
- current bar、goal marker、background bandsを別layer。
- goalはthresholdではない。
- comparativeは2〜20 rows、same unit、common range必須。
- mixed unit、goal missing、21件を拒否。

### 13.5 Progress

- linear: current/max、percentage、remaining。
- segmented: 3〜40 segments、category最大12。
- steps: 2〜20 ordered steps、completed/current/pending。
- current最大1、completedの後にpending、その後completedを拒否。
- 全件completed時はcurrentなし可。

### 13.6 Traffic Light

- numericはthreshold、string/booleanはmapping、未解決はunknown。
- singleはsignal + label + raw value。
- listは2〜30 items、input order。
- matrixは2〜20 rows × 2〜8 columns、最大160 cells。
- cellをtab stopにせずTableを操作経路にする。
- 色に加えlabel/icon shapeを表示。点滅なし。

## 14. Table fallback

derived summary columns:

```text
Name / Current / Previous / Delta / Goal / Min / Max / Progress % / State
```

存在する列だけ表示し、raw Data Frame viewも維持する。Sparklineはtime/value rows、Bulletはcurrent/goal、
stepsはorder/raw state/derived phase、Traffic matrixはrow/column/raw/semantic stateを確認できる。
visual sortではなくinput orderを初期表示する。

## 15. Accessibility / responsive

- stateを色だけで伝えない。
- deltaは符号、text、sentimentを読む。
- decorative SVGをtreeから除外。
- Table toggleへkeyboardで到達。
- summary最大1,000文字。
- Stat/listは先頭5 + 残件数。
- Trafficはcounts + critical先頭5。
- axe serious/critical 0、forced-colors、200% zoom、reduced motionを検証。

Summary例:

```text
Error rate: 2.4 percent, down 0.3 percentage points, improved, warning.
Capacity: 72 of 100, goal 80, below goal by 8, healthy.
Deployment: step 3 of 5, Verify, 60 percent complete.
Service health: 8 healthy, 2 warning, 1 critical, 1 unknown.
```

Mobile:

- Statはvalue+delta、Sparkline省略可。
- Gaugeはcompact arcまたはsummary。
- Bar Gauge/Bulletはhorizontal list。
- Progress stepsはcurrent step text。
- Traffic matrixはcounts + critical list。
- font 8px未満禁止、overflow禁止、label全文はTable。

## 16. Limits / performance / security

| Model | Limit |
| --- | ---: |
| Stat Sparkline | 100 points |
| Stat list | 12 items |
| Gauge | 6 items |
| Bar Gauge | 20 items / 400 segments |
| Bullet comparative | 20 items |
| Progress | 12 items / 20 steps |
| Traffic list | 30 items |
| Traffic matrix | 160 cells |

Gate:

- model/geometry 50ms Long Taskなし。
- SVG DOM 500 nodes未満/panel。
- resize memoization、layout shiftなし、animationなし。
- strict Zod、raw HTML/SVG injectionなし。
- pathはnumeric helperのみ、token schema通過CSS variableのみ。
- goal/stateをURLへ追加しない。
- metric名をDOM idへ使わない。
- action/acknowledgementを追加しない。

## 17. Lazy load / bundle

Dynamic entries:

```text
core-stat
core-gauge
core-bar-gauge
core-bullet
core-progress
core-traffic-light
```

- normal initial / Dashboard shell / Gallery shellにstatic renderer importなし。
- 6 renderer graphからRechartsへ到達しない。
- catalogはdefinition/configのみ。
- 6 entryへraw/gzip budget row。
- 実測+10% rounding。
- core.stat baseline delta記録。
- lockfile runtime dependency差分0。

## 18. Gallery cases

| Case ID | Type/Preset | 主確認 |
| --- | --- | --- |
| `stat-value` | stat/value | existing互換 |
| `stat-delta` | stat/value-delta | sentiment |
| `stat-sparkline` | stat/value-sparkline | null gap |
| `stat-combined` | stat/value-delta-sparkline | responsive |
| `stat-list` | stat/value-list | multi-unit |
| `gauge-semi` | gauge/semi-circle | range/bands |
| `gauge-full` | gauge/full-circle | ticks |
| `gauge-needle` | gauge/needle | needle/goal |
| `bar-gauge-horizontal` | bar-gauge/horizontal | compare |
| `bar-gauge-vertical` | bar-gauge/vertical | negative range |
| `bar-gauge-segmented` | bar-gauge/segmented | rounding |
| `bar-gauge-retro` | bar-gauge/retro-lcd | compact |
| `bullet-horizontal` | bullet/horizontal | layers |
| `bullet-vertical` | bullet/vertical | narrow |
| `bullet-comparative` | bullet/comparative | common range |
| `progress-linear` | progress/linear | remaining |
| `progress-segmented` | progress/segmented | segments |
| `progress-steps` | progress/steps | phases |
| `traffic-single` | traffic-light/single | label/color |
| `traffic-list` | traffic-light/list | counts |
| `traffic-matrix` | traffic-light/matrix | summary |

fixed values/time、stable IDs/order、token colors、recommended size、Table enabled。05/06 casesを削除しない。

Invalid fixtures:

- duplicate value role、non-finite previous/delta/goal。
- min>=max、range外reject、percent mismatch。
- Sparkline 101、Stat list 13、Gauge 7。
- Bar Gauge 21/401、Bullet goal missing/mixed unit。
- Progress negative/duplicate/current multiple。
- Traffic unresolved string/161 cells。
- unknown config、raw color。

## 19. Backend / Frontend responsibility

Backend:

- shared config/role、legacy migration、Gallery Frames、manifest validation、limits。
- 業務handlerはcurrent/previous/goalを集計して返してよい。
- 共通Backendは業務goal、delta sentiment、nice range、geometry、visual sortを決めない。

Frontend:

- binding、range/state/delta、geometry、responsive、Field Config、Table、summary、lazy load。
- JSXへrole探索、division-by-zero、state priority、nice max、band分割、step validationを書かない。

## 20. K0〜K12 Work Packages

| WP | 内容 | 完了gate |
| --- | --- | --- |
| K0 | baseline / audit | 06 R13、38 preset、bundle |
| K1 | role / shared config / migration | schema tests |
| K2 | value / range / state model | pure tests |
| K3 | native SVG / compact primitives | geometry/a11y tests |
| K4 | Stat 5 presets | regression + Gallery 5 |
| K5 | Gauge 3 presets | geometry + Gallery 3 |
| K6 | Bar Gauge 4 presets | limits + Gallery 4 |
| K7 | Bullet 3 presets | goal/bands + Gallery 3 |
| K8 | Progress 3 presets | range/steps + Gallery 3 |
| K9 | Traffic 3 presets | state/matrix + Gallery 3 |
| K10 | catalog/Gallery conformance | exact 58 presets |
| K11 | visual/a11y/performance/bundle | expanded gates |
| K12 | full verify/docs/handoff | full gates/progress |

## 21. K0: Baseline

```bash
git branch --show-current
git status --short
node -p 'require("./node_modules/recharts/package.json").version'
bun run verify
bun run verify:dashboard-contract
bun run verify:dashboard-coverage
bun run verify:dashboard-frontend-coverage
bun run verify:dashboard-gallery
E2E_PORT=5175 bun run verify:dashboard-e2e
bun run verify:dashboard-bundle
git diff --check
```

Record: 06 status、38 preset、Gallery count、core.stat bytes、initial/shell graph、coverage、visual count、
D11 baseline、concurrent changes。

Gate: 06 complete、38 presets green、Stat characterization green、no-Recharts方針固定。

## 22. K1: Contracts

実装: previous/delta/goal roles、roleTypes、legacy migration、6 configs、21 descriptors/defaults、Stat v1→v2
normalizer、barrel export。

Tests: role positive/negative、target string regression、strict unknown、all defaults、exact IDs、field key、boundary、
legacy conversion、old `{}` normalization、JSON round-trip。

```bash
bunx vitest run shared/schemas/dashboard/kpi-visualizations.schema.test.ts shared/schemas/dashboard/compatibility.test.ts shared/schemas/dashboard.schema.test.ts
bun run typecheck
git diff --check
```

## 23. K2: Model

Testsを先に追加する。

- key > role > legacy > value fallback、ambiguous拒否。
- last/last-not-null、explicit delta、previous=0。
- negative range、1/2/5 nice max、percent scales。
- overflow reject/marker、color priority、lower-is-better、tolerance。
- stable IDs/order、item limits。

```bash
bunx vitest run web/src/domains/dashboard/v2/visualizations/kpi/model.test.ts web/src/domains/dashboard/v2/visualizations/kpi/range.test.ts web/src/domains/dashboard/v2/visualizations/kpi/state.test.ts
bun run verify:dashboard-frontend-coverage
git diff --check
```

## 24. K3: Primitives

実装: arc/needle/band/Sparkline geometry、RangeTrack、Goal/Overflow、SegmentTrack、Value/Delta/State、TrafficSignal。

Tests: angle endpoint、largeArc/sweep、0/0.5/1、band continuity、null gap、min=max Sparkline、overflow、
non-focusable SVG、token-only、no animation。

```bash
bunx vitest run web/src/domains/dashboard/v2/visualizations/kpi/geometry.test.ts web/src/domains/dashboard/v2/visualizations/kpi/primitives.test.tsx
bun run typecheck
bun run verify:dashboard-bundle
git diff --check
```

## 25. K4〜K9: Renderer packages

各packageでdefinition、loader、renderer、summary、Table derived model、unit/component test、Gallery fixtureを
同時に追加する。空rendererを先に登録しない。

| WP | 必須test | Focused command grep |
| --- | --- | --- |
| K4 Stat | migration、value DOM、delta、100/101 points、12/13 items、no Recharts | `stat` |
| K5 Gauge | min/mid/max、ticks、bands、overflow、6/7 items | `gauge` |
| K6 Bar Gauge | 20/21 items、400/401 segments、sort/raw order、negative | `bar gauge` |
| K7 Bullet | goal missing/bounds、bands、mixed unit、20/21 | `bullet` |
| K8 Progress | 0/50/100、overflow、steps sequence、20/21 | `progress` |
| K9 Traffic | threshold/mapping/unknown、30/31、160/161、no mass tabs | `traffic` |

各WP gate:

```bash
bunx vitest run web/src/domains/dashboard/v2/visualizations/<family>
bun run verify:dashboard-gallery
E2E_PORT=5175 bun run verify:dashboard-e2e -- --grep "<family>"
bun run verify:dashboard-bundle
git diff --check
```

### 25.1 K4 Stat completion checklist

- [ ] existing `value` fixtureを変更前characterizationと比較。
- [ ] descriptor version 2、5 preset exact。
- [ ] scalar/timeseries/tableのshape validation。
- [ ] value/delta/Sparkline/combined/list strategyを分離。
- [ ] 100 pointでgreen、101 pointでincompatible。
- [ ] 12 itemでgreen、13 itemでincompatible。
- [ ] previous=0、null gap、mapped text、mixed unit listをtest。
- [ ] xs/sm/md/lg snapshot。
- [ ] raw/derived Tableとsummary。
- [ ] renderer graphからRecharts edge 0。

### 25.2 K5 Gauge completion checklist

- [ ] 3 preset exact、default semi-circle。
- [ ] start/end angleをpreset defaultから解決。
- [ ] min/mid/maxでarc endpoint確認。
- [ ] threshold bandとgoal markerを別layer化。
- [ ] full-circleは270度gapを維持。
- [ ] needleのorigin/angle/overflowをgeometry test。
- [ ] tick 2/11 green、1/12 reject。
- [ ] negative rangeとpercent scale。
- [ ] 6 items green、7 reject。
- [ ] mobile summary / Table / accessible text。

### 25.3 K6 Bar Gauge completion checklist

- [ ] 4 preset exact、default horizontal。
- [ ] horizontal/verticalで同じnormalized model。
- [ ] vertical negative rangeにzero marker。
- [ ] segmented 0/max boundary。
- [ ] retro-lcdにfilter/glow/animationなし。
- [ ] 20 items / 400 segments green。
- [ ] 21 items / 401 segments reject。
- [ ] input/value asc/value desc sort。
- [ ] Tableはraw order維持。
- [ ] mobile horizontal fallback。

### 25.4 K7 Bullet completion checklist

- [ ] 3 preset exact、default horizontal。
- [ ] goal roleなしをdefinitionでreject。
- [ ] actual、goal、threshold bandsのlayer順固定。
- [ ] goal at min/max test。
- [ ] goal overflow reject/marker test。
- [ ] threshold stepを連続bandへ変換。
- [ ] comparative same unit/common range validation。
- [ ] 20 items green、21 reject。
- [ ] value/goal/bandをsummaryで区別。
- [ ] Tableにraw goalを表示。

### 25.5 K8 Progress completion checklist

- [ ] 3 preset exact、default linear。
- [ ] 0/50/100とremainingをtest。
- [ ] over maxのreject/marker。
- [ ] segmented count 3/40 green、2/41 reject。
- [ ] steps 2/20 green、1/21 reject。
- [ ] duplicate label、current複数をreject。
- [ ] completed-current-pending sequenceをvalidate。
- [ ] all-completeを許可。
- [ ] xsではcurrent step textを維持。
- [ ] Tableにraw state/derived phase。

### 25.6 K9 Traffic completion checklist

- [ ] 3 preset exact、default single。
- [ ] numeric threshold、string/boolean mapping。
- [ ] unresolved raw stateはunknown。
- [ ] CSS token名からsemantic stateを推論しない。
- [ ] active/inactive lampのaccessible name。
- [ ] list 30 green、31 reject。
- [ ] matrix 160 cells green、161 reject。
- [ ] state countとcritical先頭5 summary。
- [ ] forced-colorsでshape/textが残る。
- [ ] cell mass tab stop 0、Table keyboard pathあり。

## 26. K10: Gallery / conformance

- 5 new type + 1 expanded type。
- exact 21 P4 presets、cumulative 58。
- every default parses、every preset deterministic case。
- loader dynamic、summary non-empty <=1000、Table enabled。
- invalid fixtureは意図したlayerでreject。
- 05/06 cases維持。
- family ready、table toggle、responsive、console error 0。

```bash
bun run verify:dashboard-contract
bun run verify:dashboard-coverage
bun run verify:dashboard-frontend-coverage
bun run verify:dashboard-gallery
E2E_PORT=5175 bun run verify:dashboard-e2e
git diff --check
```

## 27. K11: Quality gate

Visual baseline minimum:

```text
gallery-kpi-desktop.png
gallery-goal-desktop.png
gallery-status-desktop.png
gallery-kpi-mobile.png
panel-stat-delta-sparkline.png
panel-gauge-needle.png
panel-bar-gauge-retro.png
panel-bullet-comparative.png
panel-progress-steps.png
panel-traffic-matrix.png
```

Accessibility: axe、forced-colors、200% zoom、keyboard Table、reduced motion、no mass tabs。
Performance: upper-bound fixture、50ms、SVG node、memoization、layout shift 0。
Bundle: 6 entries/budgets、initial/shell、Recharts edge 0、dependency diff 0、Stat delta。

```bash
bun run verify:dashboard-gallery
bun run verify:dashboard-frontend-coverage
E2E_PORT=5175 bun run verify:dashboard-e2e
E2E_PORT=5175 bun run verify:dashboard-visual
E2E_PORT=5175 bun run verify:dashboard-a11y
E2E_PORT=5175 bun run verify:dashboard-performance
bun run verify:dashboard-bundle
git diff --check
```

## 28. K12: Full verification / handoff

```bash
bun run verify
bun run verify:dashboard-contract
bun run verify:dashboard-coverage
bun run verify:dashboard-frontend-coverage
bun run verify:dashboard-gallery
E2E_PORT=5175 bun run verify:dashboard-e2e
E2E_PORT=5175 bun run verify:dashboard-visual
E2E_PORT=5175 bun run verify:dashboard-a11y
E2E_PORT=5175 bun run verify:dashboard-performance
bun run verify:dashboard-bundle
git diff --check
```

Docs: README catalog、roles/migration、range/overflow/state、no-Recharts、limits、LLM_CONTEXT、progress、D11 handoff。

```text
07 status: complete
Expanded types: 1
New types: 5
P4 presets: 21
Net new presets: 20
Cumulative presets: 58
New runtime dependencies: 0
KPI renderer Recharts imports: 0
Next: 08 S0
```

## 29. Coverage / failure handling

Focused coverageにmodel、range/state/geometry、summary、definitions、strategies、responsive branchesを含める。
Native SVGをexcludeしない。thresholdはstatements/lines/functions 80%、branches 70%。

| Failure | 戻るWP |
| --- | --- |
| role/config/migration | K1 |
| binding/range/state | K2 |
| SVG primitive | K3 |
| family renderer | K4〜K9の該当WP |
| catalog/Gallery | K10 |
| visual/a11y/perf/bundle | K11または原因WP |
| full gate | 原因WP、K12 complete禁止 |

## 30. Stop条件

停止する:

- 06 R13未完了。
- additive roleが外部consumerを壊す証拠。
- Stat DOM contractをmigration不能。
- status tokenがforced-colorsで識別不能。
- Panel size classを取得不能。
- native SVGを安全に描画不能。
- Tableへderived valueを追加不能。
- accessibilityを弱める必要。
- concurrent変更と安全にmerge不能。

停止しない: geometry test増加、visual調整、label collision、Stat refactor、coverage不足、mobile再調整、
budget row追加。

## 31. 完了条件

- [ ] 06 R0〜R13 complete。
- [ ] K0〜K12 complete。
- [ ] expanded type 1 / new types 5。
- [ ] P4 21 / net new 20 / cumulative 58 presets。
- [ ] previous/delta/goal roles、target regressionなし。
- [ ] Stat config migration。
- [ ] strict definitions / shared model。
- [ ] no implicit clamp / sentiment。
- [ ] Stat 5、Gauge 3、Bar Gauge 4、Bullet 3、Progress 3、Traffic 3。
- [ ] 21 Gallery success + invalid tests。
- [ ] Table raw/derived、summary、mobile、forced-colors、200% zoom。
- [ ] visual/a11y/performance/bundle/coverage/full verify pass。
- [ ] KPI Recharts import 0 / runtime dependency 0 / 6 budget rows。
- [ ] progress/docs updated。

## 32. 次計画へ渡す成果

```text
Stat: value / delta / Sparkline / combined / list
Goal: Gauge / Bar Gauge / Bullet / Progress
Status: Traffic single / list / matrix
Shared: previous/delta/goal roles, binding, range/overflow, semantic state,
        sentiment, native SVG geometry, compact primitives
```

08 P5は[08: Distribution・Heatmap・Statistical Visualization拡張](./08-distribution-heatmap-statistical-visualizations.md)
としてHistogram、Heatmap、Box Plot、Calendar Heatmapを追加する。07のrange、threshold、semantic color、
compact summaryを再利用する。distribution binningとmatrix color scaleは08で定義し、07へ先回りしない。

## 33. 再開手順

1. 00 P4を読む。
2. 06 R13 completeを確認。
3. progressの07節を読む。
4. branch/statusを確認。
5. current `in_progress` Kを確認。
6. 最後の成功commandを再実行。
7. 最初のpending Kだけを開始。
8. contract/model/renderer/Gallery/testを同packageで完成。
9. K12後、08 S0へhandoff。

## 34. 実装後コードレビュー（2026-07-17）

- 通常の`/dashboard`をnative v2 dashboardへ切り替え、KPI新familyを代表パネルとして表示。
- `/dashboard`からVisualization Galleryへの導線を追加。
- percent `hundred` / `unit` scaleの逆転、category行のprevious/goal参照、delta percent/pp formattingを修正。
- Gauge複数項目、preset別angle、Bar Gauge segmented/retro、Progress steps、Traffic single/list/matrixの表示差を実装。
- GalleryのStat sparkline / Table / truncated output shapeとProgress steps fixtureを修正。
- Gallery 64 fixtureをAPI coordinator経由で全件実行し、shape mismatchをunit testで検出可能にした。
- 通常画面・Gallery E2Eでrenderer error 0、table fallback 0、新family DOM、2.4%表示を検証。
- full release gate成功: backend 95 files / 290 tests、frontend 36 files / 93 tests、E2E 3/3、visual 5/5、a11y 3/3、performance 1/1。
