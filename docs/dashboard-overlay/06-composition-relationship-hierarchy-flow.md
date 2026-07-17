# 06: Composition・Relationship・Hierarchy・Flow Visualization拡張 実装計画

## 1. 文書の位置づけ

この文書は、[00: コンセプト](./00-concept.md)のP3を、Lunaが最後まで実装できる粒度へ
分解した正本である。

05がCartesian表示を18 presetへ拡張するのに対し、06は次の分析領域を追加する。

- 構成比
- 多軸比較
- radial ranking / progress
- 2〜3変数の関係
- 段階別減少
- 階層構造
- 流量 / 遷移

追加するrenderer typeは8、presetは18、純増18である。05完了後のStat/Tableを含む20 presetへ
追加し、catalog全体を38 presetまで増やす。40以上の完成条件は07で超える。

### 1.1 開始条件

- [01: 共有契約](./01-contracts.md) C0〜C9 complete。
- [02: Backend](./02-backend.md) B0〜B12 complete。
- [03: Frontend](./03-frontend.md) F0〜F12 complete。
- [04: Validation / Gallery / Delivery](./04-testing-and-delivery.md) D0〜D10 complete。
- [05: Cartesian Visualization拡張](./05-cartesian-visualizations.md) V0〜V12 complete。
- shared strict Visualization definition patternが存在する。
- Renderer contextへresolved presetが渡る。
- Gallery / visual / a11y / performance / bundle gateが18 Cartesian presetを扱える。

05未完了のまま、06側へCartesian helperの複製、暫定preset context、loose options schemaを作らない。

### 1.2 実行順

```text
04 D0〜D10  (quality baseline)
      │
      ▼
05 V0〜V12  (18 Cartesian presets)
      │
      ▼
06 R0〜R13  (18 non-Cartesian presets)
      │
      ▼
07 K0〜K12  (21 KPI / Goal / Status presets)
      │
      ▼
08 S0〜S13  (20 Distribution / Statistical presets)
      │
      ▼
09 T0〜T13  (18 State / Uptime presets)
      │
      ▼
04 D11〜D12 (variant / release candidate)
```

現在のworking treeでは05 candidateに対するD11初回matrixまで完了している。その結果は06着手前の
baselineとして保持するが、06でshared contract、renderer、Gallery、bundle graphが変わるため、
R13後は[07](./07-kpi-goal-status-visualizations.md) K0へhandoffする。既存D11証拠だけでD12へ進まない。

### 1.3 Lunaへの完了指示

LunaはR0〜R13を順番に実行する。

1. [progress.md](./progress.md)の06節を読む。
2. 05 V12 completeを確認する。
3. 最初の`pending` R packageだけを`in_progress`にする。
4. shared contract、model、renderer、Gallery caseをpackage内で完成させる。
5. package固有gateを通す。
6. test件数、coverage、Gallery case、bundle bytesをprogressへ記録する。
7. `complete`へ変更して次へ進む。
8. R13完了後、07 K0へhandoffする。

typeだけ登録して空rendererを残さない。各typeは最初に登録されるpackageで、少なくとも1 presetの
実描画、Table fallback、accessible summary、Gallery fixtureを持つ。

### 1.4 正本の優先順位

1. プロダクト境界: [00-concept.md](./00-concept.md)
2. Data Frame / roles / wire: [01-contracts.md](./01-contracts.md)
3. Backend registry: [02-backend.md](./02-backend.md)
4. Frontend runtime: [03-frontend.md](./03-frontend.md)
5. Gallery / quality / release: [04-testing-and-delivery.md](./04-testing-and-delivery.md)
6. shared Visualization pattern / common formatting: [05-cartesian-visualizations.md](./05-cartesian-visualizations.md)
7. Composition / Relationship / Hierarchy / Flow: この文書
8. 現在地: [progress.md](./progress.md)

## 2. 目的

1. 8 renderer type、18 presetを追加する。
2. category、distribution、hierarchy、graph-nodes/edgesを実際のVisualizationで使う。
3. BackendとFrontendで同じstrict Zod options definitionを使う。
4. flat Data Frameからpolar/hierarchy/flow modelへの変換をpure helperへ分離する。
5. negative、zero、null、duplicate、cycle、orphan、unknown edgeを曖昧に描画しない。
6. token colorをcategory/node IDに安定割当し、sortやfilterで色を変えない。
7. Tooltip、Legend、Table fallback、accessible summaryを全presetに提供する。
8. Recharts family単位lazy loadを維持する。
9. 通常routeとDashboard shellへ新rendererを混入させない。
10. 新runtime依存なしで実装する。
11. 後続P4〜P7がhierarchy/graph modelと品質contractを再利用できる状態にする。

## 3. 完了後のcatalog

### 3.1 core.pie

| # | Preset ID | 表示 | 用途 |
| ---: | --- | --- | --- |
| 1 | `pie` | Pie | 単純な構成比 |
| 2 | `donut` | Donut | 構成比 + center total |
| 3 | `semi-donut` | 半円Donut | compact KPI composition |
| 4 | `rose` | equal-angle rose | categoryごとの相対量 |

### 3.2 core.radar

| # | Preset ID | 表示 | 用途 |
| ---: | --- | --- | --- |
| 1 | `line` | outline radar | 指標形状比較 |
| 2 | `filled` | filled radar | 単一seriesの強調 |
| 3 | `multi` | multi-series radar | 複数対象比較 |

### 3.3 core.radial-bar

| # | Preset ID | 表示 | 用途 |
| ---: | --- | --- | --- |
| 1 | `ranking` | radial ranking | category ranking |
| 2 | `progress` | radial progress | 共通maxに対する達成度 |

### 3.4 core.scatter

| # | Preset ID | 表示 | 用途 |
| ---: | --- | --- | --- |
| 1 | `scatter` | X/Y scatter | 2変数相関 |
| 2 | `bubble` | X/Y/size bubble | 3変数相関 |
| 3 | `quadrant` | reference quadrant | 4象限分析 |

### 3.5 core.funnel

| # | Preset ID | 表示 | 用途 |
| ---: | --- | --- | --- |
| 1 | `funnel` | funnel | 段階別減少 |
| 2 | `pyramid` | reversed funnel | 段階構成 / expansion |

### 3.6 core.treemap

| # | Preset ID | 表示 | 用途 |
| ---: | --- | --- | --- |
| 1 | `flat` | flat treemap | 1階層構成比 |
| 2 | `nested` | nested treemap | 多階層構成比 |

### 3.7 core.sunburst

| # | Preset ID | 表示 | 用途 |
| ---: | --- | --- | --- |
| 1 | `sunburst` | sunburst | 階層と構成比 |

### 3.8 core.sankey

| # | Preset ID | 表示 | 用途 |
| ---: | --- | --- | --- |
| 1 | `sankey` | Sankey flow | 流入、流出、遷移 |

### 3.9 数え方

```text
core.pie        = 4
core.radar      = 3
core.radial-bar = 2
core.scatter    = 3
core.funnel     = 2
core.treemap    = 2
core.sunburst   = 1
core.sankey     = 1
06 total        = 18

05 catalog total including Stat/Table = 20
after 06 total                       = 38
```

## 4. Recharts capability audit

計画作成時のlockfileはRecharts `3.9.2`である。local type declarationで次を確認済み。

```text
PieChart / Pie
RadarChart / Radar
RadialBarChart / RadialBar
ScatterChart / Scatter
FunnelChart / Funnel
Treemap
SunburstChart
Sankey
```

SunburstもRecharts 3.9.2に含まれる。D3、ECharts、visx等を追加しない。

実装開始時:

```bash
node -p 'require("./node_modules/recharts/package.json").version'
rg -n "SunburstChart|Sankey|Treemap" node_modules/recharts/types/index.d.ts
```

versionが変わっている場合はAPI差分を監査する。機能が存在するという理由だけでlockfileを更新しない。

## 5. 対象

### 5.1 既存file

```text
shared/schemas/dashboard.schema.ts
shared/schemas/dashboard/index.ts
shared/schemas/dashboard/data-frame.schema.ts
shared/schemas/dashboard/visualization.schema.ts

api/app/hono.ts
api/modules/dashboard/index.ts
api/modules/dashboard/v2/gallery-dashboard.ts
api/modules/dashboard/v2/gallery-dashboard.test.ts
api/modules/dashboard/v2/visualization-registry.ts

web/src/domains/dashboard/v2/runtime/field-config.ts
web/src/domains/dashboard/v2/runtime/theme.ts
web/src/domains/dashboard/v2/runtime/visualization-types.ts
web/src/domains/dashboard/v2/visualizations/catalog.ts
web/src/domains/dashboard/v2/visualizations/catalog.test.ts
web/src/domains/dashboard/v2/visualizations/cartesian/legend.tsx
web/src/domains/dashboard/v2/visualizations/cartesian/tooltip.tsx
web/src/styles.css

scripts/verify-dashboard-gallery.ts
scripts/verify-dashboard-bundle.ts
scripts/dashboard-bundle-budget.json

tests/e2e/dashboard/dashboard-gallery.spec.ts
tests/visual/dashboard-gallery.visual.spec.ts
tests/accessibility/dashboard.accessibility.spec.ts
tests/performance/dashboard.performance.spec.ts

docs/dashboard-overlay/progress.md
docs/dashboard-overlay/04-testing-and-delivery.md
docs/dashboard-overlay/05-cartesian-visualizations.md
```

### 5.2 追加shared file

```text
shared/schemas/dashboard/composition-visualizations.schema.ts
shared/schemas/dashboard/composition-visualizations.schema.test.ts
shared/schemas/dashboard/relationship-visualizations.schema.ts
shared/schemas/dashboard/relationship-visualizations.schema.test.ts
shared/schemas/dashboard/hierarchy-flow-visualizations.schema.ts
shared/schemas/dashboard/hierarchy-flow-visualizations.schema.test.ts
```

### 5.3 追加Frontend common file

```text
web/src/domains/dashboard/v2/visualizations/composition/category-model.ts
web/src/domains/dashboard/v2/visualizations/composition/category-model.test.ts
web/src/domains/dashboard/v2/visualizations/composition/polar-tooltip.tsx
web/src/domains/dashboard/v2/visualizations/composition/polar-legend.tsx
web/src/domains/dashboard/v2/visualizations/composition/summary.ts
web/src/domains/dashboard/v2/visualizations/composition/summary.test.ts

web/src/domains/dashboard/v2/visualizations/relationship/scatter-model.ts
web/src/domains/dashboard/v2/visualizations/relationship/scatter-model.test.ts

web/src/domains/dashboard/v2/visualizations/hierarchy/hierarchy-model.ts
web/src/domains/dashboard/v2/visualizations/hierarchy/hierarchy-model.test.ts
web/src/domains/dashboard/v2/visualizations/hierarchy/hierarchy-summary.ts

web/src/domains/dashboard/v2/visualizations/flow/sankey-model.ts
web/src/domains/dashboard/v2/visualizations/flow/sankey-model.test.ts
```

### 5.4 追加renderer family

各directoryに`definition.ts`、`model.ts`またはcommon model adapter、`renderer.lazy.tsx`、
`renderer.test.tsx`を置く。

```text
web/src/domains/dashboard/v2/visualizations/core-pie/
web/src/domains/dashboard/v2/visualizations/core-radar/
web/src/domains/dashboard/v2/visualizations/core-radial-bar/
web/src/domains/dashboard/v2/visualizations/core-scatter/
web/src/domains/dashboard/v2/visualizations/core-funnel/
web/src/domains/dashboard/v2/visualizations/core-treemap/
web/src/domains/dashboard/v2/visualizations/core-sunburst/
web/src/domains/dashboard/v2/visualizations/core-sankey/
```

### 5.5 対象外

- Histogram、Heatmap、Box Plot
- Gauge、Bar Gauge、Bullet、Traffic Light
- State Timeline、Status History、Uptime Grid
- Node Graph
- Candlestick
- Logs、Trace、Flame Graph、Geomap
- hierarchy click zoom / breadcrumb persistence
- Sankey node drag
- force layout
- scatter regression line
- lasso / brush selection
- cross-panel selection
- annotation
- image export
- arbitrary color per raw row
- Canvas/WebGL renderer

## 6. 現行contract監査

### 6.1 再利用できるData Frame shape

| Visualization | Shape | 必須roles |
| --- | --- | --- |
| Pie/Donut/Rose | category | category + value |
| Radar | category | category + value fields |
| Radial Bar | category / scalar | category + value、またはscalar value |
| Scatter/Bubble | distribution | x + y、任意size/series |
| Funnel/Pyramid | category | category + value |
| Flat Treemap | category | category + value |
| Nested Treemap/Sunburst | hierarchy | id + optional parent-id + value |
| Sankey nodes | graph-nodes | id + optional category/value |
| Sankey edges | graph-edges | source + target + value |

必要roleとshapeは01ですでに定義済みである。新しいwire field type/role/shapeを追加しない。

### 6.2 Contractだけでは不足するsemantic validation

- category duplicate
- negative composition value
- all-zero composition
- Radar axis数 / null / scale
- Bubble size negative
- Funnel monotonicity
- hierarchy duplicate ID / orphan / self-parent / cycle
- internal hierarchy valueとchildren sum
- graph edge unknown endpoint / duplicate / self-loop / cycle
- renderer safe node/point limits

これらはshared structural schemaではなく、Frontend definitionの`validateFrames`とpure model builderで
検証する。Backend code-defined Galleryはdeterministic valid fixtureを使う。

### 6.3 維持する05成果

- shared strict definition
- resolved preset context
- effective Field Config
- stable Tooltip/Legend pattern
- token validation
- category/time formatter
- Gallery conformance
- dynamic renderer discovery
- visual/a11y/performance/bundle gates

### 6.4 解消する現行不足

1. category modelがCartesian row/series向けでslice/polarへ最適化されていない。
2. category IDに基づくstable color allocationがない。
3. hierarchy flat rowsをtreeへ変換するhelperがない。
4. graph node/edge framesをSankey indexへ変換するhelperがない。
5. generic Tableはmulti-frame表示できるが、Sankeyのnodes/edges関係をsummaryしない。
6. polar/hierarchy rendererのaccessible summary contractがない。
7. non-Cartesian rendererのbundle budget rowがない。

## 7. 固定済み設計判断

1. 18 presetを8 renderer typeへ整理する。
2. type IDは01で予約済みのIDを使う。
3. type/family単位でrendererをlazy loadする。
4. presetごとのdynamic chunkは作らない。
5. options schema、descriptor、default optionsはshared moduleを正本にする。
6. Backend Galleryで`z.record(...unknown())`を使わない。
7. raw category/node IDをpaletteへstable hashし、array indexだけで色を決めない。
8. negative composition valueをabsolute valueへ暗黙変換しない。
9. renderer内でTop N / Other集約しない。必要ならTransformationを使う。
10. input orderをFunnelで暗黙sortしない。
11. hierarchy parent valueを二重加算しない。
12. orphan/cycleをsynthetic rootで隠さない。
13. forestだけはvalidとし、display専用synthetic rootを作る。
14. SankeyはDAGのみ。cycleをNode Graphへ誘導する。
15. duplicate parallel edgeを暗黙合算しない。
16. Rechartsへ渡すSankey numeric indexはdisplay modelだけで作る。
17. Pie/Radar/Sunburstのsector/nodeを全件tab stopにしない。
18. datum linkのkeyboard代替はTable fallbackに持たせる。
19. animationは全presetでfalse。
20. raw hex/rgb/hslを使わない。
21. Recharts以外のruntime dependencyを追加しない。
22. hierarchy/flow dataをURL/localStorageへ保存しない。
23. 05のcommon formatterを再利用し、独自unit formatterを作らない。
24. renderer safe limit超過はincompatible state。先頭N件だけ描画しない。
25. Gallery success caseなしでcatalog登録しない。
26. Table fallbackなしでcompleteにしない。

## 8. Shared Visualization contracts

### 8.1 module split

```text
composition-visualizations.schema.ts
  core.pie
  core.radar
  core.radial-bar
  core.funnel

relationship-visualizations.schema.ts
  core.scatter

hierarchy-flow-visualizations.schema.ts
  core.treemap
  core.sunburst
  core.sankey
```

各moduleは次をexportする。

- strict Zod config schema
- inferred config type
- serializable descriptor
- defaultOptionsByPreset
- `VisualizationDefinition<TConfig>` contract object

React、Recharts、loaderをsharedへ入れない。

### 8.2 descriptor versions

```text
core.pie        configSchemaVersion 1
core.radar      configSchemaVersion 1
core.radial-bar configSchemaVersion 1
core.scatter    configSchemaVersion 1
core.funnel     configSchemaVersion 1
core.treemap    configSchemaVersion 1
core.sunburst   configSchemaVersion 1
core.sankey     configSchemaVersion 1
```

全て新typeなのでmigration aliasは不要。06完了後にoptionを変える場合はversionを上げる。

### 8.3 minimum / recommended size

| Type | Minimum | Recommended |
| --- | --- | --- |
| core.pie | 4x4 | 6x5 |
| core.radar | 5x4 | 7x5 |
| core.radial-bar | 4x4 | 6x5 |
| core.scatter | 5x4 | 8x5 |
| core.funnel | 4x4 | 6x5 |
| core.treemap | 5x4 | 8x6 |
| core.sunburst | 5x5 | 8x6 |
| core.sankey | 7x5 | 12x6 |

Gallery layoutはrecommendedを基本にする。mobileは1列でheightを再計算する。

## 9. Stable color allocation

### 9.1 key

Color key:

```text
Pie/Radial/Funnel: category raw string
Radar: series field key
Scatter: series value or frameRefId
Treemap/Sunburst: top-level ancestor ID
Sankey node: node ID
Sankey link: source node token with opacity
```

### 9.2 algorithm

stable, small pure hashを使う。

```ts
function paletteIndex(key: string, paletteLength: number): number;
```

Requirements:

- 同じkey/theme paletteで同じindex。
- sort/filter前後で不変。
- process/browserで不変。
- `Math.random()`、locale compare、object identityを使わない。
- paletteLength 0はfallback brand token。
- collisionは許可するが隣接categoryで可能な限り避けるsecondary allocationをしてよい。

FNV-1a等を実装してよい。暗号学的hashは不要。

### 9.3 Field Config

- value field fixed colorがある場合、single-series renderer全体のbase tokenに使う。
- categoryごとのtoken override contractは06では追加しない。
- palette modeはexisting effective Field Configを尊重。
- threshold colorはPie slice colorへ自動転用しない。

## 10. Category composition model

### 10.1 output

```ts
type CategorySlice = {
  id: string;
  label: string;
  rawCategory: string | null;
  value: number;
  percent: number;
  colorToken: DashboardColorToken;
  raw: Record<string, string | number | boolean | null>;
};

type CategoryCompositionModel = {
  slices: CategorySlice[];
  total: number;
  valueFieldConfig: StandardFieldConfigV2;
};
```

### 10.2 rules

- category field exactly 1。
- selected value field exactly 1。
- row order維持。
- category duplicate拒否。
- null categoryはstable `__null__` ID、labelはno-value text。
- value nullはsliceを欠損としてreject。empty stateと混同しない。
- value finite。
- value `>= 0`。
- total `> 0`。
- percent=`value/total*100`。
- input mutationなし。
- raw row保持。

Pie/Radial/Funnelの共通baseにする。Funnelはpercent-of-first/previousを追加modelで計算する。

### 10.3 slice limits

```text
Pie/Donut/Semi/Rose <= 24
Radial Bar           <= 20
Funnel               <= 20
```

超過時はTop N transformationを案内するincompatible messageを返す。自動Other集約しない。

## 11. Pie config and presets

```ts
type PieConfigV1 = {
  showLegend: boolean;
  showLabels: "auto" | "always" | "never";
  labelContent: "category" | "percent" | "value";
  paddingAngle: number;
  cornerRadius: number;
  sort: "none" | "ascending" | "descending";
  centerMetric: "none" | "total";
};
```

Limits/defaults:

```text
showLegend = true
showLabels = auto
labelContent = percent
paddingAngle = 1, range 0..10
cornerRadius = 0, range 0..20
sort = none
centerMetric = none for pie/rose, total for donut/semi-donut
```

Preset geometry:

| Preset | start/end | inner radius | sector angle | outer radius |
| --- | --- | --- | --- | --- |
| pie | 90/-270 | 0% | value proportional | fixed |
| donut | 90/-270 | 55% | value proportional | fixed |
| semi-donut | 180/0 | 58% | value proportional | fixed |
| rose | 90/-270 | 0% | equal | sqrt(value) scaled |

Rose:

- Recharts `Pie.outerRadius` functionを使用。
- angle用derived valueは全slice `1`。
- area perceptionのためradiusはnormalized `sqrt(value)`。
- raw value/percentはTooltip/Table/summaryへ保持。
- zero valueはminimum radiusを与えずsectorなし。Legend/Tableには残す。

Sortはdisplay orderだけを変更し、Table raw orderは変えない。stable sortする。

## 12. Pie accessibility and interaction

- summary: total、slice数、top 3 category/percent。
- Donut center metricはformatted total text。
- Legend buttonでslice hide/isolate。
- hide後percent denominatorはvisible slicesで再計算。
- 全slice hiddenならempty interaction stateではなくReset controlを表示。
- Tooltip: category、formatted value、percent。
- labels autoはslice 5%以上かつ24px以上のarcだけ。
- label非表示でもLegend/Tableで確認可能。
- datum click/touchはexisting `onDatumActivate`。
- keyboard datum linkはTable row。

## 13. Radar config and model

```ts
type RadarConfigV1 = {
  showLegend: boolean;
  showGrid: boolean;
  showAxisLabels: boolean;
  showDots: boolean;
  fillOpacity: number;
  max: "auto" | number;
  scaleMode: "shared" | "percent";
};
```

Defaults:

```text
showLegend = true
showGrid = true
showAxisLabels = true
showDots = true
fillOpacity = 0.2, range 0..0.8
max = auto
scaleMode = shared
```

Model:

- category rowsがradar axes。
- numeric value fieldsがseries。
- axis数3〜12。
- series数1〜8。
- value non-null、finite、`>=0`。
- category duplicate拒否。
- shared modeは全axis同一domain `0..max`。
- percent modeは全value `0..100`、domain固定。
- 異なるunitの指標を暗黙normalizeしない。
- heterogeneous metricsはhandler/transformationでpercent化してから渡す。

Preset:

| Preset | series requirement | stroke/fill |
| --- | --- | --- |
| line | >=1 | stroke、fill 0 |
| filled | exactly 1 | stroke + configured fill |
| multi | >=2 | stroke + low fill |

Summary:

- axes数、series数。
- 各seriesのhighest/lowest axis。
- percent modeを明示。

## 14. Radial Bar config and model

```ts
type RadialBarConfigV1 = {
  showLegend: boolean;
  showLabels: boolean;
  startAngle: number;
  endAngle: number;
  innerRadiusPercent: number;
  outerRadiusPercent: number;
  max: "auto" | number;
  showTrack: boolean;
};
```

Validation:

- angle finite、-360..360。
- start != end。
- inner 0..90。
- outer 10..100。
- inner < outer。
- max positive finite or auto。

Ranking:

- category shape。
- 1 value field。
- 1〜20 rows。
- non-negative。
- max autoは最大value。
- row order維持。ranking sortはhandler/transformation責務。

Progress:

- categoryまたはscalar。
- 1〜12 rows。
- finite max必須。config maxまたはeffective field max。
- value 0..max。clampしない。
- background track表示。
- formatted valueとpercentage。

Summary:

- ranking top category/value。
- progress各categoryのpercentage、最大5件 + 残件数。

## 15. Scatter config

```ts
type ScatterConfigV1 = {
  showLegend: boolean;
  showGrid: boolean;
  xFieldKey?: string;
  yFieldKey?: string;
  sizeFieldKey?: string;
  seriesFieldKey?: string;
  pointSize: number;
  bubbleRadius: { min: number; max: number };
  xAxis: { min: "auto" | number; max: "auto" | number };
  yAxis: { min: "auto" | number; max: "auto" | number };
  quadrant?: {
    x: number;
    y: number;
    labels: [string, string, string, string];
  };
};
```

Limits:

```text
pointSize 10..400
bubbleRadius min 2..40
bubbleRadius max 4..80
min < max
quadrant label 0..40 chars
```

Field resolution:

1. explicit field key。
2. role `x` / `y` / `size` / `series`。
3. ambiguousならincompatible。

X/Y:

- numberまたはtime。
- string/category X/Yは06では拒否。
- null pointは描画せず、skipped countをnotice/summaryへ出す。
- mixed physical type across framesを拒否。

Series:

- series fieldがなければframeRefId単位。
- series value string。
- stable token hash。
- 最大12 groups。

Preset:

| Preset | Requirement |
| --- | --- |
| scatter | x+y、size無視 |
| bubble | x+y+size、size >=0 |
| quadrant | x+y+quadrant config |

Point limits:

```text
scatter/quadrant <= 1,000
bubble           <= 500
```

Regression line、density、jitterは追加しない。

## 16. Scatter rendering and accessibility

- Cartesian common formatter/axisを再利用。
- X/Y別unit/decimals。
- Bubble radiusはsqrt area scale。
- size 0は最小radiusを与えず非表示だがsummary skipped countへ含む。
- Quadrant reference lineはtoken、labelはSVG外のsemantic listにも表示。
- Tooltip: series、x、y、size、raw row。
- summary: point数、skipped数、x/y range、quadrant counts。
- 全pointをtab stopにしない。
- Table fallbackでdatum link可能。
- animation false。

## 17. Funnel config and model

```ts
type FunnelConfigV1 = {
  showLegend: boolean;
  showLabels: boolean;
  labelContent: "value" | "percent-first" | "percent-previous" | "both";
  enforceMonotonic: boolean;
  lastShape: "triangle" | "rectangle";
};
```

Model:

```ts
type FunnelStage = {
  id: string;
  label: string;
  value: number;
  percentOfFirst: number;
  percentOfPrevious: number;
  dropOff: number;
  colorToken: DashboardColorToken;
};
```

Rules:

- category exactly 1、value exactly 1。
- 2〜20 stages。
- input orderをstage orderとして維持。
- value finite、`>=0`。
- first value `>0`。
- `enforceMonotonic=true`ならnon-increasing。
- violationをsort/clampしない。
- previous 0かつcurrent 0はpercentage 0。
- previous 0かつcurrent >0はmonotonic error。

Preset:

- `funnel`: Recharts normal geometry。
- `pyramid`: Recharts `reversed=true`。data semantics/orderは同じ。

Summary:

- first/final value。
- overall conversion。
- largest drop-off stage。

## 18. Hierarchy Data Frame contract

### 18.1 fields

Hierarchy frame:

```text
id          string role=id, required
parent      string role=parent-id, nullable
label       string role=category, optional
value       number role=value, nullable for internal nodes
```

### 18.2 model

```ts
type HierarchyNodeModel = {
  id: string;
  label: string;
  ownValue: number | null;
  value: number;
  depth: number;
  path: string[];
  colorToken: DashboardColorToken;
  children: HierarchyNodeModel[];
};

type HierarchyModel = {
  roots: HierarchyNodeModel[];
  syntheticRoot: HierarchyNodeModel;
  nodeCount: number;
  leafCount: number;
  maxDepth: number;
};
```

### 18.3 semantic validation

- id non-null、unique。
- parent null/emptyはroot。
- parentはexisting id。
- self-parent拒否。
- cycle拒否。
- forest許可。
- label fallback=id。
- leaf value finite `>0`。
- internal valueはnullまたはchildren sumと一致。
- 一致tolerance=`max(1e-9, abs(sum)*1e-9)`。
- internal nullはchildren sumをderive。
- own/input valueとderived valueを区別。
- sibling input order維持。
- input mutationなし。

### 18.4 safe limits

```text
nodes <= 500
depth <= 6
children per node <= 100
roots <= 50
```

超過を先頭N件へ切らない。Limit/Group transformationを案内する。

### 18.5 synthetic root

forestをRecharts単一rootへ渡すためdisplay専用rootを作る。

```text
id = __dashboard_root__
label = manifest/panel title
value = roots sum
color = none
```

input IDがreserved IDと一致したら拒否する。synthetic rootはTooltip/Table/summaryのnode countに含めない。

## 19. Treemap config and presets

```ts
type TreemapConfigV1 = {
  showLabels: "auto" | "always" | "never";
  labelContent: "category" | "value" | "both";
  padding: number;
  colorBy: "item" | "top-level" | "depth";
  maxLabelDepth: number;
};
```

Limits:

```text
padding 0..12
maxLabelDepth 1..6
```

Flat preset:

- category shape。
- 1 value field。
- 1〜100 rows。
- positive values。
- Recharts Treemap flat mode。

Nested preset:

- hierarchy shape。
- hierarchy model。
- Recharts Treemap nested mode。
- synthetic root自体はcellとして表示しない。

Rendering:

- custom content rendererでtoken fill。
- labelはcell面積閾値によりauto。
- value formatter共通。
- Tooltipにpath/value/percent-parent/percent-total。
- drill zoom/breadcrumbは対象外。

Summary:

- total、leaf数、depth。
- top 5 leaves。

## 20. Sunburst config

```ts
type SunburstConfigV1 = {
  showLabels: "auto" | "always" | "never";
  innerRadius: number;
  ringPadding: number;
  sectorPadding: number;
  colorBy: "top-level" | "depth";
  maxLabelDepth: number;
};
```

Limits:

```text
innerRadius 0..120
ringPadding 0..12
sectorPadding 0..8
maxLabelDepth 1..6
```

Rules:

- hierarchy shape only。
- same hierarchy model。
- Recharts `SunburstChart` responsive behaviorをrenderer wrapperで検証。
- rootはdisplay containerでありsectorに含めない。
- internal derived sum。
- token fill。
- labels autoはarc length/area閾値。
- click zoomは対象外。
- Tooltip path/value/percent-parent/percent-total。

Summary:

- root数、leaf数、depth、top branches。

## 21. Sankey Data Frame contract

### 21.1 nodes frame

Shape `graph-nodes`:

```text
id       string role=id, required
label    string role=category, optional
group    string role=series, optional
value    number role=value, optional metadata only
```

### 21.2 edges frame

Shape `graph-edges`:

```text
source   string role=source, required
target   string role=target, required
value    number role=value, required
```

Panel visualization `frameRefs`はnodes、edgesの2 Frameを明示する。frame orderに依存せずshapeHintで識別する。

### 21.3 semantic validation

Nodes:

- id unique/non-null。
- label fallback=id。
- 最大100 nodes。

Edges:

- source/target non-null。
- endpoint exists。
- source != target。
- value finite `>0`。
- source-target pair unique。
- 最大300 edges。
- cycleなし。
- 全nodeが1 edge以上へ接続。

DAG checkはKahnまたはDFSでpure helperとして実装する。100/300上限内である。

### 21.4 display model

```ts
type SankeyModel = {
  nodes: Array<{
    id: string;
    name: string;
    group?: string;
    colorToken: DashboardColorToken;
  }>;
  links: Array<{
    source: number;
    target: number;
    value: number;
    sourceId: string;
    targetId: string;
  }>;
  totalFlow: number;
};
```

- numeric indexはnodes input order。
- source/target raw ID保持。
- valueを合算しない。
- input mutationなし。
- totalFlowはsource nodesから出るflowの合計。全edge sumを総流量と誤表示しない。

## 22. Sankey config and rendering

```ts
type SankeyConfigV1 = {
  nodeWidth: number;
  nodePadding: number;
  iterations: number;
  align: "left" | "justify";
  verticalAlign: "top" | "justify";
  linkOpacity: number;
  showNodeLabels: boolean;
};
```

Limits/defaults:

```text
nodeWidth = 12, 4..40
nodePadding = 16, 0..48
iterations = 32, 1..64
align = justify
verticalAlign = justify
linkOpacity = 0.28, 0.05..0.8
showNodeLabels = true
```

Rendering:

- Recharts `Sankey`。
- custom node rendererはtoken fill、label text。
- custom link rendererはsource token + opacity。
- node/link geometryへraw HTMLなし。
- animation false。
- node dragなし。
- Tooltip node: in/out total。
- Tooltip link: source→target、formatted value。
- Table fallbackはnodes/edges Frameを別tableとして表示。

Summary:

- node/edge counts。
- total source flow。
- largest link。
- top source/sink。

## 23. Shared Tooltip / Legend policy

05のCartesian Tooltip/Legendを無理にDOM構造まで共有しない。formatter、interaction semantics、
token marker、keyboard behaviorを再利用する。

Tooltip共通:

- mapped/formatted value。
- raw value accessible text。
- category/path/series。
- viewport overflow防止。
- 最大20 rows。
- no HTML。

Legend共通:

- button + `aria-pressed`。
- Enter/Space toggle。
- Shift+Enter isolate。
- Reset control。
- stable key/color。
- mobile wrap/collapse。

Treemap/Sunburst/SankeyはLegendが情報過多になるため、top-level category/node groupだけをLegendへ出す。

## 24. Table fallback

全typeでgeneric Data Frame Tableを維持する。

| Type | Table |
| --- | --- |
| Pie/Radar/Radial/Funnel | category/value raw rows |
| Scatter/Bubble | x/y/size/series raw rows |
| Treemap/Sunburst | id/parent/label/value raw hierarchy |
| Sankey | nodes Frameとedges Frameの2 tabs/tables |

derived percent、hierarchy path、Sankey indexをraw Tableへ混ぜない。Inspectorまたはsummaryでderived値を
説明してよい。

Chart/Table toggleでAPI再requestしない。同一response Framesを使う。

## 25. Accessibility

### 25.1 general

- figure accessible label。
- non-empty summary。
- Table fallback。
- Legend keyboard。
- colorだけに依存しないlabel/text。
- reduced motion。
- focus outline clipなし。
- Tooltip alternative。

### 25.2 many marks

sector/point/node/linkを全件tab stopにしない。最大500 hierarchy nodes、1,000 scatter pointsへtab stopを
与えると操作不能になるためである。

Keyboardで数値へ到達する経路:

1. Panel summary。
2. Legend filter。
3. Chart/Table toggle。
4. semantic Table rows。
5. Table row data link。

### 25.3 summary maximum

summaryは最大600文字をhard capにし、次を含む。

- type/preset。
- item count。
- total/range。
- top/bottom/major flow。
- skipped/invalidはrendererへ到達しないため、null scatter skipped countだけnotice。

### 25.4 Recharts accessibility

`accessibilityLayer`を受けるChart containerでは有効にする。Treemap/Sunburst/Sankeyで同propがない場合、
存在しないpropをcastして渡さず、figure semantics + summary + Tableでcontractを満たす。

## 26. Mobile

- Dashboard 1列。
- Pie/Donut labelはautoで抑制。
- Semi Donutはcompact heightを活用。
- Radar axis labelは省略せず、長文はtruncate + Table。
- Radial rankingは最大12 categoryをmobile推奨。contract上20はdesktop。
- Scatter axis tickを減らす。
- Funnel labelはinside/outsideをwidthで切替。
- Treemap nested labelはtop 2 depth優先。
- Sunburst outer labelを無理に表示しない。
- Sankey minimum mobile heightを増やし、node labelを短縮。
- page横scrollなし。
- Table containerだけscroll可。
- hover-only interactionなし。

## 27. Performance and safe limits

| Family | Hard renderer limit |
| --- | ---: |
| Pie slices | 24 |
| Radar axes | 12 |
| Radar series | 8 |
| Radial categories | 20 |
| Scatter points | 1,000 |
| Bubble points | 500 |
| Scatter groups | 12 |
| Funnel stages | 20 |
| Flat Treemap items | 100 |
| Hierarchy nodes | 500 |
| Hierarchy depth | 6 |
| Sankey nodes | 100 |
| Sankey edges | 300 |
| Sankey iterations | 64 |

Limitsはconfigで無制限に緩和できない。超過はincompatible。Backend Data Frame limit内でもrenderer limitを
適用する。

Performance fixture:

- Pie 24 slices。
- Radar 12 axes x 8 series。
- Scatter 1,000 points。
- Bubble 500 points。
- Hierarchy 500 nodes/depth 6。
- Sankey 100 nodes/300 edges/64 iterations。

Hard gate:

- model buildで100ms Long Taskなし。
- Sankey layout/renderの100ms超taskをPerformanceObserverで検出。Recharts内部で超える場合、
  hard limit/iterationsを下げ、gateを緩めない。
- input/config同一でresizeだけならtree/graph validationを再実行しない。
- animation false。

## 28. Security and privacy

- strict shared Zod options。
- arbitrary formatter/functionなし。
- raw HTMLなし。
- label/messageをReact textとして描画。
- CSS token validation。
- hierarchy ID/node IDをDOM idへ直接使わない。
- SVG element IDはsanitized deterministic prefix + hash。
- TooltipへInspector metadata/token/filterを混ぜない。
- URLへselected hierarchy pathを保存しない。
- datum linksはexisting same-origin resolver。
- error messageにraw frame全件を含めない。
- malformed cycle/edgeをRechartsへ渡さない。

## 29. Lazy load and bundle

### 29.1 renderer entries

```text
core-pie/renderer.lazy.tsx
core-radar/renderer.lazy.tsx
core-radial-bar/renderer.lazy.tsx
core-scatter/renderer.lazy.tsx
core-funnel/renderer.lazy.tsx
core-treemap/renderer.lazy.tsx
core-sunburst/renderer.lazy.tsx
core-sankey/renderer.lazy.tsx
```

### 29.2 graph rules

- initial graphへ8 rendererなし。
- Dashboard shellへRechartsなし。
- Gallery shellへrenderer static importなし。
- catalogはdefinitionだけ。
- 各renderer dynamic entryがmanifestに存在。
- stat/tableはRechartsへ到達しない。
- routeを開いてもPanelで使わないfamilyはrequestしない。
- Galleryは全caseを表示するため結果的に全8をrequestしてよい。

### 29.3 chunk strategy

Viteがpolar/hierarchy modulesを共有chunkへまとめることを許可する。最初からmanual chunk名を固定しない。
manifest graphでtype entryとtransitive dependencyを検証する。

### 29.4 budget rows

```text
core.pie
core.radar
core.radial-bar
core.scatter
core.funnel
core.treemap
core.sunburst
core.sankey
```

05と同じ実測+10% rounding rule。新runtime dependency 0をlockfile auditする。

## 30. Gallery cases

| Case ID | Type/Preset | Fixture | 必須確認 |
| --- | --- | --- | --- |
| `pie-basic` | core.pie/pie | 6 categories | percent/legend |
| `pie-donut` | core.pie/donut | composition | center total |
| `pie-semi-donut` | core.pie/semi-donut | KPI composition | half geometry |
| `pie-rose` | core.pie/rose | varied values | equal angle/radius |
| `radar-line` | core.radar/line | 6 axes/1 series | outline |
| `radar-filled` | core.radar/filled | percent metrics | fill |
| `radar-multi` | core.radar/multi | 6 axes/3 series | legend |
| `radial-ranking` | core.radial-bar/ranking | 8 categories | ranking arcs |
| `radial-progress` | core.radial-bar/progress | 4 progress | track/max |
| `scatter-basic` | core.scatter/scatter | x/y/groups | relationship |
| `scatter-bubble` | core.scatter/bubble | x/y/size | area scale |
| `scatter-quadrant` | core.scatter/quadrant | threshold lines | quadrant counts |
| `funnel-basic` | core.funnel/funnel | 5 stages | conversion/drop-off |
| `funnel-pyramid` | core.funnel/pyramid | 5 stages | reversed geometry |
| `treemap-flat` | core.treemap/flat | 20 categories | cell labels |
| `treemap-nested` | core.treemap/nested | hierarchy depth 3 | nested cells |
| `sunburst-basic` | core.sunburst/sunburst | hierarchy depth 4 | rings/path |
| `sankey-basic` | core.sankey/sankey | 10 nodes/14 edges | flow/labels |

### 30.1 invalid unit fixtures

- Pie negative/all zero/25 slices。
- Radar 2 axes/13 axes/null/negative。
- Progress missing max/value over max。
- Bubble negative size/501 points。
- Funnel increase under monotonic/1 stage。
- Hierarchy duplicate/orphan/self/cycle/depth 7/501 nodes。
- Sankey unknown endpoint/self/duplicate/cycle/301 edges。

Invalid casesはGallery manifestへ登録せずunit/component testで扱う。

### 30.2 deterministic rules

- fixed values/timestamps。
- no random。
- stable IDs/order。
- raw colorなし。
- recommended panel size。
- all Table fallback enabled。
- Gallery revision/layoutVersion increment。
- existing 18 Cartesian and state cases維持。

## 31. Backend responsibilities

- shared strict definitions登録。
- Gallery manifest validation。
- deterministic valid frames。
- native v2 API。
- frame/response limits。
- shape validation。

Backendで実行しない:

- Pie percent。
- rose radius。
- Radar polygon normalization。
- Bubble radius。
- hierarchy tree build。
- Sankey numeric index/layout。

DBで効率的なgrouping/aggregationはhandlerが行う。Frontendは表示modelだけを構築する。

## 32. Frontend responsibilities

- preset resolution。
- semantic validation。
- category/tree/graph model。
- stable token allocation。
- Tooltip/Legend/summary。
- Table fallbackとの同一frame維持。
- Recharts renderer。
- datum interaction。
- lazy load。
- mobile adaptation。

model builderはpureで、renderer JSX内にcycle detectionやgraph indexingを直書きしない。

## 33. R0〜R13 Work Packages

| WP | 内容 | 完了gate |
| --- | --- | --- |
| R0 | prerequisite、baseline、Recharts audit | 05 V12、catalog/bundle baseline |
| R1 | shared strict contracts / registrations | schema、registry、default tests |
| R2 | stable color / category composition common | model/formatter tests |
| R3 | Pie/Donut/Semi/Rose | 4 presets + Gallery |
| R4 | Radar line/filled/multi | 3 presets + Gallery |
| R5 | Radial ranking/progress | 2 presets + Gallery |
| R6 | Scatter/Bubble/Quadrant | 3 presets + Gallery |
| R7 | Funnel/Pyramid | 2 presets + Gallery |
| R8 | hierarchy model / validation | tree/cycle/value tests |
| R9 | flat/nested Treemap | 2 presets + Gallery |
| R10 | Sunburst | renderer + Gallery |
| R11 | Sankey graph model / renderer | graph tests + Gallery |
| R12 | 18-preset visual/a11y/performance/bundle | expanded quality gates |
| R13 | full verify、docs、handoff | full gates、progress |

## 34. R0: Baseline

### 34.1 command

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

### 34.2 record

- 05 type/preset count。
- Gallery case count。
- renderer dynamic entries。
- Recharts version / primitives。
- bundle raw/gzip graph。
- coverage。
- visual baseline count。
- 05 candidateに対するD11初回matrix evidence。
- active user/concurrent changes。

### 34.3 gate

- 05 V0〜V12 complete。
- 20 existing catalog presets green。
- Recharts 8 primitives confirmed。
- R1 scope fixed。

## 35. R1: Shared contracts

実装:

- 3 shared schema modules。
- 8 descriptors。
- 18 preset descriptors/defaults。
- strict config schemas。
- barrel exports。
- Backend registrations。
- Frontend definitions/loaders stubsではなく、各renderer packageで登録するまではcatalogへ入れない。

R1で全8をBackend登録する場合、Gallery manifestがまだ参照しないdefinitionでもstartup validationを
通す。Frontend catalogへの登録はR3〜R11でrenderer完成と同時に行う。

Tests:

- all defaults parse。
- unknown option rejection。
- numeric/string limits。
- preset/default key exact match。
- descriptor size/capability。
- reserved ID。
- serializationからschema/function除外。
- duplicate type/preset rejection。

Gate:

```bash
bunx vitest run \
  shared/schemas/dashboard/composition-visualizations.schema.test.ts \
  shared/schemas/dashboard/relationship-visualizations.schema.test.ts \
  shared/schemas/dashboard/hierarchy-flow-visualizations.schema.test.ts \
  api/modules/dashboard/v2/visualization-registry.test.ts
bun run typecheck
git diff --check
```

## 36. R2: Common composition model

実装:

- stable palette hash。
- category slice model。
- percent。
- display sort。
- Field Config color/unit。
- polar Tooltip/Legend。
- composition summaries。

Tests:

- category duplicate/null。
- negative/null/all zero。
- stable color reorder/filter。
- visible denominator。
- sort stability。
- formatter/mapping。
- immutable frozen input。
- slice limits。

Gate:

```bash
bunx vitest run web/src/domains/dashboard/v2/visualizations/composition
bun run verify:dashboard-frontend-coverage
bun run typecheck
```

## 37. R3: Pie family

実装順:

1. shared contract Frontend definition。
2. category model adapter。
3. pie renderer strategy。
4. donut center metric。
5. semi geometry。
6. rose equal-angle/sqrt-radius。
7. summary/Tooltip/Legend。
8. Gallery 4 cases。

Tests:

- geometry props。
- total/percent。
- zero slice。
- labels auto。
- hide/isolate/reset。
- center total format。
- rose radius monotonic。
- Table same frame。
- summary。
- animation false。

Gate:

```bash
bunx vitest run web/src/domains/dashboard/v2/visualizations/core-pie
bun run verify:dashboard-gallery
E2E_PORT=5175 bun run verify:dashboard-e2e -- --grep "pie|donut|rose"
bun run verify:dashboard-bundle
```

## 38. R4: Radar family

実装:

- category axes model。
- shared/percent scale。
- line/filled/multi strategies。
- PolarGrid/AngleAxis/RadiusAxis。
- Tooltip/Legend/summary。
- Gallery 3 cases。

Tests:

- 3/12 axis boundaries。
- 1/8 series boundaries。
- null/negative。
- percent >100。
- filled exactly one。
- multi >=2。
- hidden series。
- label overflow。

Gate:

```bash
bunx vitest run web/src/domains/dashboard/v2/visualizations/core-radar
bun run verify:dashboard-gallery
E2E_PORT=5175 bun run verify:dashboard-e2e -- --grep radar
```

## 39. R5: Radial Bar

実装:

- ranking/progress model。
- common max resolution。
- tracks/labels。
- Tooltip/Legend/summary。
- Gallery 2 cases。

Tests:

- max auto/explicit。
- over max rejection。
- scalar/category。
- angle/radius config。
- zero/progress 100%。
- mobile labels。

Gate:

```bash
bunx vitest run web/src/domains/dashboard/v2/visualizations/core-radial-bar
bun run verify:dashboard-gallery
E2E_PORT=5175 bun run verify:dashboard-e2e -- --grep "radial"
```

## 40. R6: Scatter family

実装:

- role/explicit field resolution。
- multi-frame/group model。
- scatter/bubble/quadrant strategies。
- X/Y axes formatter。
- sqrt bubble scale。
- quadrant counts/labels。
- Tooltip/Legend/summary。
- Gallery 3 cases。

Tests:

- numeric/time axes。
- ambiguous/missing role。
- null skip count。
- bubble negative/zero/max points。
- stable series color。
- quadrant boundary assignment。boundary pointはright/top側へ含める規則を固定。
- Table raw。

Gate:

```bash
bunx vitest run web/src/domains/dashboard/v2/visualizations/relationship web/src/domains/dashboard/v2/visualizations/core-scatter
bun run verify:dashboard-gallery
E2E_PORT=5175 bun run verify:dashboard-e2e -- --grep "scatter|bubble|quadrant"
bun run verify:dashboard-bundle
```

## 41. R7: Funnel family

実装:

- stage model。
- conversion/drop-off。
- monotonic validation。
- normal/reversed strategies。
- Tooltip/labels/summary。
- Gallery 2 cases。

Tests:

- order preserved。
- increasing rejection。
- zero previous。
- first/final conversion。
- triangle/rectangle last shape。
- Table raw。

Gate:

```bash
bunx vitest run web/src/domains/dashboard/v2/visualizations/core-funnel
bun run verify:dashboard-gallery
E2E_PORT=5175 bun run verify:dashboard-e2e -- --grep "funnel|pyramid"
```

## 42. R8: Hierarchy model

実装:

- field resolver。
- map nodes by ID。
- parent linking。
- orphan/self/cycle validation。
- depth/path。
- leaf/internal value resolution。
- forest synthetic root。
- stable top-level colors。
- summary helper。

Tests:

- one root/forest。
- input order。
- duplicate/orphan/self。
- simple/deep cycle。
- internal null/sum/mismatch。
- tolerance。
- reserved root ID。
- depth/node/child/root limits。
- immutable。

Gate:

```bash
bunx vitest run web/src/domains/dashboard/v2/visualizations/hierarchy
bun run verify:dashboard-frontend-coverage
bun run typecheck
```

## 43. R9: Treemap

実装:

- flat category adapter。
- nested hierarchy adapter。
- custom token content。
- area-aware labels。
- Tooltip path/percent。
- summary。
- Gallery 2 cases。

Tests:

- flat positive values。
- nested root omission。
- colorBy modes。
- label thresholds。
- field formatting。
- Table raw hierarchy。
- mobile overflow。

Gate:

```bash
bunx vitest run web/src/domains/dashboard/v2/visualizations/core-treemap
bun run verify:dashboard-gallery
E2E_PORT=5175 bun run verify:dashboard-e2e -- --grep treemap
bun run verify:dashboard-bundle
```

## 44. R10: Sunburst

実装:

- hierarchy adapter to `SunburstData`。
- synthetic root removal。
- radii/padding config。
- token sectors。
- area-aware labels。
- Tooltip path/percent。
- summary。
- Gallery。

Tests:

- depth/ring mapping。
- forest root。
- internal sums。
- labels max depth。
- responsive dimensions。
- no unsupported accessibility prop cast。
- Table raw。

Gate:

```bash
bunx vitest run web/src/domains/dashboard/v2/visualizations/core-sunburst
bun run verify:dashboard-gallery
E2E_PORT=5175 bun run verify:dashboard-e2e -- --grep sunburst
bun run verify:dashboard-bundle
```

## 45. R11: Sankey

### 45.1 graph model

- shape-based nodes/edges select。
- node map/index。
- endpoint validation。
- duplicate/self/cycle。
- limits。
- source/sink totals。
- stable tokens。

### 45.2 renderer

- responsive size。
- custom node/link。
- labels。
- Tooltip node/link。
- summary。
- multi-frame Table。
- Gallery。

Tests:

- valid DAG。
- disconnected。
- unknown endpoint。
- self/parallel/cycle。
- zero/negative link。
- index order。
- source flow total。
- config bounds。
- mobile labels。

Gate:

```bash
bunx vitest run web/src/domains/dashboard/v2/visualizations/flow web/src/domains/dashboard/v2/visualizations/core-sankey
bun run verify:dashboard-gallery
E2E_PORT=5175 bun run verify:dashboard-e2e -- --grep sankey
bun run verify:dashboard-bundle
```

## 46. R12: Expanded quality gate

### 46.1 conformance

- 8 new type registered。
- 18 new preset exact。
- cumulative catalog 38 preset。
- every default parses。
- every preset Gallery success。
- every loader dynamic。
- every summary non-empty。
- every Table fallback enabled。

### 46.2 visual baseline

最低限:

```text
gallery-composition-desktop.png
gallery-relationship-desktop.png
gallery-hierarchy-flow-desktop.png
gallery-non-cartesian-mobile.png
panel-rose.png
panel-radar-multi.png
panel-bubble.png
panel-treemap-nested.png
panel-sunburst.png
panel-sankey.png
```

### 46.3 accessibility

- axe serious/critical 0。
- Legend keyboard。
- summary length/non-empty。
- Table alternate path。
- labels/color semantics。
- reduced motion。
- no mass tab stops。

### 46.4 performance

- all upper-bound fixtures。
- long task gate。
- hierarchy/graph memoization。
- no animation。

### 46.5 bundle

- 8 dynamic entries。
- initial/shell boundary。
- budget rows。
- stat/table no Recharts。
- runtime dependency diff 0。

### 46.6 gate

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

## 47. R13: Full verification and handoff

### 47.1 full command

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

### 47.2 docs

- README catalog count/list。
- Gallery sections。
- Data Frame examples: category/distribution/hierarchy/graph。
- strict shared definitions。
- limits/non-goals。
- bundle boundary。
- LLM_CONTEXT。
- progress。
- 07 K0 handoff。

### 47.3 handoff record

```text
06 status: complete
New renderer types: 8
New presets: 18
Cumulative catalog presets: 38
New runtime dependencies: 0
Next: 07 K0
```

## 48. Test matrix

### 48.1 shared schema

- strict options。
- defaults/preset keys。
- boundaries。
- descriptors/capabilities/sizes。
- serialization。

### 48.2 category/polar

- duplicate/null/negative/zero。
- percent/color/order。
- Pie/Radar/Radial/Funnel semantics。

### 48.3 relationship

- role resolution。
- point groups/limits。
- bubble/quadrant。
- axes/formatter。

### 48.4 hierarchy

- identity/parent/cycle。
- value/depth/path。
- Treemap/Sunburst。

### 48.5 flow

- nodes/edges/DAG。
- index/totals。
- Sankey renderer/Table。

### 48.6 browser

- 18 Gallery ready。
- dynamic chunks。
- Table toggle。
- Legend interactions。
- mobile。
- visual/a11y/performance。

## 49. Coverage

Focused Frontend coverageへ含める。

- shared model adapters。
- semantic validators。
- stable color helper。
- summaries。
- definitions。
- renderer strategies。

Recharts renderer本体をinstrumentation都合でexcludeする場合、component/visual/E2Eの対応testをevidenceへ
記録する。Hierarchy/Sankey modelはpure codeなのでexclude禁止。

Threshold:

```text
statements >= 80
lines      >= 80
functions  >= 80
branches   >= 70
```

## 50. Stop条件

次の場合だけ停止する。

- 05 shared definition/preset contextが未完成。
- Recharts 3.9系に計画primitiveが存在しない。
- Sunburst/Sankeyを安全に使うため新runtime依存が必須になる。
- hierarchy/graph role contract変更が必要になる。
- Recharts SankeyがDAG upper-boundでもperformance gateを満たせない。
- Table fallbackでmulti-frameを確認できない。
- token colorだけでは必要な区別を表現できずdesign system変更が必要。
- accessibility contractを弱める必要がある。
- user/concurrent変更と同じ行を保存不能な形で競合する。

停止しない例:

- custom SVG shapeが必要。
- hierarchy validationが複雑。
- visual baselineが多い。
- label collision調整が必要。
- Recharts TypeScript genericが複雑。
- bundle graphが複数shared chunkになる。
- coverage不足。
- mobile調整が複数回必要。

## 51. Failure handling

| Failure | 戻るWP |
| --- | --- |
| shared config/descriptor | R1 |
| category/color/percent | R2 |
| Pie | R3 |
| Radar | R4 |
| Radial | R5 |
| Scatter | R6 |
| Funnel | R7 |
| hierarchy semantic | R8 |
| Treemap | R9 |
| Sunburst | R10 |
| graph/Sankey | R11 |
| visual/a11y/performance/bundle | R12または原因package |
| full gate | 原因package、R13 complete禁止 |

Shared contractを変更したら、そのpackage以降を再実行する。

## 52. 完了条件

- [x] 05 V0〜V12 complete。
- [x] R0〜R13 complete。
- [x] 8 new renderer types。
- [x] 18 new presets。
- [x] cumulative 38 presets。
- [x] new runtime dependencies 0。
- [x] shared strict definitions。
- [x] Backend/Frontend driftなし。
- [x] stable category/node colors。
- [x] Pie/Donut/Semi/Rose。
- [x] Radar line/filled/multi。
- [x] Radial ranking/progress。
- [x] Scatter/Bubble/Quadrant。
- [x] Funnel/Pyramid。
- [x] flat/nested Treemap。
- [x] Sunburst。
- [x] Sankey。
- [x] negative/zero/null rules。
- [x] hierarchy orphan/cycle/value rules。
- [x] Sankey endpoint/DAG rules。
- [x] renderer safe limits。
- [x] Tooltip/Legend/summary。
- [x] Table fallback。
- [x] 18 Gallery success cases。
- [x] invalid semantic tests。
- [x] mobile no overflow。
- [x] visual baseline pass。
- [x] accessibility pass。
- [x] performance pass。
- [x] initial/shell lazy boundary pass。
- [x] 8 renderer budget rows。
- [x] focused coverage pass。
- [x] full verification pass。
- [x] progress/docs updated。

## 53. 次計画へ渡す成果

```text
Composition:
  Pie / Donut / Semi Donut / Rose
  Radar line / filled / multi
  Radial ranking / progress
  Funnel / Pyramid

Relationship:
  Scatter / Bubble / Quadrant

Hierarchy:
  flat / nested Treemap
  Sunburst
  validated hierarchy model

Flow:
  Sankey
  validated DAG model

Quality:
  18 Gallery cases
  visual / a11y / performance / bundle evidence
```

07 P4は[07: KPI・Goal・Status Visualization拡張](./07-kpi-goal-status-visualizations.md)として、
Stat Sparkline、Gauge、Bar Gauge、Bullet、Progress、Traffic Lightを追加する。06のcategory
composition、stable token、formatter、summary patternを再利用してよい。

## 54. 再開手順

1. [00-concept.md](./00-concept.md) P3を読む。
2. [05-cartesian-visualizations.md](./05-cartesian-visualizations.md) V12 completeを確認。
3. [progress.md](./progress.md) 06節を読む。
4. `git branch --show-current`。
5. `git status --short`。
6. current `in_progress` R packageを確認。
7. 最後の成功commandを再実行。
8. 最初のpending Rだけを開始。
9. type/presetとGallery/testを同packageで完成。
10. R13完了後、07 K0、またはprogress記載の次計画へhandoff。
