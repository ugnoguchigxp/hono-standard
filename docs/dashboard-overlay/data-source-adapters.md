# Dashboard Data Source Adapters 実装計画

## 1. 文書の位置づけ

この文書は、既存の Dashboard Visualization Platform v2 へ、アプリケーションがすでに持つ
データを短い TypeScript 定義で接続するための server-side adapter 計画である。

対象は次の3段階とする。

| 採用優先度 | 対象 | 実装段階 |
| --- | --- | --- |
| P0 | `Record[]` → Data Frame adapter | 直ちに実装する |
| P0 | SQL / Drizzle query helper | Record adapterの直後に実装する |
| P1 | HTTP / JSON・pipeline adapter | P0完了後に実装する |

この表のP0/P1は本計画内の採用優先度であり、
[00-concept.md](./00-concept.md)のVisualization roadmap P0〜P11とは別の記号である。
実装Work Packageは混同を避けるため`AD0`〜`AD10`を使う。

この計画は、共有Data Frame契約を変更する計画ではない。既存の
[01: shared contracts](./01-contracts.md)、[02: Backend runtime](./02-backend.md)、
[03: Frontend runtime](./03-frontend.md)を利用し、query handlerの手前に薄い変換層を追加する。

```text
Record[] ───────────────┐
Drizzle select result ──┼─> Record adapter ─> DashboardQueryFrameInputV2
HTTP JSON / pipeline ───┘                         ↓
                                      existing queryResult / normalizer
                                                 ↓
                                      existing Panel / Visualization
```

## 2. 目的

Dashboard採用者がData Frame内部構造を学ばなくても、既存データから最初のPanelを作れるようにする。

P0完了時の目標は次のとおり。

1. 型付きの`Record[]`と明示的なcolumn定義から、1つのData Frameを生成できる。
2. Drizzleのread-only databaseと`select` callbackを渡すだけで、v2 queryを定義できる。
3. 空結果でもfield metadataを維持し、Tableまたは指定Visualizationでempty stateを表示できる。
4. range、filters、auth、AbortSignal、timeout、concurrency、row/cell limitsは既存runtimeを再利用する。
5. 既存の低レベル`defineDashboardQueryV2`、`dataFrame`、field builderを削除・変更しない。
6. SQLite固有コードを共通adapterへ入れず、PostgreSQL / Turso variantでも同じpublic APIを維持する。

P1完了時の目標は次のとおり。

1. 固定されたserver-side endpointからJSONを取得し、Zod検証後に同じRecord adapterへ渡せる。
2. CI/CDやbatch pipelineのrun一覧を、専用runtimeを追加せずHTTP/JSON recipeとして表示できる。
3. user inputで接続先originを変更できず、secret、response body、URL credentialを公開しない。
4. webhook、保存、background ingestionを導入せず、pull型の1 requestを完成させる。

## 3. 成功指標

P0の採用容易性は次で判定する。

- 既存Drizzle selectから最初のTable表示まで、利用者側コード30行以内を標準例にする。
- 利用者は`DashboardDataFrameV2`、`DashboardFieldV2`、`queryResult()`を直接組み立てなくてよい。
- DB schema / migration / seedを追加せずにread-only queryを接続できる。
- 0 rows、null、Date、boolean、string、finite numberを決定的に処理できる。
- 無指定時は`table` shapeとし、Visualizationの自動推測は行わない。
- 既存v1/v2 transport、Frontend bundle、Panel runtimeへ変更を加えない。

P1の採用容易性は次で判定する。

- Zod response schema、固定base URL、row selector、column定義だけでJSON APIを接続できる。
- pipeline例はvendor固有SDKやruntime dependencyを追加しない。
- HTTP失敗、JSON不正、schema不一致、response size超過、abortを個別にtestできる。

## 4. 対象外

### 4.1 P0対象外

- ブラウザ上のSQL editor
- SQL文字列、table名、column名をURLやmanifestから受け取る機能
- SQL生成DSL、query planner、dialect abstraction
- `SELECT`へのlimit / range / filterの自動注入
- write query、migration、Dashboard用table
- runtimeでのcolumn名・semantic roleの自動推測
- multi-frame query helper
- Visualization picker、Panel自動生成、WYSIWYG editor
- server-side cache

### 4.2 P1対象外

- webhook / push ingestion
- pipeline resultのDB保存、retention、replay
- background polling worker、scheduler
- OAuth flow、credential管理UI
- user指定URLへのproxy
- redirect追跡
- 自動pagination
- GraphQL専用client
- Prometheus / OTLP / OpenTelemetry receiver
- retry queue、circuit breaker

これらは採用実績と具体的な需要を確認してから独立計画にする。

## 5. 固定設計判断

1. AdapterはBackend v2専用とし、`api/modules/dashboard/v2/adapters/`に置く。
2. Shared transport schemaとFrontendにはadapter種別を追加しない。
3. Adapterは常に既存の`DashboardQueryFrameInputV2`を出力する。
4. Record adapterはpure functionとし、DB、fetch、clock、loggerをimportしない。
5. column順は明示された`columns`配列順とし、record property列挙順へ依存しない。
6. columnは明示登録制とし、recordの未登録propertyをData Frameへ含めない。
7. 1 columnは`source`または`accessor`のどちらか一方だけを持つ。
8. 物理型は`time | number | string | boolean`を必須指定する。
9. semantic roleは明示指定する。自動付与は行わない。
10. `outputShape`のdefaultは`table`とし、roleからshapeを推測しない。
11. `undefined`、missing property、非finite number、invalid time、unsupported objectを拒否する。
12. `null`は全field typeで許可する。
13. `time`はepoch millisecondsのsafe integerまたはvalid `Date`だけを受ける。
14. ISO string、decimal string、`bigint`の変換は`accessor`またはload callbackで明示する。
15. `Date`はepoch millisecondsへ変換し、input recordをmutationしない。
16. empty rowsでもcolumn定義から0-length fieldsを生成する。
17. default overflow policyは`error`とする。暗黙truncateは禁止する。
18. `truncate`を明示した場合だけ先頭`maxRows`へ切り、`DATA_TRUNCATED` noticeを必ず付ける。
19. Record query helperは1 query / 1 frameだけを扱う。multi-frameは既存低レベルAPIを使う。
20. frame `refId`はmanifestへ固定せず、実行contextの`outputFrameRefs[0]`を使う。
21. Drizzle helperはquery builderを解析・変更せず、read databaseとtyped callbackをRecord helperへ結ぶだけにする。
22. Drizzle helperはruntimeで`drizzle-orm`のdialect固有moduleをimportしない。
23. Drizzle helper自体は接続のread-only性をruntime判定しない。app DB runtimeの`client.read`型とcompositionを正本にする。
24. SQL、parameters、DB URL、HTTP headers、response bodyをFrame metadata、notice、Inspectorへ入れない。
25. HTTP adapterは`http:` / `https:`の固定base URLだけを登録時に受け付ける。
26. HTTP requestのpathは相対pathに限定し、解決後originがbase URLと一致することを再検証する。
27. HTTP redirectは`error`とし、response schemaのZod検証を必須とする。
28. P0で新runtime dependencyを追加しない。P1もplatform `fetch`と既存Zodだけを使う。

## 6. Public API案

### 6.1 Record column contract

```ts
export type DashboardRecord = Readonly<Record<string, unknown>>;

type SourceRecordColumn<TRow extends object> = {
  source: Extract<keyof TRow, string>;
  accessor?: never;
  key?: string;
};

type AccessorRecordColumn<TRow extends object> = {
  source?: never;
  accessor: (row: TRow, index: number) => unknown;
  key: string;
};

export type DashboardRecordColumn<TRow extends object> =
  (SourceRecordColumn<TRow> | AccessorRecordColumn<TRow>) & {
  label?: string;
  type: DashboardFieldType;
  roles?: readonly DashboardFieldRole[];
  labels?: Readonly<Record<string, string>>;
  config?: StandardFieldConfigPatchV2;
  };
```

Rules:

- `TRow`はobject型として受け、runtimeではnull、array、class instanceではないplain recordであることを確認する。
- `source`使用時の`key` defaultは`String(source)`。
- `accessor`使用時は`key`を必須とする。
- `label` defaultは`key`。
- `roles` / `labels` defaultは空。
- `config`は既存shared schemaでparseし、cloneして保持する。
- duplicate sourceは許可するが、出力`key`重複は拒否する。
- accessor exceptionはcauseとして保持し、公開responseへ値やstackを出さない。

### 6.2 Pure Record adapter

```ts
export function recordsToDataFrameV2<TRow extends object>(input: {
  records: readonly TRow[];
  refId: string;
  name: string;
  outputShape?: DashboardDataShape;
  columns: readonly DashboardRecordColumn<TRow>[];
  maxRows?: number;
  overflow?: "error" | "truncate";
}): {
  frame: DashboardQueryFrameInputV2;
  state?: PanelDataStateV2;
};
```

`recordsToDataFrameV2`は次の順で処理する。

1. refId、name、shape、column数、key、role、configを既存schemaで検証する。
2. `maxRows`とshared upper boundの小さい方をeffective limitにする。
3. overflowを判定する。
4. 各columnを配列順、各recordを入力順に読み取る。
5. 値を指定物理型へ厳格変換する。
6. 既存`dataFrame()`または同じschema pathを通してFrameを構築する。
7. `validateDashboardDataFrameShape`でshape / role compatibilityを検証する。
8. explicit truncate時だけstate noticeを返す。

### 6.3 値変換表

| 指定type | 入力 | 出力 | その他 |
| --- | --- | --- | --- |
| `time` | valid `Date` | epoch ms | invalid Date拒否 |
| `time` | safe integer number | 同じnumber | 秒との自動判定なし |
| `number` | finite number | 同じnumber | `NaN` / ±Infinity拒否 |
| `string` | string | 同じstring | stringifyしない |
| `boolean` | boolean | 同じboolean | truthy変換しない |
| 全type | `null` | `null` | 許可 |
| 全type | `undefined` / missing | - | 拒否 |
| 全type | bigint / object / array | - | 拒否、accessorで明示変換 |

### 6.4 Record query helper

```ts
export function defineRecordQueryV2<TRow extends object>(input: {
  id: string;
  filterKeys: readonly string[];
  outputShape?: DashboardDataShape;
  frameName: string;
  columns: readonly DashboardRecordColumn<TRow>[];
  overflow?: "error" | "truncate";
  load: (
    context: DashboardQueryHandlerContextV2,
  ) => readonly TRow[] | Promise<readonly TRow[]>;
}): DashboardQueryDefinitionV2;
```

Behavior:

- `defineDashboardQueryV2()`を内部で利用する。
- `outputShapes`は`[input.outputShape ?? "table"]`とする。
- `context.outputFrameRefs.length !== 1`はregistrationまたはexecutionで拒否する。
- `load`へ既存contextをそのまま渡し、range/filter/auth/signalを欠落させない。
- `context.signal.aborted`をload前後で確認する。
- `recordsToDataFrameV2`へ`context.maxRows`を渡す。
- empty resultは`emptyReason: "no-records"`として返す。
- adapter validation失敗は`INVALID_HANDLER_RESULT` / 422 / non-retryableへmapする。
- loadが投げた外部I/O errorは既存`QUERY_FAILED` mappingに任せる。

### 6.5 SQL / Drizzle helper

```ts
export function defineDrizzleRecordQueryV2<
  TReadDatabase,
  TRow extends object,
>(input: {
  id: string;
  filterKeys: readonly string[];
  database: TReadDatabase;
  outputShape?: DashboardDataShape;
  frameName: string;
  columns: readonly DashboardRecordColumn<TRow>[];
  overflow?: "error" | "truncate";
  select: (
    database: TReadDatabase,
    context: DashboardQueryHandlerContextV2,
  ) => readonly TRow[] | Promise<readonly TRow[]>;
}): DashboardQueryDefinitionV2;
```

このhelperは`database`と`select`をclosureへ束縛し、`defineRecordQueryV2`を呼ぶだけとする。
SQLを生成せず、Drizzle query objectも受け取らない。
`TReadDatabase`は渡されたread clientの型を保持するが、任意のwritable instanceをruntimeでread-onlyへ変換するものではない。

利用例:

```ts
const ordersQuery = defineDrizzleRecordQueryV2({
  id: "daily-orders",
  filterKeys: ["status"],
  database: dbRuntime.client.read,
  outputShape: "timeseries",
  frameName: "Daily orders",
  columns: [
    { source: "bucket", type: "time", roles: ["time"] },
    { source: "status", type: "string", roles: ["series"] },
    { source: "orders", type: "number", roles: ["value"] },
  ],
  select: (db, context) =>
    db
      .select({
        bucket: orders.createdAt,
        status: orders.status,
        orders: count(),
      })
      .from(orders)
      .where(/* context.resolvedRange / context.filters */)
      .groupBy(orders.createdAt, orders.status)
      .limit(context.maxRows + 1),
});
```

Guidance:

- app compositionで必ず`dbRuntime.client.read`を渡す。
- raw driverやDrizzle以外のSQL clientは、query結果を`defineRecordQueryV2`へ返して同じ変換境界を利用する。
- partial selectのaliasをData Frame keyとして利用する。
- range / filtersのSQL化はapplication queryの責務とする。
- limitを自動注入できないため、標準例では`maxRows + 1`を取得しoverflowを検出する。
- Drizzleの型引数はruntime castではないため、adapterは全cellをruntimeで再検証する。
- raw SQLを使う場合もcode-defined handler内だけに置き、manifest/Inspectorへ出さない。

Drizzleのpartial selectと型推論は
[Drizzle Select](https://orm.drizzle.team/docs/select)を参照する。

## 7. P1 HTTP / JSON・pipeline adapter

### 7.1 Public API案

```ts
export function defineHttpJsonRecordQueryV2<
  TResponse,
  TRow extends object,
>(input: {
  id: string;
  filterKeys: readonly string[];
  baseUrl: string | URL;
  outputShape?: DashboardDataShape;
  frameName: string;
  columns: readonly DashboardRecordColumn<TRow>[];
  responseSchema: z.ZodType<TResponse>;
  request: (context: DashboardQueryHandlerContextV2) => {
    path: string;
    method?: "GET" | "POST";
    search?: Readonly<Record<string, string | readonly string[] | undefined>>;
    headers?: Readonly<Record<string, string>>;
    body?: DashboardJsonValue;
  };
  selectRecords: (
    response: TResponse,
    context: DashboardQueryHandlerContextV2,
  ) => readonly TRow[];
  maxResponseBytes?: number;
  fetch?: DashboardFetch;
}): DashboardQueryDefinitionV2;
```

`fetch`はtest injection専用で、通常はglobal `fetch`を使う。

### 7.2 Request security

- `baseUrl`はregistration時にparseする。
- protocolは`http:` / `https:`だけを許可する。
- username、password、search、hashを含むbase URLを拒否し、pathnameは`/`だけを許可する。
- `request.path`は`/`始まりのrelative pathだけを許可し、`//`始まりを拒否する。
- URL解決後にprotocol / originをbase URLと再比較する。
- `search` keyはlexicographic順、配列値は入力順で追加し、raw query string連結を提供しない。
- methodはGET / POSTだけとする。
- GET bodyは禁止する。
- POST bodyはJSON value budgetを検証してからserializeする。
- `Host`、`Cookie`、`Content-Length`、hop-by-hop headerを拒否し、`Accept`と`Content-Type`はadapterが設定する。
- `redirect: "error"`、`signal: context.signal`を固定する。
- headers、body、full URL、response bodyをlogger / notice / error detailsへ含めない。
- `Content-Type`はresponse headerを正規化し、JSON media type以外を拒否する。
- streaming readでbyte limitを超えた時点でcancelする。
- default byte limitは2 MiB、hard maxは8 MiBとし、定数とtestを置く。

### 7.3 Response and retry semantics

- 2xxだけを成功とする。
- 408 / 429 / 5xxはretryable query failureへmapする。
- その他4xx、content type不正、JSON parse、Zod parse、row mapping不正はnon-retryableとする。
- response schema検証前に`selectRecords`を呼ばない。
- JSON objectをFrame metadataへ保存しない。
- adapter自身はbackground retryしない。Frontendの既存Retry操作を利用する。

### 7.4 Pipelineはrecipeとして扱う

P1では独立したpipeline runtimeを作らない。HTTP JSON adapterのsampleとして、次のflat rowを返す
Zod schemaとDashboard定義例を追加する。

```ts
type PipelineRunRow = {
  id: string;
  pipeline: string;
  branch: string | null;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled";
  startedAt: Date;
  finishedAt: Date | null;
  durationMs: number | null;
  url: string | null;
};
```

これはwire標準にはしない。sample内で外部responseをこのrowへmapし、次を示す。

- status history
- duration timeseries / bar
- success ratio stat
- same-origin detail linkへ変換する場合のallowlist

外部URLをfield linkとしてそのまま公開しない。必要ならapplication側のsame-origin detail routeを経由する。

## 8. Error、state、privacy contract

### 8.1 Developer error

次は`INVALID_HANDLER_RESULT`、422、non-retryableとする。

- column key / role / config不正
- missing / undefined cell
- field type不一致
- invalid Date / non-finite number
- duplicate output key
- shape / role不一致
- Record adapter上限違反
- HTTP JSON / Zod / row mapping不正

### 8.2 Operational error

次は既存runtimeの安全messageへmapし、causeだけserver-sideに保持する。

- DB query failure
- network failure
- timeout / abort
- remote 408 / 429 / 5xx

SQL、query parameters、header、token、response body、record value、stackをpublic error detailsへ入れない。

### 8.3 State

- 0 records: `emptyReason = "no-records"`
- explicit truncate: `truncated = true` + `DATA_TRUNCATED`
- adapterは`partial`を推測しない。
- HTTP freshnessはremote responseから自動推測しない。
- dataThrough / staleAfterMsが必要なsourceは低レベルhandlerまたは将来optionで明示する。

## 9. 予定ファイル

### 9.1 P0追加

```text
api/modules/dashboard/v2/adapters/record-adapter.ts
api/modules/dashboard/v2/adapters/record-adapter.test.ts
api/modules/dashboard/v2/adapters/record-query.ts
api/modules/dashboard/v2/adapters/record-query.test.ts
api/modules/dashboard/v2/adapters/drizzle-query.ts
api/modules/dashboard/v2/adapters/drizzle-query.test.ts
api/modules/dashboard/v2/adapters/index.ts
scripts/verify-dashboard-adapter-sqlite.ts
docs/dashboard-overlay/data-source-adapters-quickstart.md
```

### 9.2 P0変更候補

```text
api/modules/dashboard/index.ts
api/db/index.ts
vitest.dashboard.config.ts
README.md
LLM_CONTEXT.md
docs/dashboard-overlay/progress.md
docs/dashboard-overlay/release-evidence.md
```

`api/db/index.ts`は必要な場合だけread database utility typeをpublic exportする。Dashboard adapterから
SQLite driverやapplication schemaをimportしない。

### 9.3 P1追加

```text
api/modules/dashboard/v2/adapters/http-json-query.ts
api/modules/dashboard/v2/adapters/http-json-query.test.ts
api/modules/dashboard/v2/adapters/pipeline-example.test.ts
```

P1でもshared schema / frontend fileは変更しない。

## 10. Work Packages

| WP | 優先度 | 内容 | 完了gate |
| --- | --- | --- | --- |
| AD0 | P0 | baseline、既存builder characterization、API型spike | focused tests、typecheck |
| AD1 | P0 | Record column contract、value conversion、error policy | pure unit tests |
| AD2 | P0 | `recordsToDataFrameV2`、empty/limit/shape integration | schema + shape tests |
| AD3 | P0 | `defineRecordQueryV2`、context/refId/state/error integration | query coordinator tests |
| AD4 | P0 | `defineDrizzleRecordQueryV2`、read-only composition | helper + abort/limit tests |
| AD5 | P0 | SQLite integration fixture、Quickstart、public export | integration test、doc link gate |
| AD6 | P0 | P0 coverage、full verification、handoff | verify + Dashboard release gate |
| AD7 | P1 | HTTP URL/request/response byte security primitives | focused security tests |
| AD8 | P1 | `defineHttpJsonRecordQueryV2`、Zod、error/retry mapping | mocked fetch integration tests |
| AD9 | P1 | pipeline recipe、state/duration examples | adapter + Gallery-independent tests |
| AD10 | P1 | P1 docs、coverage、full verification | verify + Dashboard release gate |

P0はAD0〜AD6、P1はAD7〜AD10である。P0 gate成功前にAD7を開始しない。

## 11. AD0〜AD6 P0実装手順

### AD0: Baseline and API spike

1. branch、working tree、progressを記録する。
2. 既存`frame-builders`、`frame-normalizer`、`query-coordinator`のfocused testを実行する。
3. public API案をcompile-only fixtureで確認する。
4. Drizzle SQLite / PostgreSQL / Turso型をadapterへ直接importしないことを確認する。

Commands:

```bash
bunx vitest run \
  api/modules/dashboard/v2/frame-builders.test.ts \
  api/modules/dashboard/v2/frame-normalizer.test.ts \
  api/modules/dashboard/v2/query-coordinator.test.ts
bun run typecheck
git diff --check
```

### AD1: Record contract

実装:

- exclusive source/accessor type
- output key/default label resolution
- strict cell conversion
- duplicate/undefined/missing/invalid value errors
- input immutability

Tests:

- Date / epoch time
- number/string/boolean/null
- invalid Date、NaN、Infinity、bigint、object、array
- accessor conversion and exception
- stable column/row order
- extra source property非公開

### AD2: Data Frame integration

実装:

- existing field/Data Frame schema parse
- explicit outputShape
- empty Frame metadata
- maxRows / maxFields / cell budget
- explicit truncate notice
- shape/role validator

Tests:

- table/timeseries/category/stat相当の代表shape
- empty timeseries with required role fields
- shape mismatch
- error vs truncate
- config/labels clone and budget

### AD3: Record query

実装:

- `defineDashboardQueryV2` wrapper
- context forwarding
- runtime output ref resolution
- queryResult/state generation
- abort before/after load
- adapter validation error mapping

Tests:

- range/filter/auth/signal identity
- same queryを異なるbinding refIdで実行
- 1 outputFrameRef enforcement
- empty/truncated/error response
- existing query coordinator limits

### AD4: Drizzle helper

実装:

- generic database binding
- typed select callback
- Record query delegation
- no dialect runtime import

Tests:

- database identity
- select callback context
- `maxRows + 1` overflow detection
- DB exception / abort propagation
- returned Date/null/aggregate number validation

### AD5: SQLite integration and Quickstart

- test-only SQLite fixtureをwriter側で準備し、read connectionからaggregate selectする。
- production schema / migration / seedは変更しない。
- Quickstartはconceptual `orders` tableを使用し、認証userのPIIを例に使わない。
- low-level APIへのescape hatchを示す。
- SQLite/PostgreSQL/Tursoで同じhelper APIを使い、select callbackだけがvariant固有であることを文書化する。

### AD6: P0 gate

```bash
bunx vitest run api/modules/dashboard/v2/adapters
bun run typecheck
bun run verify:dashboard-coverage
bun run verify:dashboard-doc-links
bun run verify
E2E_PORT=<free-port> bun run verify:dashboard-release
git diff --check
```

Frontend fileを変更していなくても、Dashboard release gateでbundle / E2E / visual / a11yの回帰を確認する。

## 12. AD7〜AD10 P1実装手順

### AD7: HTTP security primitives

- base URL registration validation
- relative path / same-origin resolution
- search serialization
- GET / POST body rules
- redirect rejection
- response content type / byte-limited read
- header/body/error sanitization

### AD8: HTTP JSON query

- platform fetch / injected fetch
- AbortSignal forwarding
- HTTP status mapping
- JSON parse / Zod parse
- `selectRecords` / Record query delegation
- response object immutability

### AD9: Pipeline recipe

- deterministic pipeline response fixture
- Zod transformation from ISO datetime toDate
- status/duration Records
- state history / duration / statに必要なcolumn定義例
- secret、external link、raw response非公開test

### AD10: P1 gate

```bash
bunx vitest run api/modules/dashboard/v2/adapters
bun run typecheck
bun run verify:dashboard-coverage
bun run verify:dashboard-security
bun run verify:dashboard-doc-links
bun run verify
E2E_PORT=<free-port> bun run verify:dashboard-release
git diff --check
```

## 13. Compatibility and migration

- v1/v2 wire format変更なし。
- Dashboard manifest schema変更なし。
- Data Frame schemaVersion変更なし。
- DB migration 0。
- 新runtime dependency 0。
- existing query handlerは変更なし。
- existing Dashboard definitionはadapterへ移行しなくてよい。
- adapterはadditive public exportとする。
- 将来APIを変更する場合もv2 suffixを維持し、既存低レベルAPIを先にdeprecated化しない。

## 14. Stop条件

次の場合は該当WPを完了せず設計判断を行う。

- Record adapterのためにshared wire schema変更が必要になる。
- Drizzle dialect固有runtime importが共通adapterに必要になる。
- read-only compositionを維持できずwrite databaseが必要になる。
- DB schema / migration / production seedが必須になる。
- user inputからSQL、table、column、HTTP originを受ける必要が生じる。
- secret、SQL、response bodyをInspectorやerrorへ出さないと診断できない。
- P1で新runtime dependencyが必要になる。
- existing Dashboard limitsを弱める必要がある。

停止しない:

- TypeScript genericの調整。
- focused coverage不足。
- test fixtureの追加。
- Drizzle driverごとの返却値差をaccessorで明示変換する対応。
- full gateでadapterと無関係な既存flaky testを切り分ける作業。

## 15. 完了条件

### 15.1 P0

- [ ] AD0〜AD6 complete。
- [ ] Record columnsは明示順、明示field、strict physical typeで変換される。
- [ ] empty resultでもvalid Frameを作れる。
- [ ] missing / undefined / invalid / excess dataがsilent repairされない。
- [ ] explicit truncateだけがnotice付きで動く。
- [ ] query context、auth、AbortSignal、limitsが維持される。
- [ ] Drizzle read databaseとtyped select callbackを接続できる。
- [ ] dialect固有runtime import 0、DB migration 0、dependency 0。
- [ ] SQLite integration testと30行以内のQuickstartがある。
- [ ] adapter focused tests、coverage、full release gateが成功する。

### 15.2 P1

- [ ] AD7〜AD10 complete。
- [ ] 固定base URL / same-origin path / no redirectが強制される。
- [ ] JSON responseがbyte limitとZod schemaを通る。
- [ ] pipeline responseが同じRecord adapterを通る。
- [ ] abort、HTTP status、invalid JSON、schema error、size超過がtestされる。
- [ ] secret / headers / body / external URLがpublic outputへ出ない。
- [ ] webhook / storage / scheduler / OAuthを追加していない。
- [ ] P1 full release gateが成功する。

## 16. 次計画へのhandoff

P0/P1完了後、次の候補を別計画で評価する。

1. Prometheus read-only query adapter
2. adapterからPanel定義を生成するQuickstart / CLI
3. Visualization recommendationとpicker
4. pipeline webhook ingestion
5. server-side cache

Prometheus相当のscrape / TSDB / PromQL / alertingはこのhandoffに含めない。
