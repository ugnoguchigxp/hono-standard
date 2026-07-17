# 10: Specialized Observability Visualization 実装計画

## 1. 文書の位置づけ

この文書は[00: コンセプト](./00-concept.md)のP7を、Lunaが最後まで実装できる粒度へ分解した正本である。
09までの汎用時系列、構成、KPI、分布、状態可視化に対し、10は運用調査で対象データの構造自体が
異なる専門Visualizationを追加する。

対象:

- Node Graph
- Candlestick / OHLC
- Logs
- Trace
- Flame Graph
- Geomap

予約済みだが未実装のrenderer type 6へ各5 preset、合計30 presetを追加する。09完了時の96 presetへ追加し、
catalog全体を126 presetへ増やす。名前だけ異なるpresetを数えず、入力契約、layout、mark、比較軸、要約の
いずれかが明確に異なるものだけを登録する。

### 1.1 開始条件

- 01〜03 complete、04 D0〜D10 complete。
- 05〜08 complete。
- [09](./09-state-timeline-status-annotations.md) T0〜T13 complete。
- cumulative 96 preset、annotation layer、state/severity token、time range modelがgreen。
- 09完了後のcontract、Gallery、bundle、coverage値が[progress.md](./progress.md)へ記録済み。

09未完了のまま、10側へannotation、severity、time clipping、Table fallback、lazy loaderを複製しない。

### 1.2 実行順

```text
08 S0〜S13 -> 09 T0〜T13 -> 10 O0〜O18
                                  |
                                  v
                    04 D11 revalidation -> D12
```

O18完了後のD11は126 preset candidateを対象とする。09完了時点の96 preset証拠はbaselineとして保持し、
10追加後のrelease evidenceとして流用しない。

### 1.3 Lunaへの完了指示

1. [progress.md](./progress.md)の09節と10節を読む。
2. 09 T13 completeを確認する。
3. 最初の`pending` O packageだけを`in_progress`にする。
4. contract、pure model、renderer、Table/summary、Gallery、testを同じpackageで完成させる。
5. placeholder renderer、空loader、未使用schemaを先行登録しない。
6. package固有gateを通し、command、件数、coverage、bundle bytesをprogressへ記録する。
7. packageを`complete`にしてから次へ進む。
8. O18後、04 D11を126 preset candidateで再検証する。

### 1.4 正本順

00 > 01 > 02 > 03 > 04 > 05 > 06 > 07 > 08 > 09 > この文書 > progress。

専門familyのpreset、入力role、上限、描画規則はこの文書を優先する。release、variant matrix、rollbackは04を
優先するが、D11対象preset数は10完了後126とする。

## 2. 目的

1. 6 renderer type、30 presetを追加する。
2. 既に予約済みの`graph-nodes`、`graph-edges`、`ohlc`、`logs`、`traces`、`profile`、`geo`を使い、
   曖昧な`table` shapeや重複shape IDを追加しない。
3. renderer JSXからlayout、tree構築、critical path、projection、windowingを分離する。
4. 同じderived modelからVisualization、Table、accessible summaryを生成する。
5. label、message、attribute、URLをuntrusted dataとして扱う。
6. upper-bound dataでもmain threadを長時間占有せず、DOM node数を制限する。
7. normal routeとDashboard shellへ専門renderer、Recharts、map assetを載せない。
8. mobileでは縮小図ではなく、調査に必要なtop list、critical path、latest rowsへ要約する。
9. deterministic fixtureとlayoutでvisual regressionを安定させる。
10. Grafanaの収集・保存・query engineを再実装せず、集計済みFrameを表示するstarter境界を守る。

## 3. 完了後のcatalog

### 3.1 core.node-graph

| Preset | 主な用途 | 見た目・意味の差 |
| --- | --- | --- |
| `service-map` | service依存関係 | service state、request rate、error edge |
| `dependency` | 一般依存graph | layered DAG、in/out degree |
| `directed` | event/flow方向 | arrow、edge label、cycle表示 |
| `grouped` | team/namespace cluster | group hullではなくtoken背景lane |
| `critical-path` | 遅延寄与経路 | longest weighted pathを強調 |

### 3.2 core.candlestick

| Preset | 主な用途 | 見た目・意味の差 |
| --- | --- | --- |
| `candles` | 標準OHLC | filled up/down candle |
| `hollow` | open/close方向比較 | up candle hollow、down filled |
| `volume` | OHLCと出来高 | price + volume二段plot |
| `range-bars` | high/low変動幅 | bodyを抑えrangeを主役にする |
| `baseline-comparison` | 基準値との差 | baseline lineとrelative delta |

金融用途に限定しない。min/max/first/lastを持つlatency bucketなども、roleを明示した場合だけ利用できる。

### 3.3 observability.logs

| Preset | 主な用途 | 見た目・意味の差 |
| --- | --- | --- |
| `stream` | 時系列log調査 | timestamp、severity、message |
| `compact` | 高密度監視 | 1行固定、message省略 |
| `severity` | level中心の確認 | severity laneとcounts |
| `structured` | 属性付きlog | allowlisted attribute columns |
| `context` | 対象行の前後確認 | focal rowとbefore/after区別 |

### 3.4 observability.trace-waterfall

| Preset | 主な用途 | 見た目・意味の差 |
| --- | --- | --- |
| `waterfall` | span時間関係 | tree + horizontal duration bar |
| `service-colored` | service横断 | service token color |
| `critical-path` | latency原因調査 | longest causal chain強調 |
| `errors-only` | error span抽出 | ancestor contextを保持して絞り込み |
| `compact` | overview | rootと上位duration spanへ要約 |

### 3.5 observability.flame-graph

| Preset | 主な用途 | 見た目・意味の差 |
| --- | --- | --- |
| `flame` | bottom-up profile | rootを下、stackを上へ積む |
| `icicle` | top-down profile | rootを上、stackを下へ積む |
| `differential` | 2 profile差分 | signed deltaのdiverging color |
| `category-colored` | module/service比較 | category token color |
| `compact` | top cost overview | depthと最小幅を強く制限 |

### 3.6 geo.map

| Preset | 主な用途 | 見た目・意味の差 |
| --- | --- | --- |
| `points` | 拠点・event位置 | fixed-size point |
| `proportional-symbol` | 地域値比較 | sqrt area scale symbol |
| `routes` | region間通信 | source/target great-circle近似 |
| `regions` | 国・地域別値 | ISO region choropleth |
| `clusters` | 高密度point | projected grid cluster |

```text
Node Graph   = 5
Candlestick  = 5
Logs         = 5
Trace        = 5
Flame Graph  = 5
Geomap       = 5
10 total     = 30
after 10     = 126 presets
```

## 4. 固定設計判断

実装中に次を再検討しない。変更が必要ならコードより先にこの文書を更新する。

1. Node Graphはanimated force simulationを使わない。
2. Node layoutは入力座標またはdeterministic layered layoutを使う。
3. Candlestickだけ既存Cartesian/Recharts lazy boundaryを再利用する。
4. Logs、Trace、Flame GraphはHTML + native SVGで描画する。
5. Geomapはlive tile、Mapbox、MapLibre、Leafletを使わない。
6. Geomapはbundled low-resolution world outlineとequirectangular projectionを使う。
7. 新しいruntime dependencyを追加しない。
8. arbitrary GeoJSON、HTML、Markdown、ANSI escapeを描画しない。
9. Logsはplain textのみ。`dangerouslySetInnerHTML`を禁止する。
10. Trace/Flameのtreeをrenderer内で再帰構築しない。
11. profile、trace、graphのcycleは暗黙修復しない。
12. server common layerはgraph layout、critical path、projectionを行わない。
13. query language、data source、storage、stream transportを追加しない。
14. every presetにTable、summary、mobile fallbackを必須とする。
15. all animationはdefault off。reduced-motionで挙動差を作らない。
16. P8のVisualization picker/Panel editorを10へ前倒ししない。
17. 6 type全て`loadPolicy: "viewport"`とし、Panelがviewportへ入る前にrenderer chunkをimportしない。

### 4.1 Repositoryに既にある境界

Lunaは次を新規設計せず、現在の実装を拡張する。

- `data-frame.schema.ts`: 7 specialized shape IDとminimum validator。
- `field-config.schema.ts`: OHLC、trace、profile、geoを含む既存role群とtype compatibility。
- `visualization.schema.ts`: 6 specialized visualization type IDのreservation。
- `core-sankey`: `graph-nodes` + `graph-edges`の2 Frame bindingと`validateFrames` pattern。
- `FrontendVisualizationRegistry`: presetを受ける`validateFrames` / `validateResolvedFrames` hook。
- Gallery: category tab、keyboard操作、`visibleManifest`による選択categoryだけのquery実行。
- common limits: 2,000 rows/frame、8,192 characters/cell、64 fields、100,000 cells/frame。
- PanelShell: loading、retry、stale、Table toggle、summary、lazy renderer boundary。

O0で上記が変わっていた場合は実コードを正として差分をprogressへ記録し、文書を更新してからO1へ進む。

## 5. Data shapeとFrame binding

### 5.1 既存予約shapeを完成させる

```text
graph-nodes
graph-edges
ohlc
logs
traces
profile
geo
```

これら7 shape IDは`shared/schemas/dashboard/data-frame.schema.ts`へ既に予約され、minimum validatorも存在する。
O1では新しいshape文字列を追加せず、既存validatorをpreset要件まで強化する。既存Frame fixtureがparseできる
backward compatibility testを先に固定し、追加制約のうちpreset固有のものはdefinitionの`validateFrames`へ置く。

追加するfield roleは次の9個だけとする。

```text
label
service
operation
baseline
region-id
source-latitude
source-longitude
target-latitude
target-longitude
```

全roleは`field-config.schema.ts`と`data-frame.schema.ts`の`roleTypes`を同時更新する。`label`、`service`、
`operation`、`region-id`はstring限定、`baseline`と緯度経度4個はnumber限定。roleだけ予約して
shape/definitionから参照しない状態を禁止する。

### 5.2 Node Graph

2 Frameを使う。

```text
Frame A nodes:
  id(required string, unique; role id)
  label(optional string; absentならid)
  category(optional string)
  state(optional string)
  value(optional finite number)
  x/y(optional finite pair; one-sidedは禁止)
  url(optional safe link field)

Frame B edges:
  source-node-id(required string; role source)
  target-node-id(required string; role target)
  value(optional finite non-negative number)
  state(optional string)
  label(optional string)
```

edge endpointは必ずFrame Aに存在する。self-loopは`directed`だけ許可し、ほかはvalidation error。duplicate edgeは
`source + target + label`で拒否する。multi-edgeを暗黙集約しない。

### 5.3 OHLC

1 Frame、1 row = 1 bucket。shapeHintは既存`ohlc`を使う。

```text
time(required, unique, ascending)
open(required finite)
high(required finite)
low(required finite)
close(required finite)
volume(optional finite >= 0)
baseline(optional finite, role baseline)
series(optional string; max 4, volume presetは1)
```

`low <= min(open, close) <= max(open, close) <= high`を全rowで要求する。duplicate time、NaN、Infinity、
negative volumeを拒否する。市場休日などのgapは詰めず、time scale上のgapとして保持する。

open/high/low/closeとbaselineのeffective unitはkindと全parameterが一致しなければならない。volumeだけは別unitを
許可する。unit互換性はField Config/override解決後に`validateResolvedFrames`で判定する。series field指定時は
最大4値、同一series内でtime unique、volume presetはseries 1件だけを許可する。

### 5.4 Logs

```text
time(required, ascending; duplicate可、stable row order必須)
message(required string)
severity(optional semantic severity)
id(optional unique string)
service/category/trace-id/span-id(optional string)
context(optional state role: before | focal | after)
attribute columns(optional scalar, max 12)
```

object値やJSON blobをfield valueへ追加しない。Structured presetは明示field columnだけを表示する。messageは
plain textとして扱い、制御文字を表示用modelで置換する。

### 5.5 Trace

```text
trace-id(required string)
span-id(required unique within trace-id)
parent-span-id(optional string; rootはnull)
operation(required string)
service(required string)
start-time(required)
duration(required finite > 0)
end-time(optional; 指定時はstart + durationと1ms以内で一致)
state/severity(optional)
attributes(optional scalar columns, max 12)
url(optional same-origin data link)
```

parentは同じtrace内に存在しなければならない。cycleとorphanはerror。1 traceに複数rootがあるpartial traceは
許可し、model内だけにsynthetic display rootを作ってnoticeを返す。childがparent interval外にある場合も
clock-skew noticeとして保持し、raw timeを補正しない。trace envelopeは全spanのmin(start)〜max(end)で求める。

### 5.6 Profile tree

```text
frame-id(required unique string, role id)
parent-frame-id(optional string, role parent-id)
label(required string)
total(required finite >= 0)
self(optional finite >= 0)
delta(optional finite; differentialのみrequired)
category(optional string)
```

cycle/orphanを拒否する。rootは1件以上を許可し、複数rootではmodel内だけにsynthetic `All` rootを作る。
synthetic rootはTableへ出さず、summaryへroot件数を表示する。親`total`は子`total`合計以上を要求し、
floating toleranceは`max(1e-6, abs(parent) * 1e-6)`とする。`self`指定時は
`total - children sum`とtolerance内で一致する。

### 5.7 Geo

presetごとに同じFrameを異なるroleで読む。

```text
points/symbol/clusters:
  latitude(required -90..90)
  longitude(required -180..180)
  label(optional string)
  value(optional finite)
  category/state(optional string)

routes:
  source-latitude/source-longitude(required)
  target-latitude/target-longitude(required)
  value(optional finite >= 0)
  label/category/state(optional)

regions:
  region-id(required ISO 3166-1 alpha-2, unique)
  value(required finite)
  label/state(optional)
```

既存`geo` minimum validatorはpoint用latitude/longitudeだけを受ける。O1で、point pair、route 4-role set、
region-id+valueのいずれかを受けるunion validatorへ拡張する。presetごとのexact role setはdefinitionの
`validateFrames(frames, config, preset)`で検証する。

arbitrary polygon、GeoJSON URL、remote tile URLはwireへ追加しない。未知region-idはnotice付きskipではなく、
Frame incompatibilityとして明示する。

## 6. Shared contract

### 6.1 対象file

```text
shared/schemas/dashboard/data-frame.schema.ts
shared/schemas/dashboard/visualization.schema.ts
shared/schemas/dashboard/manifest-v2.schema.ts
shared/schemas/dashboard/specialized-visualizations.schema.ts
shared/schemas/dashboard/specialized-visualizations.schema.test.ts
shared/schemas/dashboard/index.ts
```

### 6.2 Definition

各typeは既存`VisualizationDefinition` contractを使い、次を持つ。

- strict config schema。
- descriptor version。
- exact 5 preset IDs。
- default preset。
- supported shape。
- minimum/recommended size。
- capabilities: tooltip、legend、table、summary、links、annotations。
- lazy loader。
- preset strategy map。

definitions、defaults、Frontend catalog、Backend Galleryのtype/preset文字列は同じshared exportから導出する。
重複した文字列配列を4箇所へ作らない。

既存`RESERVED_VISUALIZATION_TYPE_IDS`を変更せず、次のexact IDを使う。

| Type ID | category | supportedShapes | default preset | min | recommended |
| --- | --- | --- | --- | --- | --- |
| `core.node-graph` | `relationship` | `graph-nodes`, `graph-edges` | `service-map` | 6x5 | 10x6 |
| `core.candlestick` | `time` | `ohlc` | `candles` | 5x4 | 8x5 |
| `observability.logs` | `observability` | `logs` | `stream` | 5x4 | 8x6 |
| `observability.trace-waterfall` | `observability` | `traces` | `waterfall` | 7x5 | 12x6 |
| `observability.flame-graph` | `observability` | `profile` | `flame` | 6x5 | 10x6 |
| `geo.map` | `relationship` | `geo` | `points` | 6x5 | 10x6 |

`core.logs`、`core.trace`、`core.flame-graph`、`core.geomap`などのaliasを追加しない。reserved type、shared
contract、Frontend definition、Gallery caseのIDが1文字でも違えばO1をcompleteにしない。

Capabilitiesは次で固定する。

| Type | legend | tooltip | annotations | fieldOverrides | table/exportData/mobileSummary |
| --- | --- | --- | --- | --- | --- |
| Node Graph | true | true | false | true | true |
| Candlestick | true | true | true | true | true |
| Logs | true | true | true | true | true |
| Trace | true | true | true | true | true |
| Flame Graph | true | true | false | true | true |
| Geomap | true | true | false | true | true |

全typeで`sharedCrosshair=false`、`zoom=false`、`rangeSelection=false`、`exportImage=false`とする。これらは
P8/P9で実装と同時にcapabilityを変更する。capabilityだけを先にtrueにしない。

Validation hookの責務:

- `validateDashboardDataFrameShape`: 1 Frame内で判定できるminimum role/type set。
- `validateFrames(frames, config, preset)`: preset exact role、row invariant、graph/tree relation、family limits。
- `validateResolvedFrames(frames, config, preset, spec)`: effective Field Config/overrideが必要なunit互換性。
- renderer/model: 上記を通過したFrameを受けるが、防御的errorをthrowしてError Boundaryへ渡す。

Trace duration unit、OHLC effective unit、Geomap value scaleなどをrenderer内だけで初めて判定しない。

### 6.3 Config概略

```ts
type NodeGraphConfig = {
  orientation: "left-right" | "top-bottom";
  nodeSize: "compact" | "normal";
  edgeScale: "fixed" | "value";
  showEdgeLabels: boolean;
  maxLabelLength: number;
};

type CandlestickConfig = {
  yDomain: "auto" | "zero" | "config";
  candleGapRatio: number;
  showWicks: boolean;
  baseline?: number;
};

type LogsConfig = {
  order: "ascending" | "descending";
  wrap: boolean;
  showTimestamp: boolean;
  showAttributes: boolean;
  attributeFields: string[];
  maxMessageCharacters: number;
};

type TraceConfig = {
  order: "tree" | "start-time" | "duration";
  showService: boolean;
  showIdle: boolean;
  minDurationPercent: number;
  attributeFields: string[];
};

type FlameGraphConfig = {
  minVisibleWidthPx: number;
  maxDepth: number;
};

type GeomapConfig = {
  clusterCellPx: number;
  showOutline: boolean;
};
```

presetが意味を固定するmark、direction、color modeはconfig schemaへ入れない。parse後にexact preset strategyを解決し、
未知keyを拒否する。

Schema bounds:

- `maxLabelLength`: 8..256。
- `candleGapRatio`: 0..0.8。
- `attributeFields`: unique field key、max 12。
- `maxMessageCharacters`: 80..8,192。
- `minDurationPercent`: 0..100。
- `minVisibleWidthPx`: 1..20。
- `maxDepth`: 1..128。
- `clusterCellPx`: 16..96。

### 6.3.1 Exact defaultOptionsByPreset

Node Graph:

```text
service-map:  orientation=left-right, nodeSize=normal,  edgeScale=value, showEdgeLabels=false, maxLabelLength=48
dependency:   orientation=left-right, nodeSize=normal,  edgeScale=fixed, showEdgeLabels=false, maxLabelLength=48
directed:     orientation=left-right, nodeSize=compact, edgeScale=fixed, showEdgeLabels=true,  maxLabelLength=40
grouped:      orientation=top-bottom, nodeSize=normal,  edgeScale=value, showEdgeLabels=false, maxLabelLength=44
critical-path:orientation=left-right, nodeSize=normal,  edgeScale=value, showEdgeLabels=false, maxLabelLength=48
```

Node preset strategy:

```text
service-map:   node state + request/error edge semantics
dependency:    layered dependency DAG/SCC
directed:      arrow + self-loop + edge label
grouped:       category lane background
critical-path: weighted critical path highlight
```

Candlestick:

```text
candles:             yDomain=auto, candleGapRatio=0.20, showWicks=true
hollow:              yDomain=auto, candleGapRatio=0.25, showWicks=true
volume:              yDomain=auto, candleGapRatio=0.20, showWicks=true
range-bars:          yDomain=auto, candleGapRatio=0.35, showWicks=true
baseline-comparison: yDomain=auto, candleGapRatio=0.20, showWicks=true, baseline=(omitted)
```

Candlestick preset strategy:

```text
candles:             mark=candle, body=filled, volume=false, baseline=false
hollow:              mark=candle, body=hollow-up, volume=false, baseline=false
volume:              mark=candle, body=filled, volume=true, baseline=false
range-bars:          mark=range-bar, body=ticks, volume=false, baseline=false
baseline-comparison: mark=candle, body=filled, volume=false, baseline=true
```

`volume`はvolume role必須。ほかのpresetでvolume fieldが存在してもTableへ残し、price plotへ描画しない。
`baseline-comparison`はbaseline role、config baseline、最初のcloseの順で解決するためbaseline field自体はoptional。

Logs:

```text
stream:     order=ascending,  wrap=true,  showTimestamp=true, showAttributes=false, attributeFields=[], maxMessageCharacters=2000
compact:    order=descending, wrap=false, showTimestamp=true, showAttributes=false, attributeFields=[], maxMessageCharacters=240
severity:   order=descending, wrap=false, showTimestamp=true, showAttributes=false, attributeFields=[], maxMessageCharacters=1000
structured: order=descending, wrap=false, showTimestamp=true, showAttributes=true,  attributeFields=[], maxMessageCharacters=1000
context:    order=ascending,  wrap=true,  showTimestamp=true, showAttributes=true,  attributeFields=[], maxMessageCharacters=2000
```

`attributeFields=[]`はarbitrary field自動選択ではなく、service/category/trace-id/span-idのsemantic roleだけを表示する。

Trace:

```text
waterfall:       order=tree,      showService=true, showIdle=false, minDurationPercent=0.05, attributeFields=[]
service-colored: order=tree,      showService=true, showIdle=false, minDurationPercent=0.05, attributeFields=[]
critical-path:   order=tree,      showService=true, showIdle=false, minDurationPercent=0.05, attributeFields=[]
errors-only:     order=tree,      showService=true, showIdle=false, minDurationPercent=0,    attributeFields=[]
compact:         order=duration,  showService=true, showIdle=false, minDurationPercent=0.50, attributeFields=[]
```

Flame Graph:

```text
flame:            minVisibleWidthPx=2, maxDepth=64
icicle:           minVisibleWidthPx=2, maxDepth=64
differential:     minVisibleWidthPx=2, maxDepth=64
category-colored: minVisibleWidthPx=2, maxDepth=64
compact:          minVisibleWidthPx=4, maxDepth=16
```

Flame preset strategy:

```text
flame:            direction=flame,  colorBy=value
icicle:           direction=icicle, colorBy=value
differential:     direction=flame,  colorBy=delta
category-colored: direction=flame,  colorBy=category
compact:          direction=flame,  colorBy=value
```

Geomap:

```text
points:              clusterCellPx=32, showOutline=true
proportional-symbol: clusterCellPx=32, showOutline=true
routes:              clusterCellPx=32, showOutline=true
regions:             clusterCellPx=32, showOutline=true
clusters:            clusterCellPx=40, showOutline=true
```

Geomap preset strategy:

```text
points:              mark=point,  symbolScale=fixed
proportional-symbol: mark=point,  symbolScale=sqrt
routes:              mark=route,  symbolScale=fixed
regions:             mark=region, symbolScale=fixed
clusters:            mark=cluster,symbolScale=fixed
```

projectionは全presetで`equirectangular`、antimeridian policyは`split`の実装定数であり、optionsへ保存しない。

`undefined`はJSON defaultへ保存しない。baseline未指定はkey omissionで表す。preset strategy keyをuser optionへ
追加しないことをunknown-key schema testで固定する。

### 6.4 Versioning

- 6 definitionsは`configSchemaVersion: 1`で開始する。
- additive shape/roleだけを追加し、既存shapeの意味を変更しない。
- v1 Dashboard mappingは追加しない。unknown v1 typeは従来どおりincompatible。
- v2 manifestの既存panelはmigrationなしで同じ表示を保つ。
- layoutVersionはOperations/Galleryのlayout変更時だけincrementする。

## 7. 対象file構成

```text
web/src/domains/dashboard/v2/visualizations/specialized/
  limits.ts
  text.ts
  scale.ts
  viewport.ts
  viewport.test.ts

web/src/domains/dashboard/v2/visualizations/graph/
  graph-model.ts
  graph-model.test.ts
  layered-layout.ts
  layered-layout.test.ts
  critical-path.ts
  critical-path.test.ts

web/src/domains/dashboard/v2/visualizations/financial/
  ohlc-model.ts
  ohlc-model.test.ts

web/src/domains/dashboard/v2/visualizations/logs/
  log-model.ts
  log-model.test.ts
  virtual-rows.ts
  virtual-rows.test.ts

web/src/domains/dashboard/v2/visualizations/trace/
  trace-model.ts
  trace-model.test.ts
  critical-path.ts
  critical-path.test.ts

web/src/domains/dashboard/v2/visualizations/profile/
  profile-model.ts
  profile-model.test.ts
  flame-layout.ts
  flame-layout.test.ts

web/src/domains/dashboard/v2/visualizations/geo/
  geo-model.ts
  geo-model.test.ts
  projection.ts
  projection.test.ts
  assets/world-110m.paths.json
  assets/world-110m.LICENSE.md

web/src/domains/dashboard/v2/visualizations/core-node-graph/
web/src/domains/dashboard/v2/visualizations/core-candlestick/
web/src/domains/dashboard/v2/visualizations/observability-logs/
web/src/domains/dashboard/v2/visualizations/observability-trace-waterfall/
web/src/domains/dashboard/v2/visualizations/observability-flame-graph/
web/src/domains/dashboard/v2/visualizations/geo-map/
  definition.ts
  renderer.lazy.tsx
  renderer.test.tsx

web/src/routes/dashboard-gallery-route-search.ts
web/src/routes/dashboard-gallery-route-search.test.ts
scripts/build-dashboard-world-outline.ts
scripts/build-dashboard-world-outline.test.ts
```

既存catalog、Gallery、schema index、bundle budget、test scriptsを更新する。family外へ巨大なhelperを置かない。

## 8. 共通model規則

1. pure functionはinput Frameとresolved configだけを受ける。
2. timezone、resolvedRange、field config、overrideはruntime contextから明示的に渡す。
3. `Date.now()`、`Math.random()`、locale defaultへ依存しない。
4. stable sortはoriginal row indexを最後のtie-breakerにする。
5. model errorとnoticeを区別する。契約違反はerror、表示省略はnotice。
6. rendererはmodelを再集計しない。
7. Tableとsummaryはrenderer DOMをparseせずmodelから生成する。
8. colorはtoken keyだけを保持し、raw hexをFrame/configへ保存しない。
9. selection/filter interactionはP9へ渡す。10ではtooltip、legend、data linkだけを扱う。
10. hidden/zero-width itemもTableから消さない。
11. configのfield key配列はunique、最大12、Frameに存在するscalar fieldだけを許可する。

## 9. Node Graph model

### 9.1 検証順

1. nodes/edges Frame binding。
2. unique node ID。
3. endpoint存在。
4. duplicate/self-loop policy。
5. finite value/coordinate。
6. limits。
7. state/value mapping。
8. layout。

Preset-specific:

- `grouped`はnode category role必須。
- `critical-path`はedge valueまたはnode valueを最低1つ必須。
- `directed`だけself-loopを許可。
- `service-map`でstate欠落時はunknown stateを表示し、healthyと推測しない。

### 9.2 Deterministic layered layout

座標roleが全nodeにある場合は正規化して使用する。一部だけ座標がある場合はerror。

座標なしの場合:

1. node ID昇順でadjacencyを作る。
2. Tarjan SCCを決定的順序で求める。
3. SCCをcondensation DAGへ変換する。
4. sourceからlongest-path rankを割り当てる。
5. rank内をnode IDで初期sortする。
6. left-to-right/right-to-left barycentric sweepを各2回行う。
7. SCC内nodeはnode ID順の小さなringへ置く。
8. Panel plot rectへpadding付きで正規化する。

force、random seed、requestごとの揺れを入れない。

### 9.3 Critical path

edge valueがある場合はedge value、ない場合はtarget node value、両方ない場合は1をweightにする。
condensation DAG上で最大weight pathをdynamic programmingで求める。同点はpathのnode ID列の辞書順で決める。
cycle内部はcritical SCCとして強調するが、架空のnode順をcritical causal orderとして表示しない。

### 9.4 Rendering

- edgeを先、nodeを後に描く。
- arrow markerはSVG defsを1つだけ使う。
- edge widthは1〜6pxへclamp。
- edge labelは100件以下のときだけ描画する。101件以上ではlabelをTooltip/Tableへ残しnoticeを表示する。
- node labelはconfig上限で省略し、完全値をtooltip/Tableへ残す。
- groupedはcategory別lane背景。複雑なconvex hullを作らない。
- 全nodeをtab stopにせず、summary/listをkeyboard alternativeにする。

## 10. Candlestick model / renderer

### 10.1 Scale

- Xは既存Cartesian time scaleを再利用する。
- candle widthは隣接timestampのpixel距離中央値から求め、2〜24pxへclamp。
- Y auto domainはlow/high全件に5% padding。
- `zero`は0を含めるが、価格用途でdefaultにしない。
- Field Config min/max指定時だけ`config`を許可する。
- baseline comparisonは明示baseline field、config baseline、最初のcloseの順で解決する。

### 10.1.1 Pixel-density aggregation

raw 2,000 bucketをそのままSVG markへしない。plot width確定後、
`maxVisibleBuckets = max(1, floor(plotWidth / 2))`を求め、raw row数が超える場合は連続rowを同じpixel bucketへ
決定的に集約する。

```text
time   = first time
open   = first open
high   = max high
low    = min low
close  = last close
volume = sum volume
baseline = last baseline
sourceRowCount = aggregated row count
```

seriesを跨いで集約しない。Tooltipは集約期間、source row count、集約OHLCを明示する。Visualization modelは
集約値、Tableはraw 2,000 rowを使う。集約後もOHLC invariantを再検証する。

### 10.2 Marks

- wick: highからlowの1px以上のline。
- body: open/close間。等値は2px line。
- up/downはsuccess/danger tokenではなく専用positive/negative chart tokenを使う。
- hollow presetはfillの有無に加えstroke patternをforced-colorsで区別する。
- volumeは別Y scale、plot高さの25%、priceと重ねない。
- range-barsはopen/close markerを短tickとして残す。

### 10.3 Tooltip / legend / Table

tooltipはtimestamp、O/H/L/C、range、delta、volumeを同じformat pipelineで表示する。Tableはraw O/H/L/Cと
derived range/deltaを列に持つ。LegendはUp/Down/Volume/Baselineだけで、各rowをlegend itemにしない。

## 11. Logs model / windowing

### 11.1 Text safety

- React text nodeとしてだけ描画する。
- `\u0000`、ESC、bidi overrideをvisible replacementへ置換する。
- tabは4 spaces相当の表示へ正規化する。
- newlineはwrap presetだけ保持し、compactでは`↵`へ置換する。
- URL auto-linkをしない。data link specだけを許可する。
- redactionはdata source責務。Frontendで秘密を推測してmaskしない。

### 11.2 Stable order

ascending/descendingをconfigで解決する。同timestampはoriginal row index順。streamという名前でもWebSocket、
polling、tail-followを10で追加しない。React Query refreshで新Frameへ置換する。

### 11.3 Windowing

外部virtualization dependencyを追加しない。`virtual-rows.ts`で次を実装する。

- fixed row height: compact 28px、stream/severity 36px。
- structured/contextは52px固定、wrapは2行line-clamp付き52px固定。
- scrollTop、viewportHeight、overscan 8からvisible rangeを算出。
- top/bottom spacerで総高さを保つ。
- ResizeObserverはcontainerだけに1つ。
- focus中rowはwindow外へ即時破棄せずoverscanへpinする。
- 完全文と全attributeはvirtual rowを可変高にせず、list外のdetails regionへ表示する。
- print/Table modeはwindowingを使わず上限付きtableを使う。

### 11.4 Preset semantics

- severity: level countsを先頭summaryへ表示し、row順は維持。
- structured: attribute columnは最大6列を画面表示、残りはTable。
- context: focal rowを必須とし、0件または2件以上はincompatible。
- compact: message 1行、timestamp short format。
- stream: latest側を視覚的に示すが、自動scrollしない。

## 12. Trace model / renderer

### 12.1 Treeとdepth

trace-idごとにspan mapを作り、rootからstart-time、span-id順にDFSする。depth上限を超えたらtruncateせず
Frame error。multi-trace Frameは最大3 traceまで許可し、presetごとにsectionを分ける。

`duration` fieldはField Config unitの`duration` kindを必須とし、`ns`、`us`、`ms`、`s`をmillisecondsへ変換する。
`m`、`h`、`d`はTraceではincompatible。unit未指定を暗黙にmillisecondsと解釈しない。

### 12.2 Durationとcritical path

```text
end = start + duration
traceStart = min(all span start)
traceEnd = max(all span end)
relativeStart = start - traceStart
relativeEnd = end - traceStart
```

`critical-path`はroot-to-leafの各pathについてspan duration合計を比較した「critical path estimate」とする。
これはwall-clock exclusive timeでもOpenTelemetryの正式なcritical pathでもないため、UI、summary、tooltipで
`Estimated critical chain`と表示する。同点はspan ID列の辞書順。複数rootの場合は全rootの候補を比較する。

### 12.3 errors-only

error/warning spanと、そのrootまでのancestorを残す。正常なsiblingは除外する。対象0件ならempty stateで
`No error spans in this trace`を表示し、trace全体をerrorにしない。

### 12.4 Waterfall

- 左: depth indent、operation、service。
- 右: trace envelopeに対するspan bar。
- 1px未満のspanはmarkerを表示する。
- idle gapをshowIdle時だけ薄いpatternで表示する。
- annotation layerはtrace root time domainへclipして重ねられる。
- rowはLogsと同じwindow primitiveを再利用する。

## 13. Flame Graph model / renderer

### 13.1 Layout

root widthをplot widthとし、child widthは`child.total / parent.total`で配分する。child順はtotal降順、label、
frame-idで安定化する。`minVisibleWidthPx`未満は個別rectを作らず、親ごとに`Other`表示用集約modelへまとめる。
raw Frame/Tableでは元frameを保持する。

### 13.2 Differential

`delta`はsigned。color domainは`max(abs(min), abs(max))`の対称domainとし、0をneutral tokenに固定する。
rect widthは`total`で決め、deltaの絶対値で幅を変えない。total 0かつdelta非0はTableに残し、graphではnoticeへ
件数を示す。

### 13.3 Rendering

- SVG rect数はvisible aggregation後2,000以下。
- depth row height 22px、compact 16px。
- labelは実幅を測定せず、平均文字幅ベースのdeterministic truncation。
- hover/focus tooltipはlabel、inclusive、self、percent、delta、category。
- full keyboard tree navigationはP9。10ではaccessible top-frame listを必須とする。
- flame/icicleはY方向だけ反転し、同じlayout modelを使う。

## 14. Geomap model / renderer

### 14.1 Basemap

network tileを使わない。O13で出典と利用条件を検証した110m低解像度outlineを、canonical
`0 0 1000 500` SVG pathへ事前変換したJSON assetとしてrepositoryへ置く。assetにはsource URL、取得日、
source revision/version、source SHA-256、生成後SHA-256、license、変換commandを
`assets/world-110m.LICENSE.md`へ記録する。出典または利用条件を検証できないassetをcommitしない。

JSONはglobal outline 1本だけでなく、`region-id -> SVG path`のstable mapと表示順を持つ。region ID集合はassetから
導出し、別のISO一覧を手書きしない。複数polygonを持つregionも1つのSVG path stringへ保持する。

変換は`scripts/build-dashboard-world-outline.ts`で再現可能にし、generated JSONを手編集しない。scriptは入力fileを
明示引数で受け、実装時やbuild時にnetworkへ接続しない。

world outline assetは`geo-map/renderer.lazy`からだけimportし、normal initial、Dashboard shell、ほかのrenderer
chunkへ入れない。

### 14.2 Projection

```text
x = (longitude + 180) / 360 * width
y = (90 - latitude) / 180 * height
```

projectionは`equirectangular`だけ。routeは緯度経度をunit vectorへ変換し、spherical linear interpolationで
32 segmentへ分割する。ほぼ同一点は直線、数値的に不安定なantipodal pairはincompatibleとする。project後の
longitude差が180度を超えるsegmentはantimeridianで2本へsplitする。3D globe、pan/zoomは10の対象外。

### 14.3 Symbols / clusters / regions

- proportional-symbol半径はsqrt scale、4〜28px。
- value domainが同値なら中間半径。
- clustersはproject後`clusterCellPx`のgrid keyで集約。
- cluster labelは件数、tooltip/Tableに構成pointを残す。
- regionsはISO alpha-2とbundled path mapをjoin。
- sequential/diverging/status colorは08 color scaleを再利用。
- missing regionはno-data pattern。
- ocean/background/outlineもdesign tokenを使う。

### 14.4 Privacy

Frontendは座標丸めや匿名化を暗黙に行わない。位置精度の低減はBackend aggregation責務。Inspector、tooltip、
TableはFrameに含まれる精度を表示するため、PII座標をDashboardへ渡さないことをREADMEへ明記する。

## 15. Limits

limitはshared constantとしてBackend normalizationとFrontend modelが同じ値を参照する。

| Family | 上限 | 超過時 |
| --- | ---: | --- |
| Node Graph nodes | 250 | 251でreject |
| Node Graph edges | 500 | 501でreject |
| Node label | 256 chars | 超過Frame reject |
| OHLC rows | 2,000 | 2,001でreject |
| OHLC series | 4 | 5でreject |
| Log rows | 2,000 | 2,001でreject |
| Log message | 8,192 characters/row | shared `maxCellStringLength`超過でreject |
| Log scalar attributes | 12 | 13でreject |
| Trace spans | 2,000 | 2,001でreject |
| Trace IDs | 3 | 4でreject |
| Trace depth | 64 | 65でreject |
| Profile frames | 2,000 | shared `maxRowsPerFrame`に従い2,001でreject |
| Profile depth | 128 | 129でreject |
| Flame visible rects | 2,000 | modelでOther集約 |
| Geo points / symbols | 800 | 801でreject |
| Geo cluster input | 2,000 | 2,001でreject |
| Geo routes | 1,000 | 1,001でreject |
| Geo regions | 249 | 250でreject |

limitちょうどとlimit+1を必ずtestする。API `maxRows`がこれより小さい場合はAPI limitを優先し、Frontendで
欠落を隠さない。

## 16. Table / summary

| Family | Tableで必須の列 | Summaryで必須の内容 |
| --- | --- | --- |
| Node Graph | node/edge kind、IDs、label、value、state | nodes、edges、cycles、top degree、critical path |
| Candlestick | time、O/H/L/C、range、delta、volume | first/last、min/max、change、largest range |
| Logs | time、severity、message、service、attributes | rows、time range、severity counts、truncated count |
| Trace | trace/span/parent、service、operation、start/end/duration | total duration、span count、error count、critical chain |
| Flame | frame/parent、inclusive/self、percent、delta | total、depth、top frames、positive/negative delta |
| Geomap | coordinates/region/route、value、state | point/route/region count、top locations、unknown count |

summaryは1,000文字以下、視覚色だけに依存せず、値の単位と期間を含める。Table toggleは同じquery responseと
derived modelを使い、別API requestを行わない。

## 17. Tooltip / legend / links / annotations

- Tooltipはpointerとkeyboard focusの両方で到達可能にする。
- Tooltip portalはPanel外overflowを許すがviewport内へclampする。
- Legend filter interactionはP9。10では説明とtoken key表示だけ。
- Node/Trace/Logsのdata linkは既存same-origin resolverを使う。
- log message中URLを自動link化しない。
- annotationはCandlestick、Logs、Traceでtime domainがある場合だけ対応する。
- Node/Flame/Geomapへannotation Frameを渡した場合は無視せずincompatibleを返す。
- map point/node clickで外部navigationを暗黙に行わない。

Annotation描画はfamilyごとに固定する。

- Candlestick: price plotのx domain/plot rectへ09 shared overlayを重ねる。
- Trace: waterfall bar領域のtrace envelopeへ09 shared overlayを重ねる。
- Logs: point/line/badgeをtimestamp順のdivider row、regionを該当log rowのtoken backgroundとして表現する。
- Logs annotation dividerもvirtual row modelへ含め、絶対position overlayでscrollと分離しない。

Legend itemはNodeのcategory/state、CandlestickのUp/Down/Volume/Baseline、Logsのseverity、Traceのservice、
Flameのcategory/delta scale、Geomapのcategory/value scaleに限定する。row/node/spanごとのlegend itemを生成しない。

## 18. Accessibility

### 18.1 共通

- Panel accessible label。
- concise summary。
- Table fallback。
- token color + text/pattern/shape。
- 200% zoom、forced-colors、reduced-motion。
- tooltipだけに情報を閉じ込めない。
- SVGの数百要素をすべてtab stopにしない。

### 18.2 Family別

- Node Graph: top nodes/edgesとcritical pathのordered list。
- Candlestick: latest、min/max、changeと全row Table。
- Logs: `role=list`/row semantics、severity text、focal row announcement。
- Trace: tree depthを`aria-level`相当のlist構造で表現し、critical path listを付ける。
- Flame: top inclusive/self/delta frames list。
- Geomap: location/region ranking listと座標Table。

Canvasだけの表示を禁止する。SVGを`aria-hidden`にする場合は同等summary/Tableが同時に存在しなければならない。

## 19. Responsive

| Family | Desktop | Mobile |
| --- | --- | --- |
| Node Graph | graph + side summary | critical path/top dependency list |
| Candlestick | full plot | latest 40 buckets + summary/Table |
| Logs | windowed rows + attributes | compact 1-column rows |
| Trace | tree + waterfall | critical path/slow spans list |
| Flame | flame/icicle | top frames + depth-limited compact |
| Geomap | map + legend | map summary + top locations; min 320px |

mobileで単純にdesktop SVGをscale downしない。Tableは横scrollを許すが、主要列をstickyにし、message/labelは
wrap可能にする。

## 20. Lazy load / bundle boundary

```text
normal route
  must not import Dashboard route, Recharts, specialized definitions, renderers, map asset

Dashboard shell
  may import lightweight catalog descriptors/config schemas
  must not import renderer.lazy implementation or world outline asset

panel resolution
  imports only selected type renderer

core.candlestick
  imports Recharts/cartesian chunk

geo.map
  imports world outline asset

other five families
  native HTML/SVG, no Recharts edge
```

新runtime dependencyは0。map asset gzipは60 KiB以下、各native renderer chunk gzipは25 KiB以下、
Candlestick incremental gzipは既存Recharts shared chunkを除き30 KiB以下。Dashboard shellの既存budgetを
増やして通さない。

## 21. Performance

計測は固定fixture、animation off、cold model buildとwarm rerenderを分ける。

| 対象 | fixture | hard gate |
| --- | --- | --- |
| Node layout | 250 nodes / 500 edges | model <= 100ms、graphical marks <= 750、DOM <= 1,600 |
| OHLC | 2,000 raw rows | model <= 50ms、visible buckets <= floor(plotWidth/2) |
| Logs | 2,000 rows | model <= 50ms、mounted rows <= 80 |
| Trace | 2,000 spans | model <= 100ms、mounted rows <= 100 |
| Flame | 2,000 frames | model <= 100ms、visible rects <= 2,000 |
| Geomap | 2,000 cluster inputs / 1,000 routes | model <= 100ms、symbols <= 800、route paths <= 1,000 |

CI環境差があるためwall timeだけでなくDOM/SVG node上限をhard gateとする。long task 100ms超をPlaywrightで
記録し、upper-bound caseで連続2回超過したらO17をcompleteにしない。

## 22. Security

- raw HTML/Markdown/ANSI禁止。
- label/message/attributeはReact escapingを通す。
- bidi/control charactersを可視化または除去するpure sanitizer。
- same-origin allowlisted data linkだけ。
- mapはnetwork request 0、remote tile 0。
- bundled assetのlicense/provenance必須。
- coordinates、trace attributes、logsをInspectorで追加露出しない。
- Query Inspector既存sanitizeをregression testする。
- huge string、deep tree、cycle、zip-bomb相当のnested JSONを受けない。
- CSPを緩和しない。

## 23. Gallery cases

各presetに1 deterministic success caseを作る。

```text
node-service-map
node-dependency
node-directed
node-grouped
node-critical-path

candle-basic
candle-hollow
candle-volume
candle-range
candle-baseline

logs-stream
logs-compact
logs-severity
logs-structured
logs-context

trace-waterfall
trace-service
trace-critical
trace-errors
trace-compact

flame-basic
flame-icicle
flame-differential
flame-category
flame-compact

geo-points
geo-symbol
geo-routes
geo-regions
geo-clusters
```

全fixtureは固定timestamp/timezone、固定ID、固定order、token color、no random、Table enabled。05〜09 casesと
state/error fixturesを削除しない。Galleryのsuccess preset countはexact 126、追加successはexact 30。

Invalid fixtureはpublic Gallery manifestへ登録せずunit/component testで扱う。

- graph orphan/cycle policy/251 nodes/501 edges。
- OHLC invariant/duplicate time/2,001 rows。
- log oversized/control/focal mismatch/2,001 rows。
- trace cycle/orphan/invalid time/depth65/2,001 spans。
- profile cycle/value mismatch/depth129/2,001 frames。
- geo invalid coordinate/unknown ISO/801 points/2,001 cluster inputs/1,001 routes。

### 23.1 126 presetを閲覧可能にするGallery navigation

既存Galleryにはcategory tab、visible manifest、選択categoryだけのPanel queryが実装済みである。O16はこれを
作り直さず、09/10 family、overview、検索、URL復元へ拡張する。126 presetを1画面で一括query/renderする
実装は禁止する。Gallery manifestは全caseを保持するが、Frontendは選択familyだけを
`useDashboardPanelsV2`へ渡し、非表示familyのPanel API requestとrenderer importを行わない。

Gallery category IDと所属typeは既存`galleryCategories`のlightweight metadataで管理する。descriptorの
`category`だけでは`composition`と`hierarchy-flow`などを区別できないため、推測しない。display name、preset数、
default presetはshared descriptorから導出し、conformance testで全catalog typeがexact 1 categoryへ所属することを
検証する。09の3 typeは`state-time`、10の6 exact type IDは`specialized-observability`へ追加する。

```text
overview
cartesian
kpi-status
composition
hierarchy-flow
distribution
state-time
specialized-observability
data-states
```

必須UI:

- 上部に`126 presets`とstate/integration fixtureの別件数。
- category tabまたはjump navigation。
- type名、display name、preset数。
- type/preset text search。
- active categoryとquery件数。
- Operations Dashboardへ戻るlink。
- Phase 11のAdd panelと誤認しない`Renderer gallery`説明。

Gallery専用search parserを`web/src/routes/dashboard-gallery-route-search.ts`へ追加する。既存
`parseDashboardRouteSearch`を内部で再利用してrange/timezone/refresh/filtersを保持し、その戻り値へ次だけを加える。

```text
family?: GalleryFamily
q?: string (trimmed, 2..80 chars; emptyはomit)
```

TanStack Routerのtyped search schemaでparseし、unknown familyは`overview`へcanonicalizeする。`q`はtype、display name、
preset IDへのcase-insensitive substringだけで、regexや任意queryを許可しない。`q`指定時はfamilyを跨いで検索するが、
表示・queryは先頭40件までとし、41件以上では総一致件数と`Refine your search`を表示する。search結果0件は
empty stateを表示する。

既存`useState("cartesian")`をURL search由来stateへ置き換える。tab click、keyboard arrow、browser back/forward、reloadで
同じfamilyが復元されることをroute/unit/E2Eで検証する。Gallery以外のDashboard route search型へ`family`/`q`を
混ぜない。

`overview`は全typeからdefault presetを1件ずつ表示する。family viewはそのfamilyの全presetを表示する。
`all 126 panels`をdefault modeにしない。conformance testはfamily viewを順番に開き、全126 success caseの集合が
catalogと一致することを検証する。

Gallery readinessは表示対象Panelだけを数える。非表示Panelをpending扱いしない。category切替時は前categoryの
requestをAbortSignalでcancelし、query cache keyにGallery familyを混ぜるのではなく、既存panel query keyを使う。
同じPanelへ戻った場合はReact Query cacheを再利用する。

## 24. Backend / Frontend boundary

Backend:

- shape/role/config/limit validation。
- query handlerから集計済みFrameを返す。
- logsのaccess control、redaction、position precisionをdata source側で担保する。
- trace/profile/graphのID関係を保持する。
- layout、projection、critical path、virtual rowsは実装しない。

Frontend:

- binding、pure model、layout、projection、windowing、renderer、Table、summary。
- renderer JSXへschema validation、tree cycle検出、OHLC invariantを直書きしない。
- Browser transformationでarbitrary script/queryを追加しない。

### 24.1 Runtime integration

- API responseはspecialized shapeを含め既存共有Zod schemaでparseする。
- range/timezone/filter/refreshは既存TanStack Router search paramsとquery keyを使う。
- Candlestick、Logs、Traceはrequest rangeとserver `resolvedRange`を必ず使用する。
- Node Graph、Flame Graph、Geomapもfilter/refresh変更時は同じReact Query orchestrationへ従う。
- Operations用handlerでGalleryの固定timestamp fixtureを流用しない。
- loading、refreshing、error-with-data、retry、staleは既存PanelShellで表示し、family rendererへ複製しない。
- Playwrightは少なくともCandlestick、Logs、Traceでrange変更、API request body、resolvedRange、表示範囲を照合する。
- Table toggleで追加requestを発生させない。

## 25. O0〜O18 Work Packages

| WP | 内容 | 完了gate |
| --- | --- | --- |
| O0 | baseline / dependency / capability audit | 09 T13、96 presets、bundle record |
| O1 | reserved shape validators / 9 roles / config / definitions | shared schema tests |
| O2 | common limits / text / viewport / scale | pure tests |
| O3 | graph binding / SCC / layered layout / critical path | pure tests |
| O4 | Node Graph 5 presets | renderer + Gallery 5 |
| O5 | OHLC invariant / scale / derived model | pure tests |
| O6 | Candlestick 5 presets | renderer + Gallery 5 |
| O7 | log text / ordering / window model | pure/component tests |
| O8 | Logs 5 presets | renderer + Gallery 5 |
| O9 | trace tree / duration / critical path | pure tests |
| O10 | Trace 5 presets | renderer + Gallery 5 |
| O11 | profile tree / differential / flame layout | pure tests |
| O12 | Flame Graph 5 presets | renderer + Gallery 5 |
| O13 | geo projection / clustering / asset provenance | pure/license tests |
| O14 | Geomap 5 presets | renderer + Gallery 5 |
| O15 | Table / summary / a11y / mobile / security | component/security tests |
| O16 | 30-preset Gallery conformance | exact cumulative 126 |
| O17 | visual / a11y / performance / bundle | expanded gates |
| O18 | full verify / docs / D11 handoff | full gates/progress |

## 26. O0: Baseline

```bash
git branch --show-current
git status --short
bun run verify
bun run verify:dashboard-contract
bun run verify:dashboard-coverage
bun run verify:dashboard-frontend-coverage
bun run verify:dashboard-gallery
E2E_PORT=5175 bun run verify:dashboard-e2e
bun run verify:dashboard-bundle
git diff --check
```

Record:

- 09 T13 status、96 preset、Gallery total/success/state counts。
- existing shapes/roles/config snapshots。
- initial、Dashboard shell、each renderer raw/gzip。
- Recharts import graph。
- runtime dependency list/license。
- coverage file/test counts。
- visual/a11y/performance baselines。
- current D11 evidence SHAとconcurrent changes。

O0で不足を発見しても実装を始めず、progressへ事実とowner WPを記録する。

## 27. O1〜O2: Contract / common foundation

O1:

- 7 reserved shapesのbackward compatibility、minimum validator強化、9 additive roles。
- 6 strict config schemas、definitions、30 preset defaults。
- reserved IDs、catalog type、wire serialization。
- multi-frame node graph binding。
- exact descriptor/default keys。
- 09 manifest backward compatibility。

O2:

- shared limits。
- text control/bidi sanitizer。
- deterministic viewport/window range。
- common numeric/area/time scale helper。
- token resolver。

```bash
bunx vitest run shared/schemas/dashboard/specialized-visualizations.schema.test.ts shared/schemas/dashboard/data-frame.schema.test.ts shared/schemas/dashboard/field-config.schema.test.ts shared/schemas/dashboard/visualization.schema.test.ts shared/schemas/dashboard.schema.test.ts
bunx vitest run web/src/domains/dashboard/v2/visualizations/specialized
bun run typecheck
git diff --check
```

## 28. O3〜O14: Family packages

各renderer packageで次を同時に完了する。

1. definition/catalog registration。
2. model/strategy。
3. lazy renderer。
4. Table rows/summary。
5. unit/component tests。
6. deterministic Gallery cases。
7. focused E2E。
8. bundle row。

| WP | Boundary cases |
| --- | --- |
| O3/O4 | 250/251 nodes、500/501 edges、SCC、coordinate all/partial、critical tie |
| O5/O6 | OHLC invariant、gap、equal body、2,000/2,001、volume/baseline |
| O7/O8 | control/bidi、same timestamp、wrap、focus pin、2,000/2,001 |
| O9/O10 | orphan/cycle、clock skew、3/4 traces、64/65 depth、critical tie |
| O11/O12 | parent sum tolerance、Other aggregation、signed delta、128/129 depth |
| O13/O14 | poles、antimeridian、800/801 points、2,000/2,001 clusters、unknown ISO、asset lazy edge |

Focused gate:

```bash
bunx vitest run web/src/domains/dashboard/v2/visualizations/<family> web/src/domains/dashboard/v2/visualizations/<renderer>
bun run verify:dashboard-gallery
E2E_PORT=5175 bun run verify:dashboard-e2e -- --grep "<family>"
bun run verify:dashboard-bundle
git diff --check
```

## 29. O15: Cross-family quality

- all 30 presetsにVisualization/Table toggle。
- same response、same derived values。
- summary <= 1,000 chars。
- tooltip/legend/link/annotation compatibility。
- mobile family fallback。
- forced-colors/pattern/shape。
- 200% zoom、keyboard、focus retention。
- logs/labels/attributes control character security。
- map network 0、asset provenance。
- inspector/data link regression。

```bash
bunx vitest run web/src/domains/dashboard/v2/visualizations
E2E_PORT=5175 bun run verify:dashboard-a11y
bun run verify:dashboard-security
git diff --check
```

## 30. O16: Gallery conformance

- 6 new types。
- exact 5 presets/type、30 new、cumulative 126。
- `126`はunique `type/preset` success catalog件数で、state/limit/annotation integration fixtureを含めない。
- every default parses。
- every preset deterministic success case。
- no orphan/extra Gallery preset。
- loaderは全てdynamic、resolve可能。
- minimum size以上。
- Table/summary ready。
- overview/family navigation、typed `family`/`q` search、件数表示。
- non-visible familyのPanel request 0、renderer import 0。
- family view集合が全126 success presetsとexact一致。
- family切替時cancel、cache再利用、readiness対象の切替。
- below-fold specialized Panelはscroll前renderer chunk request 0、scroll後ready。
- console error 0、renderer error 0。
- 05〜09 regression 0。

```bash
bun run verify:dashboard-contract
bun run verify:dashboard-coverage
bun run verify:dashboard-frontend-coverage
bun run verify:dashboard-gallery
E2E_PORT=5175 bun run verify:dashboard-e2e
git diff --check
```

## 31. O17: Visual / a11y / performance / bundle

Visual minimum:

```text
gallery-specialized-desktop-1.png
gallery-specialized-desktop-2.png
gallery-specialized-mobile.png
panel-node-service-map.png
panel-candlestick-volume.png
panel-logs-structured.png
panel-trace-waterfall.png
panel-flame-differential.png
panel-geomap-routes.png
```

Visual assertion:

- clipping、overlap、zero-size、missing labelなし。
- token以外のraw colorなし。
- Gauge/SegmentTrackを含む既存Gallery regressionも同時確認。
- screenshotsはfamily group + representative panelで原因特定可能にする。

Accessibility:

- axe 0 violation。
- summary/list/Table alternative。
- forced-colors、zoom、keyboard、focus pin。
- log control/bidi textがDOM意味を壊さない。

Performance/bundle:

- section 20/21の全hard gate。
- map assetはGeomap chunkだけ。
- Recharts edgeはCandlestickだけ。
- runtime dependency diff 0。
- normal initial/Dashboard shell budget不変。

```bash
bun run verify:dashboard-gallery
bun run verify:dashboard-frontend-coverage
E2E_PORT=5175 bun run verify:dashboard-e2e
E2E_PORT=5175 bun run verify:dashboard-visual
E2E_PORT=5175 bun run verify:dashboard-a11y
E2E_PORT=5175 bun run verify:dashboard-performance
bun run verify:dashboard-security
bun run verify:dashboard-bundle
git diff --check
```

## 32. O18: Full verification / docs / handoff

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
bun run verify:dashboard-security
bun run verify:dashboard-bundle
git diff --check
```

Docs:

- 7 reserved shape / 9 additive role contracts。
- renderer/preset catalog。
- limits、security、mobile、Table。
- graph layout、critical pathの意味。
- OHLC invariant。
- logs plain-text boundary。
- trace/profile tree rules。
- map projection、asset license、network 0。
- renderer追加方法、Gallery fixture追加方法。
- README、LLM_CONTEXT、progress、release evidence handoff。

```text
10 status: complete
New renderer types: 6
New presets: 30
Cumulative presets: 126
New data shape IDs: 0
Strengthened reserved shapes: 7
New field roles: 9
New runtime dependencies: 0
Map network requests: 0
Next: Data Source Adapters AD0
```

P8へ進まない場合は、ここで04 D11を126 preset candidateに対して再実行する。tag、push、release公開はD12と
user承認まで行わない。

## 33. Test matrix

| Layer | Node | Candle | Logs | Trace | Flame | Geo |
| --- | --- | --- | --- | --- | --- | --- |
| schema | IDs/frames | OHLC | text/attrs | parent/time | tree/value | coordinates/ISO |
| pure model | SCC/layout | scale/marks | order/window | tree/path | layout/delta | project/cluster |
| component | SVG | Recharts/SVG | rows | waterfall | SVG | SVG/map |
| Table | nodes/edges | OHLC | raw rows | spans | frames | locations |
| summary | degree/path | change/range | severity | duration/error | top/delta | top region |
| mobile | list | 40 bars | compact | slow spans | top frames | ranking |
| a11y | ordered list | pattern | list/focus | tree list | top list | location list |
| security | label/link | tooltip | control/bidi | attrs/link | label | no network |
| performance | 250/500 | 2,000 | 2,000 | 2,000 | 2,000 | 2,000 |
| bundle | native | Recharts | native | native | native | asset-only |

## 34. Coverage / failure handling

Focused coverageへschema、binding、models、layout、window、projection、summary、rendererを含める。
statements/lines/functions 80%以上、branches 70%以上。generated map path dataはcoverage対象外にできるが、loaderと
region joinは対象外にしない。

| Failure | 戻るWP |
| --- | --- |
| shape/config/definition | O1 |
| common text/viewport/limit | O2 |
| Node model/renderer | O3/O4 |
| OHLC/model/renderer | O5/O6 |
| Logs model/renderer | O7/O8 |
| Trace model/renderer | O9/O10 |
| Flame model/renderer | O11/O12 |
| Geo model/asset/renderer | O13/O14 |
| Table/a11y/mobile/security | O15 |
| Gallery count/loader | O16 |
| visual/performance/bundle | O17または原因WP |
| full gate/docs | 原因WP、O18 complete禁止 |

test failureを`exclude`、threshold低下、fixture削除で通さない。原因WPへ戻し、progressのcurrent WPを更新する。

## 35. Stop条件

停止する:

- 09 T13がcompleteでない。
- shape/role追加が既存v2 Frame parseを破壊する。
- multi-frame graphを既存Panel query/frameRefsで表現できない。
- log messageを安全なtext nodeだけで要件達成できない。
- trace/profile tree validationがBackend/Frontendで不一致になる。
- verified license/provenance付きmap outlineを用意できない。
- map assetをGeomap lazy chunkへ隔離できない。
- Candlestickがnormal initial graphへRechartsを載せる。
- accessibility alternativeなしにCanvas/WebGLが必要になる。
- runtime dependency追加なしでは実装不能という証拠が出る。
- concurrent変更と安全に統合できない。

停止しない:

- layout crossing調整。
- label truncation調整。
- visual baseline差分。
- upper-bound最適化。
- coverage不足。
- mobile summary文言。
- deterministic fixture追加。

## 36. 完了条件

- [ ] 09 T0〜T13 complete。
- [ ] O0〜O18 complete。
- [ ] new types 6 / presets 30 / cumulative 126。
- [ ] new shape ID 0、7 reserved shapeのvalidator完成、9 additive field roles。
- [ ] Node Graph 5 presets、deterministic layout、cycle/SCC、critical path。
- [ ] Candlestick 5 presets、OHLC invariant、volume/baseline。
- [ ] Logs 5 presets、plain text safety、windowing。
- [ ] Trace 5 presets、tree、duration、critical path。
- [ ] Flame Graph 5 presets、tree value、differential、Other aggregation。
- [ ] Geomap 5 presets、projection、antimeridian、cluster、region join。
- [ ] map asset license/provenance、network request 0。
- [ ] 30 deterministic Gallery success cases、cumulative exact 126。
- [ ] all presets Table/summary/mobile。
- [ ] tooltip/legend/link/annotation compatibility。
- [ ] forced-colors/zoom/keyboard/a11y。
- [ ] upper-bound performance/DOM limits。
- [ ] normal initial/Dashboard shell bundle不変。
- [ ] runtime dependency 0。
- [ ] contract/coverage/Gallery/E2E/visual/a11y/performance/security/bundle/full verify pass。
- [ ] README/LLM_CONTEXT/progress/release handoff更新。

## 37. 次計画へ渡す成果

```text
Specialized shapes: graph, OHLC, logs, spans, profile tree, geo
Deterministic models: SCC/layered layout, critical path, windowing, flame layout, projection
Rendering: 6 lazy families, 30 presets, native SVG/HTML except Candlestick
Safety: plain text logs, same-origin links, no map network, strict limits
Fallback: Table, summary, mobile family-specific views
Catalog: 126 selectable presets
```

次の優先作業は[Data Source Adapters](./data-source-adapters.md) AD0である。P8のVisualization picker、
Panel editor、duplicate、fullscreen、exportは後続計画として維持する。10で追加した6 familyも、既存familyと
同じdescriptor/role/config contractから将来のpickerへ列挙できる状態にし、10でpicker専用分岐を追加しない。

## 38. 再開手順

1. 00 P7を読む。
2. 09 T13 completeを確認する。
3. progressの10節を読む。
4. `git branch --show-current`と`git status --short`を確認する。
5. current `in_progress` O packageを確認する。
6. 最後の成功commandを再実行する。
7. 最初のpending Oだけを開始する。
8. contract/model/renderer/Table/Gallery/testを同packageで完成する。
9. gate結果をprogressへ記録する。
10. O18後はadapter AD0へ進み、adapter candidate完了後に04 D11を再検証する。
