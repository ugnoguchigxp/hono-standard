# Dashboard Data Source Adapters Quickstart

既存の配列、Drizzle query、固定HTTP JSON APIを、Dashboard v2のquery定義へ接続するserver-side APIである。
shared transport、DB schema、migration、frontendの変更は不要で、すべての列を明示的に登録する。

P0だけを導入する場合は「Drizzleから最初のPanelへ」と「Record配列」だけを使用する。
HTTP JSONとpipelineはP1であり、P0の導入条件ではない。

## Drizzleから最初のPanelへ

次のquery定義は30行以内である。`dbRuntime.client.read`を渡し、range/filterのSQL化は`select`内で行う。

```ts
import { count } from "drizzle-orm";
import { defineDrizzleRecordQueryV2 } from "@api/modules/dashboard";
import { orders } from "./orders.schema";

const ordersOverTime = defineDrizzleRecordQueryV2({
  id: "orders-over-time",
  filterKeys: [],
  database: dbRuntime.client.read,
  outputShape: "timeseries",
  frameName: "Orders over time",
  overflow: "truncate",
  columns: [
    { source: "bucket", type: "time", roles: ["time"] },
    { source: "status", type: "string", roles: ["series"] },
    { source: "orders", type: "number", roles: ["value"] },
  ],
  select: (db, context) => db
    .select({ bucket: orders.createdAt, status: orders.status, orders: count() })
    .from(orders)
    .groupBy(orders.createdAt, orders.status)
    .limit(context.maxRows + 1),
});
```

`orders`はapplication側の既存schema、`dbRuntime`はapp compositionで作成済みのDB runtimeを表す。
range/filterが必要な場合は、`select`内で`context.resolvedRange`と`context.filters`からDrizzleの
filter expressionを構築し、`.groupBy()`より前に`.where(expression)`を追加してから、使用するkeyを
`filterKeys`へ登録する。`maxRows + 1`と明示的な`overflow: "truncate"`の組み合わせにより、超過を検出して
`DATA_TRUNCATED` noticeを返す。
このqueryを通常どおり`defineDashboardV2({ queries: [ordersOverTime], ... })`へ登録する。
Drizzle以外のSQL clientは`defineRecordQueryV2`の`load`から結果配列を返す。
multi-frameなどの特殊ケースでは既存の`defineDashboardQueryV2`を使う。

## Record配列

I/Oが不要ならpure adapterを直接利用できる。

```ts
import { recordsToDataFrameV2 } from "@api/modules/dashboard";

const { frame, state } = recordsToDataFrameV2({
  records: [{ at: new Date(), value: 42, internal: "not exported" }],
  refId: "A",
  name: "Requests",
  outputShape: "timeseries",
  columns: [
    { source: "at", type: "time", roles: ["time"] },
    { source: "value", type: "number", roles: ["value"] },
  ],
});
```

未登録の`internal`は出力されない。ISO文字列、decimal文字列、`bigint`などは`accessor`で明示変換する。
row超過は既定でエラーとなり、`overflow: "truncate"`を指定した場合だけnotice付きで切り詰める。
empty resultでもfield metadataは保持されるが、指定shapeに必要なroleが不足している列定義はregistration時に失敗する。

## HTTP JSONとpipeline

HTTP adapterはregistration時に固定originとZod response schemaを要求する。
request pathは`/`から始まる同一originのorigin-relative path、methodはGET/POST、redirectは拒否される。

```ts
import { defineHttpJsonRecordQueryV2 } from "@api/modules/dashboard";

const pipelineRuns = defineHttpJsonRecordQueryV2({
  id: "pipeline-runs",
  filterKeys: [],
  baseUrl: "https://ci.example.com",
  frameName: "Pipeline runs",
  columns: [
    { source: "startedAt", type: "time", roles: ["time"] },
    { source: "status", type: "string", roles: ["state"] },
    { source: "durationMs", type: "number", roles: ["value", "duration"] },
  ],
  responseSchema: pipelineResponseSchema,
  request: () => ({ path: "/api/runs" }),
  selectRecords: ({ runs }) => runs.map(toPipelineRecord),
});
```

`pipelineResponseSchema`と`toPipelineRecord`はapplication側で定義する。前者は外部response全体を検証し、
後者は公開してよいflat recordだけを返す。外部detail URLやcredentialを返却recordへコピーしない。

responseは既定2 MiB、最大8 MiBで制限される。header、body、response、credential、外部detail URLを
Data Frameやnoticeへ含めない。認証headerが必要な場合はapplication側の固定設定から渡す。
credentialを送るproduction endpointには`https:`を使用し、`http:`はlocal developmentだけに限定する。

## 検証

```bash
bunx vitest run api/modules/dashboard/v2/adapters
bun run verify:dashboard-adapter-sqlite
bun run verify:dashboard-coverage
```

P0の実行順は[P0実装計画](./data-source-adapters-p0.md)、HTTP securityを含む詳細契約と非目標は
[Data Source Adapters全体計画](./data-source-adapters.md)を参照する。
