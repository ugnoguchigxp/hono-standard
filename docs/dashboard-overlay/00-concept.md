# Dashboard Visualization Platform コンセプト

## 1. 文書の位置づけ

この文書は `overlay/dashboard` を今後拡張する際の、プロダクトコンセプトと設計判断の最上位文書である。

後続の実装計画書は、機能単位・Work Package 単位に複数へ分割してよい。ただし、各計画書はこの文書に記載された目的、境界、用語、設計原則、完成像を変更してはならない。

この文書が定義するもの:

- Dashboard overlay が提供する価値
- Grafana との関係と「Grafana ライク」の意味
- 対象利用者と主要ユースケース
- Visualization、データ変換、Panel、Dashboard の概念境界
- 長期的に揃える可視化カタログ
- 性能、アクセシビリティ、セキュリティ、variant 適用に関する原則
- 後続の実装計画書を分割する単位

この文書が定義しないもの:

- 個別ファイル名や関数名
- Zod schema の最終的な field 名
- Work Package の詳細な作業手順
- 依存ライブラリの exact version
- 各リリースへ含める最終的な機能数

これらは、この文書を正本として別の実装計画書で定義する。

## 2. 一文で表すコンセプト

`overlay/dashboard` は、アプリケーション固有の集計ロジックを接続するだけで、運用監視、業務指標、状態分析、データ探索に使える Dashboard を組み込める、軽量で型安全な Visualization Platform Starter である。

## 3. 目指す位置

### 3.1 提供するもの

この overlay は、次の中間地点を狙う。

```text
単純な Recharts サンプル
        ↓
再利用可能な Dashboard Visualization Platform Starter
        ↓
Grafana のような独立 Observability Platform
```

単純なチャートコンポーネント集ではない。一方で、Grafana のデータソースエコシステム、運用基盤、アラート基盤、権限管理を再実装するものでもない。

提供する中心価値は次の4点である。

1. アプリケーション内へ自然に組み込める。
2. API と UI の間に型安全な集計・変換契約がある。
3. 複数の Visualization を同じデータから選択できる。
4. starter として理解、変更、削除、variant 適用が容易である。

### 3.2 「Grafana ライク」の定義

このプロジェクトにおける「Grafana ライク」は、Grafana と同一製品になることを意味しない。

次の体験をアプリケーション内 Dashboard で提供することを意味する。

- Panel を自由に配置、リサイズ、複製できる。
- 同一データを複数の Visualization で確認できる。
- range、timezone、refresh、variable を Dashboard 全体で共有できる。
- threshold、value mapping、unit、legend、tooltip、field override を設定できる。
- query 結果へ共通 transformation を適用できる。
- loading、empty、partial、stale、error を区別できる。
- chart から table、詳細画面、関連 Dashboard へ移動できる。
- 時系列だけでなく、分布、状態、階層、フロー、ログ、トレースを扱える。
- Visualization を必要時だけ読み込み、通常アプリの初期表示を重くしない。

### 3.3 同等性を主張する範囲

将来的に「Grafana ライク」と説明できる完成条件は、以下の範囲に限定する。

- Dashboard の閲覧とレイアウト編集
- 一般的な可視化タイプの幅
- Field configuration と override
- Transformation pipeline
- Filter、drilldown、annotation、crosshair などの分析操作
- Query Inspector とデータ状態表示

次の領域で Grafana と同等とは主張しない。

- Prometheus、Loki、Tempo などのデータソース plugin ecosystem
- Alert rule、notification policy、on-call
- Organization、folder、team、RBAC の管理基盤
- Dashboard marketplace と外部 plugin 配布
- 大規模な observability data の保存、検索、indexing

## 4. 対象利用者

### 4.1 Starter 利用者

- 新規アプリへ管理 Dashboard を短期間で追加したい開発者
- SQLite、PostgreSQL、Turso、Cloudflare など異なる variant を使う開発者
- Grafana を別サービスとして導入するほどではないが、表だけでは不足するプロジェクト
- AI agent に継続実装させるため、契約と拡張点が明確な starter を必要とするチーム

### 4.2 Dashboard 閲覧者

- 運用担当者
- プロダクト管理者
- サポート担当者
- データを確認する業務ユーザー
- 開発環境で API や集計結果を確認する開発者

### 4.3 Dashboard 定義者

初期段階では Dashboard 定義者は TypeScript を編集できる開発者とする。

将来的に設定 UI を追加しても、コード定義を捨てない。UI は同じ manifest と schema を生成・編集する入口として扱う。

## 5. 主要ユースケース

### 5.1 Operations

- request rate、error rate、latency、throughput
- CPU、memory、storage、queue depth
- service、region、version ごとの比較
- deploy 前後の変化
- uptime、health、incident state

### 5.2 Product Analytics

- active user、conversion、retention
- feature usage
- funnel
- cohort やカテゴリ別構成比
- 期間比較と傾向

### 5.3 Business Dashboard

- 売上、注文、在庫、原価
- 目標対実績
- 地域別、部門別、商品別の比較
- Top N、構成比、累積値
- KPI と詳細表

### 5.4 Application Diagnostics

- structured logs
- distributed trace
- profile / flame graph
- dependency / node graph
- Query Inspector による request、response、timing の確認

## 6. 設計原則

### 6.1 軽量性は機能数ではなく読み込み方で守る

Visualization が増えても、通常ページの initial bundle へ含めない。

- Dashboard は route-level lazy load を維持する。
- 重い Visualization は visualization-level lazy load とする。
- Geomap、Flame Graph、Node Graph などの特殊 renderer は別 chunk にする。
- 未使用 Visualization のコードと依存を読み込まない。
- animation や高密度描画は reduced motion と端末性能を考慮する。

「機能を減らすこと」ではなく「必要な機能だけ読み込むこと」で軽量性を実現する。

### 6.2 Recharts は主要 renderer だが、プラットフォーム境界ではない

Recharts は次の用途で第一選択とする。

- Cartesian chart
- Pie / Radar / Radial Bar
- Scatter / Bubble
- Funnel
- Treemap / Sankey / Sunburst

一方、次の Visualization は SVG、Canvas、HTML、専用ライブラリを使用してよい。

- Gauge / Bullet
- Heatmap
- State Timeline / Status History
- Logs / Trace Waterfall
- Flame Graph
- Node Graph
- Geomap

すべての renderer は共通 Visualization Registry、Panel shell、theme、accessibility、table fallback の配下に置く。

### 6.3 データ契約を renderer より先に設計する

個別チャートの都合で API response を増殖させない。

処理の基本構造は次とする。

```text
Data source / application query
              ↓
      normalized data frame
              ↓
   transformation pipeline
              ↓
 visualization data adapter
              ↓
           renderer
```

Backend handler は DB 固有の取得・一次集計を担当する。共通層は DB 固有 SQL を生成しない。

共通層は次を担当する。

- validation
- limits
- metadata
- normalization
- transformations
- Visualization 互換性判定
- table fallback

### 6.4 同じデータを複数の方法で確認できる

Visualization はデータそのものではなく、データの見せ方である。

- Chart と Table は同一の normalized data を使う。
- Visualization を変更するためだけに API query を作り直さない。
- 選択中の Visualization がデータへ適合しない場合は理由を表示する。
- compatible Visualization を候補として提示できる設計にする。
- raw data と transformed data を Inspector で区別する。

### 6.5 設定可能性と安全性を両立する

設定は共有 Zod schema で検証する。

- 任意 JavaScript を設定として実行しない。
- 任意 SQL editor は core に含めない。
- formatter、link、action は allowlist と構造化設定を使う。
- URL filter は公開される前提で secret や PII を保持しない。
- action は閲覧操作と明確に区別し、追加する場合は権限と確認 UI を必須とする。

### 6.6 Accessibility は後付けにしない

すべての Visualization は次を満たす。

- accessible label
- keyboard で到達可能な操作
- screen reader summary
- color だけに依存しない状態表現
- tooltip 内容へ代替経路を持つ
- table fallback
- reduced motion
- WCAG を意識した token 配色

グラフを描けても、数値を確認できない状態を完成としない。

### 6.7 starter として差し替えやすくする

- Dashboard core は DB、deploy runtime、業務 schema に依存しない。
- demo query と実アプリ query の境界を明示する。
- Visualization は registry から追加・削除できる。
- advanced renderer の依存は optional にできる。
- main と各 `variant/*` に同じ契約で適用できる。
- overlay を外しても auth、showcase、通常 route が壊れない。

## 7. コア概念

### 7.1 Dashboard

Dashboard は以下を束ねる表示単位である。

- metadata
- default range / timezone / refresh
- variables
- panels
- layout
- annotations
- shared interaction state

Dashboard はデータソースそのものを所有しない。Panel が query または data binding を参照する。

### 7.2 Panel

Panel は次の責務を持つ。

- title、description、links
- layout constraints
- query binding
- transformations
- Visualization 設定
- loading / empty / partial / stale / error 表示
- Inspector
- table fallback

Panel shell と Visualization renderer は分離する。

### 7.3 Visualization

Visualization は normalized data を表示する plugin-like component である。

各 Visualization は少なくとも次を宣言する。

- stable type ID
- display name と category
- supported data shapes
- configuration schema
- default configuration
- minimum / recommended panel size
- renderer loader
- legend / tooltip support
- table fallback policy
- accessibility summary builder
- export capability

### 7.4 Visualization Preset

表示バリエーションを増やすため、renderer type と preset を分ける。

例:

```text
renderer: timeseries
presets:
  - line
  - smooth-line
  - step-line
  - area
  - stacked-area
  - percent-stacked-area
  - time-bars
```

ユーザーには別の表示形式として見せられるが、内部実装と schema を不必要に複製しない。

### 7.5 Data Frame

Data Frame は Visualization 間で共有する正規化データ表現である。

必要な概念:

- frame ID / name
- ordered fields
- field type
- values
- row count
- field metadata
- unit / decimal places
- labels / dimensions
- color token
- nullability
- data state metadata

対象 field type:

- time
- number
- string
- boolean
- duration
- link
- latitude / longitude
- trace ID / span ID

Data Frame から以下の logical data shape を判定できるようにする。

- scalar
- timeseries
- category
- table
- distribution
- matrix
- state interval
- hierarchy
- graph
- logs
- traces
- profile
- geo

### 7.6 Transformation

Transformation は query 後、Visualization 前に Data Frame を変換する純粋処理である。

基本 transformation:

- reduce: latest / first / min / max / average / sum / count
- rate
- delta / difference
- moving average
- cumulative sum
- group by
- sort
- limit / Top N
- histogram binning
- filter fields / rows
- rename fields
- calculate field
- join
- pivot / unpivot
- threshold to state
- fill missing values
- time bucket

原則:

- 入出力を schema で検証する。
- 実行順序を manifest に保存する。
- 破壊的な暗黙変換をしない。
- 大きなデータへ適用する場合は limit と計算量を定義する。
- Server で行う変換と Browser で行う変換を明示する。

DB で効率的に行うべき集計は handler が担当し、Browser transformation は表示上の再構成を中心とする。

### 7.7 Field Configuration

共通 Field Configuration は Visualization ごとの重複設定を減らす。

- display name
- unit
- decimal places
- min / max
- color
- no-value text
- threshold
- value mapping
- link

Field Override は matcher と property の組み合わせで表現する。

matcher 例:

- field name
- field type
- regex
- query / frame ID

property 例:

- color token
- line width / style
- axis assignment
- unit / decimal places
- hide
- stacking group
- threshold

## 8. Visualization カタログ

カタログは「独立 renderer」と「preset」を合わせ、Dashboard 作成者が40以上の表示バリエーションから選べる状態を目標とする。

実装計画では次の tier を明示する。

| Tier | 扱い | 対象 |
| --- | --- | --- |
| Core | 標準 overlay の必須機能 | Time Series、Bar、Stat、Table、Pie、Scatter、Histogram、Heatmap、Gauge |
| Operations | Grafana ライクを名乗るための必須機能 | State Timeline、Status History、Annotations、shared interaction、Inspector |
| Extended | 標準 overlay に段階的に追加する機能 | Treemap、Sunburst、Sankey、Node Graph、Box Plot、Candlestick |
| Specialized | 重い依存または専用データを必要とする optional renderer | Logs、Trace Waterfall、Flame Graph、Geomap |

Specialized tier も共通 registry と schema の配下に置くが、通常の Dashboard chunk へ常時含めない。

### 8.1 Core charts

| Family | Preset / Visualization | 主な用途 |
| --- | --- | --- |
| Time series | Line | 時系列の基本比較 |
| Time series | Smooth Line | 緩やかな傾向 |
| Time series | Step Line | 状態値、段階的変化 |
| Time series | Area | 量の推移 |
| Time series | Stacked Area | 系列ごとの累積 |
| Time series | 100% Stacked Area | 時系列構成比 |
| Time series | Time Bars | 時間bucketごとの量 |
| Time series | Stacked Time Bars | 時間bucketごとの内訳 |
| Time series | Range / Band | min-max、信頼区間、SLO帯 |
| Composed | Dual-axis | 単位が異なる系列比較 |
| Compact | Sparkline | Stat、Table cell 内の傾向 |
| Bar | Vertical Bar | カテゴリ比較 |
| Bar | Horizontal Bar | 長いlabel、ranking |
| Bar | Grouped Bar | 複数系列比較 |
| Bar | Stacked Bar | カテゴリ内訳 |
| Bar | 100% Stacked Bar | カテゴリ構成比 |
| Bar | Lollipop | 軽量なカテゴリ比較 |
| Bar | Waterfall | 増減要因 |

### 8.2 Distribution and relationship

| Visualization | 主な用途 |
| --- | --- |
| Histogram | 値の分布 |
| Heatmap | 時間×bucket、密度 |
| Scatter | 2変数の相関 |
| Bubble | 3変数の相関 |
| Box Plot | 中央値、四分位、外れ値 |
| Pie | 単純な構成比 |
| Donut | 構成比と中心KPI |
| Radar | 多軸比較 |
| Radial Bar | radial ranking / progress |
| Funnel | 段階別減少 |

### 8.3 KPI and status

| Visualization | 主な用途 |
| --- | --- |
| Stat | 主要な単一値 |
| Stat with Sparkline | 現在値と傾向 |
| Gauge | min-max に対する現在値 |
| Bar Gauge | 複数値の達成度 |
| Bullet Chart | 目標、実績、評価帯 |
| Progress | 完了率 |
| Traffic Light | 正常、警告、異常 |
| State Timeline | 状態変化と継続時間 |
| Status History | 定期観測された状態 |
| Calendar Heatmap | 日別活動量 |
| Uptime Grid | 稼働状況の連続表示 |

### 8.4 Hierarchy and flow

| Visualization | 主な用途 |
| --- | --- |
| Treemap | 階層別の量 |
| Sunburst | 多階層の構成比 |
| Sankey | 流入、流出、遷移 |
| Node Graph | service dependency、ネットワーク |

### 8.5 Specialized observability

| Visualization | 主な用途 |
| --- | --- |
| Candlestick / OHLC | 価格、範囲変動 |
| Logs | structured log の検索・閲覧 |
| Trace Waterfall | span の時間関係 |
| Flame Graph | profile とhotspot |
| Geomap | 地理的分布 |

### 8.6 Data views

| Visualization | 主な用途 |
| --- | --- |
| Table | 汎用データ確認 |
| Pivot Table | dimension 集計 |
| Key / Value Table | metadata、単一record |

## 9. 共通 Panel 機能

すべての Visualization で可能な限り共通化する。

### 9.1 表示設定

- title / description
- transparent / surface background
- unit / decimal places
- min / max
- threshold
- value mapping
- field override
- no-value表示

### 9.2 Tooltip

- single
- all series
- nearest
- sort by value
- hide zero / null
- max width / max rows

### 9.3 Legend

- hidden / list / table
- bottom / right
- series value: latest / min / max / average / sum
- click to hide
- isolate series
- keyboard operation

### 9.4 Interaction

- hover
- shared crosshair
- zoom
- range selection
- reset zoom
- data link
- drilldown
- inspect
- fullscreen
- export

### 9.5 Panel editing

- add
- remove
- duplicate
- move
- resize
- change Visualization
- edit query binding
- edit transformations
- edit field configuration
- Save / Cancel / Reset

設定 UI の導入時も View mode と Edit mode を明確に分離する。

## 10. Dashboard 全体の機能

- range
- timezone
- refresh
- variables
- dependent variables
- annotations
- shared crosshair
- layout
- row / section
- collapse / expand
- kiosk / fullscreen
- URL state
- browser persistence
- optional server persistence

初期 overlay の localStorage layout は維持し、server persistence は独立した拡張計画として扱う。

## 11. Data state

成功と失敗の二値だけにしない。

Panel は次を区別する。

- pending
- refreshing
- success
- empty
- partial
- stale
- error without data
- error with previous data
- incompatible visualization
- transformation error
- truncated / limit exceeded

どの状態でも Panel の占有サイズを不必要に変えず、Dashboard 全体のレイアウトを安定させる。

## 12. Performance budget

後続計画書は、最低限次の budget を定義する。

- 通常 route の initial graph に Dashboard renderer を含めない。
- Dashboard route の初期表示では現在使用中の renderer family だけを優先する。
- 大型 renderer は interaction 後または viewport 到達時に読み込める。
- point / row / series / node / cell 数へ上限を設ける。
- 高密度データは downsampling、aggregation、virtualization を使用する。
- Logs、Table、Trace は行 virtualization を前提にする。
- Resize 中に高コスト再描画を連続実行しない。
- browser main thread を長時間占有する transformation を避ける。

性能 gate は bundle size だけでなく、描画件数と interaction responsiveness を含める。

## 13. Design system

- 色は既存 CSS variable / design token を使う。
- Visualization 固有の raw hex color を manifest に保存しない。
- categorical palette、sequential palette、diverging palette、status palette を token として定義する。
- light / dark theme の双方で意味が保たれる設計にする。
- threshold、state、series color の優先順位を定義する。
- chart 内 typography と spacing は Panel サイズに応じて段階的に変える。

## 14. Mobile 方針

Desktop の縮小版にはしない。

- Dashboard layout は1列へ落とす。
- Panel は推奨高さを mobile 用に再計算する。
- legend は折り返しまたは省略可能にする。
- tooltip は hover 前提にしない。
- dense chart は要約、横scroll、table fallback を使う。
- edit 操作は drag だけに依存せず、move control を提供する。
- advanced Visualization は mobile 用 summary 表示を持ってよい。

## 15. Security and privacy

- Dashboard API は既存 auth middleware 配下に置く。
- Dashboard、Panel、query ごとの認可を将来追加できる境界を保つ。
- Query Inspector は secret、token、cookie、raw SQL を表示しない。
- data link は same-origin allowlist を基本とする。
- external link は明示設定と安全な属性を必要とする。
- variable と URL search params へ secret / PII を保存しない。
- CSV / JSON export は権限と件数上限を継承する。
- HTML、Markdown、log message を表示する renderer は sanitization を必須とする。
- action panel を追加する場合、CSRF、権限、確認、audit を独立要件とする。

## 16. Extensibility

Visualization Registry は内部 plugin point として設計する。ただし、初期段階で外部 package を動的にインストールする plugin marketplace は作らない。

拡張方法:

- repository 内に renderer module を追加
- registry へ明示登録
- Zod schema と default config を追加
- data shape compatibility を宣言
- lazy loader を追加
- test fixture と Gallery panel を追加

将来、別 package へ分離できる public boundary は意識するが、monorepo package 分割を先回りして必須にしない。

## 17. Visualization Gallery

全 Visualization の確認用に、業務 Dashboard とは別の Gallery Dashboard を用意する。

Gallery の責務:

- 各 renderer / preset の正常表示
- loading / empty / partial / stale / error fixture
- threshold / mapping / override の例
- desktop / tablet / mobile の確認
- table fallback
- accessibility
- performance upper-bound fixture
- theme token の確認

Gallery は showcase であり、実運用の Dashboard manifest を不必要に巨大化させない。

## 18. Testing philosophy

### 18.1 Contract tests

- Visualization config schema
- Data Frame schema
- transformation input / output
- compatibility判定
- limits
- migration / versioning

### 18.2 Renderer tests

- representative data
- null / negative / zero / large value
- threshold / mapping
- legend / tooltip
- accessible summary
- table fallback

### 18.3 Browser tests

- Visualization picker
- Chart / Table toggle
- filter / range / API request
- shared crosshair
- zoom / reset
- edit / save / cancel
- lazy chunk
- mobile layout

### 18.4 Visual regression

Visualization Gallery の代表 viewport を screenshot baseline として管理できる構造にする。

すべてのデータ点を pixel 単位で固定するのではなく、重なり、overflow、欠落、token 逸脱を検出する。

## 19. Versioning and migration

Dashboard manifest、layout、Visualization config、transformation は version を持つ。

- schema version を暗黙推測しない。
- minorなdefault変更でも表示が変わる場合は migration を検討する。
- unknown Visualization type は Dashboard 全体を落とさず、対象 Panel を incompatible state にする。
- localStorage layout は layoutVersion 不一致時に安全にresetする。
- deprecated type / option は removal 前に migration path を用意する。

## 20. 非目標

以下は Visualization Platform Starter の core には含めない。

- observability data の収集、保存、indexing
- Prometheus / Loki / Tempo 互換 backend の再実装
- 任意 SQL、任意 JavaScript の実行 UI
- 外部 plugin marketplace
- alert rule engine
- notification delivery
- on-call management
- organization / billing
- 完全な Dashboard RBAC 管理画面
- 大規模 BI semantic layer
- spreadsheet の完全代替

外部 data source adapter、server persistence、alerting、public embed は独立 overlay または variant として追加できる。

## 21. 完成像

このコンセプトにおける完成像は、次の状態である。

- 40以上の表示バリエーションを選択できる。
- renderer と preset が整理され、巨大な条件分岐がない。
- 同じ Data Frame を複数 Visualization と Table で確認できる。
- 10種類以上の共通 transformation がある。
- field configuration と override が共通化されている。
- 運用監視に必要な Gauge、Heatmap、State Timeline、Status History がある。
- 階層・フロー用の Treemap、Sankey、Node Graph がある。
- Logs、Trace、Flame Graph、Geomap を独立 lazy renderer として追加できる。
- Visualization Gallery が存在する。
- mobile、accessibility、loading/error state が全 renderer で考慮されている。
- 通常ページの initial bundle は Dashboard 機能追加前と同等の境界を維持する。
- DB variant を変更しても共有契約、renderer、transformation を再利用できる。

これは「Grafana のコピー」ではなく、アプリケーションへ組み込む用途に絞った軽量 Visualization Platform の完成像である。

## 22. 後続実装計画書の分割単位

後続の計画書は、少なくとも次の単位へ分割する。

| Plan | 対象 |
| --- | --- |
| P0 | Visualization Registry、Data Frame、schema versioning、lazy boundary |
| P1 | Transformation pipeline、Field Configuration、Override |
| P2 | [05: Core Time Series、Bar、Composed、Sparkline](./05-cartesian-visualizations.md) |
| P3 | [06: Pie、Radar、Radial Bar、Scatter、Funnel、Treemap、Sankey、Sunburst](./06-composition-relationship-hierarchy-flow.md) |
| P4 | [07: Stat、Gauge、Bar Gauge、Bullet、Progress、Traffic Light](./07-kpi-goal-status-visualizations.md) |
| P5 | [08: Histogram、Heatmap、Box Plot、Calendar Heatmap](./08-distribution-heatmap-statistical-visualizations.md) |
| P6 | [09: State Timeline、Status History、Uptime Grid、Annotations](./09-state-timeline-status-annotations.md) |
| P7 | [10: Node Graph、Candlestick、Logs、Trace、Flame Graph、Geomap](./10-specialized-observability-visualizations.md) |
| P8 | Visualization picker、Panel editor、duplicate、fullscreen、export |
| P9 | Shared interaction、crosshair、zoom、drilldown、URL state |
| P10 | Gallery、accessibility、visual regression、performance、bundle gate |
| P11 | variant適用、migration、release |

各計画書は次を必ず含む。

1. このコンセプトのどの節を実現するか。
2. 対象と非対象。
3. 共有契約の変更。
4. Backend / Frontend の責務境界。
5. lazy load と performance budget。
6. accessibility と table fallback。
7. migration / compatibility。
8. unit / integration / browser / bundle gate。
9. 完了条件。
10. 次の計画書へ渡す前提。

## 23. 意思決定ルール

計画や実装で迷った場合は、次の順で判断する。

1. 通常アプリの初期表示を重くしないか。
2. 同じデータを複数の表示へ再利用できるか。
3. API と UI の契約が型安全か。
4. table fallback と accessibility が成立するか。
5. DB / runtime variant に依存していないか。
6. starter 利用者が理解、変更、削除できるか。
7. 機能数ではなく実際の分析用途を増やしているか。

上記を満たさない機能は、Grafana に存在するという理由だけで追加しない。

## 24. 参照

- [Grafana Visualizations](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/visualizations/)
- [Grafana Panels and visualizations](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/)
- [Grafana State timeline](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/visualizations/state-timeline/)
- [Grafana Gauge](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/visualizations/gauge/)
- [Grafana Flame graph](https://grafana.com/docs/grafana/latest/visualizations/panels-visualizations/visualizations/flame-graph/)
- [Recharts API](https://recharts.github.io/en-US/api/)
