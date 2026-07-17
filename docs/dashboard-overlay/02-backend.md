# 02: Dashboard Visualization Platform Backend 実装計画

## 1. 文書の位置づけ

この文書は [01: 共有契約 実装計画](./01-contracts.md)で追加されるVisualization Platform v2 contractを、Backend runtime、registry、query execution、normalization、Transformation、APIへ実装するための正本である。

初期Dashboard v1 Backendは既に実装済みである。この計画ではv1を削除せず、v1 Frontendが動作したままv2 Backendを併設する。

### 1.1 開始条件

次を全て満たすまでB0を開始しない。

- 01のC0〜C9がcomplete。
- v2 schemaとcompatibility helperがpublic exportされている。
- `bun run verify`が成功している。
- `bun run verify:dashboard-coverage`が成功している。
- [進捗台帳](./progress.md)の01 statusがcomplete。

01未完了はStop条件である。Backend側で共有schemaを仮実装して進めてはならない。

### 1.2 Lunaへの完了指示

LunaはB0〜B12を順番に実行する。

- 同時に`in_progress`にするWork Packageは1つだけ。
- v1 routeとv1 responseを壊さない。
- Backend内部からReact、Recharts、`react-grid-layout`をimportしない。
- Dashboard coreからDB driver、Drizzle schema、SQL builderをimportしない。
- type errorやtest failureを残して次へ進まない。
- 既存の未コミット変更、`dist-server/`、`dist-ssg/`を削除しない。
- Frontend v2実装を先行して追加しない。

## 2. 目的

この計画で構築するBackendは次の責務を持つ。

1. v1 / v2 Dashboard定義を同時に登録する。
2. v1定義をv2 public manifest / responseへ変換する。
3. Native v2 Dashboardをschemaとregistryで起動時検証する。
4. Panel内の複数query bindingを実行する。
5. Query handler出力をData Frameへ正規化する。
6. Server Transformationをmanifest順に実行する。
7. Browser Transformation用のraw Frameを返す。
8. Variable optionsを専用executorで実行する。
9. range、filter、auth、AbortSignal、timeout、limiterを全handlerへ渡す。
10. v1 Frontendを維持しながらv2 transportを選択できるAPIを提供する。

Backendは可視化を描画しない。Visualization Registryはmanifest configとData Frame shapeの互換性を検証するために使う。

## 3. 完了後の状態

02完了時に次の状態になっていること。

- 既存`/dashboard`がv1 responseで従来通り動く。
- v2 media typeまたはv2 request bodyでv2 responseを取得できる。
- v1 Dashboardをv2 manifest / Data Frame responseとして取得できる。
- Native v2 Dashboardをinjected fixtureとして登録・queryできる。
- 1 Panelで最大8 query bindingを扱える。
- 1 queryで宣言済み1〜4 Frameを返せる。
- Query handlerはDB固有集計だけを実装すればよい。
- HandlerがFrame sourceやschemaVersionを偽装できない。
- Server Transformation engineがgeneric definitionを実行できる。
- Browser TransformationはBackendで実行せずraw inputを返す。
- request abort、queue timeout、handler timeout、panel timeoutが区別される。
- auth contextがquery / variable handlerへ伝播する。
- routeがsafe errorだけを返し、内部error messageやstackを漏らさない。
- Dashboard focused coverageにrouteとv2 runtimeが含まれる。

## 4. 対象

### 4.1 既存ファイル

```text
api/modules/dashboard/index.ts
api/modules/dashboard/types.ts
api/modules/dashboard/dashboard-limits.ts
api/modules/dashboard/dashboard-registry.ts
api/modules/dashboard/define-dashboard.ts
api/modules/dashboard/query-executor.ts
api/modules/dashboard/normalize-result.ts
api/modules/dashboard/result-builders.ts
api/modules/dashboard/execution-limiter.ts
api/modules/dashboard/abort-signals.ts
api/modules/dashboard/interval.ts
api/modules/dashboard/demo-dashboard.ts
api/modules/auth/types.ts
api/modules/auth/context.ts
api/modules/auth/context.test.ts
api/routes/dashboard.route.ts
api/routes/dashboard.route.test.ts
api/app/hono.ts
api/app/hono.test.ts
package.json
vitest.config.ts
```

### 4.2 追加ファイル

v1ファイルを移動せず、v2をsubdirectoryへ追加する。

```text
api/modules/dashboard/dashboard-service.ts
api/modules/dashboard/dashboard-service.test.ts
api/modules/dashboard/runtime-errors.ts
api/modules/dashboard/runtime-errors.test.ts
api/modules/dashboard/runtime-clock.ts
api/modules/dashboard/runtime-clock.test.ts
api/modules/dashboard/runtime-logger.ts
api/modules/dashboard/runtime-logger.test.ts
api/modules/dashboard/abort-signals.test.ts

api/modules/dashboard/v2/types.ts
api/modules/dashboard/v2/define-dashboard.ts
api/modules/dashboard/v2/define-dashboard.test.ts
api/modules/dashboard/v2/frame-builders.ts
api/modules/dashboard/v2/frame-builders.test.ts
api/modules/dashboard/v2/visualization-registry.ts
api/modules/dashboard/v2/visualization-registry.test.ts
api/modules/dashboard/v2/transformation-registry.ts
api/modules/dashboard/v2/transformation-registry.test.ts
api/modules/dashboard/v2/dashboard-registry.ts
api/modules/dashboard/v2/dashboard-registry.test.ts
api/modules/dashboard/v2/frame-normalizer.ts
api/modules/dashboard/v2/frame-normalizer.test.ts
api/modules/dashboard/v2/panel-state.ts
api/modules/dashboard/v2/panel-state.test.ts
api/modules/dashboard/v2/query-coordinator.ts
api/modules/dashboard/v2/query-coordinator.test.ts
api/modules/dashboard/v2/transformation-executor.ts
api/modules/dashboard/v2/transformation-executor.test.ts
api/modules/dashboard/v2/variable-options-executor.ts
api/modules/dashboard/v2/variable-options-executor.test.ts
api/modules/dashboard/v2/compatibility-runtime.ts
api/modules/dashboard/v2/compatibility-runtime.test.ts
api/modules/dashboard/v2/test-fixtures.ts

api/routes/dashboard-version.ts
api/routes/dashboard-version.test.ts
vitest.dashboard.config.ts
```

### 4.3 対象外

- Frontend v2 API client
- Visualization renderer
- Panel editor
- built-in Transformation全種のアルゴリズム
- arbitrary SQL editor
- data source plugin
- cache server
- job queue
- worker thread
- Dashboard DB保存
- server-side layout保存
- alerting
- RBAC管理画面

02ではgeneric Transformation runtimeを実装する。`core.reduce`などの個別Transformation schema / algorithmは後続P1で実装する。

## 5. 現行Backend監査

### 5.1 現行構造

```text
DashboardModule
  ├─ DashboardRegistry(v1)
  ├─ DashboardExecutionLimiter
  ├─ clock: () => Date
  └─ execution limits

Panel endpoint
  → createDashboardQueryExecutor
  → panel.handler
  → normalizePanelResult
  → PanelQueryResponse(v1)
```

### 5.2 現行で維持するもの

- `createDashboardModule()`の引数なし起動
- `demoDashboards`
- v1 `DashboardDefinition`
- v1 result builders
- v1 manifest / variable / panel endpoint
- requireAuth配下
- rangeとnice interval
- shared limiter
- request cancellation
- route-level error envelope

### 5.3 現行で修正する問題

1. Dashboard routeがauth contextをhandlerへ渡していない。
2. Variable options routeがtimeout / limiter / error mappingを重複実装している。
3. limiter queueのabort listener cleanupが不十分。
4. queued request abortがexecution limit errorとして扱われる。
5. max queue lengthがない。
6. timeoutがHTTP 408になっており、handler timeoutの504契約と異なる。
7. routeがunknown handler errorのmessageをclientへ返している。
8. requestIdがrouteとexecutorで別生成される。
9. duration計測がinjectできない`Date.now()`へ依存する。
10. native v2 query / multi-frame / transformationを扱えない。

B0では既存の正常挙動をcharacterizationするが、上記の問題を互換仕様として固定しない。

## 6. 固定済み設計判断

実装中に次を再検討しない。

1. v1 Backendを削除せずdual runtimeとする。
2. default `operations` Dashboardは02完了時点でもv1登録を維持する。
3. v2 requestに対するlegacy Dashboard実行はv1 executor結果をv2へ変換する。
4. Native v2 Dashboardをv1へ逆変換しない。
5. manifest GETのv2選択は`Accept` media typeを使う。
6. POST response versionはrequest body versionに合わせる。
7. routeはDashboardServiceだけを呼び、registry / limiterを直接操作しない。
8. Native v2 query handlerはPanelではなくdashboard-level query registryへ登録する。
9. Query handlerは宣言済みFrameだけを返す。
10. Query handlerはschemaVersionとsourceを指定しない。executorが付与する。
11. 複数query bindingは並列実行する。
12. query結果のFrame順はmanifest binding / outputFrameRefs順へ安定化する。
13. response Frame順はquery Framesの後にserver Transformation出力をmanifest順で置く。
14. hidden queryも実行し、Browser Transformation用にresponseへ含める。
15. 複数queryが失敗した場合はmanifest順で最初の非cancel errorを返す。
16. query failure時に成功済みFrameをpartial responseとして返さない。
17. v2 normalizerは値のcoercion、sort、gap fill、aggregationを暗黙実行しない。
18. v1 queryは既存v1 normalizerを通してからv2へ変換する。
19. Server Transformationはcode-defined trusted functionだけを実行する。
20. Browser TransformationをBackendで実行しない。
21. Server Transformationは1 specにつき1 Frameを出力する。
22. query Frameとserver transformation Frameをresponseへ含める。
23. response全体cell budgetを超えたら失敗し、truncateしない。
24. handler / variable handlerへ認証済みauth contextを渡す。
25. auth管理やrole policy engineは追加しない。
26. global handler limiterをv1 / v2 / variableで共有する。
27. route errorはsafe messageだけを返す。
28. Backend coreはDB / Hono / Reactへ依存しない。Hono依存はrouteだけ。
29. v2 runtime追加のための外部runtime dependencyを増やさない。
30. AbortSignalを無視する非同期handlerでもresponse deadlineは守る。
31. timeout後も未完了handlerのlimiter slotは実Promise settleまで解放しない。
32. 同期無限loopは同一threadではpreemptできないため、trusted handlerの禁止事項とする。

## 7. Version negotiation

### 7.1 Media type

```ts
export const DASHBOARD_V2_MEDIA_TYPE =
	"application/vnd.hono-standard.dashboard.v2+json";
```

Manifest GET:

| Accept | Response |
| --- | --- |
| v2 media typeを含む | v2 |
| `application/json` | v1 |
| `*/*` | v1 |
| 未指定 | v1 |
| dashboard vendor media typeの未知version | 406 |

移行中はv1をdefaultとし、03 Frontend計画でv2 Acceptへ切り替える。

Parser rules:

1. header長8KiB以下、media range最大32件。
2. commaで分割し、media typeはcase-insensitive、parameter名もcase-insensitive。
3. `q`省略は1、`q=0`はnot acceptable。0〜1外、重複q、malformed parameterは400。
4. supported v2 vendor media typeが`q>0`ならv2。
5. supported vendorがなく、未知dashboard vendor versionが`q>0`なら406。
6. それ以外で`application/json`または`*/*`が`q>0`ならv1。
7. acceptable rangeが残らなければ406。

generic `application/json`のqがv2より高くても、v2 vendorを明示したrequestはv2を選ぶ。
これは通常のformat negotiationではなく、移行期間の明示的version opt-inとして扱う。

### 7.2 POST version

- `schemaVersion: 2`を持つbodyはv2。
- schemaVersionなしのvalid v1 bodyはv1。
- `schemaVersion: 1`は01のany-version contractに従いv1。
- 未知versionは`SCHEMA_VERSION_UNSUPPORTED`。
- v2 Accept + v1 bodyはversion mismatchとして400。
- Accept未指定 + v2 bodyはv2 response。

### 7.3 Response header

- 全Dashboard responseへ`X-Request-ID`を付ける。
- Manifest responseへ`Vary: Accept`を付ける。
- Content-Typeは通常の`application/json`を維持する。
- 429だけ`Retry-After: 1`を付ける。

## 8. Module構成

```text
DashboardRoute(Hono)
        ↓
DashboardService
  ├─ legacy registry / executor
  ├─ v2 registry / query coordinator
  ├─ variable options executors
  ├─ compatibility runtime
  ├─ version negotiation input
  ├─ clock / request ID / logger
  └─ shared execution limiter
```

### 8.1 DashboardModule

```ts
export type DashboardModule = {
	service: DashboardService;
	registry: DashboardRegistry;
	limiter: DashboardExecutionLimiter;
	v2Registry: DashboardRegistryV2;
	visualizations: DashboardVisualizationRegistry;
	transformations: DashboardTransformationRegistry;
	limits: DashboardExecutionLimits;
	clock: DashboardRuntimeClock;
	/** @deprecated compatibility alias for clock.now */
	now: () => Date;
	logger: DashboardRuntimeLogger;
};
```

`registry`、`limiter`、`now`はv1 compatibilityのため維持する。新しいrouteは
`service`だけを使用する。

### 8.2 createDashboardModule

```ts
export function createDashboardModule(options?: {
	dashboards?: DashboardDefinition[];
	dashboardsV2?: DashboardDefinitionV2[];
	visualizations?: AnyVisualizationDefinition[];
	transformations?: AnyTransformationRuntimeDefinition[];
	limits?: Partial<DashboardExecutionLimits>;
	clock?: DashboardRuntimeClock;
	/** @deprecated use clock */
	now?: () => Date;
	requestId?: () => string;
	logger?: DashboardRuntimeLogger;
}): DashboardModule;
```

Defaults:

```text
dashboards = demoDashboards
dashboardsV2 = []
visualizations = []
transformations = []
clock = system clock
requestId = crypto.randomUUID
logger = no-op logger
```

Native v2 Dashboardを登録する場合、必要なVisualization / Transformation definitionも同時に渡す。

既存caller互換ルール:

- `now`だけが渡された場合、`clock.now = now`として扱う。
- `now`互換時の`monotonicMs`はdefault monotonic clockを使う。
- `clock`と`now`の同時指定はstartup errorにする。
- 返却する`module.now`は常に`module.clock.now`と同一function referenceにする。
- 引数なし起動、`limits`だけ、`dashboards`だけ、`now`だけの既存呼び出しを壊さない。
- request ID factoryの返却値は共有UUID schemaで起動時または使用時に検証し、
  invalidならclient requestを開始せずstartup/configuration errorにする。

## 9. Runtime primitive

### 9.1 Clock

```ts
export type DashboardRuntimeClock = {
	now: () => Date;
	monotonicMs: () => number;
};
```

Default:

```ts
{
	now: () => new Date(),
	monotonicMs: () => performance.now(),
}
```

1 HTTP operationにつき`requestTime = clock.now()`を1度だけ取得する。

- relative rangeの`to`
- generatedAt
- handler context

に同じrequestTimeを使う。durationはmonotonic clock差分で計測する。

### 9.2 Auth

現行`AuthContextUser`はHonoをimportする`api/modules/auth/context.ts`に定義されている。
Dashboard coreからそこをimportするとHono非依存を破るため、型定義だけを
`api/modules/auth/types.ts`へ移す。

```ts
// api/modules/auth/types.ts
export type AuthContextUser = {
	userId: string;
	email: string;
	role: UserRole;
};

// dashboard runtime
export type DashboardAuthContext = Readonly<AuthContextUser>;
```

`auth/context.ts`はこの型をimportし、従来通り`AuthContextUser`をre-exportして既存importを
壊さない。Routeは`getAuthContextUser(c)`で取得する。email、userId、role以外を渡さない。
auth middleware/serviceの挙動は変更しない。

### 9.3 Logger

```ts
export type DashboardRuntimeLogger = {
	info: (event: DashboardLogEvent) => void;
	warn: (event: DashboardLogEvent) => void;
	error: (event: DashboardLogEvent, cause?: unknown) => void;
};
```

Defaultは全method no-op。

許可するfield:

```text
event
requestId
dashboardId
panelId
variableId
queryId
queryRefId
durationMs
frameCount
fieldCount
rowCount
cellCount
errorCode
```

禁止:

- filter value
- email
- token / cookie
- raw SQL
- connection string
- response row
- stack traceのclient転送

内部loggerのerrorへ`cause`を別引数で渡してよいが、public event objectへserializeしない。

## 10. Execution limits

```ts
export type DashboardExecutionLimits = {
	maxConcurrent: number;
	maxQueued: number;
	queueTimeoutMs: number;
	handlerTimeoutMs: number;
	panelTimeoutMs: number;
	maxServerTransformations: number;
	serverTransformationBudgetMs: number;
};
```

Defaults:

```text
maxConcurrent = 6
maxQueued = 64
queueTimeoutMs = 2_000
handlerTimeoutMs = 10_000
panelTimeoutMs = 15_000
maxServerTransformations = 10
serverTransformationBudgetMs = 250
```

Validation:

- 全てpositive integer。ただしmaxQueuedは0を許可する。
- panelTimeoutMs >= handlerTimeoutMs。
- maxServerTransformations <= shared maxTransformationsPerPanel。
- serverTransformationBudgetMs < panelTimeoutMs。

### 10.1 Limiter

既存`DashboardExecutionLimiter`をrefactorし、v1/v2で共有する。

```ts
new DashboardExecutionLimiter({
	maxConcurrent,
	maxQueued,
	queueTimeoutMs,
});
```

Rules:

- FIFO。
- queue fullは即時`EXECUTION_LIMIT_REACHED`。
- queue timeoutも`EXECUTION_LIMIT_REACHED`。
- queued signal abortは`REQUEST_CANCELLED`。
- releaseはidempotent。
- timeout / abort / acquire成功時にtimerとlistenerを必ずcleanupする。
- active / queued countを負数にしない。
- panel request自体はslotを取得せず、各handlerだけがslotを取得する。
- Server Transformationはhandler limiterを使用しない。

### 10.2 Abort reason

```text
request-cancelled
queue-timeout
handler-timeout
panel-timeout
```

AbortSignal.reasonへ識別可能なobjectを設定する。文字列message比較でreasonを判定しない。

Panel request signal:

```text
HTTP request signal + panel timeout signal
```

Query handler signal:

```text
panel request signal + handler timeout signal
```

終了時に全listener / timerをdisposeする。

AbortSignalは協調的cancelなので、signalを渡すだけでは無視するPromiseを止められない。
Backend内部に次のhelperを実装する。

```ts
raceDashboardOperation<T>(options: {
	operation: Promise<T>;
	signal: AbortSignal;
	onLateSettlement?: (outcome: "fulfilled" | "rejected") => void;
}): Promise<T>
```

Rules:

- signal abort時はreasonに対応する`DashboardRuntimeError`でrace側をrejectする。
- 元Promiseへ必ずfulfillment/rejection handlerを付け、late rejectionをunhandledにしない。
- race完了時にabort listenerをcleanupする。
- 元Promise自体をcancelできたと仮定しない。
- synchronous throwはPromise化して同じpathへ通す。
- 同期無限loopはpreempt不能であり、handler/Transformation authoring ruleで禁止する。

Limiter付きhandlerのrelease ownership:

1. limiter slot取得。
2. actual handler Promiseを生成。
3. `actual.then(release, release)`を先に登録し、返されたPromiseのrejectionも吸収する。
4. callerは`raceDashboardOperation(actual, composedSignal)`をawait。
5. timeout/cancelでcallerが先に戻ってもslotはactual settleまでactiveのまま。
6. late settle時はresponseを再開せず、safe logger eventだけを記録する。

slotをrace Promiseの`finally`で解放してはならない。そうするとAbortSignalを無視する
handlerが裏で動き続けているのに新しいhandlerを開始でき、`maxConcurrent`を破る。

## 11. B0〜B12 Work Packages

| WP | 内容 | 完了gate |
| --- | --- | --- |
| B0 | baselineとv1 characterization | 現行target test、typecheck、coverage記録 |
| B1 | runtime error、clock、logger、limiter、abort | infrastructure unit test |
| B2 | v2 definition型とFrame builder | builder / definition test |
| B3 | Visualization / Transformation registry | registry config test |
| B4 | DashboardRegistryV2 semantic validation | manifest graph test |
| B5 | Frame normalizerとPanel state merge | normalization/state test |
| B6 | native v2 multi-query coordinator | query execution test |
| B7 | Server Transformation executor | ordering/budget test |
| B8 | Variable options executor | static/query/auth/cancel test |
| B9 | compatibility runtimeとDashboardService | v1/v2 dispatch test |
| B10 | API route version negotiation / error mapping | route integration test |
| B11 | app composition、test fixture、coverage gate | app/fixture/coverage test |
| B12 | full verification、docs、handoff | verify/e2e/bundle/diff |

## 12. B0: baselineとcharacterization

### 12.1 実行

```bash
git branch --show-current
git status --short
bunx vitest run \
  api/modules/dashboard/dashboard-registry.test.ts \
  api/modules/dashboard/normalize-result.test.ts \
  api/modules/dashboard/query-executor.test.ts \
  api/modules/dashboard/execution-limiter.test.ts \
  api/routes/dashboard.route.test.ts
bunx tsc --noEmit
bun run verify:dashboard-coverage
```

### 12.2 Characterization

既存testへ最低限追加する。

- default moduleがoperationsを返す。
- v1 manifestにschemaVersionがない。
- v1 panel query responseに`data`がある。
- v1 requestはv1 responseになる。
- static optionsがpublic manifestから除去される。
- routeがrequireAuth外で直接呼ばれた場合の現状を記録するが、auth欠落を仕様として固定しない。

## 13. B1: Runtime infrastructure

### 13.1 DashboardRuntimeError

```ts
export class DashboardRuntimeError extends Error {
	constructor(
		readonly code: DashboardErrorCodeV2,
		readonly status: 400 | 404 | 406 | 408 | 422 | 429 | 500 | 504,
		message: string,
		readonly retryable: boolean,
		readonly details?: DashboardJsonObject,
		readonly cause?: unknown,
	) {
		super(message);
		this.name = "DashboardRuntimeError";
	}
}
```

`message`はclientへ表示可能なsafe messageだけを入れる。unknown errorの元messageはcauseへ入れ、public messageへ使わない。

Factory:

```text
invalidRequest
notFound
unsupportedVersion
requestCancelled
executionLimit
handlerTimeout
panelTimeout
invalidHandlerResult
queryFailed
```

### 13.2 v1 error bridge

既存`DashboardQueryError`は削除しない。

```ts
dashboardQueryErrorToRuntimeError(error): DashboardRuntimeError
```

Mapping:

| v1 code | v2 runtime |
| --- | --- |
| invalid/not found | 400/404、retry false |
| execution limit | 429、retry true |
| handler timeout | 504、retry true |
| request cancelled | 408、retry false |
| invalid result | 422、retry false |
| query failed | 500、retry policy維持 |

request disconnect済みの場合routeは408 bodyを送ろうとしない。

### 13.3 Clockとrequest ID

- `createSystemDashboardRuntimeClock()`を追加する。
- production wall clockは`new Date()`、durationは`performance.now()`を使う。
- test clockはwall timeとmonotonic timeを独立して進められるfixtureにする。
- request ID factoryはmodule生成時に注入し、route/service/executor内で
  `crypto.randomUUID()`を直接呼ばない。
- 1 operation中にwall clockを再取得しない。
- monotonic clockが後退したtest doubleを受けてもdurationは`Math.max(0, end-start)`。

Test:

- injected wall clock
- injected monotonic clock
- legacy `now` alias
- `clock`と`now`同時指定拒否
- request ID factory 1回
- invalid request ID factory output
- requestTime object identity

### 13.4 Logger

- `createNoopDashboardRuntimeLogger()`を追加する。
- eventをshared JSON schemaへ通し、未知fieldを拒否する。
- logger自体のthrowでDashboard requestを失敗させない。呼び出しを
  `try/catch`するsafe wrapperを1か所へ置く。
- `cause`はlogger implementationへ第二引数で渡してよいが、event JSONへ混ぜない。
- start / success / failureの最低3 eventを定義する。
- success eventはduration/count、failure eventはsafe errorCodeだけを持つ。

### 13.5 LimiterとAbortSignal

- immediate acquire
- FIFO
- maxQueued=0
- queue full
- queue timeout
- abort while queued
- release twice
- active handler throw
- add/remove event listener count一致
- timer cleanup
- never-settling Promiseがdeadlineでcallerへ戻る
- timeout後もactual Promise settleまでslotを保持する
- late rejectionがunhandled rejectionにならない

`abort-signals.ts`はreason objectを生成・判定するhelperを持つ。`AbortSignal.any()`の
runtime availabilityへ依存せず、現行compose helperをcleanup可能なまま拡張する。

B1完了gate:

- runtime error、clock、logger、limiter、abort unit testが全てgreen。
- 既存v1 route/executor testがgreen。
- `Date.now()`、route内`crypto.randomUUID()`の新規直接呼び出しがない。
- timer/listener leakをfake timer testで否定できる。
- Dashboard coreのimport graphに`hono`が入っていない。
- auth contextの既存runtime testとtype importが維持される。

## 14. B2: Native v2 definition

### 14.1 DashboardDefinitionV2

```ts
export type DashboardDefinitionV2 = {
	manifest: DashboardManifestV2;
	variables: DashboardVariableDefinitionV2[];
	queries: DashboardQueryDefinitionV2[];
};
```

Panel definitionを別配列に持たない。Panelはmanifest内にあり、query bindingがdashboard-level query definitionを参照する。

### 14.2 Query definition

```ts
export type DashboardQueryDefinitionV2 = {
	id: string;
	filterKeys: string[];
	interval: "none" | "auto";
	outputShapes: DashboardDataShape[];
	handler: DashboardQueryHandlerV2;
};
```

Rules:

- idはDashboard内で一意。
- filterKeysはvariable IDだけを許可し、重複禁止。
- interval default=`auto`。
- outputShapesは1〜4件。
- query binding.outputFrameRefsとoutputShapesの長さが一致すること。
- `outputShapes[i]`は各bindingの`outputFrameRefs[i]`へ対応する。
- Native v2 handlerはshapeHintを必須とする。

### 14.3 Handler context

```ts
export type DashboardQueryHandlerContextV2 = {
	requestId: string;
	requestTime: Date;
	dashboardId: string;
	panelId: string;
	queryId: string;
	queryRefId: string;
	outputFrameRefs: string[];
	range: DashboardRangeV2;
	resolvedRange: ResolvedRange;
	timezone: string;
	filters: DashboardFiltersV2;
	maxDataPoints: number;
	maxRows: number;
	intervalMs?: number;
	bucketOriginMs?: number;
	auth: DashboardAuthContext;
	signal: AbortSignal;
};
```

`filters`はquery definition.filterKeysへprojectionした値だけを含む。

### 14.4 Handler result

```ts
export type DashboardQueryFrameInputV2 = Omit<
	DashboardDataFrameV2,
	"schemaVersion" | "source"
>;

export type DashboardQueryHandlerResultV2 = {
	frames: DashboardQueryFrameInputV2[];
	state?: PanelDataStateV2;
};
```

Rules:

- framesはbinding.outputFrameRefsと同じ集合。
- handler orderは信用せずnormalizerがdeclaration順へ並べる。
- emptyでもFrameを省略せず0 row Frameを返す。
- handlerはschemaVersion / sourceを指定できない。
- handlerはrequest / contextをmutationしない。

TypeScriptの`Omit`だけではruntimeの余剰propertyを拒否できないため、Backend内部に
strictな`dashboardQueryFrameInputV2Schema`を置く。`schemaVersion`、`source`、
未知propertyが返された場合は`INVALID_HANDLER_RESULT`にする。このschemaは共有transport
contractではなくtrusted handler boundary専用であり、public exportしない。

### 14.5 Variable definition

```ts
export type DashboardVariableDefinitionV2 = {
	manifest: VariableManifestV2;
	options?: DashboardVariableOptionsHandlerV2;
};
```

Query sourceだけoptions handlerを持つ。Static sourceにhandlerがある場合はstartup error。

Variable handler context:

```ts
{
	requestId;
	requestTime;
	dashboardId;
	variableId;
	resolvedRange;
	timezone;
	dependsOn;
	filters;
	auth;
	signal;
}
```

### 14.6 Definition helper

```ts
defineDashboardV2(input): DashboardDefinitionV2
defineDashboardQueryV2(input): DashboardQueryDefinitionV2
```

helperはshared structural schemaをparseする。Visualization / Transformation registryを必要とするsemantic validationはDashboardRegistryV2が行う。

## 15. B2: Frame builders

最低限次をpublic exportする。

```text
timeField
numberField
stringField
booleanField
dataFrame
queryResult
```

Example:

```ts
queryResult({
	frames: [
		dataFrame({
			refId: "A",
			name: "Requests",
			shapeHint: "timeseries",
			fields: [
				timeField("time", timestamps, { roles: ["time"] }),
				numberField("requests", values, { roles: ["value"] }),
			],
		}),
	],
});
```

Builders:

- schema parseを行う。
- input配列をcopyする。
- nullを維持する。
- undefinedをnullへ暗黙変換しない。
- source / schemaVersionを付けない。
- handler result state defaultを適用する。

## 16. B3: Visualization Registry

```ts
class DashboardVisualizationRegistry {
	constructor(definitions: AnyVisualizationDefinition[]);
	get(type: string): AnyVisualizationDefinition | undefined;
	parseSpec(spec: VisualizationSpecV2): ParsedVisualizationSpec;
}
```

Startup validation:

- descriptor schema
- duplicate type
- duplicate preset
- defaultPreset existence
- defaultOptionsByPreset coverage
- default options JSON budget
- default options configSchema parse
- configSchemaVersion positive

`parseSpec`:

1. type lookup
2. preset resolve
3. default options + spec options merge
4. JSON budget
5. configSchema strict parse
6. parsed typed configを返す

Legacy compatibility manifestは01 adapter test済みのtrusted migration pathとして扱う。Native v2 manifestだけをこのregistryでstartup validationする。

## 17. B3: Transformation Registry

Backend runtime definition:

```ts
export type DashboardServerTransformationResult = {
	frame: DashboardQueryFrameInputV2;
	notices?: DashboardNoticeV2[];
	truncated?: boolean;
};

export type AnyTransformationRuntimeDefinition =
	TransformationDefinition<unknown> & {
	execute?: (
		context: DashboardServerTransformationContext,
		config: unknown,
	) =>
		| DashboardServerTransformationResult
		| Promise<DashboardServerTransformationResult>;
};
```

Rules:

- serverCapable=trueならexecute必須。
- serverCapable=falseならexecute禁止。
- browserCapableはBackendでexecuteしない。
- duplicate typeを拒否する。
- descriptorを共有schemaで検証する。
- Transformation option defaultは`configSchema`のZod `.default()`だけを正本とし、
  Visualizationのような別`defaultOptionsByPreset` mapは追加しない。
- parse時は`configSchema.parse(spec.options)`を実行し、default適用後の値を
  Dashboard JSON budgetで再検証する。

この計画ではfake transformation definitionをtestで注入する。built-in Transformation本体は追加しない。

## 18. B4: DashboardRegistryV2

### 18.1 Registration

```ts
class DashboardRegistryV2 {
	constructor(options: {
		dashboards: DashboardDefinitionV2[];
		visualizations: DashboardVisualizationRegistry;
		transformations: DashboardTransformationRegistry;
	});
}
```

### 18.2 Structural validation

- dashboardManifestV2Schema
- variable manifest
- query metadata
- ID uniqueness
- manifest arraysとdefinition arraysの一致

### 18.3 Variable validation

- manifest variableとdefinitionが1対1。
- query sourceはhandler必須。
- static sourceはhandler禁止。
- required/default/options。
- dependency存在、先行順、cycle。
- query definition.filterKeysのvariable存在。

### 18.4 Query binding validation

- queryId存在。
- binding.outputFrameRefs数とquery.outputShapes数一致。
- outputFrameRefsがPanel全体で一意。
- unused query definitionを拒否する。
- query definitionは複数Panelから参照可能。

### 18.5 Transformation graph validation

Panelごとにavailable Frame mapを構築する。

1. query outputFrameRefsとoutputShapesを登録する。
2. transformationをmanifest順に処理する。
3. disabled transformationはoutputを登録しない。
4. inputFrameRefs存在確認。
5. transformation definition lookup。
6. execution capability確認。
7. type固有options parse。
8. inputShapes compatibility。
9. output shapeを算出しoutputFrameRefIdへ登録。
10. output collisionを拒否する。

Output shape:

- fixed shape: descriptor値
- preserve: first input shape。複数inputでshape不一致ならstartup error。
- dynamic: unknown marker。runtime検証へ送る。

Server transformationはBrowser transformation outputをinputにできない。

Browser transformationはquery、server output、先行browser outputをinputにできる。

### 18.6 Visualization validation

- Visualization definition存在。
- config / preset parse。
- frameRefs存在。
- known shapeはsupportedShapesへ含まれる。
- dynamic shapeはruntime compatibilityへ送る。
- tableFallback設定。
- native v2のdefault desktop layout `w/h`がdescriptor.minimumSize以上。
- panel `maxW/maxH`がある場合、descriptor.minimumSizeを下回らない。
- recommendedSize未満はstartup errorにせずFrontendのcompact表示判断へ渡す。

### 18.7 Public manifest

```ts
getPublicManifest(dashboardId): PublicDashboardManifestV2
```

- static optionsを除去する。
- functionを含めない。
- public schemaで再parseする。
- cached objectを返す場合は外部mutationされないようfreezeまたはclone方針をtestする。

### 18.8 Runtime filter validation

Registryはmanifestからfilter validatorを構築する。

```ts
validatePanelFilters(dashboardId, filters): DashboardFiltersV2
validateVariableDependencyFilters(
	dashboardId,
	variableId,
	filters,
): DashboardFiltersV2
```

共通rules:

- unknown variable keyを拒否する。
- 重複valueを拒否する。
- `selection="single"`は0〜1件、`selection="multiple"`は0〜50件。
- static variableは登録済みかつdisabledでないoption valueだけを許可する。
- query variableはoption membershipを毎回再queryしない。shape/cardinalityだけを検証し、
  handlerがparameter bindingと認可を担当する。
- inputをmutationせず、manifest variable順にcanonical objectを返す。

Panel query:

- required variableは1件以上必須。
- optional variableは省略または空配列を許可する。

Variable options:

- request内の全keyが既知であることは検証する。
- handlerへ渡すのは対象variableの`dependsOn`だけ。
- required dependencyが欠落/空なら`INVALID_REQUEST`。
- 対象variable自身や非dependency valueをhandlerへ渡さない。

Legacy Dashboardへのv2 requestにも、変換済みv2 manifestから同じ検証を適用する。
v1 requestの既存挙動は変更しない。

## 19. B5: Frame normalizer

```ts
normalizeQueryHandlerResultV2(options: {
	binding: PanelQueryBindingV2;
	query: DashboardQueryDefinitionV2;
	result: unknown;
	state?: unknown;
}): NormalizedQueryResultV2
```

処理順:

1. handler result envelope検証
2. output Frame ref重複
3. declared outputFrameRefsとの完全一致
4. declaration順へFrame並べ替え
5. schemaVersion=2付与
6. source=`{kind:"query",refId:binding.refId}`付与
7. dashboardDataFrameV2Schema parse
8. shapeHint必須確認
9. query.outputShapesとの一致
10. validateDashboardDataFrameShape
11. per-frame row/field/cell limit
12. query result total cell limit
13. state parse
14. empty state consistency

v2 normalizerが行わないこと:

- sort
- duplicate timestamp修正
- gap fill
- numeric coercion
- category並べ替え
- missing field追加
- truncate
- aggregation

HandlerはDB-side aggregationまたは明示Transformationで必要な形を作る。

Errors:

```text
INVALID_HANDLER_RESULT
INVALID_DATA_FRAME
FRAME_LIMIT_EXCEEDED
FIELD_LIMIT_EXCEEDED
CELL_LIMIT_EXCEEDED
```

### 19.1 Declared Frame rule

- handlerはoutputFrameRefsを全て返す。
- dataなしでも0 row Frameを返す。
- undeclared Frameを返したら失敗。
- handler Frameのsource/schemaVersion propertyは型上存在せず、runtime objectに混入してもstrict parse前に拒否する。

## 20. B5: Panel state merge

```ts
mergePanelDataStateV2(
	results: NormalizedQueryResultV2[],
	transformationNotices: DashboardNoticeV2[],
	responseFrames: DashboardDataFrameV2[],
): PanelDataStateV2
```

Rules:

- partialはOR。
- truncatedはOR。
- noticesはquery binding順、各handler順、server transformation順。
- notice codeごとの自動dedupeはしない。
- maxNotices超過はINVALID_HANDLER_RESULT。
- responseFramesが全て0 rowならemptyReason必須。
- 1 FrameでもrowがあればemptyReasonを除去する。

Empty reason priority:

```text
not-configured
filter-no-match
no-records
```

複数empty reasonがある場合は上記の先頭を採用する。

Freshness:

1. nonempty query stateを対象にする。
2. 全対象がdataThrough / staleAfterMsを持つ場合だけpanel freshnessを作る。
3. dataThroughは最も古い値。
4. staleAtは各`dataThrough + staleAfterMs`の最も早い値。
5. panel staleAfterMsは`max(1, staleAt - panelDataThrough)`。
6. 一部だけfreshness metadataがある場合は両fieldを省略し、`FRESHNESS_METADATA_INCOMPLETE` info noticeを追加する。

Browser Transformation後のrender empty / staleはFrontendが再評価する。Backend stateはresponseに含まれるquery/server Frameを対象とする。

## 21. B6: Native v2 Query Coordinator

```ts
queryPanelV2(input: {
	requestId: string;
	requestTime: Date;
	auth: DashboardAuthContext;
	dashboardId: string;
	panelId: string;
	request: PanelQueryRequestV2;
	signal: AbortSignal;
}): Promise<PanelQueryResponseV2>
```

### 21.1 実行順

1. Dashboard / Panel lookup
2. request schema parse済み確認
3. runtime filter validation / canonicalization
4. timezone validation
5. range resolve
6. interval要否判定
7. panel timeout signal compose
8. query bindingをmanifest順に準備
9. hiddenを含むquery handlersを並列実行
10. allSettled結果をmanifest順に確認
11. failureがあれば最初のerrorへmap
12. normalized query Framesをbinding/output順に連結
13. Server Transformation実行
14. query Frames + server outputをmanifest順に連結
15. Panel state merge
16. counts計算
17. response cell budget
18. panelQueryResponseV2Schema parse
19. log
20. signal/timer cleanup

### 21.2 Query handler execution

各binding:

1. query definition lookup済み。
2. filterKeysへprojection。
3. global limiter acquire。
4. handler timeout compose。
5. handler context生成。
6. handler実行。
7. caller側は`raceDashboardOperation()`でhandler timeout / panel timeoutを強制。
8. frame normalizer。
9. caller側timer/listenerをdispose。

limiter releaseはrace側ではなくactual handler Promiseへ結び付ける。timeout後にhandlerが
late successしてもFrameをresponseへ採用しない。

同一query definitionが複数bindingから参照されてもhandlerはbindingごとに実行する。

### 21.3 Parallel failure

`Promise.allSettled`を使用する。

- 全handlerのsettleを待つ。
- request/panel timeout signalは全handlerへ伝播する。
- ordinary query failureで兄弟handlerをabortしない。
- failureが複数ならmanifest binding順で最初を返す。
- request cancellation / panel timeoutをordinary failureより優先する。

maxQueriesPerPanel=8、global limiterありのためboundedである。

### 21.4 Interval

- interval=`auto`のqueryが1件以上あれば1度だけchooseIntervalMs。
- 全queryがnoneならintervalMsはundefined。
- bucketOriginMsはresolvedRange.from。
- response intervalMsは計算した場合だけ返す。
- handlerごとに別intervalを自動計算しない。

## 22. B7: Server Transformation Executor

```ts
executeServerTransformations(options: {
	panel: PanelManifestV2;
	initialFrames: DashboardDataFrameV2[];
	registry: DashboardTransformationRegistry;
	requestTime: Date;
	signal: AbortSignal;
	clock: DashboardRuntimeClock;
	budgetMs: number;
	maxServerTransformations: number;
}): Promise<{
	frames: DashboardDataFrameV2[];
	notices: DashboardNoticeV2[];
	truncated: boolean;
}>
```

Rules:

- initialFramesをFrame mapへ登録する。
- disabledはskip。
- browser executionはskipし、outputをFrame mapへ登録しない。
- server executionだけmanifest順に実行する。
- inputFrameRefsをmapから取得する。
- configはregistry parse済みtyped configを使う。
- output refId/source/schemaVersionはexecutorが上書きする。
- definition outputを1 Frameへ限定する。
- output shapeをdescriptor/runtimeで検証する。
- original input Frameをmutationしてはならない。
- output追加後にresponse cell budgetを確認する。
- maxServerTransformationsを超えたらstartup validationまたはruntime error。

### 22.1 Budget

Server Transformationはtrusted code-defined functionであり、同期無限loopをpreemptできない。

Contextへ次を渡す。

```ts
checkBudget(): void
throwIfAborted(): void
```

executorは各Transformationの前後でmonotonic timeを確認する。

- budget超過: `TRANSFORMATION_FAILED`
- request abort: `REQUEST_CANCELLED`
- panel timeout: `PANEL_TIMEOUT`

Transformation authorは大きなrow loop内で`checkBudget()`を定期的に呼ぶ。

`serverTransformationBudgetMs`はPanel内の全server Transformationを合わせた累積budget
とする。async `execute()`は残budgetとpanel signalを使って`raceDashboardOperation()`
する。deadline後のlate resultは捨て、late rejectionを吸収してloggerへ記録する。
Transformationはlimiter slotを持たないため、AbortSignalを無視するasync処理をbuilt-in
definitionへ登録してはならない。

## 23. B8: Variable Options Executor

Routeからvariable logicを分離する。

```ts
getVariableOptionsV2(input: {
	requestId: string;
	requestTime: Date;
	auth: DashboardAuthContext;
	dashboardId: string;
	variableId: string;
	request: VariableOptionsRequestV2;
	signal: AbortSignal;
}): Promise<VariableOptionsResponseV2>
```

処理順:

1. dashboard / variable lookup
2. range resolve
3. dependsOn filter projection
4. staticならoptions取得
5. queryならlimiter acquire
6. handler timeout compose
7. auth/contextを渡してactual handler Promise生成
8. `raceDashboardOperation()`でdeadlineを強制
9. option schema parse
10. duplicate value rejection
11. max option limit
12. label/value安定sort
13. required default existence runtime確認
14. response parse
15. caller側cleanup

Query variable:

- handler errorをsafe errorへmap。
- disabled optionを維持する。
- filter valueをloggerへ出さない。
- limiter releaseはactual handler Promise settleへ結び付ける。

Static variable:

- limiter / handler timeoutを使わない。
- requestが既にabortなら実行しない。
- registryで検証済みoptionsをcopyして返す。

## 24. B9: Compatibility runtime

### 24.1 Registration

DashboardServiceはDashboard IDごとに次を保持する。

```ts
type DashboardRegistration =
	| {
			sourceVersion: 1;
			legacy: DashboardDefinition;
			publicV2: PublicDashboardManifestV2;
	  }
	| {
			sourceVersion: 2;
			native: DashboardDefinitionV2;
	  };
```

全registrationでDashboard IDは一意。v1/v2へ同じIDを別々に登録しない。

### 24.2 v1 executor compatibility refactor

既存`createDashboardQueryExecutor()`とvariable options実行経路はexportとv1 responseを
維持したまま、route/serviceからoperation contextを注入できるようにする。

```ts
type DashboardLegacyOperationContext = {
	requestId: string;
	requestTime: Date;
	auth: DashboardAuthContext;
	signal: AbortSignal;
};
```

既存4引数`query(dashboardId, panelId, request, signal)`を削除しない。内部では次の
明示的methodへ委譲する。

```ts
queryWithContext(
	dashboardId,
	panelId,
	request,
	context: DashboardLegacyOperationContext,
): Promise<PanelQueryResponse>
```

互換ルール:

- 既存`query(..., signal)`はmoduleのrequest ID factoryとclockからcontextを作る。
- Serviceは`queryWithContext()`を呼び、routeで確定したrequestId/requestTime/authを渡す。
- relative range、generatedAt、handler contextへ同じrequestTimeを使う。
- durationは`clock.monotonicMs()`で計測し、`Date.now()`を直接使わない。
- v1 `DashboardHandlerContext`と`DashboardVariableOptionsContext`へ
  `requestId`、`requestTime`、`auth`を追加する。
- 既存handlerは追加fieldを無視できるためsource互換を維持する。
- v1 response shape、normalization、gap fill、error codeは変更しない。
- unknown legacy handler errorの元messageをpublic `QUERY_FAILED` messageへ流さない。

`module.now()`をexecutor内で再度呼び、operationの時刻を分裂させてはならない。

### 24.3 Legacy v2 manifest

```ts
legacyPublicDashboardManifestToV2()
```

を使う。Compatibility helper結果をv2 public schemaで再parseする。

### 24.4 Legacy v2 panel query

v2 requestでlegacy dashboardをqueryする場合:

1. `PanelQueryRequestV2`をv1 requestへ変換する内部helperを使う。
2. v1 executorをauth/requestId付きで実行する。
3. v1 responseを`legacyPanelQueryResponseToV2`で変換する。
4. v2 schemaで再parseする。

01はv1→v2 request helperを提供するが、v2→v1は提供しない。Backend内部で次を実装する。

```ts
compatibilityPanelRequestV2ToV1(request): PanelQueryRequest
```

Rules:

- range/timezone/filters/maxDataPointsを維持。
- maxRowsはv1へ渡せないため無視する。
- v1 hard limitがv2より小さい場合は小さい方を使う。

### 24.5 Legacy variable options

- v2 requestをv1 request shapeへ変換。
- legacy registry/handlerをauth付きで実行。
- v1 responseをv2 helperで変換。

### 24.6 Native v2へのv1 request

Native v2 Dashboardにはv1 representationがない。

- Manifest v1 request: 406 `SCHEMA_VERSION_UNSUPPORTED`
- Variable v1 request: 406
- Panel v1 request: 406

Native v2をv1へlossy変換しない。

## 25. B9: DashboardService

```ts
export type DashboardService = {
	getManifest(input): Promise<PublicDashboardManifest | PublicDashboardManifestV2>;
	getVariableOptions(input): Promise<VariableOptionsResponse | VariableOptionsResponseV2>;
	queryPanel(input): Promise<PanelQueryResponse | PanelQueryResponseV2>;
};
```

共通input:

```text
requestId
requestTime
auth
dashboardId
transportVersion
signal
```

Serviceの責務:

- registration lookup
- v1 / v2 dispatch
- compatibility conversion
- safe runtime error
- version不一致
- auth context propagation

ServiceはHono Context、Request、Responseをimportしない。

## 26. B10: API Route

### 26.1 Route dependency

```ts
type DashboardRouteDeps = {
	dashboard: DashboardModule;
};
```

Routeは`dashboard.service`だけを使う。

### 26.2 Request identity

各handlerの先頭で:

1. requestId生成
2. `X-Request-ID` response header設定
3. auth user取得
4. version/body validation
5. service呼び出し

error時も同じrequestIdを使う。

### 26.3 Auth

`createApiRoutes()`の`requireAuth`を維持する。

route handler内でも:

```ts
const auth = getAuthContextUser(c);
```

を使う。

Route単体testは次のmiddlewareを持つtest appで行う。

```ts
app.use("*", async (c, next) => {
	c.set("authUser", testAuthUser);
	await next();
});
```

auth欠落時にsynthetic userを作らない。

### 26.4 Validator

- paramは共有ID schema。
- bodyはany-version schema。
- zValidator custom hookでshared error envelopeへ変換する。
- malformed JSONも`INVALID_REQUEST`。
- Content-TypeなしPOSTは400。

### 26.5 Error mapping

| Error | HTTP | retryable |
| --- | ---: | --- |
| INVALID_REQUEST | 400 | false |
| SCHEMA_VERSION_UNSUPPORTED body mismatch | 400 | false |
| SCHEMA_VERSION_UNSUPPORTED Accept/native-v1 | 406 | false |
| DASHBOARD/PANEL/VARIABLE_NOT_FOUND | 404 | false |
| REQUEST_CANCELLED、response可能時 | 408 | false |
| frame/field/cell/config/transformation invalid | 422 | false |
| EXECUTION_LIMIT_REACHED | 429 | true |
| QUERY_FAILED | 500 |定義値 |
| HANDLER_TIMEOUT / PANEL_TIMEOUT | 504 | true |

Unknown error:

- client message=`Dashboard request failed`
- code=`QUERY_FAILED`
- status=500
- stack / causeを返さない。
- logger.errorへcauseを渡す。

### 26.6 Routes

```text
GET  /api/dashboards/:dashboardId
POST /api/dashboards/:dashboardId/variables/:variableId/options
POST /api/dashboards/:dashboardId/panels/:panelId/query
```

pathは変更しない。

## 27. B11: App composition

`createDefaultAppDeps()`は引き続き引数なし`createDashboardModule()`を使う。

02完了時点:

- default operationsはlegacy registration。
- v1 Frontend requestはv1 response。
- v2 Accept/requestはcompatibility v2 response。
- Native v2 fixtureはtest injectionだけで使う。

本番defaultへNative v2 Gallery Dashboardを追加するのはVisualization planで行う。

## 28. Native v2 test fixture

`v2/test-fixtures.ts`へ決定的fixtureを作る。

最低構成:

- Dashboard ID=`native-v2`
- static service variable
- query region variable
- Panel 1: 2 query bindings
- Query A: timeseries Frame
- Query B: category Frame
- Browser Transformation 1件
- Server Transformation 1件
- Visualizationはinjected fake definition
- filter projection
- empty/partial/truncated/freshness fixture

Fake Transformation:

- input1件
- rowをmutationせず新Frameを返す
- deterministic
- configSchema strict
- server/browser capability test用definitionを分ける

fixtureをdefault production moduleへ登録しない。

## 29. Security

- auth contextなしexecutor呼び出しを禁止する。
- query handlerへ宣言済みfilter keyだけを渡す。
- variable handlerへdependsOn filterだけを依存inputとして渡す。
- public manifestへhandler / options functionを含めない。
- unknown error messageをclientへ出さない。
- error detailsはJSON budgetを通す。
- Query Inspector用にraw SQLをresponseへ含めない。
- loggerへfilter valuesを出さない。
- arbitrary transformation codeをrequestから受け取らない。
- Transformation type/configはcode-defined registryで検証する。
- Accept header parserは長さ上限を設ける。8KiBを超えるheaderはinvalid request。

## 30. Backend test matrix

### 30.1 Runtime infrastructure

- clock injection
- requestTime 1回
- monotonic duration
- request ID injection
- no-op logger
- safe error mapping
- limiter FIFO/full/timeout/cancel/cleanup
- abort reason priority

### 30.2 Definition / builders

- valid native dashboard
- invalid structural manifest
- builder immutability
- field value validation
- empty frame
- multi-frame result

### 30.3 Visualization / Transformation registry

- duplicate type
- descriptor invalid
- preset invalid
- options merge
- strict config
- server capability / execute mismatch
- browser-only definition

### 30.4 Dashboard registry

- duplicate dashboard/panel/variable/query
- missing variable definition
- query source handler
- dependency cycle
- unknown filter key
- outputFrameRefs count
- output collision
- unknown query
- unused query
- runtime filter unknown/duplicate/cardinality
- required filter missing
- static disabled/unknown value
- variable dependency projection
- Transformation forward reference
- server depends on browser output
- unsupported shape
- dynamic shape deferred
- public manifest sanitization

### 30.5 Frame normalizer

- declared single/multi Frame
- missing/extra output
- source/schema spoof
- field length mismatch
- invalid role/shape
- empty state
- field/frame/cell limits
- no sort/coercion/fill
- input immutability

### 30.6 Query coordinator

- 1 query
- multiple parallel queries
- stable Frame order
- hidden query execution/response inclusion
- filter projection
- auth propagation
- requestTime propagation
- interval none/auto
- handler timeout
- panel timeout
- request cancellation
- deterministic multi-error choice
- limiter release
- response counts

### 30.7 Transformation executor

- server order
- browser skip
- disabled skip
- input lookup
- config parse
- output source/ref override
- output shape
- mutation detection fixture
- budget
- abort
- max count
- cell budget

### 30.8 Variable options

- static/query
- auth propagation
- dependsOn projection
- disabled option
- duplicate
- sort
- option limit
- required default
- timeout/cancel/queue

### 30.9 Compatibility

- v1 manifest→v2
- v1 panel response→v2
- v1 variable options→v2
- v2 request→legacy executor
- Native v2 + v1 request=406
- operations v1 unchanged

### 30.10 Route

- auth 401 app integration
- route test auth context
- manifest Accept negotiation
- Accept q=0/malformed/unknown vendor/oversized/multiple ranges
- Vary header
- v1/v2 panel body
- version mismatch
- malformed JSON
- Content-Type
- not found
- 422
- 429 + Retry-After
- 504
- request ID same in header/body
- production error sanitization

## 31. Focused coverage

`vitest.dashboard.config.ts`を追加する。

root alias/test environmentを失わないよう、`mergeConfig()`で既存
`vitest.config.ts`をbaseとして読み込み、focused coverage設定だけを上書きする。
test includeはDashboard Backend testとdashboard route testへ限定する。

Include:

```text
api/modules/dashboard/**/*.ts
api/routes/dashboard.route.ts
api/routes/dashboard-version.ts
```

Exclude:

```text
api/modules/dashboard/v2/test-fixtures.ts
```

Threshold:

```text
statements >= 80
lines >= 80
functions >= 80
branches >= 70
```

`package.json`:

```text
verify:dashboard-coverage =
  vitest run --config vitest.dashboard.config.ts --coverage
```

既存のinline `--coverage.include` scriptを上記へ置き換える。script名は変更しない。
coverageを上げるためにproduction codeを除外しない。

## 32. Work Package別command

### B0

```bash
bunx vitest run \
  api/modules/dashboard/dashboard-registry.test.ts \
  api/modules/dashboard/normalize-result.test.ts \
  api/modules/dashboard/query-executor.test.ts \
  api/modules/dashboard/execution-limiter.test.ts \
  api/routes/dashboard.route.test.ts
bunx tsc --noEmit
```

### B1

```bash
bunx vitest run \
  api/modules/dashboard/runtime-errors.test.ts \
  api/modules/dashboard/runtime-clock.test.ts \
  api/modules/dashboard/runtime-logger.test.ts \
  api/modules/dashboard/execution-limiter.test.ts \
  api/modules/dashboard/abort-signals.test.ts \
  api/modules/dashboard/query-executor.test.ts \
  api/modules/auth/context.test.ts \
  api/routes/dashboard.route.test.ts
bunx tsc --noEmit
```

### B2

```bash
bunx vitest run \
  api/modules/dashboard/v2/define-dashboard.test.ts \
  api/modules/dashboard/v2/frame-builders.test.ts
bunx tsc --noEmit
```

### B3

```bash
bunx vitest run \
  api/modules/dashboard/v2/visualization-registry.test.ts \
  api/modules/dashboard/v2/transformation-registry.test.ts
bunx tsc --noEmit
```

### B4

```bash
bunx vitest run api/modules/dashboard/v2/dashboard-registry.test.ts
bunx tsc --noEmit
```

### B5

```bash
bunx vitest run \
  api/modules/dashboard/v2/frame-normalizer.test.ts \
  api/modules/dashboard/v2/panel-state.test.ts
bunx tsc --noEmit
```

### B6

```bash
bunx vitest run api/modules/dashboard/v2/query-coordinator.test.ts
bunx tsc --noEmit
```

### B7

```bash
bunx vitest run api/modules/dashboard/v2/transformation-executor.test.ts
bunx tsc --noEmit
```

### B8

```bash
bunx vitest run api/modules/dashboard/v2/variable-options-executor.test.ts
bunx tsc --noEmit
```

### B9

```bash
bunx vitest run \
  api/modules/dashboard/v2/compatibility-runtime.test.ts \
  api/modules/dashboard/dashboard-service.test.ts
bunx tsc --noEmit
```

### B10

```bash
bunx vitest run \
  api/routes/dashboard-version.test.ts \
  api/routes/dashboard.route.test.ts \
  api/app/hono.test.ts
bunx tsc --noEmit
```

### B11

```bash
bun run verify:dashboard-coverage
bun run verify
```

### B12

```bash
bun run verify
bun run verify:dashboard-coverage
bun run verify:e2e
bun run verify:dashboard-bundle
git diff --check
```

## 33. 進捗記録

各WP開始時:

```text
Backend plan: 02
Work package: Bx
Status: in_progress
Started at:
Baseline:
Planned files:
```

各WP完了時:

```text
Files changed:
Commands:
Verification:
Coverage:
Known issues:
Next command:
Completed at:
```

## 34. Stop条件

次の場合だけ停止する。

- 01のschema / helperが計画通りexportされていない。
- v1 default responseを維持したままv2 negotiationを追加できない。
- Native v2 handlerにDB driver dependencyをcoreへ入れないと実装できない。
- Hono runtimeでrequest AbortSignalが取得できないvariantがある。
- Server Transformationを安全にcode-defined registryへ限定できない。
- user所有変更と同じBackend行を大規模に書き換える必要がある。
- security contractを弱める必要がある。

停止しない例:

- test数が多い。
- coverage thresholdに届かない。
- TypeScript genericが複雑。
- limiter testがflaky。
- query coordinatorの実装量が多い。
- v1 testの更新が必要。

## 35. 完了条件

- [ ] 01 C0〜C9がcomplete。
- [ ] B0〜B12がcomplete。
- [ ] v1 operations Dashboardが従来通り動く。
- [ ] v2 Accept manifestが返る。
- [ ] v1/v2 POST version dispatchが動く。
- [ ] Native v2 injected Dashboardがqueryできる。
- [ ] auth contextがquery/variable handlerへ届く。
- [ ] multiple query / multi-frameが動く。
- [ ] outputFrameRefsが実行時検証される。
- [ ] Server Transformation generic executorが動く。
- [ ] Browser TransformationがBackendで実行されない。
- [ ] Frame normalizerがsilent coercion/truncationしない。
- [ ] Panel state mergeが決定的。
- [ ] limiter queue full/timeout/cancelが区別される。
- [ ] handler timeout/panel timeout/request cancelが区別される。
- [ ] request IDがresponse/error/logで一致する。
- [ ] unknown errorがsanitizeされる。
- [ ] static optionsがpublic manifestへ含まれない。
- [ ] focused coverage thresholdsを満たす。
- [ ] `bun run verify`成功。
- [ ] `bun run verify:dashboard-coverage`成功。
- [ ] `bun run verify:e2e`成功。
- [ ] `bun run verify:dashboard-bundle`成功。
- [ ] `git diff --check`成功。
- [ ] 進捗台帳更新。

## 36. 次計画へ渡す成果

03 Frontend計画は次を前提にしてよい。

```text
GET manifest:
  Accept v2 media type → PublicDashboardManifestV2

POST variable/panel:
  schemaVersion 2 body → v2 response

Backend:
  v1 default remains available
  native/compatibility v2 response available
  Data Frame normalized
  Server Transformation applied
  Browser Transformation raw inputs preserved
```

03完了まではmanifest defaultをv1から変更しない。

## 37. 再開手順

1. [00-concept.md](./00-concept.md)を読む。
2. [01-contracts.md](./01-contracts.md)の完了状態を確認する。
3. [progress.md](./progress.md)のBackend v2節を読む。
4. `git status --short`を確認する。
5. 最後の成功commandを再実行する。
6. `in_progress`のB packageを続ける。
7. `in_progress`がなければ最初のpending B packageを開始する。
8. B12完了まで03 Frontend実装へ進まない。
