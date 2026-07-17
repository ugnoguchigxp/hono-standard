# Dashboard Data Source Adapters Quickstart

既存の配列、Drizzle query、固定HTTP JSON APIを、Dashboard v2のquery定義へ接続するserver-side APIである。
shared transport、DB schema、migration、frontendの変更は不要で、すべての列を明示的に登録する。

## Drizzleから最初のPanelへ

次のquery定義は30行以内である。`dbRuntime.client.read`を渡し、range/filterのSQL化は`select`内で行う。

```ts
import { count } from "drizzle-orm";
import { defineDrizzleRecordQueryV2 } from "./api/modules/dashboard";
import { orders } from "./api/db/schema";

const dailyOrders = defineDrizzleRecordQueryV2({
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
  select: (db, context) => db
    .select({ bucket: orders.createdAt, status: orders.status, orders: count() })
    .from(orders)
    .where(/* context.resolvedRange / context.filters */)
    .groupBy(orders.createdAt, orders.status)
    .limit(context.maxRows + 1),
});
```

このqueryを通常どおり`defineDashboardV2({ queries: [dailyOrders], ... })`へ登録する。
Drizzle以外のSQL clientは`defineRecordQueryV2`の`load`から結果配列を返す。
multi-frameなどの特殊ケースでは既存の`defineDashboardQueryV2`を使う。

## Record配列

I/Oが不要ならpure adapterを直接利用できる。

```ts
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

## HTTP JSONとpipeline

HTTP adapterはregistration時に固定originとZod response schemaを要求する。
request pathは同一originの相対path、methodはGET/POST、redirectは拒否される。

```ts
const pipelineRuns = defineHttpJsonRecordQueryV2({
  id: "pipeline-runs",
  filterKeys: ["status"],
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

responseは既定2 MiB、最大8 MiBで制限される。header、body、response、credential、外部detail URLを
Data Frameやnoticeへ含めない。認証headerが必要な場合はapplication側の固定設定から渡す。

## 検証

```bash
bunx vitest run api/modules/dashboard/v2/adapters
bun run verify:dashboard-adapter-sqlite
bun run verify:dashboard-coverage
```

詳細契約と非目標は[Data Source Adapters実装計画](./data-source-adapters.md)を参照する。
