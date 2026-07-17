# 05: Cartesian Visualization拡張 実装計画

## 1. 文書の位置づけ

この文書は、[00: コンセプト](./00-concept.md)のP2を、Lunaが最後まで実装できる粒度へ
分解した正本である。

01〜03で構築したVisualization Platformへ、最初の大規模な表示バリエーションを追加する。
04が品質基盤を用意するのに対し、05は実際に選択可能なグラフを増やす。

対象family:

- Time Series
- Area
- Compact Sparkline
- Category Bar
- Time Bar
- Lollipop
- Waterfall
- Composed Dual-axis

完了時のcatalogは、現在の3 Cartesian presetから18 presetへ増える。純増は15である。

### 1.1 開始条件

- [01: 共有契約](./01-contracts.md) C0〜C9 complete。
- [02: Backend](./02-backend.md) B0〜B12 complete。
- [03: Frontend](./03-frontend.md) F0〜F12 complete。
- [04: Validation / Gallery / Delivery](./04-testing-and-delivery.md) D0〜D3 complete。
- Visualization Galleryが実v2 APIと共通Panel shellで表示できる。
- `verify:dashboard-gallery`がcatalogとGallery caseの不一致を検出する。
- 現在のTime Series、Bar、Stat、Tableがgreen。

D0〜D3が未完了なら、05内で別Gallery、別E2E server、別conformance scriptを作らない。
04へ戻って基盤を完成させる。

### 1.2 04との実行順

このrepositoryでは04 D0〜D10が05作成前に完了した。完了証拠をbaselineとして残し、現在は次の
順で進める。

```text
04 D0 ─ D1 ─ ... ─ D10  (completed baseline)
                           │
                           ▼
                    05 V0 ─ V12
                           │
                           ▼
                     06 R0 ─ R13
                           │
                           ▼
                     07 K0 ─ K12
                           │
                           ▼
                     08 S0 ─ S13
                           │
                           ▼
                     09 T0 ─ T13
                           │
                           ▼
                      04 D11 ─ D12
```

V11/V12でD4〜D10相当のcontract、coverage、E2E、visual、a11y、performance、bundle、security
gateを18 preset込みで再実行する。既存D4〜D10を未完了へ戻す必要はないが、05前の結果だけで
expanded candidateをrelease可能とは判定しない。

### 1.3 Lunaへの完了指示

LunaはV0〜V12を順番に実行する。

1. [progress.md](./progress.md)の05節を読む。
2. 最初の`pending` V packageだけを`in_progress`にする。
3. packageの対象file、contract、testを確認する。
4. 実装とfixtureを同じpackageで追加する。
5. package固有gateを通す。
6. command、件数、coverage、Gallery caseをprogressへ記録する。
7. `complete`にして次へ進む。
8. V12完了後、06 R0へhandoffする。

rendererだけ追加してGallery/testを後回しにしない。各presetは追加されたpackage内で最低限のunit、
Gallery case、accessible summaryを持つ。

### 1.4 正本の優先順位

1. プロダクト境界: [00-concept.md](./00-concept.md)
2. wire / Data Frame / Field Config: [01-contracts.md](./01-contracts.md)
3. Backend registry: [02-backend.md](./02-backend.md)
4. Frontend runtime: [03-frontend.md](./03-frontend.md)
5. Gallery / quality gate: [04-testing-and-delivery.md](./04-testing-and-delivery.md)
6. Cartesian type、preset、model、renderer: この文書
7. 現在地: [progress.md](./progress.md)

## 2. 目的

1. 18種類のCartesian表示をcode-defined manifestから選択可能にする。
2. renderer数ではなくpreset reuseでcatalogを増やし、巨大な重複実装を避ける。
3. BackendとFrontendが同じ厳密Zod options definitionを使用する。
4. Data FrameからCartesian modelへの変換をrenderer JSXから分離する。
5. multi-frame、null、negative、stack、percent、range、dual-axisを決定的に扱う。
6. CSS variable / design token、Field Config、Overrideを全presetへ適用する。
7. Tooltip、Legend、Table fallback、accessible summaryを全presetに提供する。
8. renderer family単位のlazy loadを維持する。
9. 通常routeとDashboard shellのbundleを増やさない。
10. 後続P3〜P7が同じcontract/model/test patternを再利用できる形を残す。

## 3. 完了後のcatalog

### 3.1 core.timeseries

| # | Preset ID | 表示 | 状態 |
| ---: | --- | --- | --- |
| 1 | `line` | 折れ線 | existingを仕様化 |
| 2 | `smooth-line` | smooth line | new |
| 3 | `step-line` | step-after line | new |
| 4 | `area` | area | existingを仕様化 |
| 5 | `stacked-area` | stacked area | new |
| 6 | `percent-stacked-area` | 100% stacked area | new |
| 7 | `range-band` | lower-upper band | new |
| 8 | `sparkline` | compact trend | new |

### 3.2 core.bar

| # | Preset ID | 表示 | 状態 |
| ---: | --- | --- | --- |
| 1 | `vertical` | vertical bar | existingを仕様化 |
| 2 | `horizontal` | horizontal bar | new |
| 3 | `grouped` | grouped bar | new |
| 4 | `stacked` | stacked bar | new |
| 5 | `percent-stacked` | 100% stacked bar | new |
| 6 | `time-bars` | time bucket bar | new |
| 7 | `stacked-time-bars` | stacked time bucket bar | new |
| 8 | `lollipop` | stem + dot | new |
| 9 | `waterfall` | cumulative delta | new |

### 3.3 core.composed

| # | Preset ID | 表示 | 状態 |
| ---: | --- | --- | --- |
| 1 | `dual-axis` | bar + line、left/right axes | new type |

### 3.4 数え方

```text
core.timeseries = 8
core.bar        = 9
core.composed   = 1
total           = 18
existing        = 3
net new         = 15
```

同じ見た目を名前だけ変えて数えない。各presetは、data requirement、mark、stack、orientation、
axisまたはcompact behaviorの少なくとも1つが異なる。

## 4. 対象

### 4.1 既存file

```text
shared/schemas/dashboard.schema.ts
shared/schemas/dashboard/index.ts
shared/schemas/dashboard/visualization.schema.ts
shared/schemas/dashboard/visualization.schema.test.ts
shared/schemas/dashboard/compatibility.ts
shared/schemas/dashboard/compatibility.test.ts

api/app/hono.ts
api/modules/dashboard/index.ts
api/modules/dashboard/v2/gallery-dashboard.ts
api/modules/dashboard/v2/gallery-dashboard.test.ts
api/modules/dashboard/v2/visualization-registry.ts
api/modules/dashboard/v2/visualization-registry.test.ts

web/src/domains/dashboard/v2/runtime/field-config.ts
web/src/domains/dashboard/v2/runtime/theme.ts
web/src/domains/dashboard/v2/runtime/visualization-types.ts
web/src/domains/dashboard/v2/runtime/visualization-registry.ts
web/src/domains/dashboard/v2/panel/panel-renderer-host.tsx
web/src/domains/dashboard/v2/visualizations/catalog.ts
web/src/domains/dashboard/v2/visualizations/catalog.test.ts
web/src/domains/dashboard/v2/visualizations/core-timeseries/*
web/src/domains/dashboard/v2/visualizations/core-bar/*
web/src/styles.css

scripts/verify-dashboard-bundle.ts
scripts/verify-dashboard-gallery.ts
scripts/dashboard-bundle-budget.json

tests/e2e/dashboard/dashboard-gallery.spec.ts
tests/visual/dashboard-gallery.visual.spec.ts
tests/accessibility/dashboard.accessibility.spec.ts
tests/performance/dashboard.performance.spec.ts

docs/dashboard-overlay/progress.md
docs/dashboard-overlay/04-testing-and-delivery.md
```

### 4.2 追加file

```text
shared/schemas/dashboard/cartesian-visualizations.schema.ts
shared/schemas/dashboard/cartesian-visualizations.schema.test.ts

web/src/domains/dashboard/v2/visualizations/cartesian/model.ts
web/src/domains/dashboard/v2/visualizations/cartesian/model.test.ts
web/src/domains/dashboard/v2/visualizations/cartesian/formatters.ts
web/src/domains/dashboard/v2/visualizations/cartesian/formatters.test.ts
web/src/domains/dashboard/v2/visualizations/cartesian/legend.tsx
web/src/domains/dashboard/v2/visualizations/cartesian/tooltip.tsx
web/src/domains/dashboard/v2/visualizations/cartesian/axis.tsx
web/src/domains/dashboard/v2/visualizations/cartesian/reference-lines.tsx
web/src/domains/dashboard/v2/visualizations/cartesian/summary.ts
web/src/domains/dashboard/v2/visualizations/cartesian/summary.test.ts

web/src/domains/dashboard/v2/visualizations/core-timeseries/preset-strategies.ts
web/src/domains/dashboard/v2/visualizations/core-timeseries/model.test.ts
web/src/domains/dashboard/v2/visualizations/core-timeseries/renderer.test.tsx

web/src/domains/dashboard/v2/visualizations/core-bar/preset-strategies.ts
web/src/domains/dashboard/v2/visualizations/core-bar/model.test.ts
web/src/domains/dashboard/v2/visualizations/core-bar/renderer.test.tsx

web/src/domains/dashboard/v2/visualizations/core-composed/definition.ts
web/src/domains/dashboard/v2/visualizations/core-composed/model.ts
web/src/domains/dashboard/v2/visualizations/core-composed/model.test.ts
web/src/domains/dashboard/v2/visualizations/core-composed/renderer.lazy.tsx
web/src/domains/dashboard/v2/visualizations/core-composed/renderer.test.tsx
```

既存の`model.ts`を共通Cartesian modelへ段階的に寄せる。移行中も同じ変換を二重実装しない。

### 4.3 対象外

- Pie、Donut、Radar、Scatter、Bubble
- Treemap、Sunburst、Sankey
- Gauge、Bar Gauge、Bullet、Traffic Light
- Histogram、Heatmap、Box Plot
- State Timeline、Status History、Uptime Grid
- Logs、Trace、Flame Graph、Geomap
- Annotation
- shared crosshairのDashboard横断同期UI
- brush / zoom / range selection
- Visualization picker / Panel editor
- CSV / image export
- arbitrary expression
- server-side downsampling algorithm追加

Rechartsに存在するという理由だけで05へ追加しない。上記は06以降の正本で扱う。

## 5. 現行実装監査

### 5.1 維持するもの

- type ID `core.timeseries`、`core.bar`
- existing preset ID `line`、`area`、`vertical`
- renderer-level dynamic import
- shared Recharts Cartesian chunk
- Panel shell、Chart/Table toggle
- hidden / isolated field interaction state
- Data FrameとField Config
- CSS token palette
- reference line contract
- log scale positive-value validation
- accessibilityLayer
- no animation
- Gallery case / conformance gate

### 5.2 修正する問題

1. `line`が実装上`monotone`で、LineとSmooth Lineを区別できない。
2. Time Series rendererがline/areaの条件分岐だけで拡張不能。
3. Barはverticalだけで、orientation / stack / percent / timeを表現できない。
4. `core.composed`は予約済みだが未登録。
5. multi-frame rowsをtimestamp/categoryでalignせず、frameごとに連結している。
6. TooltipがField Config formatterを使用しない。
7. series colorがeffective Field Configではなくpalette indexだけで決まる。
8. axis tickがunit / decimals / timezoneを一貫して使わない。
9. Backend Galleryが`z.record(z.string(), z.unknown())`でoptionsを広く許可する。
10. BackendとFrontendに同じVisualization definitionの正本がない。
11. presetがRenderer contextへ渡らず、options内の`mode`で表示を判定している。
12. compact Sparkline用のsize / axis / legend behaviorがない。
13. stacked percentのnegative / zero-total ruleがない。
14. range band lower/upper validationがない。
15. waterfall cumulative modelがない。
16. dual-axisのfield/axis/unit consistency ruleがない。
17. bundle gateが新しい`core.composed` entryを自動要求しない可能性がある。

### 5.3 解決しない問題

- shared crosshair capabilityはdescriptor上trueでも、Dashboard全Panel同期の完成はP9。
- zoom/range selection capabilityは05ではfalseを維持する。
- table cell sparklineへの埋め込みはP4/P8。05ではPanel presetとして完成させる。
- seriesごとのline style overrideを共通Field Overrideへ追加しない。
- legend table / min/max/avg columnsはP9。

## 6. 固定済み設計判断

1. 18表示を18 renderer typeには分けない。
2. typeは`core.timeseries`、`core.bar`、`core.composed`の3つ。
3. renderer lazy chunkはtype/family単位。presetごとのchunkは作らない。
4. `core.composed`だけ新しいrenderer moduleを追加する。
5. options schema、descriptor、default optionsはshared moduleを単一正本にする。
6. Backend GalleryとFrontend catalogはshared definitionを使う。
7. shared definitionへReact component / dynamic importを含めない。
8. selected presetをRenderer contextへ明示的に渡す。
9. preset固有の意味を、user変更可能な`mode` optionだけに依存させない。
10. existing `line`はstraight segment、`smooth-line`はmonotone、`step-line`はstep-after。
11. existing v1 JSON type/preset mappingは維持する。`line`のpixel変化は05 release noteへ記録する。
12. `area`はexisting smooth area behaviorを維持する。
13. stack percentはnegative valueを拒否する。
14. zero-total rowのpercent値は0とする。
15. stacked normalはpositive/negativeをRechartsのseparate stackとして許可する。
16. range bandはlower/upper 2 fieldを明示指定し、`lower <= upper`を要求する。
17. Sparklineはaxes/grid/legend/reference lineを表示しない。Table fallbackとsummaryは維持する。
18. horizontal barはcategoryをY、valueをXへ置く。
19. waterfallは単一value seriesを累積deltaとして扱い、任意でfinal Totalを追加する。
20. dual-axisはexplicit series bindingを推奨し、空bindingだけ安全な推論を許可する。
21. 一つのaxisへ異なるunit familyを混在させない。
22. raw hex/rgb/hslをoptionsへ追加しない。
23. Recharts以外の新runtime dependencyを追加しない。
24. BrowserでSQL/再集計を行わない。表示model変換だけを行う。
25. animationは全presetで無効。reduced motionを標準とする。
26. Gallery success caseなしでcatalogへ登録しない。
27. visual baselineなしでV12 completeにしない。

## 7. Architecture

```text
shared cartesian definitions
  ├── descriptors
  ├── strict Zod config schemas
  └── default options by preset
          │
          ├──────────────┐
          ▼              ▼
Backend registry     Frontend catalog
  │                       │
Gallery manifest          ├── common Cartesian model
  │                       ├── effective field config
  ▼                       ├── preset strategy
v2 API                    └── lazy renderer family
          │                         │
          └──────── Panel shell ────┘
                         │
                  Tooltip / Legend
                  summary / Table
```

Dependency direction:

```text
shared cartesian schema
  ↑              ↑
api              web definition
                  ↑
web model ← web renderer.lazy
```

禁止:

```text
shared -> web
api -> web
Frontend catalog -> renderer.lazy static import
Gallery Backend -> Frontend definition
renderer.lazy -> API client
```

## 8. Shared Cartesian definition

### 8.1 module responsibility

`cartesian-visualizations.schema.ts`は次をexportする。

```ts
coreTimeseriesVisualizationContract
coreBarVisualizationContract
coreComposedVisualizationContract

timeseriesConfigV2Schema
barConfigV2Schema
composedConfigV1Schema

cartesianValueAxisSchema
cartesianReferenceLineSchema
normalizeCartesianOptionsV1
```

Contract object:

```ts
type SharedVisualizationContract<TConfig> = VisualizationDefinition<TConfig>;
```

既存`VisualizationDefinition`にloaderはないため、そのままsharedで使える。

Frontend:

```ts
export const coreTimeseriesDefinition = defineFrontendVisualization({
  ...coreTimeseriesVisualizationContract,
  validateFrames: validateTimeseriesFrames,
  load: () => import("./renderer.lazy"),
  loadPolicy: "immediate",
});
```

Backend:

```ts
visualizations: [
  coreTimeseriesVisualizationContract,
  coreBarVisualizationContract,
  coreComposedVisualizationContract,
  coreStatVisualizationContract,
  coreTableVisualizationContract,
]
```

05では少なくともCartesian 3 typeをshared化する。Stat/Tableのshared化は、Gallery conformanceが
要求する最小修正だけを行い、P4を先取りしない。

### 8.2 value axis

```ts
type CartesianValueAxis = {
  scale: "linear" | "log";
  min: "auto" | number;
  max: "auto" | number;
  show: boolean;
};
```

Rules:

- numberはfinite。
- min/maxがnumberなら`min < max`。
- logは表示対象全valueが`> 0`。
- percent presetはdomain `[0, 100]`へ固定し、custom min/maxを拒否する。
- horizontal barでも名前は`valueAxis`。物理X/Yに依存しない。

### 8.3 reference line

```ts
type CartesianReferenceLine = {
  value: number;
  label?: string;
  colorToken: DashboardColorToken;
  lineStyle: "solid" | "dashed" | "dotted";
};
```

既存fieldへ`lineStyle`をdefault `dashed`で追加する。最大20件。horizontal barではX reference、
それ以外はvalue Y referenceになる。

### 8.4 legacy option normalization

05より前のnative v2 / compatibility outputを壊さない。

入力alias:

```text
yAxisScale
yAxisMin
yAxisMax
mode
orientation
fill
```

canonical:

```text
valueAxis.scale
valueAxis.min
valueAxis.max
```

Rules:

1. aliasをcanonicalへcopyする。
2. canonicalとaliasが両方あり値が異なる場合はerror。
3. `mode` / `orientation`はselected presetが意味を決めるためdiscardする。
4. `fill`はBackend normalization済みなのでrenderer configからdiscardする。
5. inputをmutationしない。
6. normalization後にstrict schemaでunknown keyを拒否する。

`legacyVisualizationToV2()`はV1でcanonical optionsを出すよう更新する。alias supportはpre-05 native
manifestの移行用として残す。

### 8.5 config version

```text
core.timeseries configSchemaVersion: 1 -> 2
core.bar        configSchemaVersion: 1 -> 2
core.composed   configSchemaVersion: 1
```

wireの`options`はgeneric JSON objectなので、transport schema変更はない。existing optionsはalias
normalizerを通りv2 schemaへ移行できる。削除不能なoptionはない。

## 9. Timeseries config

```ts
type TimeseriesConfigV2 = {
  showLegend: boolean;
  showGrid: boolean;
  connectNulls: boolean;
  lineWidth: number;
  areaOpacity: number;
  showPoints: "auto" | "always" | "never";
  valueAxis: CartesianValueAxis;
  referenceLines: CartesianReferenceLine[];
  rangeBand?: {
    lowerFieldKey: string;
    upperFieldKey: string;
  };
  sparklineShowLastValue: boolean;
};
```

Limits/defaults:

```text
showLegend = true
showGrid = true
connectNulls = false
lineWidth = 2, range 1..6
areaOpacity = 0.24, range 0.05..1
showPoints = auto
valueAxis = linear/auto/auto/show true
referenceLines = []
sparklineShowLastValue = false
```

Preset behaviorはoptionsではなくstrategyが決める。

| Preset | Curve | Mark | Stack | axes/grid/legend |
| --- | --- | --- | --- | --- |
| line | linear | line | none | config |
| smooth-line | monotone | line | none | config |
| step-line | stepAfter | line | none | config |
| area | monotone | area | none | config |
| stacked-area | monotone | area | normal | config |
| percent-stacked-area | monotone | area | percent | config |
| range-band | linear | band + boundary | none | config |
| sparkline | monotone | line | none | hidden |

Semantic validation:

- timeseries shape only。
- time field exactly 1 per selected frame。
- value series 1以上。
- stacked presetsはvalue series 2以上。
- percent presetは全non-null value `>= 0`。
- range-bandは指定2 fieldがnumeric value field。
- lower/upperは同じframeに存在。
- rowごとにnull/nullまたは`lower <= upper`。
- 片方だけnullはgapとして許可し、bandを描画しない。
- Sparklineはvalue seriesをexactly 1件要求し、複数seriesをsemantic validationで拒否する。
- log scaleとpercent/range bandは組み合わせを拒否する。

## 10. Bar config

```ts
type BarConfigV2 = {
  showLegend: boolean;
  showGrid: boolean;
  valueAxis: CartesianValueAxis;
  referenceLines: CartesianReferenceLine[];
  categoryLabelAngle: 0 | -30 | -45 | -90;
  barGap: number;
  categoryGap: number;
  maxBarSize: number | "auto";
  lollipopDotSize: number;
  waterfall: {
    valueFieldKey?: string;
    showTotal: boolean;
    totalLabel: string;
  };
};
```

Defaults/limits:

```text
showLegend = true
showGrid = true
categoryLabelAngle = 0
barGap = 4, 0..24
categoryGap = 16, 0..48
maxBarSize = auto or 4..120
lollipopDotSize = 6, 3..16
waterfall.showTotal = true
waterfall.totalLabel = Total, 1..32 chars
```

Preset behavior:

| Preset | domain | orientation | stack | requirement |
| --- | --- | --- | --- | --- |
| vertical | category | vertical | none | value >=1 |
| horizontal | category | horizontal | none | value >=1 |
| grouped | category | vertical | grouped | value >=2 |
| stacked | category | vertical | normal | value >=2 |
| percent-stacked | category | vertical | percent | value >=2、non-negative |
| time-bars | time | vertical | none | timeseries、value >=1 |
| stacked-time-bars | time | vertical | normal | timeseries、value >=2 |
| lollipop | category | vertical | none | value exactly 1 |
| waterfall | category | vertical | cumulative | value exactly 1 |

`vertical`は1 seriesを主用途とするが、複数seriesを拒否しない。複数ならgrouped表示になる。
`grouped`は2 series以上を要求するため、作成者の意図を明確にするdiscoverable presetである。

Waterfall:

- input valueはdelta。
- cumulative startは0。
- row Nのstartはrow N-1のend。
- positive/negative/zeroを別state class/tokenで表現。
- `showTotal=true`なら最後にsynthetic Total rowを追加。
- synthetic rowはinput Data Frameへ書き戻さない。
- tooltipはdeltaとcumulative endを表示。
- table fallbackはraw inputだけを表示し、synthetic Totalを混ぜない。

## 11. Composed config

```ts
type ComposedConfigV1 = {
  showLegend: boolean;
  showGrid: boolean;
  leftAxis: CartesianValueAxis;
  rightAxis: CartesianValueAxis;
  referenceLines: Array<CartesianReferenceLine & {
    axis: "left" | "right";
  }>;
  series: Array<{
    fieldKey: string;
    mark: "bar" | "line";
    axis: "left" | "right";
    lineStyle: "linear" | "monotone" | "stepAfter";
  }>;
};
```

Rules:

- `series`最大16。
- fieldKey unique。
- numeric value fieldだけ。
- left/rightに最低1 seriesずつ。
- axisごとにeffective unit familyが一致。
- 同じfieldを両axisへ置かない。
- explicit seriesが空の場合だけ推論する。
- 推論は最初のnumeric field=`bar/left`、2つ目以降=`line/right`。
- numeric fieldが2未満ならincompatible。
- time/categoryどちらのdomainも許可。
- log axisは割り当てseries全value `> 0`。
- right axis tick、Tooltip、Legendにaxis/unitを反映。

`core.composed` descriptor:

```text
category = time
supportedShapes = timeseries, category
minimumSize = 6x4
recommendedSize = 10x5
legend = true
tooltip = true
sharedCrosshair = true
zoom/rangeSelection/annotations = false
fieldOverrides/tableFallback/exportData/mobileSummary = true
```

## 12. Renderer context and preset

### 12.1 context変更

```ts
type DashboardRendererContext<TConfig> = {
  dashboardId: string;
  panel: PanelManifestV2;
  frames: DashboardDataFrameV2[];
  preset: string;
  config: TConfig;
  timezone: string;
  locale: string;
  theme: DashboardVisualizationTheme;
  interaction: DashboardPanelInteraction;
};
```

`VisualizationResolution.ready`にもresolved presetを含める。

Resolution order:

1. spec.preset or descriptor.defaultPreset
2. preset existence
3. defaultOptionsByPreset merge
4. config schema parse
5. frame select
6. `validateFrames(frames, config, preset)`
7. ready resolutionへpresetを保存
8. PanelRendererHostからRenderer/summaryへ渡す

### 12.2 validateFrames signature

```ts
validateFrames?: (
  frames: DashboardDataFrameV2[],
  config: TConfig,
  preset: string,
) => string | undefined;
```

既存definition/test/fakeを同時更新する。`preset`をoptionalにして移行を曖昧にしない。

### 12.3 strategy map

巨大なnested conditionを避ける。

```ts
const timeseriesPresetStrategies: Record<
  TimeseriesPreset,
  TimeseriesPresetStrategy
>;

const barPresetStrategies: Record<BarPreset, BarPresetStrategy>;
```

Strategyは次だけを返す。

- mark type
- curve
- orientation
- stack mode
- required series count
- axis visibility
- model adapter

React componentそのものをstrategy dataへ大量に持たせない。

## 13. Shared Cartesian model

### 13.1 output model

```ts
type CartesianDomainValue = number | string;

type CartesianSeriesModel = {
  key: string;
  frameRefId: string;
  fieldKey: string;
  label: string;
  values: Array<number | null>;
  fieldConfig: StandardFieldConfigV2;
};

type CartesianRowModel = {
  domain: CartesianDomainValue;
  values: Record<string, number | null>;
  raw: Record<string, string | number | boolean | null>;
};

type CartesianModel = {
  domainKind: "time" | "category";
  rows: CartesianRowModel[];
  series: CartesianSeriesModel[];
};
```

### 13.2 timeseries alignment

現行のframe連結を廃止する。

1. 各frameのtime fieldを取得。
2. timestampをfinite epoch millisecondへ正規化。
3. 全frameのtimestamp unionを作る。
4. 昇順stable sort。
5. frame/fieldごとにtimestamp→value map。
6. 存在しないtimestampはnull。
7. series keyはmulti-frame時`<refId>:<fieldKey>`。
8. input arrayをmutationしない。

同一frame内duplicate timestampはBackend normalizerで拒否済みだが、Frontend modelもsafe errorを返す。

### 13.3 category alignment

- single frameはrow order維持。
- multi-frameはcategoryのstring representationでalign。
- first frame orderを優先し、後続だけのcategoryを後ろへ追加。
- 同一frame duplicate categoryはincompatible。
- null categoryは`noValueText`ではなく`"—"` domain labelへ正規化するがraw nullを保持。
- object categoryはcontract上存在しない。

### 13.4 raw and derived values

modelはraw numeric valueを保持する。

- percent stackはderived percentを別mapへ作る。
- waterfall start/endは別model。
- range band base/deltaは別model。
- Tooltip/Table link用raw rowを失わない。
- Chart/Table toggleは元Data Frameを使い続ける。

### 13.5 effective Field Config

各seriesで`resolveFieldConfig()`を1度実行する。

Color priority:

```text
effective fixed color token
  -> effective palette selection
  -> Dashboard categorical palette by stable series index
```

`resolveThemeColor()`はshared schemaでvalidなCSS tokenを`var(--token)`へ変換できるようにする。
raw color valueは受けない。unknown/invalid tokenはfallbackする。

Unit/decimals:

- Tooltip
- Y/X value axis tick
- Legend accessible text
- Summary

で同じ`formatDashboardValue()`を使う。

## 14. Tooltip

共通`CartesianTooltip`を作る。

表示:

- domain label。timeはDashboard timezone/locale
- visible series label
- formatted value
- mapped textがあればmapped text + raw value accessible text
- series color marker + text
- percent presetはpercentageとraw値
- waterfallはdeltaとcumulative
- dual-axisはaxis/unit

Rules:

- null/zeroを区別。
- 最大20 rows。それ以上は`+N more`。
- viewport外へoverflowしない。
- raw HTMLを使わない。
- hover-only情報にしない。summary/Tableが代替。
- animationなし。
- hidden seriesを表示しない。

P9のtooltip sort/hide-zero設定は対象外。05ではseries orderを維持する。

## 15. Legend

共通`CartesianLegend`を作る。

- button per series
- `aria-pressed`
- Enter/Space toggle
- Shift+Enterでisolate
- visible instructionをtooltipだけに依存させず、screen reader hintを持つ
- Reset series control
- stable order
- color marker + label
- axis labelはdual-axisだけ表示
- mobile wrap
- 20 series上限。超過はBackend contract以前に拒否またはPanel notice

double-click isolateは既存互換として残してよいが、唯一の入口にしない。

## 16. Axes and grid

### 16.1 time axis

- range長に応じてdate/time formatterを選択。
- timezoneを必ず指定。
- localeをRenderer contextから使用。
- duplicate tick labelを減らす。
- timestamp rawはTooltip/Tableに保持。

### 16.2 category axis

- long labelをtruncateし、full valueはtitle/Tooltip/Table。
- rotationはconfig値。
- horizontal barはY axis widthに上限を設定。
- mobileはtick countを減らす。

### 16.3 value axis

- effective unit formatter。
- mixed unitsはsingle-axis presetでwarningではなくincompatibleにするか、field configが同一unitであることを
  semantic validationする。
- domain auto/number。
- percent `[0,100]`。
- log positive only。
- horizontal barではX axisへ投影。

### 16.4 grid

- existing design tokenからstroke。
- `showGrid=false`で非表示。
- Sparklineでは常に非表示。
- raw hardcoded hex禁止。

## 17. Preset details

### 17.1 Line

- Recharts `Line`
- `type="linear"`
- dotはshowPointsに従う
- nullはconnectNullsに従う
- lineWidth

### 17.2 Smooth Line

- `type="monotone"`
- その他はLineと同じ
- overshootによりnegativeを生成しないことをvisual確認。Recharts curve表示だけでraw値は変えない

### 17.3 Step Line

- `type="stepAfter"`
- state-like numeric transition向け
- point timestampで次区間へ値を保持
- Tooltipはraw point

### 17.4 Area

- Recharts `Area`
- monotone
- stroke + fill同token
- fill opacity config
- stackなし

### 17.5 Stacked Area

- 全series same `stackId`
- raw Tooltip
- positive/negative stackを許可
- legend hideで残りseriesが再stackされることをtest

### 17.6 Percent Stacked Area

- derived 0..100 values
- negative拒否
- row total 0は全0
- axis 0..100
- Tooltipはpercent + raw
- summaryは最新構成比

### 17.7 Range Band

- lower/upper field explicit
- lowerをbase、upper-lowerをband heightへ変換
- transparent base + filled band、またはRecharts Area range tuple。採用APIをmodel testで固定
- boundary linesは同tokenのopacity違い
- legendは1 band item
- Tableはlower/upper raw columns
- lower>upper incompatible

### 17.8 Sparkline

- single numeric series
- axes/grid/legend/Tooltip pointer overlayを最小化
- accessible summary
- Table toggle
- `sparklineShowLastValue=true`ならformatted last valueをtext表示
- minimum 2x2、recommended 4x2をPanel preset単位で表せない現contractでは、type minimumを2x2へ
  下げ、非Sparkline Gallery layoutは従来recommended sizeを使う
- 通常Line panelを2x2へ推奨しない

### 17.9 Vertical / Grouped Bar

- category X/value Y
- groupedは2 series以上
- stable field order
- zero baselineを含むauto domain

### 17.10 Horizontal Bar

- value X/category Y
- long label向け
- category countに応じてrecommended heightをGalleryで確保
- page全体の横scrollを発生させない

### 17.11 Stacked / Percent Stacked Bar

- stackedはsame stackId
- percentはderived values
- negative rejectionはpercentだけ
- hidden series時のdenominatorをvisible seriesで再計算するか固定するかを明示する
- 05ではvisible seriesで再計算する
- Tooltip raw/percent

### 17.12 Time Bars / Stacked Time Bars

- timeseries shape
- time X axis
- bucket widthはneighbor timestamp差のmedianから計算し、Recharts category widthへ直接pixel指定しない
- irregular bucketはcentered categorical barとして表示し、durationを偽らない
- stacked版は2 series以上

### 17.13 Lollipop

- single numeric series
- thin stem + dot
- category X/value Y
- negativeはzeroから下向き
- dotにkeyboard focusを大量付与しない。Panel/Tableで代替
- Tooltip datum activationはwhole chart interactionで扱う

### 17.14 Waterfall

- cumulative model
- positive token、negative token、total tokenはdesign token
- connector lineはmuted token
- total synthetic row optional
- zero deltaもlabel/Tooltipで識別
- Tableはraw deltas

### 17.15 Dual-axis

- Recharts `ComposedChart`
- line + bar
- left/right Y axis
- explicit axis ID
- axis単位label
- one shared domain axis
- Tooltip/Legendでmarkとaxisを示す
- mobileでright axisがplotを潰す場合はtick count/widthを縮め、summary/Tableを維持

## 18. Gallery cases

V package完了ごとに追加する。

| Case ID | Preset | Fixture | 必須assertion |
| --- | --- | --- | --- |
| `timeseries-line` | line | null/zero/2 series | straight line |
| `timeseries-smooth-line` | smooth-line | curved trend | monotone |
| `timeseries-step-line` | step-line | state steps | step-after |
| `timeseries-area` | area | gap/override | area opacity |
| `timeseries-stacked-area` | stacked-area | +/- 3 series | stack |
| `timeseries-percent-stacked-area` | percent-stacked-area | non-negative | 100% axis |
| `timeseries-range-band` | range-band | lower/upper | band |
| `timeseries-sparkline` | sparkline | single compact | no axes |
| `bar-vertical` | vertical | zero/negative | baseline |
| `bar-horizontal` | horizontal | long labels | no overflow |
| `bar-grouped` | grouped | 3 series | side-by-side |
| `bar-stacked` | stacked | +/- 3 series | stack |
| `bar-percent-stacked` | percent-stacked | non-negative | 100% |
| `bar-time` | time-bars | regular buckets | time axis |
| `bar-time-stacked` | stacked-time-bars | 3 series | time stack |
| `bar-lollipop` | lollipop | ranking | stem + dot |
| `bar-waterfall` | waterfall | +/- deltas | cumulative + Total |
| `composed-dual-axis` | dual-axis | count + latency | left/right units |

### 18.1 additional invalid fixtures

Gallery success manifestへinvalid caseを登録しない。unit/component testで扱う。

- percent negative
- range lower>upper
- range missing field
- Sparkline multi-series
- grouped single-series
- waterfall multi-series
- dual-axis one series
- dual-axis duplicate binding
- mixed unit per axis
- log non-positive

### 18.2 fixture rules

- fixed UTC timestamps
- deterministic values
- no random
- raw hexなし
- all panels table fallback enabled
- each case descriptor minimum以上
- existing state fixtures維持
- Gallery manifest revision/layoutVersionをincrement
- visual baselineを明示更新

## 19. Backend responsibilities

Backendにchart計算を追加しない。

担当:

- shared strict definition registration
- Gallery manifest semantic validation
- deterministic Data Frame fixtures
- supported shape / preset / options validation
- max rows/series/frames
- existing normalization

担当しない:

- percent stack計算
- waterfall cumulative display model
- range band pixel model
- axis domain inference
- color selection
- Tooltip formatting

業務handlerがpercentやcumulativeをDBで集計して返してもよいが、05のgeneric rendererはraw Data Frame
から表示modelを作れることを必須とする。

## 20. Frontend responsibilities

- preset resolution
- Cartesian alignment
- derived display model
- Field Config resolution
- token color
- axes/Tooltip/Legend/summary
- render strategy
- Panel error isolation
- lazy load
- mobile adaptation

derived modelをTanStack Query cacheへ別保存しない。pure `useMemo`またはmodel builderで、response
requestId/frame identityごとに再計算する。100ms Browser Transformation budgetとは別だが、dense fixtureで
long task gateを満たす。

## 21. Lazy load and bundle

### 21.1 chunk boundary

```text
dashboard shell
  ├── core.timeseries renderer.lazy (dynamic)
  ├── core.bar renderer.lazy (dynamic)
  ├── core.composed renderer.lazy (dynamic)
  ├── core.stat renderer.lazy (dynamic)
  └── core.table renderer.lazy (dynamic)

timeseries/bar/composed
  └── shared Recharts Cartesian family chunk
```

Shared option schema/descriptorはDashboard shellへ入ってよい。Recharts component importは
`renderer.lazy.tsx`だけに置く。

### 21.2 prohibited imports

- `catalog.ts`からrenderer.lazy
- `definition.ts`からRecharts
- shared schemaからRecharts/React
- Backendからweb
- common Cartesian modelからAPI client

### 21.3 bundle gate update

hardcoded renderer listをcatalog/manifest keyから導出できる形へする。

- `core.composed` renderer entry必須
- composed graphはCartesian shared chunkへ到達
- stat/tableは到達しない
- initial graph不変
- Dashboard shellにRechartsなし
- Gallery routeがall rendererをstatic importしない
- budget fileに`core.composed` row
- timeseries/bar graphの増加を実測し10% policyでreview

新dependencyを追加しないためlockfileのruntime dependency差分は0が期待値。

## 22. Accessibility

全preset:

- Panel accessible label
- Recharts accessibility layer where applicable
- non-empty summary
- Table fallback
- Legend keyboard toggle/isolate/reset
- color以外のseries label/state
- reduced motion
- Tooltip alternative
- focus outline clipなし

Preset summary minimum:

| Preset | Summary内容 |
| --- | --- |
| line/smooth/step | series数、point数、latest/min/max |
| area | series数、range、latest |
| stacked area/bar | series数、latest/total |
| percent | latest composition |
| range band | lower/upper latest、幅 |
| sparkline | label、first/latest、direction |
| grouped | category数、series数 |
| horizontal | top/bottom category |
| lollipop | min/max category |
| waterfall | start、net change、end |
| dual-axis | left/right seriesとunit |

summaryは全データ点を読み上げない。最大400文字を目安に代表値へ要約する。

## 23. Mobile

- Dashboard layoutは1列のまま。
- Sparkline minimum heightをcompactにする。
- legendはwrap、必要ならcollapsed summary。
- horizontal bar category label幅はcontainerの40%以下。
- dual-axis tick area合計はplot widthの45%以下。
- categoryが多い場合、全labelを強制表示せずtick intervalを調整。
- Tooltipはtapでも到達可能なRecharts behaviorを確認。
- table containerだけhorizontal scroll。
- Waterfall connector/labelがoverflowしない。
- Lollipop dot targetをvisualだけで操作対象にしない。

## 24. Performance limits

05で独自上限を増やさず、01のData Frame limitを継承する。さらにrenderer safe limit:

```text
visible series <= 20
reference lines <= 20
composed bindings <= 16
Gallery normal points <= 180 per series
Gallery dense points = contract内のperformance fixture
```

`maxDataPoints`を超えるData FrameはBackendが拒否/切り詰めstateを返す。rendererがDOM/SVG要素を
無制限に増やさない。

- point dot autoは総point数200以下だけ表示。
- dense lineでdot=false。
- Bar category×seriesが大きい場合もcontract limit内。virtualizationは05対象外。
- model buildはpure benchmarkを持つ。
- 同一frame/configでresizeだけならmodelを再構築しない。
- legend toggleは必要なderived percentだけ再計算。
- animation false。

## 25. Security

- optionsはshared strict Zod。
- field key max length/patternを共有schemaで検証。
- label/TooltipはReact text。
- raw HTMLなし。
- CSS tokenだけ。
- `var()`へ渡すtokenはdashboardColorTokenSchemaを通す。
- formatterに`eval`/`Function`なし。
- arbitrary formatter stringなし。
- Tooltip datum linkはexisting same-origin resolverだけ。
- errorへraw frame全件を含めない。
- accessible summaryにsecret filter/query metadataを含めない。

## 26. Compatibility and migration

### 26.1 stable IDs

維持:

```text
core.timeseries/line
core.timeseries/area
core.bar/vertical
```

既存Dashboard manifestを手修正せずparseできる。

### 26.2 existing options

既存:

```text
showLegend
fill
connectNulls
yAxisScale
yAxisMin
yAxisMax
referenceLines
mode
orientation
```

V1 alias normalizerでcanonicalへ変換する。unknown keyは引き続き拒否する。

### 26.3 rendering change

`line`は現行の意図しない`monotone`から`linear`へ変わる。

- JSON type/preset compatibilityは維持。
- Smooth表示が必要な新manifestは`smooth-line`。
- visual baseline update理由へ記録。
- operations demoがlineを使う場合、design意図を確認してlineまたはsmooth-lineをcode-definedに選ぶ。
- legacy v1 mappingのpreset IDは`line`を維持し、暗黙にsmoothへ変えない。

### 26.4 layout

- existing layoutVersionはpreset追加だけでは変更しない。
- Gallery panel増加ではGallery layoutVersionをincrement。
- Sparkline minimum size変更はoperations layoutへ影響させない。
- restore時はdescriptor minimumを尊重。

### 26.5 version

timeseries/bar descriptor versionを2へ上げる。manifest revisionはDashboard定義変更時に上げる。
wire schemaVersionは2のまま。API endpoint versionを増やさない。

## 27. V0〜V12 Work Packages

| WP | 内容 | 完了gate |
| --- | --- | --- |
| V0 | prerequisite、baseline、characterization | D0〜D3、existing 3 preset、bundle baseline |
| V1 | shared Cartesian contracts / preset context | schema、registry、compatibility tests |
| V2 | shared Cartesian model / formatter / primitives | model/formatter unit tests |
| V3 | line/smooth/step/area | renderer + Gallery 4 cases |
| V4 | stacked/percent stacked area | stack model + Gallery 2 cases |
| V5 | range band | lower/upper validation + Gallery |
| V6 | Sparkline | compact renderer + Gallery |
| V7 | vertical/horizontal/grouped/stacked/percent bar | model/renderer + 5 cases |
| V8 | time bars/stacked time bars/lollipop | model/renderer + 3 cases |
| V9 | waterfall | cumulative model + Gallery |
| V10 | composed dual-axis | new type/renderer + Gallery |
| V11 | conformance、visual、a11y、performance、bundle | 18 preset quality gates |
| V12 | full verify、docs、handoff to 06 R0 | full gates、progress |

## 28. V0: Baseline

### 28.1 command

```bash
git branch --show-current
git status --short
bun run verify
bun run verify:dashboard-coverage
bun run verify:dashboard-frontend-coverage
E2E_PORT=5175 bun run verify:dashboard-e2e
bun run verify:dashboard-gallery
bun run verify:dashboard-bundle
git diff --check
```

### 28.2 record

- current catalog types/presets
- Gallery cases
- timeseries/bar raw/gzip graph bytes
- Recharts shared graph
- focused coverage
- line/area/vertical screenshots
- existing config parse fixtures
- D0〜D3 evidence

### 28.3 characterization

- line currently monotone
- area currently monotone
- vertical Bar current axes
- log rejection
- hidden/isolate legend
- alias options parse
- Chart/Table same frames

### 28.4 gate

- D0〜D3 complete。
- existing 3 preset green。
- user/concurrent changesを記録。
- V1 file scope確定。

## 29. V1: Shared contract and preset context

### 29.1 shared schema

- Cartesian option schemas
- descriptors
- default options
- alias normalizer
- strict validation
- config versions
- barrel export

### 29.2 Backend

- Galleryのloose `galleryVisualization()`をCartesian shared contractsへ置換。
- `core.composed` register。
- registry startup validation。
- manifest serializerにschema/functionを出さない。

### 29.3 Frontend

- definitionがshared contractをspread。
- context/resolutionへpreset。
- validateFrames signature更新。
- fake definitions/tests更新。

### 29.4 compatibility tests

- old flat axis alias→canonical
- conflicting alias/canonical error
- mode/orientation/fill consumed
- existing line/area/vertical parse
- legacy v1 helper canonical output
- unknown option rejection
- all defaultOptions parse
- descriptor presets/defaults exact match

### 29.5 gate

```bash
bunx vitest run \
  shared/schemas/dashboard/cartesian-visualizations.schema.test.ts \
  shared/schemas/dashboard/visualization.schema.test.ts \
  shared/schemas/dashboard/compatibility.test.ts \
  api/modules/dashboard/v2/visualization-registry.test.ts \
  api/modules/dashboard/v2/gallery-dashboard.test.ts \
  web/src/domains/dashboard/v2/runtime/visualization-registry.test.ts
bun run typecheck
git diff --check
```

## 30. V2: Cartesian model and primitives

### 30.1 model

- time union align
- category align
- stable series keys
- effective field config
- raw/derived separation
- percent normalization
- range model helper
- waterfall helper
- no mutation

### 30.2 formatter

- timezone time
- field unit/decimals/mapping
- percent raw+derived
- null
- category truncation

### 30.3 shared UI

- Tooltip
- Legend
- Axis helper
- Reference lines
- summary builders

UI componentはRecharts importを持つ場合renderer lazy graph内からだけ到達する。`formatters.ts`とmodelは
Recharts非依存にする。

### 30.4 tests

- multi-frame disjoint/overlap timestamps
- out-of-order input
- duplicate domain safe error
- missing values null
- category stable order
- percent zero total
- percent negative rejection helper
- range lower/upper
- waterfall +/-/zero/total
- token/formatter
- no mutation frozen input

### 30.5 gate

```bash
bunx vitest run web/src/domains/dashboard/v2/visualizations/cartesian
bun run verify:dashboard-frontend-coverage
bun run typecheck
git diff --check
```

## 31. V3: Basic Timeseries

実装順:

1. preset strategy map
2. line linear
3. smooth monotone
4. stepAfter
5. area
6. common Tooltip/Legend/Axis
7. summary
8. Gallery 4 cases

Test:

- Recharts mark/type props
- null/connectNulls
- point policy
- area opacity
- field color token
- unit ticks/tooltip
- legend keyboard
- table fallback
- summary
- all 4 lazy renderer success

Gate:

```bash
bunx vitest run web/src/domains/dashboard/v2/visualizations/core-timeseries
bun run verify:dashboard-gallery
E2E_PORT=5175 bun run verify:dashboard-e2e -- --grep "line|area"
bun run verify:dashboard-bundle
```

## 32. V4: Stacked Area

### 32.1 normal stack

- 2+ series
- positive/negative
- visible series recomposition
- raw Tooltip

### 32.2 percent stack

- non-negative
- zero total
- 0..100 axis
- raw + percent Tooltip
- latest composition summary

### 32.3 gate

```bash
bunx vitest run web/src/domains/dashboard/v2/visualizations/core-timeseries
bun run verify:dashboard-gallery
E2E_PORT=5175 bun run verify:dashboard-e2e -- --grep "stacked area"
```

## 33. V5: Range Band

実装:

- field binding schema
- semantic validation
- band derived rows
- boundary/fill tokens
- null gaps
- Tooltip lower/upper/width
- summary
- Gallery

Test:

- valid
- missing key
- wrong type
- cross-frame pair rejection
- lower>upper
- null/null
- one null
- table raw
- log incompatible

Gate:

```bash
bunx vitest run web/src/domains/dashboard/v2/visualizations/core-timeseries
bun run verify:dashboard-gallery
E2E_PORT=5175 bun run verify:dashboard-e2e -- --grep "range band"
```

## 34. V6: Sparkline

実装:

- preset strategy compact
- single-series validation
- axes/grid/legend hidden
- optional last value
- responsive compact height
- summary
- Table toggle
- Gallery 2x2/4x2

Test:

- no axis/grid/legend DOM
- one series
- multi-series incompatible
- last value formatted
- null trend
- small width
- mobile

Gate:

```bash
bunx vitest run web/src/domains/dashboard/v2/visualizations/core-timeseries
bun run verify:dashboard-gallery
E2E_PORT=5175 bun run verify:dashboard-e2e -- --grep sparkline
bun run verify:dashboard-bundle
```

## 35. V7: Core category Bar

実装:

1. vertical strategy
2. horizontal axes
3. grouped requirement
4. stacked
5. percent stacked
6. common Tooltip/Legend
7. Gallery 5 cases

Test:

- orientation
- long labels
- 1/2/3 series
- positive/negative/zero
- percent negative rejection
- percent zero total
- visible denominator
- reference line physical axis
- field tokens/units
- no page overflow

Gate:

```bash
bunx vitest run web/src/domains/dashboard/v2/visualizations/core-bar
bun run verify:dashboard-gallery
E2E_PORT=5175 bun run verify:dashboard-e2e -- --grep "bar"
bun run verify:dashboard-bundle
```

## 36. V8: Time Bars and Lollipop

### 36.1 Time Bars

- timeseries domain adapter
- timezone ticks
- regular/irregular buckets
- single/stacked

### 36.2 Lollipop

- one series
- stem/dot
- negative baseline
- accessible summary

### 36.3 gate

```bash
bunx vitest run web/src/domains/dashboard/v2/visualizations/core-bar
bun run verify:dashboard-gallery
E2E_PORT=5175 bun run verify:dashboard-e2e -- --grep "time bars|lollipop"
```

## 37. V9: Waterfall

実装:

- cumulative model
- synthetic Total
- positive/negative/zero/total tokens
- transparent base strategy
- connector
- Tooltip
- raw Table
- summary
- Gallery

Test fixture:

```text
Start  +100 -> 100
Cost    -40 -> 60
Tax     -10 -> 50
Bonus   +20 -> 70
No-op     0 -> 70
Total       -> 70
```

Test:

- start/end exact
- floating finite
- all negative
- showTotal false
- source immutable
- one series only
- token semantics + text

Gate:

```bash
bunx vitest run web/src/domains/dashboard/v2/visualizations/core-bar
bun run verify:dashboard-gallery
E2E_PORT=5175 bun run verify:dashboard-e2e -- --grep waterfall
```

## 38. V10: Composed Dual-axis

実装:

- shared contract registration
- catalog definition
- model binding
- ComposedChart renderer
- left/right axes
- line/bar marks
- Tooltip/Legend
- summary
- Gallery
- dynamic import/budget

Test:

- explicit binding
- safe inference
- missing/duplicate field
- one axis empty
- mixed unit same axis
- log invalid
- time/category domain
- legend hide
- table fallback
- mobile plot width

Gate:

```bash
bunx vitest run \
  shared/schemas/dashboard/cartesian-visualizations.schema.test.ts \
  web/src/domains/dashboard/v2/visualizations/core-composed
bun run verify:dashboard-gallery
E2E_PORT=5175 bun run verify:dashboard-e2e -- --grep "dual axis"
bun run verify:dashboard-bundle
```

## 39. V11: 18-preset quality gate

### 39.1 conformance

- catalog 5 total types: timeseries/bar/composed/stat/table
- 18 Cartesian presets + existing stat/table cases
- every preset default parses
- every preset Gallery success
- no extra Gallery preset
- all lazy loaders
- all accessible summaries
- all table fallback

### 39.2 visual

最低baseline group:

```text
gallery-cartesian-timeseries-desktop.png
gallery-cartesian-bars-desktop.png
gallery-cartesian-compact-desktop.png
gallery-cartesian-mobile.png
panel-range-band.png
panel-waterfall.png
panel-dual-axis.png
```

全18を1枚の巨大full-pageだけで済ませない。family group + complex Panel単体を持つ。

### 39.3 accessibility

- axe serious/critical 0
- legend keyboard
- summaries
- Table alternative
- token contrast
- no hover-only blocker
- mobile

### 39.4 performance

- dense timeseries line
- stacked percent recompute
- 20 series legend
- model build long taskなし
- resizeでmodel rebuildなし

### 39.5 bundle

- initial unchanged boundary
- shell no Recharts
- composed dynamic
- stat/table Rechartsなし
- byte budgets

### 39.6 gate

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

## 40. V12: Full verification and handoff

### 40.1 full command

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

04 D12のrelease gate連続2回はまだ実行しない。05 V12は1回のfull verificationで06へhandoffする。
D4〜D10相当のexpanded quality gateはV11/V12で再実行済みであることを06へ渡す。06〜09へhandoffし、
09 T13完了後に04 D11〜D12が96 preset candidateのvariant matrixと連続release gateを担当する。

### 40.2 docs

- README catalog一覧
- Gallery route
- preset追加方法
- shared Cartesian definition
- migration note
- bundle boundary
- LLM_CONTEXT
- progress
- 06 handoff

### 40.3 handoff

```text
05 status: complete
06 start: R0
Cartesian types: 3
Cartesian presets: 18
Net new variants: 15
New runtime dependencies: 0
```

## 41. Test matrix

### 41.1 schema

- all defaults
- strict unknown
- alias migration
- conflicts
- numeric boundaries
- field IDs
- semantic config

### 41.2 model

- time/category alignment
- multi-frame
- null/zero/negative
- percent
- range
- waterfall
- dual axis
- immutable

### 41.3 renderer

- strategy per preset
- axes/marks/stack
- Tooltip/Legend
- token
- summary
- Table fallback
- error boundary

### 41.4 browser

- 18 Gallery ready
- chunks
- legend
- table
- mobile
- visual
- a11y
- performance

### 41.5 compatibility

- old presets
- old options
- v1 manifest
- layout
- bundle

## 42. Coverage

Shared schemasはglobal test scope。Backend shared registrationはBackend focused coverage。Frontend:

- model
- strategies
- validators
- summaries
- definitions
- common primitives

をfocused coverageへ含める。

Recharts renderer本体をinstrumentation都合でexcludeする場合、V11のcomponent/visual/E2E証拠を
release evidenceへ明記する。新しいcore-composed全fileをまとめてexcludeしない。

Threshold:

```text
statements >= 80
lines      >= 80
functions  >= 80
branches   >= 70
```

## 43. Stop条件

次の場合だけ停止してuser判断を求める。

- shared strict definitionを使うと既存01〜03 contractと両立しない。
- Rechartsでrange band/waterfall/dual-axisをaccessibility contract込みで実現できない。
- 新runtime dependencyが必須になる。
- preset context追加がPanel/registry public contractを破壊する。
- existing v1 manifestを移行不能にする必要がある。
- performance gate達成にData Frame上限の大幅変更が必要。
- design tokenだけでは必要stateを表現できずglobal design system変更が必要。
- user/concurrent変更と同じrenderer行を保存不能な形で競合する。

停止しない例:

- Recharts propsの型が複雑。
- model adapterが長い。
- visual baselineが多数。
- renderer testのmock調整が必要。
- bundle budgetを再計測する必要がある。
- lineのpixel差分が出る。
- mobile label調整が複数回必要。
- coverage不足。

## 44. Failure handling

| Failure | 戻るWP |
| --- | --- |
| shared schema/default | V1 |
| domain alignment/formatter | V2 |
| basic timeseries | V3 |
| stack percent | V4 |
| range validation | V5 |
| compact behavior | V6 |
| core bar | V7 |
| time/lollipop | V8 |
| cumulative | V9 |
| dual-axis | V10 |
| Gallery/visual/a11y/bundle | V11または原因WP |
| full gate | 原因WP、V12 complete禁止 |

Shared contractを変更したら、変更package以降の全gateを再実行する。

## 45. 完了条件

- [ ] 04 D0〜D3 complete。
- [ ] V0〜V12 complete。
- [ ] `core.timeseries` 8 presets。
- [ ] `core.bar` 9 presets。
- [ ] `core.composed` 1 preset。
- [ ] 18 Cartesian variations。
- [ ]純増15 variations。
- [ ] shared strict Cartesian definitions。
- [ ] Backend/Frontend definition driftなし。
- [ ] existing line/area/vertical IDs維持。
- [ ] old options alias migration。
- [ ] presetがRenderer contextへ明示伝播。
- [ ] multi-frame domain alignment。
- [ ] Field Config color/unit/decimals。
- [ ] Tooltip/Legend/a11y summary。
- [ ] Table same-frame fallback。
- [ ] line/smooth/stepの差がvisualで確認可能。
- [ ] stacked/percent rules。
- [ ] range lower/upper rules。
- [ ] Sparkline compact rules。
- [ ] horizontal/grouped/stacked bars。
- [ ] time bars/lollipop/waterfall。
- [ ] dual-axis unit/binding rules。
- [ ] 18 Gallery success cases。
- [ ] invalid fixtures unit coverage。
- [ ] mobile 1列/overflowなし。
- [ ] visual baseline pass。
- [ ] accessibility pass。
- [ ] performance pass。
- [ ] initial/shell lazy boundary pass。
- [ ] composed dynamic chunk。
- [ ] new runtime dependency 0。
- [ ] focused coverage threshold。
- [ ] full verification pass。
- [ ] progress/doc更新。
- [ ] 06 current packageがR0へ更新。

## 46. 次計画へ渡す成果

### 06へ

```text
Catalog:
  core.timeseries: 8 presets
  core.bar: 9 presets
  core.composed: 1 preset

Quality fixtures:
  18 Gallery cases
  invalid semantic fixtures
  visual baselines
  accessibility summaries
  bundle budgets
```

06はR0から開始し、この18 presetと共通contractをbaselineとしてnon-Cartesian 18 presetを追加する。
06 R13後は07 K0、07 K12後は08 S0、08 S13後は09 T0へhandoffする。09 T13後に04 D11へ戻り、
96 preset candidateをcanonical variantへ適用する。D12で05〜09のquality evidenceを含むrelease matrixと
実行する。

### 06以降へ

再利用可能:

- shared Visualization contract pattern
- strict options/defaults
- preset context
- Gallery case convention
- common Tooltip/Legend/summary
- token/formatter
- bundle auto-discovery
- visual/a11y/performance gate

Pie/Scatter等がCartesian modelに合わない場合、無理に流用しない。品質contractとregistry patternだけを
再利用する。

## 47. 再開手順

1. [00-concept.md](./00-concept.md) P2を読む。
2. [04-testing-and-delivery.md](./04-testing-and-delivery.md) D0〜D3 completeを確認。
3. [progress.md](./progress.md) 05節を読む。
4. `git branch --show-current`。
5. `git status --short`。
6. current `in_progress` V packageを確認。
7. 最後の成功commandを再実行。
8. 最初のpending Vだけを開始。
9. rendererとGallery/testを同packageで完成。
10. V12完了後に06 R0へhandoffする。
