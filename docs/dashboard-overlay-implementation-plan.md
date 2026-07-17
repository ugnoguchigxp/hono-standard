# Dashboard Overlay 実装計画

## 目的

`main` を基点に `overlay/dashboard` を作成し、SQLite、PostgreSQL、Turso、Cloudflare などの各 variant へ重ねられる、Grafana より軽量な Dashboard スターターを提供する。

この文書は初期 Dashboard v1 実装の入口である。Visualization Platform としての長期的な目的、境界、完成像は [Dashboard Visualization Platform コンセプト](./dashboard-overlay/00-concept.md) を最上位正本とする。

初期 v1 実装はWP0〜WP12まで完了済みであり、この文書の後半は履歴とbaseline契約として残す。Visualization Platform v2の[01: 共有契約 実装計画](./dashboard-overlay/01-contracts.md) C0〜C9、[02: Backend実装計画](./dashboard-overlay/02-backend.md) B0〜B12、[03: Frontend実装計画](./dashboard-overlay/03-frontend.md) F0〜F12は完了済みである。

04 D0〜D10、[05: Cartesian Visualization拡張](./dashboard-overlay/05-cartesian-visualizations.md)
V0〜V12、[06: Composition・Relationship・Hierarchy・Flow Visualization拡張](./dashboard-overlay/06-composition-relationship-hierarchy-flow.md)
R0〜R13、[07: KPI・Goal・Status Visualization拡張](./dashboard-overlay/07-kpi-goal-status-visualizations.md)
K0〜K12、[08: Distribution・Heatmap・Statistical Visualization拡張](./dashboard-overlay/08-distribution-heatmap-statistical-visualizations.md)
S0〜S13、[09: State Timeline・Status History・Uptime Grid・Annotations](./dashboard-overlay/09-state-timeline-status-annotations.md)
T0〜T13、[10: Specialized Observability Visualization](./dashboard-overlay/10-specialized-observability-visualizations.md)
O0〜O18、04 D11の初回variant matrixは完了済みである。

2026-07-18の優先判断で実施した
[Data Source Adapters](./dashboard-overlay/data-source-adapters.md)のP0 AD0〜AD6とP1 AD7〜AD10は完了済みである。
P0だけを適用・再検証する場合は[P0実装計画](./dashboard-overlay/data-source-adapters-p0.md)を使用する。
次はadapter candidateに対する04 D11再検証であり、Visualization roadmap P8のPanel editorは後続へ維持する。

履歴上、Visualization拡張は
[09: State Timeline・Status History・Uptime Grid・Annotations](./dashboard-overlay/09-state-timeline-status-annotations.md)
T0〜T13で18 presetと共有annotation layerを追加し、続いて
[10: Specialized Observability Visualization](./dashboard-overlay/10-specialized-observability-visualizations.md)
O0〜O18でNode Graph、Candlestick、Logs、Trace、Flame Graph、Geomapの30 presetを追加する。
04は品質・release、05〜10は各Visualization familyの正本である。

## 正本文書

| 順序 | 文書 | 正本とする内容 |
| ---: | --- | --- |
| 0 | [Visualization Platform コンセプト](./dashboard-overlay/00-concept.md) | プロダクト目的、Grafanaライクの定義、設計原則、長期カタログ、後続計画の境界 |
| 1 | [v2共有契約 実装計画](./dashboard-overlay/01-contracts.md) | v1 compatibility、Data Frame、Field Configuration、Visualization / Transformation envelope、v2 manifest / transport |
| 2 | [v2 Backend実装計画](./dashboard-overlay/02-backend.md) | dual v1/v2 runtime、registry、multi-query、Data Frame normalization、server transformation、limits、version negotiation、API |
| 3 | [v2 Frontend実装計画](./dashboard-overlay/03-frontend.md) | v2 API、Visualization Registry、renderer lazy load、Browser Transformation、Data Frame、Panel state、layout、Table fallback |
| 4 | [検証・Gallery・Delivery実装計画](./dashboard-overlay/04-testing-and-delivery.md) | Gallery、conformance、unit/API/UI/E2E/visual/a11y/performance/bundle、variant matrix、release/rollback |
| 5 | [Cartesian Visualization拡張](./dashboard-overlay/05-cartesian-visualizations.md) | Time Series、Area、Sparkline、Bar、Lollipop、Waterfall、Dual-axisの18 preset |
| 6 | [Composition・Relationship・Hierarchy・Flow拡張](./dashboard-overlay/06-composition-relationship-hierarchy-flow.md) | Pie、Radar、Radial Bar、Scatter、Funnel、Treemap、Sunburst、Sankeyの18 preset |
| 7 | [KPI・Goal・Status Visualization拡張](./dashboard-overlay/07-kpi-goal-status-visualizations.md) | Stat、Gauge、Bar Gauge、Bullet、Progress、Traffic Lightの21 preset |
| 8 | [Distribution・Heatmap・Statistical拡張](./dashboard-overlay/08-distribution-heatmap-statistical-visualizations.md) | Histogram、Heatmap、Box Plot、Calendar Heatmapの20 preset |
| 9 | [State Timeline・Status History・Uptime Grid・Annotations](./dashboard-overlay/09-state-timeline-status-annotations.md) | 状態系18 presetと共有annotation layer |
| 10 | [Specialized Observability Visualization](./dashboard-overlay/10-specialized-observability-visualizations.md) | Node Graph、Candlestick、Logs、Trace、Flame Graph、Geomapの30 preset |
| 採用 | [Data Source Adapters](./dashboard-overlay/data-source-adapters.md) | Record[]、SQL / Drizzle、HTTP / JSON・pipelineを既存Data Frameへ接続するserver-side adapter |
| 採用P0 | [Data Source Adapters P0](./dashboard-overlay/data-source-adapters-p0.md) | Record[]、query helper、read-only Drizzle、SQLite integrationの実行順と受入条件 |
| 常時 | [進捗台帳](./dashboard-overlay/progress.md) | 現在の work package、検証結果、次の作業、blocker |

文書間で記述が競合した場合は、プロダクトの目的と長期的な境界についてはコンセプト文書を優先する。共有契約は01、Backend v2 runtimeは02、Frontend v2 runtimeは03、検証・Gallery・release判定は04、Visualization family固有仕様は05〜10の該当文書を優先する。初期v1のテスト記録は[進捗台帳](./dashboard-overlay/progress.md)の履歴として参照する。後続拡張でv1の非目標を変更する場合は、既存計画を暗黙に読み替えず、新しい計画書に対象、migration、互換性を明記する。

## 初期リリースで必須とする機能

レビューで挙がった A1〜A8 はすべて初期スコープに含める。

| ID | 機能 | 主な正本 |
| --- | --- | --- |
| A1 | static/query variable、依存 variable、filter key/value 検証 | 共有契約、Backend、Frontend |
| A2 | sort、duplicate 検出、gap fill、series/row 上限、finite 検証 | 共有契約、Backend |
| A3 | View/Edit layout、Save/Cancel/Reset、keyboard 操作 | Frontend |
| A4 | threshold、value mapping、reference line、null/axis 設定 | 共有契約、Frontend |
| A5 | pending、refreshing、empty、partial、stale、error-with-data | 共有契約、Frontend |
| A6 | development 用 Query Inspector | 共有契約、Backend、Frontend |
| A7 | same-origin allowlisted drilldown / data link | 共有契約、Frontend |
| A8 | AbortSignal 伝播、timeout、同時実行上限、queue overflow | Backend、Frontend |

従来要件もすべて維持する。

- Recharts と `react-grid-layout` の route-level lazy load
- 既存 CSS variable / design token による配色
- TanStack Router search params による期間・timezone・refresh・filter の復元
- API request / response の共有 Zod validation
- React Query の loading / error / retry / refreshing の実演
- desktop 2〜4 panel、mobile 1列
- Chart と Table の同一データ表示
- Tooltip、Legend、`accessibilityLayer`、screen reader summary
- Playwright による期間変更、URL、API request、response、表示の一貫検証
- draggable / resizable layout と browser persistence

## 固定済みの設計判断

実装中に以下を再検討しない。変更が必要な場合は、実装を止めて計画書を先に更新する。

1. branch 名は `overlay/dashboard` とする。
2. DB schema、migration、DB 固有 SQL、業務固有 seed は含めない。
3. Dashboard と panel の集合は server-side の静的コード定義とする。
4. Dashboard 定義の DB 保存、WYSIWYG editor、任意 SQL、plugin、alerting は対象外とする。
5. layout は初期リリースでは `localStorage` 保存とし、server 保存は行わない。
6. panel query は panel 単位 endpoint とし、Frontend は `useQueries` で並列取得する。
7. 同時実行量は Backend limiter で制御し、batch API は追加しない。
8. relative range は descriptor のまま送信し、Server が `now` を確定する。
9. filter は TanStack Router の単一 `filters` object search param に保存し、custom serializer は追加しない。
10. handler は DB-side aggregation を行い、共通層は SQL を生成しない。
11. 共通 normalizer は不正・過剰な出力を暗黙修正せず、契約違反として失敗させる。gap fill だけは panel 定義に従って実行する。
12. Query Inspector は development のみ有効とし、SQL、cookie、token、secret を表示しない。
13. drilldown は同一 origin の TanStack Router route だけを許可する。
14. layout は通常 View mode で lock し、Edit mode の Save 時だけ永続化する。

## 非目標

- Dashboard / folder 管理
- Dashboard version history
- server-side layout persistence
- WYSIWYG panel editor
- 任意 query / expression / transformation editor
- data source plugin
- alert rule / notification
- annotations
- period comparison
- CSV / PDF / PNG export
- public snapshot / embed
- Dashboard RBAC

これらのための抽象化を先回りして追加しない。

## Visualization Platform v2 実行順序

| 順序 | Work package | 状態 | 次へ進む条件 |
| ---: | --- | --- | --- |
| 1 | C0〜C9: shared contracts | complete | C9 gate成功 |
| 2 | B0〜B12: Backend runtime | complete | B12 gate成功 |
| 3 | F0〜F12: Frontend runtime | complete | F12 gate成功 |
| 4 | D0〜D10: Gallery / quality foundation | complete | 05前baseline gate成功 |
| 5 | V0〜V12: Cartesian 18 variations | complete | 05 V12 full gate成功 |
| 6 | D11: 05 candidate variant matrix | complete | 05 expanded candidateの互換性証拠 |
| 7 | R0〜R13: non-Cartesian 18 variations | complete | 06 R13 full gate成功 |
| 8 | K0〜K12: KPI / Goal / Status 21 presets | complete | 07 K12 full gate成功 |
| 9 | S0〜S13: Distribution / Heatmap / Statistical 20 presets | complete | 08 S13 full gate成功 |
| 10 | T0〜T13: State / Uptime / Annotations | complete | 09 T13 full gate成功 |
| 11 | O0〜O18: Specialized Observability 30 presets | complete | 10 O18 full gate成功 |
| 12 | AD0〜AD6: Record / Drizzle P0 | pending | adapter P0 full gate成功 |
| 13 | AD7〜AD10: HTTP / JSON・pipeline P1 | blocked_by_P0 | adapter P1 full gate成功 |
| 14 | D11 revalidation / D12: Release completion | blocked_by_adapters | adapter candidateのvariant matrixと04 release gate成功 |

D0〜D11とT0〜T13、O0〜O18の既存証拠をbaselineとして保持し、AD0〜AD6、AD7〜AD10、D11 revalidation、D12の順を飛ばさない。各package開始時と完了時に[進捗台帳](./dashboard-overlay/progress.md)を更新する。D12完了前にtag、push、release公開を行わない。

## 初期v1 Work package履歴

| WP | 内容 | 開始条件 | 完了 gate |
| --- | --- | --- | --- |
| WP0 | baseline、branch、依存追加 | `main` が clean に扱える | baseline verify 結果を台帳へ記録 |
| WP1 | 共有 Zod schema | WP0 完了 | schema test、typecheck |
| WP2 | Dashboard registry と demo 定義 | WP1 完了 | registry validation test |
| WP3 | variable options と依存 graph | WP2 完了 | static/query/chained test |
| WP4 | normalizer、result builder、limits | WP3 完了 | 時系列・category・table 境界 test |
| WP5 | executor、limiter、cancellation、API | WP4 完了 | API、timeout、queue、abort test |
| WP6 | lazy route、search params、API client | WP5 完了 | route/search/client test、bundle 中間確認 |
| WP7 | variable UI と React Query states | WP6 完了 | loading/error/retry/stale UI確認 |
| WP8 | View/Edit Grid と layout persistence | WP7 完了 | drag/resize/save/cancel/reset/mobile test |
| WP9 | Chart/Table、threshold、mapping、a11y | WP8 完了 | renderer test、accessible table確認 |
| WP10 | Inspector と drilldown | WP9 完了 | sanitize/link validation/navigation test |
| WP11 | Playwright、bundle gate、全 verify | WP10 完了 | `verify`、`verify:e2e`、bundle gate |
| WP12 | variant 適用、README、release | WP11 完了 | variant matrix と文書完了 |

WP を飛ばさない。各 WP の開始時と完了時に [進捗台帳](./dashboard-overlay/progress.md) を更新する。

## 継続実装ルール

Luna は各 turn で次の手順を守る。

1. `git branch --show-current`、`git status --short`、進捗台帳を読む。
2. `in_progress` の WP があれば、その WP だけを続行する。
3. `in_progress` がなければ、最初の未完了 WP を開始する。
4. 対象 WP の正本文書を読み、変更対象外ファイルへ広げない。
5. 実装後、WP に指定された test を実行する。
6. test が失敗した場合、次 WP へ進まず同じ WP 内で修正する。
7. 完了した files、commands、結果、残課題を進捗台帳へ記録する。
8. user 所有の既存変更、未追跡生成物、別 WP の差分を削除しない。

## Stop 条件

以下の場合だけ作業を停止し、ユーザー判断を求める。

- 正本文書同士が矛盾し、一意に解釈できない。
- variant 側の構造が main と大きく異なり、overlay contract を維持できない。
- 新しい DB schema、migration、外部サービス、secret が必須になる。
- security contract を弱めないと要件を満たせない。
- 既存のユーザー変更と同じ行を大きく書き換える必要がある。

単なるテスト失敗、型エラー、実装難度は Stop 条件ではない。

## 完了条件

- WP0〜WP12 がすべて完了している。
- A1〜A8 の契約、実装、test が存在する。
- 通常ページの初期 bundle に Recharts / Grid が含まれない。
- desktop drag/resize と mobile 1列が確認できる。
- filters が URL から復元され、variable options と panel query に伝播する。
- Chart/Table が同じ response を表示する。
- threshold、value mapping、reference line が code-defined config から描画される。
- empty、partial、stale、error-with-data が区別される。
- Inspector がsanitizeされ、productionで表示されない。
- drilldown がrange/filterを保ったままsame-origin routeへ遷移する。
- query cancellation、timeout、concurrency limit がtestされる。
- `bun run verify`、`bun run verify:e2e`、`bun run verify:dashboard-bundle` が成功する。
- `bun run verify:dashboard-coverage` が成功し、Dashboard backendのfocused coverageが確認できる。
- main と代表 variant への適用結果が文書化される。

## 公式仕様参照

- [React Grid Layout](https://github.com/react-grid-layout/react-grid-layout)
- [TanStack Router Code Splitting](https://tanstack.com/router/latest/docs/guide/code-splitting)
- [TanStack Router Search Params](https://tanstack.com/router/latest/docs/guide/search-params)
- [TanStack Query Cancellation](https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation)
- [TanStack Query useQueries](https://tanstack.com/query/latest/docs/framework/react/reference/useQueries)
- [Hono Validation](https://hono.dev/docs/guides/validation)
- [Recharts API](https://recharts.github.io/en-US/api/)
- [Playwright Network](https://playwright.dev/docs/network)
