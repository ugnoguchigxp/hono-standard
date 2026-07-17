# 09: State Timeline・Status History・Uptime Grid・Annotations 実装計画

## 1. 文書の位置づけ

この文書は[00: コンセプト](./00-concept.md)のP6を、Lunaが最後まで実装できる粒度へ分解した正本である。
08までの数値・分布Visualizationに対し、09は「どの状態が、いつからいつまで続いたか」「定期観測で
どの状態だったか」「期待観測が欠けたか」「運用eventがいつ発生したか」を扱う。

対象:

- State Timeline
- Status History
- Uptime Grid
- Annotation layer

新renderer type 3、preset 18、annotation display mode 4。08完了時の78 presetへ追加し、catalog全体を
96 presetへ増やす。Annotationは独立preset数へ含めず、time-oriented rendererが共有するlayerとする。

### 1.1 開始条件

- 01〜03 complete、04 D0〜D10 complete。
- 05〜07 complete。
- [08](./08-distribution-heatmap-statistical-visualizations.md) S0〜S13 complete。
- cumulative 78 presetとquality gateがgreen。
- 07 semantic state、08 matrix/calendar/missing modelが利用可能。

08未完了のまま09へstate token、calendar bucket、native SVG gridを複製しない。

### 1.2 実行順

```text
07 K0〜K12 -> 08 S0〜S13 -> 09 T0〜T13 -> 10 O0〜O18
                                                |
                                                v
                                      04 D11 revalidation -> D12
```

既存D11証拠は拡張前baseline。T13後は10 O0へhandoffする。userが10を明示的にscope外へ戻した場合だけ、
96 preset candidateでD11を再検証する。

### 1.3 Lunaへの完了指示

1. [progress.md](./progress.md)の09節を読む。
2. 08 S13 completeを確認する。
3. 最初の`pending` T packageだけを`in_progress`にする。
4. shared wire、model、renderer/layer、Gallery、testを同packageで完成させる。
5. package固有gateを通す。
6. command、件数、coverage、Gallery、bundle bytesをprogressへ記録する。
7. `complete`にして次へ進む。
8. T13後、10 O0へhandoffする。

### 1.4 正本順

00 > 01 > 02 > 03 > 04 > 05 > 06 > 07 > 08 > この文書 > progress。

## 2. 目的

1. 3 renderer type、18 presetを追加する。
2. interval、sample、uptime bucket、annotationを別contractとして扱う。
3. missing、unknown、no-data、offlineを同一状態にしない。
4. overlap、gap、open interval、duplicate sampleを決定的に検証する。
5. AnnotationをTime Series/Time Bar/State系へ共有layerとして重ねる。
6. annotation storage/editorを作らずcode-defined/query-provided dataだけ扱う。
7. state/value mapping、status token、Table、summaryを共有する。
8. dense state dataをnative SVGで描き、Recharts依存を追加しない。
9. mobileでは縮小ではなくstate counts/current incidentへ要約する。

## 3. 完了後のcatalog

### 3.1 core.state-timeline

| Preset | 用途 |
| --- | --- |
| `single-lane` | 1対象の状態区間 |
| `multi-lane` | service/region別区間 |
| `merged-adjacent` | 同一状態の連続区間統合 |
| `duration-emphasis` | 長時間状態を強調 |
| `compact` | 狭いPanelの状態strip |
| `threshold-derived` | numeric sampleを状態区間化 |

### 3.2 core.status-history

| Preset | 用途 |
| --- | --- |
| `grid` | 時刻×対象の観測状態 |
| `bands` | 横方向state bands |
| `multi-series` | 複数check比較 |
| `changes-only` | 状態変化点を強調 |
| `latest-column` | 最新状態を右端で強調 |
| `compact` | 高密度小型grid |

### 3.3 core.uptime-grid

| Preset | 用途 |
| --- | --- |
| `hourly` | 時間bucket稼働状態 |
| `daily` | 日別uptime |
| `rolling-30d` | 直近30日 |
| `rolling-90d` | 直近90日 |
| `service-matrix` | service×bucket |
| `incident-overlay` | incident annotation付きuptime |

```text
State Timeline = 6
Status History = 6
Uptime Grid    = 6
09 total       = 18
after 09 total = 96
```

### 3.4 Annotation display modes

```text
point    = single instant marker
line     = vertical time marker
region   = start/end shaded range
badge    = compact lane badge
```

Annotation modeはcatalog presetではなくlayer specで選択する。

## 4. Capability audit

既存:

- `state-interval` shape、start-time/end-time/state roles。
- time、message、severity、url、category、series roles。
- reserved IDs: state-timeline、status-history、uptime-grid。
- descriptor capabilityに`annotations` boolean。
- 07 semantic states、08 status calendar/missing-cell model。
- same-origin link resolver、Table fallback、lazy registry。

不足:

- 定期観測用shape。
- annotation専用shape/spec。
- interval overlap/gap semantics。
- expected cadenceとmissing bucket。
- annotation FrameをVisualizationへbindingするwire。
- time-oriented renderer共通annotation primitive。

09 rendererはnative SVG/HTMLで実装し、Rechartsをimportしない。既存Time Seriesへannotationを重ねる際も
Recharts childへ直接混入せず、Panel plot overlay layerを使う。

## 5. 対象file

### 5.1 shared

```text
shared/schemas/dashboard/data-frame.schema.ts
shared/schemas/dashboard/visualization.schema.ts
shared/schemas/dashboard/manifest-v2.schema.ts
shared/schemas/dashboard/state-visualizations.schema.ts
shared/schemas/dashboard/state-visualizations.schema.test.ts
shared/schemas/dashboard/annotation.schema.ts
shared/schemas/dashboard/annotation.schema.test.ts
shared/schemas/dashboard/index.ts
```

### 5.2 Frontend common

```text
visualizations/state/state-value.ts
visualizations/state/state-value.test.ts
visualizations/state/interval-model.ts
visualizations/state/interval-model.test.ts
visualizations/state/sample-model.ts
visualizations/state/sample-model.test.ts
visualizations/state/uptime-model.ts
visualizations/state/uptime-model.test.ts
visualizations/state/annotation-model.ts
visualizations/state/annotation-model.test.ts
visualizations/state/primitives.tsx
visualizations/state/primitives.test.tsx
visualizations/state/summary.ts
```

### 5.3 renderer

```text
core-state-timeline/{definition.ts,renderer.lazy.tsx,renderer.test.tsx}
core-status-history/{definition.ts,renderer.lazy.tsx,renderer.test.tsx}
core-uptime-grid/{definition.ts,renderer.lazy.tsx,renderer.test.tsx}
```

### 5.4 annotation integration

```text
panel/plot-overlay.tsx
panel/plot-overlay.test.tsx
visualizations/annotations/annotation-layer.tsx
visualizations/annotations/annotation-layer.test.tsx
core-timeseries/renderer.lazy.tsx
core-bar/renderer.lazy.tsx
core-state-timeline/renderer.lazy.tsx
core-status-history/renderer.lazy.tsx
core-uptime-grid/renderer.lazy.tsx
```

### 5.5 対象外

- annotation DB storage/editor。
- alert rule evaluation。
- incident acknowledgement/action。
- realtime streaming updates。
- cross-panel shared cursor/selection。
- arbitrary Markdown/HTML annotation。
- recurring calendar rule。
- timezone auto-inference。

## 6. Data shape additions

### 6.1 state-sample

`state-sample`をData shapeへ追加する。

Minimum:

```text
time role 1
state role 1
optional category / series
```

用途はStatus HistoryとUptime Gridの定期観測。timeseries shapeはnumeric valueを必須とするため流用しない。

### 6.2 annotation

`annotation` shapeを追加する。

Valid forms:

```text
event:  time + message
region: start-time + end-time + message
```

Optional: severity、category、url、id。timeとstart-timeを同rowで併用しない。regionはstart < end。

### 6.3 existing state-interval

Minimumはstart-time + state、end-time optionalを維持する。category/seriesでlaneを表現する。
open intervalのendはmodelがquery resolvedRange.toへ解決する。wire dataを変更しない。

### 6.4 additive compatibility

shape追加はschemaVersion 2内のadditive変更。Backend/Frontendを同candidateで更新する。旧clientへ新shapeを
先行送信しない。既存shape enum順を変えず末尾近くへ追加し、reserved fixtureを更新する。

## 7. Annotation layer wire contract

`VisualizationSpecV2`へoptional/defaulted fieldを追加する。

```ts
type AnnotationLayerSpecV1 = {
  id: string;
  frameRef: string;
  mode: "point" | "line" | "region" | "badge";
  enabled: boolean;
  name: string;
  colorToken?: string;
  severityFilter: Array<string>;
  showLabel: "always" | "hover" | "never";
};

type VisualizationSpecV2 = {
  // existing fields
  annotationLayers: AnnotationLayerSpecV1[];
};
```

Rules:

- default `[]`、最大8 layers。
- id unique、既存ID pattern。
- frameRefはPanel query/transformation outputに存在。
- referenced Frame shapeはannotation。
- severityFilter最大20、duplicate拒否。
- colorTokenはshared token schema。
- urlはFrame fieldでありlayer configへ入れない。
- public manifestへannotation valuesを埋め込まない。
- annotation Frameは通常query responseとして取得する。

既存manifest fixtureはdefault追加でparse可能。serialization snapshotとv1 compatibilityを更新する。

### 7.1 Runtime frame separation

Annotation Frameをprimary `frameRefs`へ混ぜない。Panel runtimeは次の2系統を別々に解決する。

```ts
type ResolvedAnnotationLayer = {
  spec: AnnotationLayerSpecV1;
  frame: DashboardDataFrameV2;
};

type DashboardRendererContext<TConfig> = {
  frames: DashboardDataFrameV2[]; // existing primary frames only
  annotationLayers: ResolvedAnnotationLayer[];
  // existing context
};
```

- primary compatibilityは既存`visualization.frameRefs`だけで判定する。
- annotation layerはPanel query/transformation output全体から`frameRef`を解決する。
- annotation missing/invalidはprimary rendererを落とさずlayer単位error noticeにする。
- primary query errorとannotation query errorを混同しない。
- disabled layerはFrameを取得済みでもmodel/rendererへ渡さない。
- Table visualizationへannotationLayersを指定した場合はunsupportedとしてmanifest validationでreject。
- Query Inspectorではannotation Frameを通常Frameとして確認できるがsecret sanitizeを継承する。

Renderer context、registry、Panel runtime、Error Boundaryのfocused testをT1/T9で更新する。

## 8. Shared state semantics

```ts
type StateDatum = {
  raw: string | number | boolean | null;
  text: string;
  semantic: "healthy" | "warning" | "critical" | "unknown";
  colorToken: string;
};
```

Resolution:

1. null -> unknown。
2. value mapping text/color/semantic alias。
3. numeric threshold。
4. fixed field colorはsemantic unknown。
5. default unknown token。

`offline`、`no-data`、`missing`をhealthy/warning/criticalへ暗黙変換しない。業務固有stateはmappingで定義する。

State identityはraw typed value、display textとは分離。mapped textが同じでもraw stateが異なる場合は同一区間へ
mergeしない。ただしconfig `mergeBy="semantic"`を明示した場合だけsemanticでmergeできる。

## 9. Interval model

```ts
type StateInterval = {
  id: string;
  laneId: string;
  laneLabel: string;
  start: number;
  end: number;
  state: StateDatum;
  durationMs: number;
  openEnded: boolean;
};
```

Rules:

- start/end safe integer epoch ms。
- start < end。
- endなしは同laneの次start、最後はresolvedRange.to。
- range外はclipするがraw Table値は保持。
- clip後0 durationは表示modelから除外しnotice。
- same lane overlapはreject。自動trim禁止。
- lane内start昇順必須。暗黙sortしない。
- adjacent mergeはend==next.startかつ選択identity一致。
- gapはstateを捏造せずmissing intervalとして別model化。
- lane最大50、interval最大2,000、laneあたり500。

Threshold-derived presetはstate-sample numeric値をthresholdへ変換し、次sampleまでのintervalを作る。
expected cadenceを超えるgapはmissingとする。

## 10. State Timeline config

```ts
type StateTimelineConfigV1 = {
  laneFieldKey?: string;
  stateFieldKey?: string;
  mergeAdjacent: boolean;
  mergeBy: "raw" | "semantic";
  showValues: "auto" | "always" | "never";
  showDuration: boolean;
  gapMode: "blank" | "unknown-token";
  rowHeight: number;
  expectedCadenceMs?: number;
};
```

- rowHeight 20..64。
- expected cadence 1s..7d。
- single-laneはlane 1件必須。
- multi-laneは2〜50。
- duration-emphasisはduration labelとtop longest summary。
- compactはrowHeight 20、label省略、Table必須。
- threshold-derivedはstate-sample input限定。

Rendererはnative SVG interval rect + HTML lane labels。intervalをtab stopにせずsummary/Tableを使う。

## 11. Sample model / Status History

```ts
type StateSample = {
  id: string;
  laneId: string;
  time: number;
  state: StateDatum;
  missing: boolean;
};
```

Validation:

- lane+time duplicate拒否。
- time昇順。暗黙sortなし。
- expected cadence指定時、toleranceを超える穴にmissing cellsを生成。
- toleranceはcadenceの0..50%。default 10%。
- synthetic missing cellはraw stateを持たない。
- samples最大2,000、lanes最大50、columns最大500、cells最大5,000。

```ts
type StatusHistoryConfigV1 = {
  laneFieldKey?: string;
  expectedCadenceMs?: number;
  cadenceTolerancePercent: number;
  cellWidth: number;
  rowHeight: number;
  missing: "gap" | "unknown-token";
  emphasizeChanges: boolean;
  latestColumn: boolean;
};
```

Preset differencesはdescriptor defaultsで固定し、renderer内にID文字列比較を散らさない。

## 12. Uptime aggregation model

Uptime Gridはstate-sampleまたはstate-intervalからbucketを作る。

```ts
type UptimeBucket = {
  laneId: string;
  start: number;
  end: number;
  observedMs: number;
  healthyMs: number;
  warningMs: number;
  criticalMs: number;
  unknownMs: number;
  missingMs: number;
  uptimeRatio: number | null;
  dominantState: StateDatum["semantic"];
};
```

Rules:

- bucket boundaryはtimezoneとconfig粒度で決定。
- hourlyはlocal hour、dailyはlocal day。DSTの23/25h dayを許容。
- intervalはbucket boundaryでsplit。
- sampleは次sampleまたはcadenceまで状態継続。
- observedMsが0ならratio null。0%にしない。
- uptime numeratorはhealthyのみ。warningを含めるoptionは追加しない。
- denominatorはobservedMs。missingをobservedへ含めない。
- minimum coverage未満はuptime valueを表示せずinsufficient-data。
- ratioを小数clampしない。浮動誤差toleranceだけ適用。
- bucket最大730、lanes最大50、cells最大5,000。

## 13. Uptime Grid config

```ts
type UptimeGridConfigV1 = {
  bucket: "hour" | "day";
  range: "query" | { rollingDays: number };
  minimumCoveragePercent: number;
  showPercentage: boolean;
  showIncidentCount: boolean;
  weekStartsOn: "monday" | "sunday";
  missing: "gap" | "unknown-token";
};
```

- rollingDays 1..365。
- coverage 0..100、default 80。
- daily/30d/90dはtimezone date keyを08から再利用。
- service-matrixは2〜50 lanes。
- incident-overlayはannotation layer最低1件を要求。

## 14. Annotation model

```ts
type AnnotationDatum = {
  id: string;
  layerId: string;
  kind: "event" | "region";
  start: number;
  end?: number;
  message: string;
  severity?: string;
  category?: string;
  colorToken: string;
  safeLink?: string;
};
```

- eventはtime、regionはstart/end。
- duplicate ID拒否。
- message 1..512、表示時React textのみ。
- region start<end。
- query range外を除外、交差regionはclip。
- layer severityFilter適用。
- color priority: layer fixed > severity mapping > muted token。
- urlはexisting same-origin resolver。external/data/javascript拒否。
- layer最大8、annotation合計500、同pixel cluster最大50。
- clusterは件数badgeを表示し、個別dataを捨てない。
- annotation同士のoverlapはvalid。

## 15. Plot overlay integration

Annotation対応type:

```text
core.timeseries
core.bar (timeseries shape only)
core.state-timeline
core.status-history
core.uptime-grid
```

Descriptor `capabilities.annotations=true`へ更新する。category bar等time axisを持たないpresetでlayer指定されたら
incompatible。Panel plot overlayはrendererから次を受け取る。

```ts
type PlotViewport = {
  xDomain: [number, number];
  plotRect: { x: number; y: number; width: number; height: number };
};
```

Renderer-specific axis scaleをoverlayへ渡し、annotation layer側でRecharts internalsをimportしない。
resize/domain変更でpositionを再計算するがFrame validationは再実行しない。

Display:

- point: top marker + vertical guide optional。
- line: vertical line + label。
- region: translucent token-derived background + boundary。
- badge: lane上badge。
- label collisionはgreedy row 3段まで。残りは`+N` cluster。
- hoverだけでなくfocusable layer summary/listを提供。

## 16. Tooltip / Legend / Table

- Timeline: lane、state、start/end、duration、open/missing。
- History: lane、sample time、state、synthetic missing。
- Uptime: bucket、coverage、state durations、ratio、incident count。
- Annotation: message、time/range、severity、safe link。
- state Legendはkeyboard operable。hide stateはlocal UI、Tableは全stateを保持。
- Annotation layer listはenable/disable可能、manifestは変更しない。

Derived Table:

```text
Timeline: Lane / State / Start / End / Duration / Missing / Open
History: Lane / Time / State / Missing / Synthetic
Uptime: Lane / Bucket / Coverage / Healthy / Warning / Critical / Unknown / Missing / Uptime
Annotation: Layer / Kind / Start / End / Message / Severity / Link
```

raw Frame viewも維持する。

## 17. Accessibility / responsive

- native SVG rect/cellを大量tab stopにしない。
- stateを色だけで伝えずLegend/text/patternを用意。
- annotation regionは色だけでなくboundary/label。
- summary最大1,000文字。
- Timelineはcurrent/longest/critical duration。
- Historyはstate counts/latest/missing count。
- Uptimeはratio/coverage/incident count。
- Annotationはlayer countsとcritical先頭5件。
- axe、forced-colors、200% zoom、keyboard layer/Table、reduced motion。

Mobile:

- Timelineはselected/current lane + lane summary。
- Historyは最新N columns + counts。data truncateではなくview window。
- Uptime 90dは30d view + full Table。
- annotation labelはcluster、listを主操作経路。
- horizontal overflowをbodyへ発生させない。

## 18. Limits / performance / security

| Model | Hard limit |
| --- | ---: |
| Timeline lanes / intervals | 50 / 2,000 |
| History lanes / columns / cells | 50 / 500 / 5,000 |
| Uptime buckets / cells | 730 / 5,000 |
| Annotation layers / data | 8 / 500 |
| Annotation pixel cluster | 50 |

- model build 100ms Long Taskなし。
- SVG DOM 6,000 nodes未満。
- interval split/calendar bucketをresizeで再実行しない。
- animation/blink/pulseなし。
- label/messageはtext、raw HTMLなし。
- same-origin linkのみ。
- filter/token/cookie/Inspector dataをannotationへ混ぜない。
- limit超過はtruncateせずincompatible。

## 19. Lazy load / bundle

```text
core-state-timeline/renderer.lazy.tsx
core-status-history/renderer.lazy.tsx
core-uptime-grid/renderer.lazy.tsx
annotations/annotation-layer.tsx
```

- 3 renderer graphからRecharts edge 0。
- annotation layerはtime renderer chunkからdynamic import。
- annotationなしPanelはlayer chunkをrequestしない。
- normal initial/Dashboard shell/Gallery shellにstatic renderer/layerなし。
- 3 renderer + annotation layerへbudget row。
- runtime dependency diff 0。

## 20. Gallery success cases

| Case ID | Type/Preset | 必須確認 |
| --- | --- | --- |
| `timeline-single` | state-timeline/single-lane | open interval |
| `timeline-multi` | state-timeline/multi-lane | lanes |
| `timeline-merged` | state-timeline/merged-adjacent | merge |
| `timeline-duration` | state-timeline/duration-emphasis | duration |
| `timeline-compact` | state-timeline/compact | responsive |
| `timeline-threshold` | state-timeline/threshold-derived | cadence gap |
| `history-grid` | status-history/grid | samples |
| `history-bands` | status-history/bands | state bands |
| `history-multi` | status-history/multi-series | checks |
| `history-changes` | status-history/changes-only | changes |
| `history-latest` | status-history/latest-column | latest |
| `history-compact` | status-history/compact | dense |
| `uptime-hourly` | uptime-grid/hourly | DST hour |
| `uptime-daily` | uptime-grid/daily | coverage |
| `uptime-30d` | uptime-grid/rolling-30d | rolling |
| `uptime-90d` | uptime-grid/rolling-90d | mobile |
| `uptime-services` | uptime-grid/service-matrix | lanes |
| `uptime-incidents` | uptime-grid/incident-overlay | annotations |

Annotation integration cases:

```text
timeseries point + line
time bar point
timeline region + badge
uptime incident region
```

fixed timestamps/timezone、token colors、no random、Table enabled。05〜08 casesを削除しない。

Invalid:

- interval start>=end、overlap、unsorted、2,001 intervals。
- duplicate sample、invalid cadence/tolerance、5,001 cells。
- coverage invalid、bucket 731。
- annotation event/region field mismatch、unsafe URL、501 data、9 layers。
- missing frameRef、category bar annotation、raw color、unknown config。

## 21. Backend / Frontend boundary

Backend:

- new shapes/spec validation、annotation frameRefs、Gallery Frames、limits。
- handlerはDB-side interval/sample/event aggregationを推奨。
- common Backendはincident判定、cadence、uptime numeratorを業務推論しない。
- annotation storage/query builderを追加しない。

Frontend:

- interval/sample/uptime/annotation model、overlay positioning、responsive、Table、summary。
- renderer JSXへoverlap validation、bucket split、coverage計算、clusteringを書かない。

## 22. T0〜T13 Work Packages

| WP | 内容 | 完了gate |
| --- | --- | --- |
| T0 | baseline / capability audit | 08 S13、78 presets |
| T1 | shapes / annotation wire / configs | schema tests |
| T2 | state resolution / interval model | pure tests |
| T3 | State Timeline 6 presets | Gallery 6 |
| T4 | sample/history model | cadence tests |
| T5 | Status History 6 presets | Gallery 6 |
| T6 | uptime aggregation model | split/coverage tests |
| T7 | Uptime Grid 6 presets | Gallery 6 |
| T8 | annotation model / primitives | model/component tests |
| T9 | plot overlay integration | Time Series/Bar/state tests |
| T10 | Table/summary/a11y/mobile | component tests |
| T11 | Gallery conformance | exact cumulative 96 |
| T12 | visual/a11y/performance/bundle | expanded gates |
| T13 | full verify/docs/handoff | full gates/progress |

## 23. T0: Baseline

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

Record: 08 status、78 preset、Gallery count、shape/spec snapshots、time renderer graph、bundle/coverage/visual、
D11 baseline、concurrent changes。

## 24. T1〜T2: Contract / model foundation

T1:

- state-sample/annotation shapesとminimum validator。
- AnnotationLayerSpec、VisualizationSpec default/migration。
- 3 definitions、18 descriptors/defaults。
- strict/limit/frameRef/serialization tests。

T2:

- typed state resolver。
- interval order/open/clip/overlap/gap/merge。
- threshold-derived samples。
- raw vs semantic identity。

```bash
bunx vitest run shared/schemas/dashboard/state-visualizations.schema.test.ts shared/schemas/dashboard/annotation.schema.test.ts shared/schemas/dashboard.schema.test.ts
bunx vitest run web/src/domains/dashboard/v2/visualizations/state/state-value.test.ts web/src/domains/dashboard/v2/visualizations/state/interval-model.test.ts
bun run typecheck
git diff --check
```

## 25. T3〜T9: Feature packages

各WPでdefinition/spec、model、renderer/layer、summary/Table、unit/component、Gallery/E2Eを同時追加する。

| WP | 必須boundary |
| --- | --- |
| T3 Timeline | 50/51 lanes、2,000/2,001 intervals、open/overlap/merge/gap |
| T4 History model | duplicate、cadence tolerance、missing synthesis、5,000/5,001 cells |
| T5 History renderer | 6 presets、latest/changes、mobile view window |
| T6 Uptime model | DST 23/25h、bucket split、coverage 0、missing denominator |
| T7 Uptime renderer | 730/731 buckets、30/90d、service matrix、incident count |
| T8 Annotation | event/region/clip/filter/link/cluster、500/501、8/9 layers |
| T9 Overlay | domain/plotRect/resize、annotationなしlazy、unsupported type拒否 |

Focused gate:

```bash
bunx vitest run web/src/domains/dashboard/v2/visualizations/<family-or-layer>
bun run verify:dashboard-gallery
E2E_PORT=5175 bun run verify:dashboard-e2e -- --grep "<state-or-annotation>"
bun run verify:dashboard-bundle
git diff --check
```

## 26. T10: Table / summary / accessibility

- raw/derived tables全family。
- state/missing/coverage/annotation wording。
- summary <=1,000 chars。
- keyboard legend/layer/Table。
- forced-colors pattern、200% zoom、reduced motion。
- mobile summary/view-window。
- same-origin link regression。

## 27. T11: Gallery conformance

- 3 new types、18 exact presets、cumulative 96。
- 2 new shapes、annotation layer spec default。
- every preset deterministic case、every loader dynamic。
- annotation integration 4 cases。
- summaries/Table、invalid fixtures、05〜08 regression。
- console error 0。

```bash
bun run verify:dashboard-contract
bun run verify:dashboard-coverage
bun run verify:dashboard-frontend-coverage
bun run verify:dashboard-gallery
E2E_PORT=5175 bun run verify:dashboard-e2e
git diff --check
```

## 28. T12: Quality gate

Visual minimum:

```text
gallery-state-desktop.png
gallery-uptime-desktop.png
gallery-state-mobile.png
panel-timeline-multi.png
panel-history-grid.png
panel-uptime-90d.png
panel-timeseries-annotations.png
panel-timeline-region-annotation.png
```

Accessibility: axe、state text、annotation list、forced-colors、zoom、keyboard。
Performance: upper bounds、100ms、DOM nodes、memoized bucket/cluster。
Bundle: 3 renderer/layer、annotation conditional lazy、Recharts edge 0、dependency diff 0。

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

## 29. T13: Full verification / handoff

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

Docs: shapes、annotation wire、interval/cadence/uptime semantics、supported overlays、limits、lazy boundary、
README、LLM_CONTEXT、progress、D11 handoff。

```text
09 status: complete
New renderer types: 3
New presets: 18
Cumulative presets: 96
New data shapes: 2
Annotation display modes: 4
New runtime dependencies: 0
Next: [10 P7](./10-specialized-observability-visualizations.md) O0
```

## 30. Coverage / failure handling

Focused coverageへshape/spec、state/interval/sample/uptime/annotation、summary、renderer、overlayを含める。
statements/lines/functions 80%、branches 70%。

| Failure | 戻るWP |
| --- | --- |
| shape/spec/config | T1 |
| state/interval | T2 |
| Timeline | T3 |
| history model/renderer | T4/T5 |
| uptime model/renderer | T6/T7 |
| annotation model/layer | T8/T9 |
| Table/a11y/mobile | T10 |
| Gallery | T11 |
| quality | T12または原因WP |
| full gate | 原因WP、T13 complete禁止 |

## 31. Stop条件

停止する:

- 08 S13未完了。
- VisualizationSpec additive fieldがcompatibilityを壊す証拠。
- annotation FrameをPanel query outputへbinding不能。
- resolvedRange/timezoneをmodelへ渡せない。
- time rendererからplot domain/rectを安全に取得不能。
- status token/forced-colorsでstate判別不能。
- accessibility contractを弱める必要。
- concurrent変更と安全にmerge不能。

停止しない: interval test増加、label clustering、visual調整、DST fixture、coverage不足、mobile view調整。

## 32. 完了条件

- [ ] 08 S0〜S13 complete。
- [ ] T0〜T13 complete。
- [ ] new types 3 / presets 18 / cumulative 96。
- [ ] state-sample / annotation shapes。
- [ ] AnnotationLayerSpec default/compatibility。
- [ ] State Timeline 6、Status History 6、Uptime Grid 6。
- [ ] point/line/region/badge annotations。
- [ ] overlap/gap/open interval rules。
- [ ] cadence/missing rules。
- [ ] DST/coverage/uptime denominator rules。
- [ ] Time Series/Time Bar/state overlay integration。
- [ ] 18 Gallery + 4 annotation integration cases。
- [ ] Table/summary/mobile/forced-colors/zoom。
- [ ] visual/a11y/performance/bundle/coverage/full verify pass。
- [ ] Recharts imports 0 / runtime dependency 0。
- [ ] progress/docs updated。

## 33. 次計画へ渡す成果

```text
State: interval/sample normalization, gaps, cadence, semantic state
Uptime: timezone buckets, coverage, missing denominator
Annotations: shared wire, event/region model, plot overlay, clustering
Rendering: native SVG dense state grids, mobile summaries
```

[10 P7](./10-specialized-observability-visualizations.md)はNode Graph、Candlestick、Logs、Trace、Flame Graph、
Geomapを扱う。09のannotation、state、severity、time range modelを再利用する。runtime dependencyを増やさず、
専門rendererとmap assetをtype単位のlazy chunkへ隔離する。

## 34. 再開手順

1. 00 P6を読む。
2. 08 S13 completeを確認。
3. progressの09節を読む。
4. branch/statusを確認。
5. current `in_progress` Tを確認。
6. 最後の成功commandを再実行。
7. 最初のpending Tだけを開始。
8. wire/model/renderer/Gallery/testを同packageで完成。
9. T13後、10 O0へhandoff。
