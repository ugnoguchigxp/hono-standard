# 08: Distribution・Heatmap・Statistical Visualization拡張 実装計画

## 1. 文書の位置づけ

この文書は[00: コンセプト](./00-concept.md)のP5を、Lunaが最後まで実装できる粒度へ分解した正本である。
07までが推移、構成、関係、階層、KPIを扱うのに対し、08は値の分布、二次元密度、統計要約、日付別活動を
判断するVisualizationを追加する。

対象family:

- Histogram
- Heatmap
- Box Plot
- Calendar Heatmap

新renderer type 4、preset 20、純増20。07完了時の58 presetへ追加し、catalog全体を78 presetへ増やす。

### 1.1 開始条件

- 01 C0〜C9、02 B0〜B12、03 F0〜F12 complete。
- 04 D0〜D10 complete。
- 05 V0〜V12、06 R0〜R13 complete。
- [07](./07-kpi-goal-status-visualizations.md) K0〜K12 complete。
- cumulative 58 presetとGallery/quality gateがgreen。
- 07のrange、semantic color、native SVG、compact summaryが利用可能。

07未完了のまま08へrange/token/native SVG helperを複製しない。

### 1.2 実行順

```text
05 V0〜V12 -> 06 R0〜R13 -> 07 K0〜K12 -> 08 S0〜S13 -> 09 T0〜T13
                                                             |
                                                             v
                                                   04 D11 -> D12
```

既存D11証拠は拡張前baselineとして保持する。S13後は09 T0へhandoffする。

### 1.3 Lunaへの完了指示

1. [progress.md](./progress.md)の08節を読む。
2. 07 K12 completeを確認する。
3. 最初の`pending` S packageだけを`in_progress`にする。
4. contract、transformation/model、renderer、Gallery、testを同packageで完成させる。
5. package固有gateを通す。
6. test件数、coverage、Gallery、bundle bytesをprogressへ記録する。
7. `complete`にして次へ進む。
8. S13後、09 T0へhandoffする。

### 1.4 正本の優先順位

00 > 01 > 02 > 03 > 04 > 05 > 06 > 07 > この文書 > progress。

## 2. 目的

1. 4 renderer type、20 presetを追加する。
2. raw distributionとpre-binned distributionの両方を扱う。
3. `core.histogram` browser transformationを実装し、binningをrenderer JSXから分離する。
4. matrix valueを連続・発散・状態paletteへ決定的に割り当てる。
5. five-number summaryとraw outlierを同じBox Plotへ統合する。
6. timezoneを考慮して日付bucketを構築する。
7. missing、zero、null、outlier、empty cellを混同しない。
8. Tooltip、Legend、Table、summary、mobileを全presetへ提供する。
9. Histogram/Box PlotだけRechartsをlazy loadする。
10. Heatmap/Calendarはnative SVGで軽量に保つ。
11. 通常routeとDashboard shellへ追加rendererを載せない。

## 3. 完了後のcatalog

### 3.1 core.histogram

| Preset | 用途 |
| --- | --- |
| `count` | bucketごとの件数 |
| `density` | 確率密度 |
| `cumulative` | 累積件数/割合 |
| `stacked` | series別分布 |
| `horizontal` | 長いbucket label、順位的確認 |

### 3.2 core.heatmap

| Preset | 用途 |
| --- | --- |
| `matrix` | 汎用X×Y値 |
| `time-bucket` | 時間×bucket |
| `density` | 二次元point密度 |
| `diverging` | 0/基準値からの正負 |
| `annotated` | cell値を常時表示 |

### 3.3 core.box-plot

| Preset | 用途 |
| --- | --- |
| `vertical` | category別five-number summary |
| `horizontal` | 長いcategory label |
| `grouped` | category×series比較 |
| `box-and-points` | box + outlier/raw point |
| `range-summary` | compact min/median/max重視 |

### 3.4 core.calendar-heatmap

| Preset | 用途 |
| --- | --- |
| `year` | 1年の日別活動 |
| `month` | 月単位の詳細 |
| `rolling-weeks` | 直近N週 |
| `weekday-profile` | 曜日×週の傾向 |
| `status-calendar` | 日別semantic state |

```text
Histogram       = 5
Heatmap         = 5
Box Plot        = 5
Calendar Heatmap= 5
08 total        = 20
after 08 total  = 78
```

## 4. Capability audit

既存contract:

- distribution shape: raw value、bin-start/bin-end/count、five-number summary。
- matrix shape: x、y、value/count。
- roles: min/q1/median/q3/max、bin-start/bin-end/count、category/series/time/state。
- `core.histogram` transformation ID予約済み。
- `core.histogram`、`core.heatmap`、`core.calendar-heatmap` Visualization ID予約済み。
- `core.box-plot`だけ予約追加が必要。

Recharts 3.9.2:

- Histogram: `BarChart/Bar/Cell/ReferenceLine`。
- Box Plot: `ComposedChart/Bar/Scatter/ErrorBar`またはcustom SVG shape。
- Heatmap primitiveはないためnative SVG grid。
- Calendar Heatmapもnative SVG grid。

新runtime dependencyは追加しない。D3、simple-statistics、calendar heatmap packageを追加しない。

## 5. 対象file

### 5.1 shared

```text
shared/schemas/dashboard/visualization.schema.ts
shared/schemas/dashboard/transformation.schema.ts
shared/schemas/dashboard/distribution-visualizations.schema.ts
shared/schemas/dashboard/distribution-visualizations.schema.test.ts
shared/schemas/dashboard/histogram-transformation.schema.ts
shared/schemas/dashboard/histogram-transformation.schema.test.ts
shared/schemas/dashboard/index.ts
```

### 5.2 Frontend common

```text
web/src/domains/dashboard/v2/visualizations/distribution/bins.ts
web/src/domains/dashboard/v2/visualizations/distribution/bins.test.ts
web/src/domains/dashboard/v2/visualizations/distribution/color-scale.ts
web/src/domains/dashboard/v2/visualizations/distribution/color-scale.test.ts
web/src/domains/dashboard/v2/visualizations/distribution/matrix.ts
web/src/domains/dashboard/v2/visualizations/distribution/matrix.test.ts
web/src/domains/dashboard/v2/visualizations/distribution/box-plot.ts
web/src/domains/dashboard/v2/visualizations/distribution/box-plot.test.ts
web/src/domains/dashboard/v2/visualizations/distribution/calendar.ts
web/src/domains/dashboard/v2/visualizations/distribution/calendar.test.ts
web/src/domains/dashboard/v2/visualizations/distribution/primitives.tsx
web/src/domains/dashboard/v2/visualizations/distribution/primitives.test.tsx
web/src/domains/dashboard/v2/visualizations/distribution/summary.ts
```

### 5.3 transformation

```text
web/src/domains/dashboard/v2/transformations/core-histogram.ts
web/src/domains/dashboard/v2/transformations/core-histogram.test.ts
web/src/domains/dashboard/v2/transformations/catalog.ts
```

### 5.4 renderer

```text
core-histogram/{definition.ts,renderer.lazy.tsx,renderer.test.tsx}
core-heatmap/{definition.ts,renderer.lazy.tsx,renderer.test.tsx}
core-box-plot/{definition.ts,renderer.lazy.tsx,renderer.test.tsx}
core-calendar-heatmap/{definition.ts,renderer.lazy.tsx,renderer.test.tsx}
```

全てVisualization directory配下。Backend Gallery、catalog、E2E、visual、a11y、performance、bundle budget、
README、LLM_CONTEXT、progressも更新する。

### 5.5 対象外

- violin / ridgeline / beeswarm。
- kernel density estimation。
- arbitrary statistical expression。
- server query自動生成。
- geospatial heatmap。
- streaming incremental bins。
- cross-panel brush/selection。
- user localeによる週開始日の自動変更。

## 6. Shared contracts

### 6.1 reserved type

`core.box-plot`をreserved Visualization IDへ追加する。既存ID順を変えずHistogram/Heatmap付近へ追加し、
duplicate/reserved fixtureを更新する。

### 6.2 config versions

全4 familyをversion 1とする。schemaはstrict、unknown key拒否、defaultOptions全parse。

```ts
type ScaleConfig = {
  mode: "linear" | "log" | "symlog";
  min: "auto" | number;
  max: "auto" | number;
};

type ColorScaleConfig = {
  mode: "sequential" | "diverging" | "status";
  domain: "auto" | { min: number; max: number; center?: number };
  steps: number;
  emptyColorToken: string;
};
```

- logは0以下拒否。
- symlog constantは固定1。任意設定を追加しない。
- steps 3..9。
- divergingはmin<center<max。
- token schema通過必須。

## 7. Histogram transformation contract

```ts
type HistogramTransformationConfigV1 = {
  valueFieldKey?: string;
  seriesFieldKey?: string;
  binning:
    | { mode: "fixed-count"; count: number }
    | { mode: "fixed-width"; width: number; origin?: number }
    | { mode: "sturges" }
    | { mode: "freedman-diaconis"; fallbackCount: number };
  range: "data" | { min: number; max: number };
  includeOutOfRange: boolean;
};
```

Input `distribution` raw value、output `distribution` bin-start/bin-end/count。browserCapable=true、
serverCapable=false。業務handlerがpre-binned Frameを返す場合はtransformation不要。

Rules:

- raw values最大2,000、series最大12、bins 2..100。
- null除外、non-finiteはFrame schemaでreject済み。
- boundaryは左閉右開、最終binだけ右端を含む。
- min=maxは中心を含む1幅rangeへ展開。
- fixed widthはpositive finite。
- Freedman–DiaconisでIQR=0ならfallbackCount。
- out-of-rangeはdropせずreject、または明示overflow bins。
- count合計は採用raw values件数と一致。
- transformationは常にraw countを出力し、density/probabilityはHistogram modelが導出する。
- input orderに依存せずdeterministic。

Renderer内でraw binningを行わない。raw inputでtransformation未指定ならincompatibleとする。

## 8. Histogram config / model

```ts
type HistogramConfigV1 = {
  showLegend: boolean;
  showGrid: boolean;
  showBinLabels: boolean;
  orientation: "vertical" | "horizontal";
  normalization: "count" | "density" | "probability";
  cumulativeMode: "count" | "probability";
  stackMode: "none" | "stack" | "percent";
  xScale: ScaleConfig;
  referenceLines: Array<{ value: number; label?: string; colorToken: string }>;
};
```

Model validates contiguous non-overlapping bins per series。gapは許可するが明示zero binへ暗黙補完しない。
stackedは全seriesで同じbin boundaries必須。cumulativeはbin順で計算し、inputを暗黙sortせずunsortedをreject。

Preset semantics:

- count: normalization=count。
- density: normalization=density。
- cumulative: cumulative line + bar、ComposedChart。
- stacked: stack/percent option、最大12 series。
- horizontal: count/densityを横向き表示。

## 9. Matrix / color scale model

```ts
type MatrixCell = {
  xKey: string;
  yKey: string;
  xLabel: string;
  yLabel: string;
  value: number | null;
  state?: "healthy" | "warning" | "critical" | "unknown";
  colorToken: string;
};
```

- x/y identityはtyped primitive + formatted labelを分ける。
- duplicate coordinate拒否。
- missing cellとexplicit nullとzeroを区別。
- domain autoはfinite non-null値。
- all same valueでは中間stepを使う。
- sequentialは低→高、divergingはcenterを境界、statusは07 semantic state。
- raw hex/rgb interpolation禁止。既存token paletteの離散stepを使う。
- legendはstep境界とmin/max/centerを表示。

## 10. Heatmap config / presets

```ts
type HeatmapConfigV1 = {
  xFieldKey?: string;
  yFieldKey?: string;
  valueFieldKey?: string;
  colorScale: ColorScaleConfig;
  showLegend: boolean;
  showCellValues: boolean;
  cellGap: number;
  xSort: "input" | "asc" | "desc";
  ySort: "input" | "asc" | "desc";
  missing: "gap" | "empty-token";
};
```

Preset:

- matrix: generic x/y/value。
- time-bucket: x=time bucket、y=bin/category。timezone formatter必須。
- density: matrix count、sequential scale。
- diverging: center必須、負/正token。
- annotated: cell値常時表示、最大400 cells。

General limitは2,000 cells、x最大100、y最大100。annotatedだけ400。native SVG grid + HTML legend。
cellはtab stopにせずkeyboard Tableを提供する。

## 11. Box Plot model

Input mode:

1. summary: min/q1/median/q3/max roles。
2. raw: distribution value + optional category/series。modelがquartileを計算。

```ts
type BoxDatum = {
  id: string;
  category: string;
  series?: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  whiskerLow: number;
  whiskerHigh: number;
  outliers: number[];
  count?: number;
};
```

Quartile algorithmはR-7 linear interpolationへ固定する。whiskerはTukey 1.5×IQR。summary inputのmin/maxは
whisker endpointとみなしoutlierなし。raw modeだけoutlierを導出する。

Validation:

- min<=q1<=median<=q3<=max。
- raw group最低2 values、最大2,000 total。
- category最大40、series最大8、boxes最大80。
- outlier最大200/panel。超過はtruncateせずincompatible。
- duplicate summary category+series拒否。
- same category内seriesはsame unit。

## 12. Box Plot config / presets

```ts
type BoxPlotConfigV1 = {
  orientation: "vertical" | "horizontal";
  inputMode: "summary" | "raw";
  showOutliers: boolean;
  showAllPoints: boolean;
  showMean: boolean;
  showGrid: boolean;
  valueScale: ScaleConfig;
  pointJitter: number;
};
```

- jitter 0..0.4、stable hashで位置決定。random禁止。
- box-and-pointsのall pointsは最大500。
- meanはraw modeのみ。summaryから推論しない。
- range-summaryはq1/q3 boxを簡略化しmin/median/maxを強調。
- Recharts ComposedChart + custom shape。Tooltip/axis/formatterは05を再利用。

## 13. Calendar model

Input:

- numeric: timeseries time+value。
- status: table time+state、またはtime+value with thresholds。

```ts
type CalendarCell = {
  dateKey: string;
  startUtc: number;
  value: number | null;
  state?: KpiSemanticState;
  weekIndex: number;
  weekdayIndex: number;
  inRange: boolean;
};
```

Rules:

- timezoneでlocal date keyを作る。同じUTC instantでもtimezoneで日付が変わり得る。
- week startは`monday`または`sunday`をconfigで明示。locale推論しない。
- duplicate dateはaggregationなしにreject。
- missing day、null、zeroを区別。
- leap day/DSTをdate key基準で扱い、24h加算で翌日を作らない。
- yearは366 cells、rolling最大104 weeks、month最大42 cells。
- future dateはconfigでhideまたはempty。

## 14. Calendar config / presets

```ts
type CalendarHeatmapConfigV1 = {
  range: { mode: "year"; year: number } | { mode: "month"; year: number; month: number }
    | { mode: "rolling-weeks"; weeks: number };
  weekStartsOn: "monday" | "sunday";
  colorScale: ColorScaleConfig;
  showMonthLabels: boolean;
  showWeekdayLabels: boolean;
  showCellValues: boolean;
  future: "hide" | "empty";
};
```

- year: 1 calendar year。
- month: month grid、最大42 cells、value label可。
- rolling-weeks: 4..104 weeks。
- weekday-profile: 直近52週を曜日比較し、週columnを維持。
- status-calendar: state palette、numeric thresholdまたはstate mapping。

native SVG、decorative cell focusなし、Tableにdate/value/stateを表示する。

## 15. Tooltip / Legend / Table

- Histogram Tooltip: interval、count/density/probability、series、cumulative。
- Heatmap: x/y/raw value/missing state。
- Box Plot: five-number、IQR、whisker、count、outlier。
- Calendar: localized date、raw value/state。
- hoverだけに依存せずTable toggleとsummaryを提供。
- Legendはkeyboard operable。series hideはHistogram/Box groupedだけ。
- color scale Legendはbuttonにせず読み取り専用scaleとしてaccessible textを持つ。

Table derived columns:

```text
Histogram: Bin start / Bin end / Count / Density / Probability / Cumulative / Series
Heatmap: X / Y / Value / State / Missing
Box: Category / Series / Min / Q1 / Median / Q3 / Max / IQR / Outlier count
Calendar: Date / Week / Weekday / Value / State / Missing
```

raw Frame表示も維持する。

## 16. Accessibility / responsive

- Recharts rendererは`accessibilityLayer`。
- native SVG gridは`aria-hidden`、Panel summary + Tableを代替。
- cell/pointを大量tab stopにしない。
- color scaleだけで値/stateを伝えない。
- diverging/statusはtext legend必須。
- summary最大1,000文字。
- forced-colorsではpattern/outline/labelを使う。
- 200% zoom、reduced motion、keyboard Tableを検証。

Mobile:

- Histogramは横scroll禁止、bin label間引き。
- Heatmapはx/y上限をresponsiveでtruncateせずsummaryへ切替。
- Box Plot groupedはhorizontal summary list。
- Calendar yearはcellを縮小しすぎずrolling 16 weeks summaryへ切替可能。
- mobileで8px未満text禁止。

## 17. Limits / performance / security

| Model | Hard limit |
| --- | ---: |
| Raw distribution values | 2,000 |
| Histogram bins | 100 |
| Histogram series | 12 |
| Heatmap cells | 2,000 |
| Annotated heatmap | 400 |
| Box categories / series / boxes | 40 / 8 / 80 |
| Box all points / outliers | 500 / 200 |
| Calendar cells | 728 |

- model build 100ms Long Taskなし。
- native SVG DOM 2,500 nodes未満。
- resizeでbin/quartile/calendar modelを再計算しない。
- random/jitter nondeterminismなし。
- raw HTML/SVG injectionなし、token colorのみ。
- Tooltip/errorへraw dataset全件を含めない。
- limit超過はtruncateせずincompatible。

## 18. Lazy load / bundle

```text
core-histogram/renderer.lazy.tsx       -> Recharts allowed
core-heatmap/renderer.lazy.tsx         -> Recharts forbidden
core-box-plot/renderer.lazy.tsx        -> Recharts allowed
core-calendar-heatmap/renderer.lazy.tsx-> Recharts forbidden
```

- initial/Dashboard shell/Gallery shellにstatic rendererなし。
- transformation catalogはrendererをimportしない。
- Heatmap/Calendar graphからRecharts edge 0。
- 4 renderer + histogram transformationへbudget/evidence row。
- runtime dependency diff 0。

## 19. Gallery success cases

| Case ID | Type/Preset | 必須確認 |
| --- | --- | --- |
| `hist-count` | histogram/count | fixed bins |
| `hist-density` | histogram/density | area=1 |
| `hist-cumulative` | histogram/cumulative | monotonic |
| `hist-stacked` | histogram/stacked | aligned bins |
| `hist-horizontal` | histogram/horizontal | labels |
| `heatmap-matrix` | heatmap/matrix | missing/zero |
| `heatmap-time` | heatmap/time-bucket | timezone |
| `heatmap-density` | heatmap/density | counts |
| `heatmap-diverging` | heatmap/diverging | center |
| `heatmap-annotated` | heatmap/annotated | cell values |
| `box-vertical` | box-plot/vertical | five-number |
| `box-horizontal` | box-plot/horizontal | long labels |
| `box-grouped` | box-plot/grouped | multi-series |
| `box-points` | box-plot/box-and-points | stable jitter |
| `box-range` | box-plot/range-summary | compact |
| `calendar-year` | calendar-heatmap/year | leap/date labels |
| `calendar-month` | calendar-heatmap/month | 42-cell layout |
| `calendar-rolling` | calendar-heatmap/rolling-weeks | 16 weeks |
| `calendar-weekday` | calendar-heatmap/weekday-profile | weekday trend |
| `calendar-status` | calendar-heatmap/status-calendar | semantic state |

fixed data/timezone、no random、token colors、Table enabled。05〜07 casesを削除しない。

Invalid fixtures:

- bins overlap/unsorted/gap ambiguity、101 bins、13 series。
- raw 2,001、fixed width 0、density area mismatch。
- duplicate matrix coordinate、2,001/401 annotated cells。
- invalid color domain/center/log zero。
- five-number order violation、81 boxes、201 outliers、501 all points。
- duplicate calendar date、invalid leap date、105 weeks、timezone invalid。
- unknown option、raw color。

## 20. Backend / Frontend boundary

Backend:

- shared definitions、reserved type、Gallery Frame、shape/limit validation。
- production handlerはDB-side aggregation/pre-binningを推奨。
- common BackendはSQL、business bucket、timezone calendarを生成しない。
- `core.histogram` transformationは初期08ではbrowser only。

Frontend:

- browser histogram transformation、color scale、quartile、calendar layout。
- renderer JSXへbinning、quartile、domain、date iterationを書かない。
- pre-binned Frameは再binningしない。

## 21. S0〜S13 Work Packages

| WP | 内容 | 完了gate |
| --- | --- | --- |
| S0 | baseline / capability audit | 07 K12、58 presets |
| S1 | shared configs / reserved type | schema tests |
| S2 | color scale / matrix common | pure tests |
| S3 | histogram transformation / bin model | algorithm tests |
| S4 | Histogram 5 presets | Gallery 5 |
| S5 | Heatmap matrix/time/density | Gallery 3 |
| S6 | Heatmap diverging/annotated | Gallery 2 |
| S7 | quartile/outlier Box model | statistical tests |
| S8 | Box Plot 5 presets | Gallery 5 |
| S9 | Calendar model / 5 presets | timezone tests + Gallery 5 |
| S10 | Table/summary/a11y integration | component tests |
| S11 | 20-preset Gallery conformance | exact 78 presets |
| S12 | visual/a11y/performance/bundle | expanded gates |
| S13 | full verify/docs/handoff | full gates/progress |

## 22. S0: Baseline

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

Record: 07 status、58 preset、Gallery count、Recharts version、renderer/transform graph、bundle、coverage、
visual count、D11 baseline、concurrent changes。

## 23. S1〜S3: Shared/model foundation

### S1

- `core.box-plot` reservation。
- 4 configs / 20 descriptors/defaults。
- histogram transformation config/descriptor。
- strict/boundary/round-trip tests。

```bash
bunx vitest run shared/schemas/dashboard/distribution-visualizations.schema.test.ts shared/schemas/dashboard/histogram-transformation.schema.test.ts shared/schemas/dashboard.schema.test.ts
bun run typecheck
```

### S2

- typed x/y identity、duplicate detection。
- sequential/diverging/status token scale。
- missing/null/zero/all-same domain。
- legend boundaries。

### S3

- fixed count/width、Sturges、Freedman–Diaconis。
- boundary inclusivity、IQR zero fallback、overflow bins。
- count conservation、density area、multi-series aligned bins。
- browser transformation registration。

```bash
bunx vitest run web/src/domains/dashboard/v2/visualizations/distribution web/src/domains/dashboard/v2/transformations/core-histogram.test.ts
bun run verify:dashboard-frontend-coverage
git diff --check
```

## 24. S4〜S9: Renderer packages

各WPでdefinition、loader、renderer/model、summary、Table、unit/component test、Galleryを同時に追加する。

| WP | 必須boundary |
| --- | --- |
| S4 Histogram | 100/101 bins、12/13 series、cumulative monotonic、density tolerance |
| S5 Heatmap base | duplicate、missing/null/zero、2,000/2,001 cells、timezone axis |
| S6 Heatmap advanced | diverging center、annotated 400/401、status colors |
| S7 Box model | R-7 quartile、IQR=0、Tukey whisker、stable outlier |
| S8 Box renderer | 80/81 boxes、500/501 points、200/201 outliers、mixed unit |
| S9 Calendar | leap day、DST、week start、duplicate date、104/105 weeks |

Focused gate:

```bash
bunx vitest run web/src/domains/dashboard/v2/visualizations/<family>
bun run verify:dashboard-gallery
E2E_PORT=5175 bun run verify:dashboard-e2e -- --grep "<family>"
bun run verify:dashboard-bundle
git diff --check
```

## 25. S10: Table / summary / accessibility

- derived/raw Table columns。
- Tooltip formatting parity。
- color legend text。
- max 1,000 char summaries。
- missing/null/zero/outlier wording。
- keyboard Table、no mass tabs、forced-colors、200% zoom。
- mobile summary strategies。

## 26. S11: Gallery conformance

- 4 new types、20 exact presets、cumulative 78。
- all defaults parse、every preset deterministic success case。
- all loaders dynamic、Table enabled、summary non-empty。
- histogram transformation catalog/descriptor一致。
- 05〜07 cases維持。
- family ready、chart/table toggle、console error 0。

```bash
bun run verify:dashboard-contract
bun run verify:dashboard-coverage
bun run verify:dashboard-frontend-coverage
bun run verify:dashboard-gallery
E2E_PORT=5175 bun run verify:dashboard-e2e
git diff --check
```

## 27. S12: Quality gate

Visual minimum:

```text
gallery-distribution-desktop.png
gallery-heatmap-desktop.png
gallery-calendar-mobile.png
panel-histogram-stacked.png
panel-histogram-cumulative.png
panel-heatmap-diverging.png
panel-box-points.png
panel-calendar-year.png
panel-calendar-status.png
```

Accessibility: axe、legend、Table、forced-colors、zoom、reduced motion。
Performance: upper bounds、100ms、DOM nodes、memoization、no random。
Bundle: 4 entries、2 Recharts allowed/2 forbidden、transformation boundary、dependency diff 0。

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

## 28. S13: Full verification / handoff

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

Docs: catalog、binning algorithm、color scale、quartile algorithm、timezone/week rules、limits、bundle boundary、
README、LLM_CONTEXT、progress、D11 handoff。

```text
08 status: complete
New renderer types: 4
New presets: 20
Cumulative presets: 78
New browser transformations: 1
New runtime dependencies: 0
Next: 09 T0
```

## 29. Coverage / failure handling

Focused coverageへbinning、color scale、matrix、quartile/outlier、calendar、summary、definitions、rendererを含める。
thresholdはstatements/lines/functions 80%、branches 70%。

| Failure | 戻るWP |
| --- | --- |
| config/reservation | S1 |
| color/matrix | S2 |
| bin/transformation | S3 |
| Histogram | S4 |
| Heatmap | S5/S6 |
| Box model/renderer | S7/S8 |
| Calendar | S9 |
| Table/a11y | S10 |
| Gallery | S11 |
| visual/a11y/perf/bundle | S12または原因WP |
| full gate | 原因WP、S13 complete禁止 |

## 30. Stop条件

停止する:

- 07 K12未完了。
- R-7/bin algorithmを共有contractとして固定できない。
- timezone date keyを既存runtimeから取得不能。
- token paletteでsequential/diverging/statusを区別不能。
- Recharts custom shapeでBox semanticsを安全に表現不能。
- Table/a11y contractを弱める必要。
- concurrent変更と安全にmerge不能。

停止しない: algorithm test増加、SVG調整、visual baseline、label collision、coverage不足、mobile再調整、
bundle chunk共有。

## 31. 完了条件

- [x] 07 K0〜K12 complete。
- [x] S0〜S13 complete。
- [x] new types 4 / presets 20 / cumulative 78。
- [x] core.box-plot reserved。
- [x] core.histogram browser transformation。
- [x] fixed/Sturges/Freedman–Diaconis binning。
- [x] sequential/diverging/status scale。
- [x] missing/null/zero区別。
- [x] R-7 quartile / Tukey outlier。
- [x] timezone/leap/DST/week-start rules。
- [x] Histogram 5、Heatmap 5、Box Plot 5、Calendar 5。
- [x] 20 Gallery success + invalid fixtures。
- [x] Tooltip/Legend/Table/summary/mobile。
- [x] visual/a11y/performance/bundle/coverage/full verify pass。
- [x] Heatmap/Calendar Recharts edge 0。
- [x] runtime dependency 0。
- [x] progress/docs updated。

## 32. 次計画へ渡す成果

```text
Distribution: deterministic bins, histogram models, quartile/outlier model
Matrix: typed coordinates, missing/null/zero, token color scale
Calendar: timezone date keys, week layout, numeric/status cells
Rendering: Recharts Histogram/Box, native SVG Heatmap/Calendar
```

09 P6は[09: State Timeline・Status History・Uptime Grid・Annotations](./09-state-timeline-status-annotations.md)
として状態系を追加する。08のmatrix、calendar、semantic
state、missing-cell modelを再利用してよい。annotation storageとcross-panel interactionは09で定義する。

## 33. 再開手順

1. 00 P5を読む。
2. 07 K12 completeを確認。
3. progressの08節を読む。
4. branch/statusを確認。
5. current `in_progress` Sを確認。
6. 最後の成功commandを再実行。
7. 最初のpending Sだけを開始。
8. contract/model/renderer/Gallery/testを同packageで完成。
9. S13後、09 T0へhandoff。
