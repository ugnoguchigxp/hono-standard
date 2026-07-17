# 03: Dashboard Visualization Platform Frontend 実装計画

## 1. 文書の位置づけ

この文書は、[01: 共有契約](./01-contracts.md)と
[02: Backend](./02-backend.md)が提供するVisualization Platform v2を、
Frontend runtime、Visualization Registry、Browser Transformation、Panel shell、
renderer-level lazy loadへ接続するための正本である。

初期Dashboard v1 Frontendは既に動作している。03ではv1 UIをcharacterizationした後、
`operations` Dashboardをv2 APIへ切り替える。

03は全Visualizationカタログを実装する計画ではない。次を完成させる。

- Visualizationを追加できるFrontend plugin boundary
- Data Frame共通表示基盤
- Browser Transformation実行基盤
- v1互換で必要なcore.timeseries / core.bar / core.stat / core.table
- renderer単位のlazy load
- Panel state、Table fallback、accessibility、layout、Inspector

Gauge、Heatmap、State Timeline、Node Graph、Logsなどの追加Rendererは、03完了後の
Visualization別計画で同じRegistryへ追加する。

### 1.1 開始条件

次を全て満たすまでF0を開始しない。

- 01 C0〜C9がcomplete。
- 02 B0〜B12がcomplete。
- v2 manifest GETがvendor Acceptで取得できる。
- v2 variable / panel POSTが`schemaVersion: 2`で動く。
- v2 error codeがv1 codeを含む。
- `outputFrameRefs`がshared manifestへ実装済み。
- `bun run verify`が成功している。
- `bun run verify:dashboard-coverage`が成功している。
- [進捗台帳](./progress.md)のBackend statusがcomplete。

開始条件未達はStop条件である。Frontend側へtemporary schema、mock transport、
v1→v2変換を作って先行しない。

### 1.2 Lunaへの完了指示

LunaはF0〜F12を順番に実行する。

- 同時に`in_progress`にするWork Packageは1つだけ。
- 各WPのtestとtypecheck成功前に次へ進まない。
- v2 route切替はF10まで行わない。
- F10までは現行v1 Dashboardを動かしたままv2 subtreeを構築する。
- rendererをregistry外のtype条件分岐へ追加しない。
- RechartsをDashboard shell、router、通常routeへstatic importしない。
- Browser Transformationへ任意JavaScript文字列実行を追加しない。
- API responseを型assertionだけで信用しない。
- CSSへVisualization固有のraw colorを追加しない。
- 既存の未コミット変更、`dist-server/`、`dist-ssg/`を削除しない。

## 2. 目的

この計画で構築するFrontendは次の責務を持つ。

1. Dashboard API v2を共有Zod schemaでparseする。
2. range、timezone、refresh、filtersをTanStack Router searchへ保存する。
3. variable dependencyを解決してPanel queryを並列実行する。
4. Serverが返したData FrameへBrowser Transformationを適用する。
5. Visualization typeをFrontend Registryから解決する。
6. type固有configをparseし、compatible Frameだけをrendererへ渡す。
7. renderer moduleをdynamic importする。
8. Field ConfigurationとOverrideを全Renderer/Tableで共通適用する。
9. Visualizationが未知・非対応・load失敗でもDashboard全体を落とさない。
10. 同じFrameをVisualizationとTableで確認可能にする。
11. loading / empty / partial / stale / error状態をPanel shellで共通表示する。
12. drag / resize / keyboard layoutとmobile 1列を維持する。

## 3. 完了後の状態

03完了時:

- `/dashboard`はv2 manifest / responseだけを使用する。
- Backendのv1 endpoint互換は残るがFrontendはsilent downgradeしない。
- 通常route初期bundleにDashboard runtime、Grid、Rechartsが入らない。
- Dashboard shell chunkにGridは入るがRechartsは入らない。
- Rechartsはcore.timeseries / core.bar renderer chunkからだけ到達する。
- core.stat / core.table chunkはRechartsへ依存しない。
- PanelごとにRenderer moduleのloading/error/retryを表示できる。
- unknown Visualizationは対象Panelだけincompatible stateになる。
- tableFallback有効時はRenderer不成立でもData FrameをTableで確認できる。
- Browser Transformationはresponse変更時にcancelされる。
- exact value、Field Configuration、OverrideがTableとRendererで一致する。
- variable/filter/range/refreshがURLから復元される。
- layout edit、Save、Cancel、Reset、keyboard moveが動く。
- mobileは1列になり、dense VisualizationはTableへ切り替えられる。
- Query Inspectorはv2 Frames/counts/noticesをsanitizeして表示する。

## 4. 対象

### 4.1 既存ファイル

```text
web/src/routes/dashboard-route.tsx
web/src/routes/dashboard-route.lazy.tsx
web/src/api.ts
web/src/api.test.ts
web/src/domains/dashboard/api.ts
web/src/domains/dashboard/query.ts
web/src/domains/dashboard/search.ts
web/src/domains/dashboard/search.test.ts
web/src/domains/dashboard/layout.ts
web/src/domains/dashboard/layout.test.ts
web/src/domains/dashboard/grid.tsx
web/src/domains/dashboard/state.ts
web/src/domains/dashboard/panels.tsx
web/src/domains/dashboard/chart.tsx
web/src/domains/dashboard/chart.test.ts
web/src/domains/dashboard/table.tsx
web/src/domains/dashboard/toolbar.tsx
web/src/domains/dashboard/inspector.tsx
web/src/domains/dashboard/links.ts
web/src/domains/dashboard/links.test.ts
web/src/styles.css
web/src/router.tsx
web/src/routes/root-route.tsx
vite.config.ts
scripts/verify-dashboard-bundle.ts
tests/e2e/smoke.spec.ts
package.json
bun.lock
vitest.config.ts
```

### 4.2 追加ファイル

F10までv1と共存できるよう、v2実装はsubdirectoryへ追加する。

```text
web/src/routes/dashboard-route-search.ts
web/src/routes/dashboard-route-search.test.ts

web/src/domains/dashboard/v2/dashboard-page.tsx
web/src/domains/dashboard/v2/dashboard-runtime.ts
web/src/domains/dashboard/v2/dashboard-runtime.test.ts
web/src/domains/dashboard/v2/api.ts
web/src/domains/dashboard/v2/api.test.ts
web/src/domains/dashboard/v2/errors.ts
web/src/domains/dashboard/v2/query-keys.ts
web/src/domains/dashboard/v2/query-keys.test.ts
web/src/domains/dashboard/v2/query-options.ts
web/src/domains/dashboard/v2/query-options.test.ts
web/src/domains/dashboard/v2/variables.ts
web/src/domains/dashboard/v2/variables.test.ts
web/src/domains/dashboard/v2/toolbar.tsx

web/src/domains/dashboard/v2/runtime/visualization-types.ts
web/src/domains/dashboard/v2/runtime/visualization-registry.ts
web/src/domains/dashboard/v2/runtime/visualization-registry.test.ts
web/src/domains/dashboard/v2/runtime/renderer-loader.ts
web/src/domains/dashboard/v2/runtime/renderer-loader.test.ts
web/src/domains/dashboard/v2/runtime/transformation-types.ts
web/src/domains/dashboard/v2/runtime/transformation-registry.ts
web/src/domains/dashboard/v2/runtime/transformation-registry.test.ts
web/src/domains/dashboard/v2/runtime/transformation-executor.ts
web/src/domains/dashboard/v2/runtime/transformation-executor.test.ts
web/src/domains/dashboard/v2/runtime/use-browser-transformations.ts
web/src/domains/dashboard/v2/runtime/frame-selection.ts
web/src/domains/dashboard/v2/runtime/frame-selection.test.ts
web/src/domains/dashboard/v2/runtime/field-config.ts
web/src/domains/dashboard/v2/runtime/field-config.test.ts
web/src/domains/dashboard/v2/runtime/value-format.ts
web/src/domains/dashboard/v2/runtime/value-format.test.ts
web/src/domains/dashboard/v2/runtime/theme.ts
web/src/domains/dashboard/v2/runtime/theme.test.ts
web/src/domains/dashboard/v2/runtime/panel-state.ts
web/src/domains/dashboard/v2/runtime/panel-state.test.ts

web/src/domains/dashboard/v2/panel/panel-shell.tsx
web/src/domains/dashboard/v2/panel/panel-shell.test.tsx
web/src/domains/dashboard/v2/panel/panel-renderer-host.tsx
web/src/domains/dashboard/v2/panel/panel-renderer-host.test.tsx
web/src/domains/dashboard/v2/panel/panel-render-error-boundary.tsx
web/src/domains/dashboard/v2/panel/panel-table.tsx
web/src/domains/dashboard/v2/panel/panel-table.test.tsx
web/src/domains/dashboard/v2/panel/panel-notices.tsx

web/src/domains/dashboard/v2/layout/layout.ts
web/src/domains/dashboard/v2/layout/layout.test.ts
web/src/domains/dashboard/v2/layout/layout-state.ts
web/src/domains/dashboard/v2/layout/layout-state.test.ts
web/src/domains/dashboard/v2/layout/dashboard-grid.tsx

web/src/domains/dashboard/v2/inspector/inspector.tsx
web/src/domains/dashboard/v2/inspector/sanitize.ts
web/src/domains/dashboard/v2/inspector/sanitize.test.ts
web/src/domains/dashboard/v2/links/link-targets.ts
web/src/domains/dashboard/v2/links/resolve-link.ts
web/src/domains/dashboard/v2/links/resolve-link.test.ts

web/src/domains/dashboard/v2/visualizations/catalog.ts
web/src/domains/dashboard/v2/visualizations/core-timeseries/definition.ts
web/src/domains/dashboard/v2/visualizations/core-timeseries/renderer.lazy.tsx
web/src/domains/dashboard/v2/visualizations/core-timeseries/model.ts
web/src/domains/dashboard/v2/visualizations/core-timeseries/model.test.ts
web/src/domains/dashboard/v2/visualizations/core-bar/definition.ts
web/src/domains/dashboard/v2/visualizations/core-bar/renderer.lazy.tsx
web/src/domains/dashboard/v2/visualizations/core-bar/model.ts
web/src/domains/dashboard/v2/visualizations/core-bar/model.test.ts
web/src/domains/dashboard/v2/visualizations/core-stat/definition.ts
web/src/domains/dashboard/v2/visualizations/core-stat/renderer.lazy.tsx
web/src/domains/dashboard/v2/visualizations/core-stat/renderer.test.tsx
web/src/domains/dashboard/v2/visualizations/core-table/definition.ts
web/src/domains/dashboard/v2/visualizations/core-table/renderer.lazy.tsx
web/src/domains/dashboard/v2/visualizations/core-table/renderer.test.tsx

web/src/domains/dashboard/v2/test/fixtures.ts
web/src/domains/dashboard/v2/test/setup.ts

vitest.dashboard-frontend.config.ts
```

同じ責務を不必要に細分化しない。実装時に小さい隣接fileを統合してよいが、
Registry、Transformation、Data Frame、Panel shell、Renderer moduleの境界は維持する。

### 4.3 F10で削除可能なv1 file

v2 route切替とcharacterization成功後、次のsuperseded fileは削除してよい。

```text
web/src/domains/dashboard/api.ts
web/src/domains/dashboard/query.ts
web/src/domains/dashboard/search.ts
web/src/domains/dashboard/panels.tsx
web/src/domains/dashboard/chart.tsx
web/src/domains/dashboard/table.tsx
web/src/domains/dashboard/toolbar.tsx
web/src/domains/dashboard/inspector.tsx
web/src/domains/dashboard/links.ts
web/src/domains/dashboard/grid.tsx
web/src/domains/dashboard/layout.ts
web/src/domains/dashboard/state.ts
```

対応するv1 testはv2 testへ置換した後に削除する。F10より前に削除しない。

### 4.4 対象外

- Visualization picker / WYSIWYG Panel editor
- Dashboard追加・削除UI
- Gauge / Pie / Heatmap / Scatter / State Timeline等の追加Renderer
- built-in Browser Transformationアルゴリズム一式
- shared zoom / range selection / annotation editor
- fullscreen / kiosk
- CSV / image export
- server-side layout persistence
- visual regression baselineのrelease運用
- external plugin package loading

## 5. 現行Frontend監査

### 5.1 維持するもの

- `/dashboard` route-level lazy load
- TanStack Router search
- TanStack Query cancellation / retry
- variable dependency UI
- React Grid Layout
- View/Edit/Save/Cancel/Reset
- Chart/Table切替
- Inspector / drilldown
- existing CSS token
- Playwrightのperiod/API/layout確認

### 5.2 解消する問題

1. API clientがunversioned v1 schemaだけをparseする。
2. manifest GETへv2 Acceptを付けない。
3. Dashboard IDがpage component内へ直書きされる。
4. Panel rendererが単一`PanelChart`の巨大条件分岐である。
5. RechartsがDashboard route chunkへ直接入る。
6. Browser Transformationを実行できない。
7. Data Frameをrenderer共通形式として扱えない。
8. Field Overrideを適用できない。
9. unknown VisualizationでPanel単位fallbackできない。
10. renderer dynamic import失敗をPanel境界で処理できない。
11. stale判定が再renderされない限り更新されない。
12. Table row keyがrow JSONへ依存する。
13. linksがplain anchorでTanStack Router typed navigationを使わない。
14. Inspectorがv1 rowCount/seriesCountしか表示しない。
15. `react-grid-layout/legacy` entryを使用している。
16. manifest defaultRefreshSecondsの任意値をURLで表現できない。
17. hardcoded timezone選択肢しか使えない。
18. static/query variable option errorの状態が粗い。

F0では正常挙動をcharacterizationするが、上記を互換仕様として固定しない。

## 6. 固定済み設計判断

実装中に次を再検討しない。

1. 03完了後のDashboard Frontendはv2 transportだけを使用する。
2. v2失敗時にv1へsilent fallbackしない。
3. Backendのv1 transportは外部互換用に残す。
4. `operations` Dashboard IDは03では維持する。
5. `/dashboard` pathは変更しない。
6. search parserは通常bundleに残るため軽量moduleへ分離する。
7. Dashboard shellはroute-level lazy loadを維持する。
8. Visualization rendererはtype単位のdynamic importにする。
9. Registryからrenderer moduleをstatic importしない。
10. renderer loadはTanStack Queryで管理し、React.lazyのrejection cacheへ依存しない。
11. Frontend Registryはcode-defined internal plugin pointとする。
12. unknown typeはDashboard全体ではなく対象Panelだけをincompatibleにする。
13. config parse失敗も対象Panelだけをincompatibleにする。
14. compatibleなData Frameがある場合、tableFallbackを優先して復旧可能にする。
15. Browser Transformation失敗時にraw Frameを成功表示へ暗黙利用しない。
16. Server TransformationをFrontendで再実行しない。
17. Browser Transformationはmanifest順に逐次実行する。
18. Browser Transformation結果はnetwork cacheへ書き戻さない。
19. local transformationはrequestId単位のTanStack Queryへcacheする。
20. Data Frameとfield value配列をmutationしない。
21. generic Tableは全Data Frame shapeで使える。
22. Tableは最大100 rows/pageでDOM row数を制限する。
23. exact value確認に追加API requestを行わない。
24. Field Configuration解決はshared helperを正本にする。
25. chart色はallowlisted CSS variable tokenからだけ解決する。
26. Renderer JSXへhex/rgb/hsl literalを書かない。
27. layoutはlocalStorageへ保存し、serverへ保存しない。
28. React Grid Layout v2 root APIを使い`/legacy` importを削除する。
29. desktop default layoutだけdescriptor.minimumSizeを厳密適用する。
30. mobile xsは常に1列とし、desktop minimum widthを強制しない。
31. Panel表示mode、legend visibility、Inspector open stateはURLへ保存しない。
32. range/timezone/refresh/filtersだけをURLへ保存する。
33. custom rangeはApply時にfrom/toを同時反映する。
34. Query Inspectorはdevelopmentかつmanifest許可時だけrenderする。
35. 03では追加runtime dependencyを増やさない。
36. component test用dev dependency追加は許可する。
37. 高度Renderer catalogは後続計画へ分ける。

## 7. Frontend architecture

```text
dashboard-route.tsx
  └─ lightweight search parser
        ↓ dynamic import
dashboard-route.lazy.tsx
  └─ DashboardPageV2
       ├─ v2 API + TanStack Query
       ├─ variable reconciliation
       ├─ responsive layout
       └─ PanelShell[]
            ├─ browser transformation query
            ├─ frame selection / field config
            ├─ table fallback
            └─ RendererLoader
                  ↓ dynamic import by type
                  Visualization Renderer
```

Dependency direction:

```text
shared schema
  ↓
frontend runtime primitive
  ↓
registry / transformation / frame helpers
  ↓
panel shell
  ↓
renderer module
```

Renderer moduleからroute、API client、TanStack Routerをimportしない。

Composition root:

```ts
createDashboardFrontendRuntime({
	visualizations,
	transformations,
}): DashboardFrontendRuntime
```

Default:

```text
visualizations = core timeseries/bar/stat/table definitions
transformations = []
```

DashboardPageはdefault runtimeを受け取る。testはfactoryへfake definitionを注入する。
Registry singletonを各Renderer fileで個別生成しない。

## 8. API version migration

### 8.1 Media type

```ts
export const DASHBOARD_V2_MEDIA_TYPE =
	"application/vnd.hono-standard.dashboard.v2+json";
```

Manifest:

```http
GET /api/dashboards/operations
Accept: application/vnd.hono-standard.dashboard.v2+json
```

Variable / Panel:

```http
Accept: application/vnd.hono-standard.dashboard.v2+json
Content-Type: application/json
```

bodyは`schemaVersion: 2`を持つ。

### 8.2 DashboardApiErrorV2

```ts
export class DashboardApiErrorV2 extends Error {
	constructor(
		readonly code: DashboardErrorCodeV2,
		message: string,
		readonly retryable: boolean,
		readonly status: number,
		readonly requestId?: string,
		readonly details?: DashboardJsonObject,
		readonly cause?: unknown,
	) {}
}
```

Rules:

- AbortErrorはDashboardApiErrorへwrapしない。
- error bodyは`dashboardErrorResponseV2Schema`でparseする。
- parse不能error bodyはsafe message=`Dashboard request failed`。
- response `X-Request-ID`とbody requestIdが両方ある場合、一致しなければ
  `INVALID_HANDLER_RESULT`として扱う。
- response success bodyも共有v2 schemaでparseする。
- Zod issue全量をuser UIへ表示しない。
- 401は既存`web/src/api.ts`のauth refresh/unauthorized動作を壊さない。

`web/src/api.ts`の現行`customFetch`を`appFetch`としてexportし、Hono clientとDashboard
clientが同じfunctionを使う。Dashboard側で独自の401 refresh処理を複製しない。

Dashboardの並列Panel requestでrefreshが多重実行されないよう、`appFetch`はmodule内の
single-flight refresh Promiseを共有する。

```text
first protected 401 -> one /api/auth/refresh
other protected 401 -> same refresh Promiseをawait
refresh success -> each original requestを最大1回replay
refresh failure -> unauthorized event
```

callerのAbortSignalで共有refresh自体をabortしない。await中のcallerはsignal abort時に
replayせずAbortErrorで終了する。auth endpointは従来通りrefresh対象外。

### 8.3 Downgrade禁止

406、schema mismatch、unknown typeを受けてもv1 APIを再requestしない。

理由:

- deployment mismatchを隠さない。
- v1/v2でquery keyとUI stateが分裂するのを防ぐ。
- Frontendの完了条件をv2で証明する。

## 9. Search state

### 9.1 Route search

manifest defaultを適用する前のroute searchはoptionalにする。

```ts
export type DashboardRouteSearch = {
	range?: "15m" | "1h" | "6h" | "24h" | "7d" | "custom";
	from?: string;
	to?: string;
	timezone?: string;
	refresh?: number;
	filters?: DashboardFiltersV2;
};
```

`refresh`は0〜3600秒。0はoff。

Legacy URL migration:

```text
off -> 0
10s -> 10
30s -> 30
1m -> 60
```

parserは旧値を受け付けるが、次のnavigateでnumeric canonical formへreplaceする。

### 9.2 Manifest default resolution

```ts
resolveDashboardSearch({
	routeSearch,
	manifest,
	now,
}): {
	value: ResolvedDashboardSearch;
	canonicalRouteSearch: DashboardRouteSearch;
	needsReplace: boolean;
}
```

Default:

- range: manifest.defaultRange
- timezone: manifest.defaultTimezone
- refresh: manifest.defaultRefreshSeconds
- filters: manifest variable defaults

Rules:

- invalid relative rangeはmanifest default。
- customでfrom/to欠落、invalid、from>=toならmanifest default。
- absolute datetimeはoffset付きISOへcanonicalizeする。
- timezoneは1〜64文字。実在性errorはBackend responseとして表示する。
- filter key/value structural limitはshared schemaを使う。
- filtersはkey昇順、value重複除去、value昇順、空配列削除。
- manifestにないfilterはvariable reconciliation後に削除する。
- canonical replaceは1 render cycleにつき最大1回。
- replace後の値が同じならnavigateしない。

Custom range editorはlocal draftを持ち、Apply時にfrom/toを同時更新する。入力途中の
片側だけをURLへ書かない。

### 9.3 Timezone options

`Intl.supportedValuesOf("timeZone")`があれば使用する。未対応browserでは次を最低fallback
とする。

```text
UTC
Asia/Tokyo
America/Los_Angeles
Europe/London
```

manifest defaultがfallback list外でも選択肢へ追加する。

## 10. Frontend Visualization Registry

### 10.1 Renderer contract

```ts
export type DashboardRendererContext<TConfig> = {
	dashboardId: string;
	panel: PanelManifestV2;
	frames: DashboardDataFrameV2[];
	config: TConfig;
	timezone: string;
	locale: string;
	theme: DashboardVisualizationTheme;
	interaction: DashboardPanelInteraction;
};

export type DashboardPanelInteraction = {
	hiddenFieldKeys: ReadonlySet<string>;
	isolatedFieldKey?: string;
	toggleField: (fieldKey: string) => void;
	isolateField: (fieldKey: string) => void;
	resetFields: () => void;
	onDatumActivate: (fieldValues: Record<string, DashboardJsonValue>) => void;
};

export type DashboardRendererModule<TConfig> = {
	Renderer: ComponentType<DashboardRendererContext<TConfig>>;
	buildAccessibleSummary: (
		context: DashboardRendererContext<TConfig>,
	) => string;
};

export type FrontendVisualizationDefinition<TConfig> = {
	contract: VisualizationDefinition<TConfig>;
	loadPolicy: "immediate" | "viewport";
	load: () => Promise<DashboardRendererModule<TConfig>>;
};
```

`defineFrontendVisualization<TConfig>()` helperでdefinitionとloader moduleのgenericを
結び付ける。

### 10.2 Registry

```ts
class FrontendVisualizationRegistry {
	constructor(definitions: AnyFrontendVisualizationDefinition[]);
	get(type: string): AnyFrontendVisualizationDefinition | undefined;
	resolve(input: {
		spec: VisualizationSpecV2;
		frames: DashboardDataFrameV2[];
	}): VisualizationResolution;
	load(type: string): Promise<AnyDashboardRendererModule>;
	clearFailedLoad(type: string): void;
}
```

Startup validation:

- descriptor schema
- duplicate type
- preset uniqueness
- default preset
- defaultOptionsByPreset coverage
- config schema strict parse
- loader function存在
- minimum/recommended size
- capability/tableFallback矛盾

Resolution result:

```ts
type VisualizationResolution =
	| {
			status: "ready";
			definition: AnyFrontendVisualizationDefinition;
			config: unknown;
			frames: DashboardDataFrameV2[];
	  }
	| {
			status: "unknown-type" | "invalid-config" | "missing-frame" | "incompatible-shape";
			message: string;
			frames: DashboardDataFrameV2[];
	  };
```

Rules:

1. type lookup
2. config resolution
3. frameRefsをmanifest順に選択
4. missing Frame検出
5. shapeHint / shape validator確認
6. supportedShapes確認
7. ready

unknown typeやinvalid configをthrowしてDashboard rootへ伝播しない。

### 10.3 Loader

Renderer module loadはTanStack Queryで行う。

```ts
["dashboard-renderer", type, configSchemaVersion]
```

- `staleTime=Infinity`
- `gcTime=Infinity`
- dynamic import failureだけ1回retry
- Retry buttonはfailed queryをremoveし、registry failed cacheをclearして再実行
- manifest取得後、使用typeを重複除去してprefetchしてよい
- `loadPolicy="viewport"`はIntersectionObserver到達までprefetchしない
- F7 core rendererは`immediate`

Registry fileへ次を書かない。

```ts
import { Renderer } from "./visualizations/.../renderer.lazy";
```

loader arrow内のdynamic importだけを許可する。

## 11. Browser Transformation runtime

### 11.1 Definition

```ts
export type BrowserTransformationContext = {
	panelId: string;
	transformationId: string;
	requestId: string;
	signal: AbortSignal;
	checkBudget: () => void;
	yieldIfNeeded: () => Promise<void>;
};

export type BrowserTransformationFrameInput = Omit<
	DashboardDataFrameV2,
	"schemaVersion" | "source" | "refId"
>;

export type BrowserTransformationResult = {
	frame: BrowserTransformationFrameInput;
	notices?: DashboardNoticeV2[];
	truncated?: boolean;
};

export type FrontendTransformationDefinition<TConfig> =
	TransformationDefinition<TConfig> & {
		execute: (
			context: BrowserTransformationContext,
			frames: DashboardDataFrameV2[],
			config: TConfig,
		) =>
			| BrowserTransformationResult
			| Promise<BrowserTransformationResult>;
	};
```

Rules:

- browserCapable=trueのみ登録。
- serverCapableだけのdefinitionはFrontend Registryへ登録しない。
- duplicate type拒否。
- configSchema strict。
- requestからfunction/codeを受け取らない。

03 production registryはbuilt-in algorithmをまだ持たなくてよい。fake definitionをtestで
注入し、generic runtimeを完成させる。

### 11.2 Execution

```ts
executeBrowserTransformations({
	panel,
	responseFrames,
	requestId,
	registry,
	signal,
	budget,
}): Promise<{
	frames: DashboardDataFrameV2[];
	notices: DashboardNoticeV2[];
	truncated: boolean;
}>
```

処理順:

1. response Frame map作成
2. transformationをmanifest順に走査
3. disabled skip
4. server execution skip。response内のserver outputはmapに既に存在
5. browser definition lookup
6. input Frame lookup
7. input shape validation
8. config parse
9. execute
10. internal strict Frame input schemaで余剰propertyを拒否
11. source/refId/schemaVersionをspec値へ上書き
12. notice/truncated parse
13. output shape validation
14. cell budget確認
15. mapへ追加
16. response Frames + browser outputsを安定順で返す

Browser outputはBackend response objectへpushしない。

### 11.3 TanStack Query integration

```ts
[
	"dashboard-browser-transform",
	dashboardId,
	panel.id,
	manifestRevision,
	response.requestId,
	transformationSignature,
]
```

- network queryとは別cache。
- response requestId変更で旧executionをcancel。
- retry=false。
- config/algorithm errorは再実行しても直らないためPanel transformation errorにする。
- manual Retryはqueryをremoveして再計算する。
- transformationなしはraw Framesを同期的に返し、余分なpending stateを作らない。
- abort/budgetはactual Promiseとraceし、late resultを採用しない。
- late rejectionへhandlerを付け、unhandled rejectionにしない。
- Backend state.noticesの後にbrowser noticesをmanifest順で連結する。
- derived truncatedは`response.state.truncated || browserResult.truncated`。
- maxNoticesを超えた場合はTransformation errorにし、noticeを暗黙に捨てない。

### 11.4 Main thread budget

```text
soft yield interval = 8ms
panel browser transformation hard budget = 100ms
```

`yieldIfNeeded()`は`setTimeout(0)`またはscheduler相当でmain threadへ制御を返す。
外部scheduler dependencyは追加しない。

同期無限loopはpreemptできない。built-in Transformation authorは大きいloop内で
`checkBudget()`と`yieldIfNeeded()`を呼ぶ。

## 12. Data Frame runtime

### 12.1 Frame selection

```ts
selectVisualizationFrames(
	spec: VisualizationSpecV2,
	frames: DashboardDataFrameV2[],
): {
	selected: DashboardDataFrameV2[];
	missing: string[];
}
```

- spec.frameRefs順。
- duplicateはshared schemaで拒否済みだがdefensive checkする。
- hidden query由来Frameも選択可能。
- inputをcopy/mutationしない。

### 12.2 Field runtime

```ts
type ResolvedDashboardField = {
	frame: DashboardDataFrameV2;
	field: DashboardFieldV2;
	config: StandardFieldConfigV2;
};
```

各fieldで`resolveEffectiveFieldConfig()`を使う。

Resolution order:

1. panel fieldConfig
2. Frame field.config
3. Panel overrides manifest順

Renderer独自にthreshold/value mapping/unit mergeを実装しない。

### 12.3 Value formatter

```ts
formatDashboardValue({
	value,
	field,
	config,
	locale,
	timezone,
}): {
	text: string;
	rawText: string;
	colorToken?: string;
	mappingApplied: boolean;
	thresholdLabel?: string;
}
```

順序:

1. null mapping
2. exact value mapping
3. range mapping
4. unit formatter
5. active threshold metadata

Unit:

- none
- short
- percent unit/hundred
- bytes 1000/1024
- duration ns/us/ms/s/m/h/d
- rate
- currency
- custom suffix

Rules:

- nullはmappingなしならnoValueText。
- 0とnullを区別。
- NaN/Infinityはschema boundaryで拒否済み。
- decimals=autoは値の大きさに応じ0〜3桁。
- explicit decimalsは0〜8。
- time fieldはtimezone指定でformat。
- formatterはReact elementを返さない。

### 12.4 Theme

```ts
type DashboardVisualizationTheme = {
	color: (token: string | undefined, fallback: DashboardThemeToken) => string;
	categorical: readonly string[];
	sequential: readonly string[];
	diverging: readonly string[];
	status: readonly string[];
};
```

allowlistは既存CSS tokenとDashboard semantic tokenだけを含む。

```text
--color-brand
--color-brand-strong
--color-muted
--color-muted-strong
--color-danger
--color-chart-primary
--color-chart-primary-strong
--color-chart-danger
--color-chart-warning
--color-chart-success
--color-chart-muted
--color-chart-series-1 ... --color-chart-series-8
```

unknown tokenはfallbackへ置換し、developmentで1回だけwarnする。raw token valueを
styleへ直接入れない。

### 12.5 Generic Table

全Frameをrow/columnへtransposeできる汎用Tableを実装する。

- multi-frameはFrame tab/selectを表示。
- default selected Frameはvisualization.frameRefs先頭。
- 1 page 100 rows。
- page変更でnetwork requestしない。
- `<table>`, `<caption>`, `<thead>`, `<tbody>`, `<th scope>`。
- row keyは`${frame.refId}:${rowIndex}`。
- field label/displayNameをheaderへ使う。
- formatted valueとrawTextを確認可能にする。
- mapping/thresholdをtext badgeで表示する。
- colorだけで状態を伝えない。
- 2000 rows全件を一度にDOMへrenderしない。
- timeはDashboard timezone。
- stringはtextとしてrenderし、HTML injectionしない。

## 13. Variable and query orchestration

### 13.1 Query keys

Manifest:

```ts
["dashboard-v2", dashboardId, "manifest"]
```

Variable:

```ts
[
	"dashboard-v2",
	dashboardId,
	"variable",
	variableId,
	rangeKey,
	timezone,
	dependencyFilterKey,
]
```

Panel:

```ts
[
	"dashboard-v2",
	dashboardId,
	"panel",
	panelId,
	manifestRevision,
	rangeKey,
	timezone,
	filterKey,
	maxDataPoints,
	maxRows,
]
```

object identity、Date、functionをkeyへ入れない。range/filterは安定serializeする。

### 13.2 Variable reconciliation

```ts
reconcileDashboardVariables({
	manifest,
	routeFilters,
	optionStates,
}): {
	filters: DashboardFiltersV2;
	statusByVariable: Record<string, VariableResolutionState>;
	panelsReady: boolean;
	changed: boolean;
}
```

Variable state:

```text
blocked
loading
error
ready
```

定義順に処理する。

1. dependsOnがreadyか確認
2. option query state確認
3. disabled option除去
4. URL selectionをknown optionへ絞る
5. singleなら先頭1件
6. requiredで空ならvalid default
7. defaultも無効なら先頭enabled option
8. optionalは空を許可
9. canonical filter作成

Rules:

- option queryはstatic/queryどちらもendpointを使う。
- dependency filterだけをoptions requestへ送る。
- dependency未解決なら`enabled=false`。
- option errorは対象variableと下流をblockedにする。
- URL replaceは全variable reconciliation後に1回。
- required variable全てreadyになるまでPanel queryを開始しない。
- invalid URL valueをerror UIにせずcanonical URLから除去する。
- optionが0件のrequired variableはerrorではなくblocked/not-configured表示。

### 13.3 Panel query

Request:

```ts
{
	schemaVersion: 2,
	range,
	timezone,
	filters,
	maxDataPoints: 800,
	maxRows: 2000,
}
```

Panel sizeに応じてmaxDataPointsを将来自動調整できる境界は持つが、03では800固定。

Retry:

```ts
retry: (failureCount, error) =>
	error instanceof DashboardApiErrorV2 &&
	error.retryable &&
	failureCount < 2
```

- 400/404/406/422はretryしない。
- 429/500/504はresponse retryableに従う。
- retry delayは1s、2s、最大5s。
- Query signalをfetchへ渡す。
- key変更時にprevious key dataをplaceholder表示しない。
- 同じkeyのrefetch中はlast successful dataを維持する。
- `refetchIntervalInBackground=false`。
- manual refreshは実行中requestをcancelしてからrefetchする。

## 14. Panel runtime

### 14.1 Derived state

```ts
type PanelRuntimeState =
	| { kind: "network-pending" }
	| { kind: "network-error"; error: DashboardApiErrorV2 }
	| { kind: "transformation-pending"; response: PanelQueryResponseV2 }
	| { kind: "transformation-error"; error: Error; response: PanelQueryResponseV2 }
	| { kind: "empty"; response: PanelQueryResponseV2 }
	| { kind: "incompatible"; resolution: VisualizationResolution }
	| { kind: "renderer-loading" }
	| { kind: "renderer-error"; error: Error }
	| { kind: "ready"; response: PanelQueryResponseV2; frames: DashboardDataFrameV2[] };
```

表示priority:

1. initial network pending
2. network error without data
3. transformation pending
4. transformation error
5. empty
6. Visualization resolution incompatible
7. renderer module loading/error
8. ready

Overlay state:

- previous data + refetch error
- partial
- truncated
- stale
- refreshing
- notices

emptyはBrowser Transformation後のvisualization selected Framesで再判定する。

- selected Framesが全て0 rowならempty。
- 1件でもrowがあればBackend emptyReasonを表示しない。
- Backend emptyReasonがありselected Framesもemptyならそのreasonを使う。
- reasonがないのにselected Framesがemptyなら`no-records`をderived defaultにする。

### 14.2 Empty

Copy:

```text
no-records: No data in this period.
filter-no-match: No data matches the selected filters.
not-configured: This panel is not configured yet.
```

emptyでもFrame metadataはInspector/Table contract用に保持するが、Table toggleは
empty copyを優先する。

### 14.3 Partial / truncated / notices

- partial=trueはwarning noticeとbanner。
- derived truncated=trueはBackend/BrowserのORとし明示badge。
- noticeはBackend noticesの後にBrowser Transformation noticesをmanifest順で連結する。
- noticeはseverity/code/messageを表示。
- field/frame指定noticeはInspectorで対象を示す。
- codeだけをuser-facing headingにしない。

### 14.4 Stale

```ts
staleAt = Date.parse(dataThrough) + staleAfterMs;
```

`useDashboardNow()`は30秒ごと、またはrefresh intervalの短い方で更新する。
component render時の`Date.now()`一回だけに依存しない。

### 14.5 Table fallback policy

Fallback可能:

- unknown Visualization
- invalid Visualization config
- incompatible shape
- missing optional renderer chunk
- renderer load error
- renderer render error

条件:

- `tableFallback.enabled=true`
- visualization.frameRefsが全て存在する
- 1件以上の表示可能Frameがある

`missing-frame`はTable fallbackしない。不完全な入力を完全なデータとして見せないため、
明示的なmissing data stateを表示する。

Transformation errorではraw inputへfallbackしない。意図した変換結果ではないためである。

`defaultView`:

- visualization: rendererをdefault
- table: Tableをdefault

user toggleはPanel local state。manifest revision/type/preset変更時にdefaultへresetする。

### 14.6 Render error boundary

RendererごとにError Boundaryを置く。

- Dashboard rootを落とさない。
- component stackをproduction UIへ出さない。
- Retryはrenderer loader/cacheをreset。
- Table fallback buttonを表示。
- same renderer typeの他Panelを強制resetしない。

## 15. Core renderer migration

03でproduction catalogへ登録するのは次だけ。

| Type | Preset | Shape | Recharts |
| --- | --- | --- | --- |
| core.timeseries | line | timeseries | yes |
| core.timeseries | area | timeseries | yes |
| core.bar | vertical | category / timeseries | yes |
| core.stat | value | scalar | no |
| core.table | table | table / any fallback | no |

### 15.0 Core config contract

Frontend-local strict schemaとして次を実装する。request/manifestのJSON構造はshared
VisualizationSpecを通過済みであり、このschemaがtype固有最終validationになる。

```ts
type CartesianReferenceLine = {
	value: number;
	label?: string;
	colorToken: string;
};

type TimeseriesConfig = {
	showLegend: boolean;
	connectNulls: boolean;
	yAxisScale: "linear" | "log";
	yAxisMin: "auto" | number;
	yAxisMax: "auto" | number;
	referenceLines: CartesianReferenceLine[];
};

type BarConfig = {
	showLegend: boolean;
	yAxisScale: "linear" | "log";
	yAxisMin: "auto" | number;
	yAxisMax: "auto" | number;
	referenceLines: CartesianReferenceLine[];
};

type StatConfig = Record<string, never>;
type TableConfig = Record<string, never>;
```

Defaults:

```text
showLegend = true
connectNulls = false
yAxisScale = linear
yAxisMin = auto
yAxisMax = auto
referenceLines = []
```

Rules:

- schemaは`.strict()`。
- referenceLines最大20件。
- colorTokenはshared token schema。
- min/maxが両方numberならmin < max。
- log scaleで表示対象numberに0以下があればincompatible state。
- stat/tableは未知optionを拒否。

Descriptor:

| Type | minimum | recommended | supportedShapes |
| --- | --- | --- | --- |
| core.timeseries | 4x3 | 6x4 | timeseries |
| core.bar | 4x3 | 6x4 | category、timeseries |
| core.stat | 2x2 | 3x3 | scalar |
| core.table | 4x3 | 8x5 | sharedの全Data Frame shape |

Capabilities:

- timeseries/bar: legend、tooltip、sharedCrosshair、fieldOverrides、tableFallback。
- stat: fieldOverrides、tableFallback、mobileSummary。
- table: fieldOverrides、tableFallback。
- 03でzoom/rangeSelection/annotations/exportはfalse。

### 15.1 core.timeseries

Model:

- spec.frameRefs順にFrameを処理。
- role=time fieldを1件選択。
- role=value/lower/upper fieldをseries化。
- field key collisionはFrame refIdをprefix。
- nullを維持。
- response順をsortし直さない。
- effective field configをseriesへ付与。

Renderer:

- `LineChart` / `AreaChart`
- `ResponsiveContainer`
- `accessibilityLayer`
- Dashboard IDを含むstable syncId
- CSS token palette
- timezone X axis
- custom Tooltip
- custom keyboard-operable Legend
- click=hide/show
- isolate buttonまたはdouble action
- `aria-pressed`
- reduced motion時animation off
- threshold/reference line
- connectNulls option
- no raw color

Legend visibility stateはPanel shellが所有し、renderer remountで不必要に失わない。
TableはhiddenFieldKeysに関係なく全fieldを表示し、exact data確認を優先する。

03ではshared zoom/range selectionを追加しない。

### 15.2 core.bar

- category roleをX/Y labelへ使う。
- vertical presetのみ。
- grouped multiple value field。
- yAxis min auto時は0を含む。
- long labelはtruncateし、Tooltip/Tableで全文確認。
- Legend/Tooltip/thresholdはtimeseries共通componentを再利用可能。
- timeseries shapeを受ける場合はtime bucket barとして表示。

### 15.3 core.stat

- scalar Frame先頭のprimary value field。
- previous/delta roleまたはlegacy keyを補助値に使う。
- mapping textをprimary表示。
- raw formatted valueも確認可能。
- threshold/mapping color token。
- no-value state。
- screen reader summary。
- Recharts import禁止。

### 15.4 core.table

generic Table componentをrendererとして包む。

- Recharts import禁止。
- tableFallbackと同じformat結果を使う。
- default page 1。
- multi-frame selection。

### 15.5 Renderer module export

各`renderer.lazy.tsx`は次だけをexportする。

```ts
export const Renderer = ...
export const buildAccessibleSummary = ...
```

route component、query hook、registry singletonをexportしない。

## 16. Responsive layout

### 16.1 Breakpoints

| Breakpoint | min width | columns |
| --- | ---: | ---: |
| lg | 1200 | 12 |
| md | 996 | 8 |
| sm | 768 | 4 |
| xs | 0 | 1 |

### 16.2 React Grid Layout v2

`react-grid-layout` root entryを使う。

```ts
import {
	Responsive,
	useContainerWidth,
	verticalCompactor,
} from "react-grid-layout";
```

`react-grid-layout/legacy`をimportしない。

v2 config:

```text
dragConfig.enabled = editMode
dragConfig.bounded = true
dragConfig.handle = ".dashboard-panel-drag-handle"
dragConfig.cancel = interactive selector
resizeConfig.enabled = editMode && breakpoint !== xs
Responsive props rowHeight/margin/containerPadding/maxRows
compactor = verticalCompactor
```

Panel header全体をdrag handleにせず専用handleだけを使う。

### 16.3 Descriptor minimum size

Frontend Registry解決後、default desktop layoutとdescriptor minimumを照合する。

- lgはminimum w/hを強制。
- md/smはcolumn比へclampし、h minimumを維持。
- xsはw=1。
- xsでminimum widthを満たせない場合、mobile summaryまたはTable fallbackを使う。
- recommended size未満はerrorにせずcompact mode。

### 16.4 Storage

Key:

```text
hono-standard:dashboard-layout:<dashboardId>:v<layoutVersion>
```

Stored:

```ts
{
	layoutVersion,
	updatedAt,
	layouts: { lg, md, sm, xs },
}
```

Restore:

- strict schema parse
- version mismatch削除
- duplicate/unknown panel削除
- missing panel追加
- min/max clamp
- deterministic vertical compact
- invalid storageは削除してdefault

### 16.5 State machine

```text
view
  -> edit-clean
edit-clean
  -> edit-dirty
edit-clean/edit-dirty
  -> cancel -> view
edit-dirty
  -> save -> view
edit-clean/edit-dirty
  -> reset -> edit-dirty
```

Save時だけlocalStorageへ書く。

Keyboard:

- up/down/left/right
- width +/-1
- height +/-1
- xsはup/downのみ
- aria-liveへ結果通知

## 17. Toolbar and Dashboard composition

Toolbar:

- title/description
- range
- custom range dialog/draft
- timezone
- refresh seconds
- variables
- manual refresh
- layout edit controls

Variable UI:

- single=`select`
- multiple=checkbox/chip popover
- disabled optionを選択不可
- loading skeleton
- variable単位error + Retry
- dependency blocked copy
- optional emptyは`All`ではなく`No filter`と表示する

`includeAll`特殊値は実装しない。

DashboardPageはorchestrationだけを担当し、Renderer type switchを持たない。

## 18. Inspector

表示条件:

```ts
import.meta.env.DEV && manifest.inspectorEnabled
```

Tabs:

- Overview
- Request
- Frames
- Transformations
- Visualization
- Error

Overview:

- requestId
- generatedAt
- duration
- resolvedRange
- interval
- counts
- state

Frames:

- refId/source/shape/name
- field key/type/roles
- row count
- 最大100 rows preview

Transformations:

- id/type/execution/disabled
- input/output refs
- status
- configはJSON budget内のsanitized object

Visualization:

- type/preset
- descriptor metadata
- selected frameRefs
- resolved config
- compatibility result

禁止:

- Cookie
- Authorization header
- token
- email
- raw SQL
- stack
- arbitrary response header

Copy JSONはsanitize済みobjectだけ。

## 19. Drilldown and links

Frontend allowlist:

```ts
export const dashboardLinkTargets = {
	protected: { to: "/protected" },
} as const;
```

Resolve input:

```ts
resolveDashboardLink({
	link,
	filters,
	range,
	fieldValues,
	targets,
}): ResolvedDashboardLink | DisabledDashboardLink
```

Rules:

- targetId lookup。
- manifest `to`とallowlist path一致。
- same-origin absolute pathのみ。
- field sourceはfieldKey。
- filter sourceはvariableId。
- first/comma/json format。
- constant。
- unresolved sourceはdisabled。
- includeRange/includeFilters。
- link固有searchが共通searchより優先。
- external URL、`javascript:`、HTMLを拒否。
- header linkはTanStack Router `Link`。
- datum/table actionはtyped `navigate`。
- plain `<a href>`でsearchを手組みしない。

Link source:

- Panel header/footerは`panel.links`。
- Tooltip/Table datum actionはeffective field configの`links`。
- 複数linkが解決できる場合はaction menuを表示し、自動で先頭へ遷移しない。
- field linkは現在rowのfieldValuesだけをsourceにする。

## 20. Accessibility

Panel shell:

- `section`または`article`
- accessibleLabel
- `aria-busy`
- loading/error/status live region
- focus ring維持

Renderer:

- `buildAccessibleSummary()`必須
- chart summaryをvisually hidden textで提供
- Recharts `accessibilityLayer`
- exact valuesへTable toggleで到達可能
- Legendはbutton semantics
- hide/isolateは`aria-pressed`
- colorだけで意味を伝えない
- Tooltipだけに情報を閉じ込めない
- reduced motion尊重

Layout:

- drag handle label
- keyboard move
- resize control
- aria-live announcement

Table:

- caption
- scope
- keyboard scroll
- mapping/threshold text

Renderer moduleがsummaryを返さない場合はmodule contract violationとしてrenderer errorにする。

## 21. Bundle and performance budget

### 21.1 Import boundary

通常initial graph:

```text
dashboard-route.tsx
dashboard-route-search.ts
```

Dashboard route chunk:

```text
Dashboard shell
TanStack Query hooks
Grid
Registry metadata
generic Table
```

Renderer chunks:

```text
core-timeseries -> Recharts
core-bar -> Recharts
core-stat -> no Recharts
core-table -> no Recharts
```

### 21.2 禁止import

- router/rootからDashboard v2 runtime
- search parserからReact Query/Grid/Registry
- catalogからrenderer component static import
- stat/tableからRecharts
- common Panel shellからRecharts
- rendererからGrid

### 21.3 Rendering budget

- generic Table 100 DOM rows/page。
- Data Frame全体のJSON clone禁止。
- model adapterはselected Frameだけ処理。
- resize中は高コストmodel再生成を避ける。
- renderer modelはrequestId/config/frameRefをkeyにmemoize。
- Browser Transformationは8msごとyield可能。
- hidden/offscreen advanced renderer用viewport policyをRegistryに備える。
- F7 core rendererはvisible Dashboard panelとして即load。

## 22. F0〜F12 Work Packages

| WP | 内容 | 完了gate |
| --- | --- | --- |
| F0 | prerequisite、baseline、v1 characterization | current tests/typecheck/bundle記録 |
| F1 | v2 search、API、error、query key | pure/API test |
| F2 | Visualization Registryとrenderer loader | registry/loader test |
| F3 | Browser Transformation runtime | ordering/cancel/budget test |
| F4 | Frame、Field Config、formatter、Table | data/format/table test |
| F5 | variable/query orchestration | dependency/retry/cancel test |
| F6 | Panel state、fallback、error boundary | state/component test |
| F7 | core renderer migration | model/renderer/browser test |
| F8 | RGL v2 layout/persistence/mobile | layout/interaction test |
| F9 | Inspector、links、accessibility | sanitize/link/a11y test |
| F10 | route compositionとv1→v2切替 | operations v2 E2E |
| F11 | focused coverageとbundle gate | coverage/bundle/E2E |
| F12 | full verify、docs、handoff | all gate / progress |

## 23. F0: Baseline

実行:

```bash
git branch --show-current
git status --short
bunx vitest run \
  web/src/domains/dashboard/search.test.ts \
  web/src/domains/dashboard/layout.test.ts \
  web/src/domains/dashboard/chart.test.ts \
  web/src/domains/dashboard/links.test.ts
bunx tsc --noEmit
bun run verify:dashboard-bundle
bunx playwright test -g "dashboard period filter"
```

記録:

- current branch
- tracked/untracked差分
- existing Dashboard chunk names/sizes
- v1 UI正常表示
- range URL/API request
- Chart/Table
- layout save/reload/cancel

必要ならcomponent test用dev dependencyをF0 baseline後に追加する。

```bash
bun add --dev --exact @testing-library/react @testing-library/user-event jsdom
```

追加後はlockfileを保持し、runtime dependencyへ入れない。

全DOM component testは先頭に次を置き、root `bun run test`でもjsdomになるようにする。

```ts
// @vitest-environment jsdom
import "../test/setup";
```

relative pathは対象test位置に合わせる。focused configだけにenvironment setupを依存しない。

## 24. F1: v2 transport/search

実装:

- dashboard-route-search
- v2 API client
- v2 error
- query key serializer
- request builder

Gate:

- Accept header
- schemaVersion=2
- maxRows含有
- success/error Zod parse
- AbortError passthrough
- requestId header/body一致
- no v1 fallback
- 401 refresh single-flight
- refresh後replayは1回だけ
- abort callerは共有refresh完了後にreplayしない
- search default/migration/custom/filter canonicalization
- query key stability

## 25. F2: Visualization Registry

実装:

- renderer contract
- definition helper
- registry
- resolution
- dynamic loader
- prefetch/retry
- fake renderer fixture

Gate:

- duplicate/invalid descriptor
- preset/default config
- unknown type
- invalid config
- missing Frame
- incompatible shape
- loader called once
- loader retry
- no static renderer import

## 26. F3: Browser Transformation

実装:

- definition/registry
- executor
- budget/yield
- TanStack Query hook
- fake browser Transformation

Gate:

- server skip
- browser order
- disabled skip
- config parse
- input/output ref
- source override
- shape/cell limit
- response immutability
- cancellation
- requestId cache separation
- error state
- browser notice/truncated merge
- notice limit
- late rejection吸収

## 27. F4: Data Frame/Table

実装:

- frame selection
- resolved field
- formatter
- theme
- generic Table

Gate:

- multi-frame order
- all unit kinds
- mapping/threshold order
- override matcher
- null/zero
- palette/token fallback
- 100-row pagination
- semantic table
- no HTML injection

## 28. F5: Query orchestration

実装:

- variable state/reconciliation
- options queries
- panel queries
- refresh/manual refresh
- retry policy

Gate:

- dependency chain
- disabled option
- invalid URL correction
- required fallback
- no option case
- variable error blocks downstream
- panel enable condition
- signal propagation
- no placeholder across key change
- stale data during same-key refetch

## 29. F6: Panel runtime

実装:

- derived state
- Panel shell
- notices
- Table toggle
- renderer host
- error boundary
- stale ticker

Gate:

- state priority
- error with previous data
- partial/truncated/stale/refreshing
- unknown/incompatible fallback
- transformation error no raw fallback
- renderer load/render retry
- Panel size stability

## 30. F7: Core renderer

実装順:

1. core.stat
2. core.table
3. core.timeseries line
4. core.timeseries area
5. core.bar vertical

軽いRendererを先に通し、Registry/loaderをRechartsなしで検証してからchartへ進む。

Gate:

- legacy converted manifest config
- representative Data Frame
- null/negative/zero/large value
- threshold/mapping/override
- Tooltip/Legend
- accessibility summary
- Table値一致
- renderer chunk dynamic import

## 31. F8: Layout

実装:

- RGL root v2 API
- layout conversion/restore
- descriptor size
- state machine
- keyboard controls
- xs 1列

Gate:

- `/legacy` import 0件
- view drag disabled
- edit drag/resize
- Save/Cancel/Reset
- storage corruption/version
- new/removed Panel
- min/max
- desktop non-overlap
- mobile 1列

## 32. F9: Inspector/links/a11y

実装:

- Inspector tabs/sanitize
- v2 links
- typed navigation
- focus/live region
- renderer contract a11y enforcement

Gate:

- secret/raw SQL absent
- preview max100 rows
- unknown link disabled
- same-origin
- range/filter merge
- field/filter/constant
- keyboard Legend/layout
- semantic Table

## 33. F10: Route switch

手順:

1. F1〜F9 tests green。
2. `dashboard-route.lazy.tsx`をDashboardPageV2へ切替。
3. manifest Accept v2を確認。
4. request body schemaVersion=2を確認。
5. operations全Panelを比較。
6. v1 superseded fileを削除。
7. import 0件確認。
8. full target test。

切替後、Frontend内でunversioned v1 Dashboard型をimportしない。

```bash
rg -n \
  'PublicDashboardManifest|PanelManifest|PanelQueryResponse|PanelData' \
  web/src/domains/dashboard web/src/routes/dashboard-route*
```

v2 suffixなしのlegacy型だけを検出し、意図したcompat test以外0件にする。

## 34. F11: Coverage/bundle/E2E

### 34.1 Focused coverage

`vitest.dashboard-frontend.config.ts`を追加し、既存`vitest.config.ts`を
`mergeConfig()`する。

- environment=`jsdom`
- setupFiles=`web/src/domains/dashboard/v2/test/setup.ts`
- ResizeObserver、matchMedia、IntersectionObserverを決定的fixtureで補う

Include:

```text
web/src/routes/dashboard-route-search.ts
web/src/domains/dashboard/v2/**/*.ts
web/src/domains/dashboard/v2/**/*.tsx
```

Renderer JSXのpixel描画はE2E対象にし、coverage除外はdynamic renderer component本体だけ
許可する。model/definitionは除外しない。

Threshold:

```text
statements >= 80
lines >= 80
functions >= 80
branches >= 70
```

Script:

```text
verify:dashboard-frontend-coverage =
  vitest run --config vitest.dashboard-frontend.config.ts --coverage
```

### 34.2 Bundle gate

`verify-dashboard-bundle.ts`を拡張する。

- normal entry static graphにDashboard runtime/Grid/Rechartsなし。
- lightweight dashboard-route/search parserはinitial graphへ存在してよい。
- dashboard-route.lazy chunk存在。
- shell chunkからRecharts tokenへ到達しない。
- core-timeseries/core-bar dynamic chunk存在。
- chart renderer graphからRechartsへ到達する。
- core-stat/core-table graphからRechartsへ到達しない。
- catalog sourceにstatic renderer importがない。

file名文字列だけでなくVite manifest import graphで判定する。

### 34.3 E2E

- login
- v2 manifest Accept
- panel POST schemaVersion=2
- period URL/API
- variable dependency
- renderer表示
- Chart/Table same response
- unknown renderer fallback fixture
- renderer lazy request
- layout edit/save/reload/cancel
- mobile 1列
- Inspector sanitize

unknown renderer fixtureはproduction manifestへ追加せず、E2E server injectionで提供する。
Backend側にはfake Visualization definitionを登録してmanifestをvalidにし、Frontend default
catalogには登録しない。これによりFrontend unknown-type fallbackを実routeで確認する。

## 35. F12: Full verification

```bash
bun run verify
bun run verify:dashboard-coverage
bun run verify:dashboard-frontend-coverage
bun run verify:e2e
bun run verify:dashboard-bundle
git diff --check
```

完了後:

- progress更新
- README/LLM_CONTEXT更新
- 04へFrontend gateを引き渡す
- advanced renderer planの開始条件を記録

## 36. Test matrix

### 36.1 Search/API

- missing defaults
- legacy refresh migration
- custom invalid/valid
- filter canonicalization
- Accept/body/version
- 401/404/406/422/429/500/504
- malformed JSON
- malformed success
- requestId mismatch
- abort
- auth refresh single-flight/replay

### 36.2 Registry/loader

- duplicate type
- descriptor/config/preset
- shape compatibility
- missing Frame
- unknown type
- module contract
- prefetch/dedupe/retry

### 36.3 Transformation

- sequential
- server/browser
- disabled
- missing input
- output spoof
- budget/yield
- abort
- late result ignored
- mutation fixture

### 36.4 Data/format

- frame selection
- override order
- unit/mapping/threshold
- locale/timezone
- palette
- null/zero
- multi-frame Table
- pagination

### 36.5 Variables/query

- static/query
- dependency
- disabled
- required/default
- error/retry
- cancel
- refresh
- key change

### 36.6 Panel

- pending
- network error
- previous data error
- transform pending/error
- empty
- incompatible
- renderer loading/error
- partial/truncated/stale/refreshing
- fallback

### 36.7 Layout

- default conversion
- storage
- collision
- min/max
- mode
- keyboard
- mobile

### 36.8 Renderer

- line/area/bar/stat/table
- null/negative/large
- tooltip/legend
- threshold/mapping/override
- summary
- Table parity

## 37. Work Package別command

### F0

```bash
bunx vitest run \
  web/src/domains/dashboard/search.test.ts \
  web/src/domains/dashboard/layout.test.ts \
  web/src/domains/dashboard/chart.test.ts \
  web/src/domains/dashboard/links.test.ts
bunx tsc --noEmit
bun run verify:dashboard-bundle
```

### F1

```bash
bunx vitest run \
  web/src/api.test.ts \
  web/src/routes/dashboard-route-search.test.ts \
  web/src/domains/dashboard/v2/api.test.ts \
  web/src/domains/dashboard/v2/query-keys.test.ts
bunx tsc --noEmit
```

### F2

```bash
bunx vitest run \
  web/src/domains/dashboard/v2/dashboard-runtime.test.ts \
  web/src/domains/dashboard/v2/runtime/visualization-registry.test.ts \
  web/src/domains/dashboard/v2/runtime/renderer-loader.test.ts
bunx tsc --noEmit
```

### F3

```bash
bunx vitest run \
  web/src/domains/dashboard/v2/runtime/transformation-registry.test.ts \
  web/src/domains/dashboard/v2/runtime/transformation-executor.test.ts
bunx tsc --noEmit
```

### F4

```bash
bunx vitest run \
  web/src/domains/dashboard/v2/runtime/frame-selection.test.ts \
  web/src/domains/dashboard/v2/runtime/field-config.test.ts \
  web/src/domains/dashboard/v2/runtime/value-format.test.ts \
  web/src/domains/dashboard/v2/runtime/theme.test.ts \
  web/src/domains/dashboard/v2/panel/panel-table.test.tsx
bunx tsc --noEmit
```

### F5

```bash
bunx vitest run \
  web/src/domains/dashboard/v2/variables.test.ts \
  web/src/domains/dashboard/v2/query-keys.test.ts \
  web/src/domains/dashboard/v2/query-options.test.ts
bunx tsc --noEmit
```

### F6

```bash
bunx vitest run \
  web/src/domains/dashboard/v2/runtime/panel-state.test.ts \
  web/src/domains/dashboard/v2/panel/panel-shell.test.tsx \
  web/src/domains/dashboard/v2/panel/panel-renderer-host.test.tsx
bunx tsc --noEmit
```

### F7

```bash
bunx vitest run \
  web/src/domains/dashboard/v2/visualizations/core-timeseries/model.test.ts \
  web/src/domains/dashboard/v2/visualizations/core-bar/model.test.ts \
  web/src/domains/dashboard/v2/visualizations/core-stat/renderer.test.tsx \
  web/src/domains/dashboard/v2/visualizations/core-table/renderer.test.tsx \
  web/src/domains/dashboard/v2/runtime/value-format.test.ts
bunx tsc --noEmit
```

### F8

```bash
bunx vitest run \
  web/src/domains/dashboard/v2/layout/layout.test.ts \
  web/src/domains/dashboard/v2/layout/layout-state.test.ts
bunx tsc --noEmit
```

### F9

```bash
bunx vitest run \
  web/src/domains/dashboard/v2/inspector/sanitize.test.ts \
  web/src/domains/dashboard/v2/links/resolve-link.test.ts
bunx tsc --noEmit
```

### F10

```bash
bunx vitest run web/src/domains/dashboard/v2 web/src/routes/dashboard-route-search.test.ts
bunx tsc --noEmit
bunx playwright test -g "dashboard period filter"
```

### F11

```bash
bun run verify:dashboard-frontend-coverage
bun run verify:dashboard-bundle
bun run verify:e2e
```

### F12

```bash
bun run verify
bun run verify:dashboard-coverage
bun run verify:dashboard-frontend-coverage
bun run verify:e2e
bun run verify:dashboard-bundle
git diff --check
```

## 38. Security and privacy

- API response textをHTMLとしてrenderしない。
- Table/Tooltip/Legendはplain text。
- URL filterへsecret/PIIを保存しない。
- Inspectorへemail/token/cookie/SQL/stackを入れない。
- error detailsを無制限表示しない。
- data linkはallowlist same-origin。
- dynamic import pathをmanifest文字列から組み立てない。
- registryのloaderはcode-defined functionだけ。
- Transformation configからeval/Functionを呼ばない。
- CSS tokenはallowlist。
- localStorage layoutへdata/query responseを保存しない。
- clipboardへsanitize済みInspector JSONだけを書く。

## 39. Stop条件

次の場合だけ停止する。

- 01 C9または02 B12が未完了。
- v2 Backend responseが計画したshared schemaと一致しない。
- core legacy migration configをstrict schemaで一意に解釈できない。
- renderer dynamic importが通常initial graphから切り離せない。
- RGL v2 root APIで現行layout機能を維持できない。
- unknown VisualizationをPanel単位で隔離できないReact構造になっている。
- Browser Transformationに任意code実行が必要になる。
- security/accessibility contractを弱める必要がある。
- user所有変更と同じFrontend行を大規模に書き換える必要がある。

停止しない例:

- TypeScript genericが複雑。
- renderer testが多い。
- Recharts model adapterが長い。
- bundle gate scriptの改修が必要。
- CSS調整が複数回必要。
- component test dependency追加が必要。
- coverage thresholdに最初は届かない。

## 40. 完了条件

- [ ] 01 C0〜C9 complete。
- [ ] 02 B0〜B12 complete。
- [ ] F0〜F12 complete。
- [ ] Dashboard Frontendがv2 transportだけを使用。
- [ ] v1 silent downgradeなし。
- [ ] Visualization Registryがcode-defined。
- [ ] renderer typeごとのdynamic import。
- [ ] unknown/config/shape/load/render errorがPanel単位。
- [ ] Browser Transformation generic runtime。
- [ ] Server Transformationを再実行しない。
- [ ] Data Frame/Field Config/Override共通処理。
- [ ] generic Table fallback。
- [ ] core.timeseries line/area。
- [ ] core.bar vertical。
- [ ] core.stat value。
- [ ] core.table。
- [ ] Tooltip/Legend/accessibility summary。
- [ ] Chart/Table同一Frame。
- [ ] variable dependencyとURL canonicalization。
- [ ] loading/error/retry/refreshing/partial/truncated/stale。
- [ ] RGL v2 root API。
- [ ] desktop drag/resize、mobile 1列。
- [ ] Save/Cancel/Reset/keyboard。
- [ ] Inspector sanitize。
- [ ] same-origin typed drilldown。
- [ ] normal initial graphへDashboard runtime/Grid/Rechartsなし。
- [ ] Dashboard shell chunkへRechartsなし。
- [ ] chart renderer chunkだけRecharts依存。
- [ ] focused Frontend coverage達成。
- [ ] `bun run verify`成功。
- [ ] `bun run verify:dashboard-coverage`成功。
- [ ] `bun run verify:dashboard-frontend-coverage`成功。
- [ ] `bun run verify:e2e`成功。
- [ ] `bun run verify:dashboard-bundle`成功。
- [ ] `git diff --check`成功。
- [ ] progress更新。

## 41. 次計画へ渡す成果

04 Validation / Gallery / Delivery計画は次を前提にしてよい。

```text
Frontend:
  v2 transport only
  registry-based render
  renderer-level lazy load
  browser transformation runtime
  generic Data Frame table
  field config / override
  stable panel states
  responsive editable layout

Core production catalog:
  core.timeseries line/area
  core.bar vertical
  core.stat value
  core.table table
```

後続Visualization計画は次だけを追加すればよい。

1. descriptor/config schema
2. model adapter
3. lazy renderer module
4. catalog registration
5. fixture/test/Gallery panel

Panel shell、API、query orchestration、layoutをRendererごとに作り直さない。

## 42. 再開手順

1. [00-concept.md](./00-concept.md)を読む。
2. [01-contracts.md](./01-contracts.md) C9完了を確認する。
3. [02-backend.md](./02-backend.md) B12完了を確認する。
4. [progress.md](./progress.md)のFrontend v2節を読む。
5. `git branch --show-current`、`git status --short`。
6. 最後の成功commandを再実行する。
7. `in_progress`のF packageだけを続ける。
8. なければ最初のpending F packageを開始する。
9. F12完了まで04 release判定へ進まない。
