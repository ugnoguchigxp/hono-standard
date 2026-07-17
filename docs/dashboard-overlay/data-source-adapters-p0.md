# Dashboard Data Source Adapters P0 実装計画

## 1. 目的

既存のSQL、Drizzle、application loaderが返す`Record[]`を、Dashboard v2のData Frameへ最短経路で接続する。
利用者がPrometheus相当の収集基盤を先に構築しなくても、既存データだけでDashboardの価値を確認できる状態をP0とする。

P0の成果物は次の3点である。

1. 明示的な列定義を使う`Record[]` → Data Frame変換。
2. 任意のloaderをDashboard queryへ接続するquery helper。
3. read-only Drizzle databaseとtyped select callbackを接続する薄いhelper。

本書はP0の実行順序と受入条件の正本である。P0/P1を合わせた契約は
[全体計画](./data-source-adapters.md)、現在の実装状況と検証結果は[進捗台帳](./progress.md)を正本とする。

2026-07-18時点でAD0〜AD6は完了済みである。以下の手順は新しいvariantへの適用、回帰修正、再検証でも同じ順序で使用する。

## 2. P0の範囲

含む:

- `recordsToDataFrameV2`
- `defineRecordQueryV2`
- `defineDrizzleRecordQueryV2`
- SQLite read-only integration fixture
- public export、Quickstart、unit/integration/coverage gate
- 空結果でも列定義のshape contractを登録時に検証すること

含まない:

- HTTP/JSON、pipeline固有recipe
- SQL文字列builder、migration、schema生成
- scheduler、storage、webhook、OAuth、secret管理
- frontend transportまたはvisualization schemaの変更
- multi-frame query。必要な場合は低レベル`defineDashboardQueryV2`を使う

## 3. 固定する設計判断

- columnは配列順・明示登録制とし、record propertyの列挙順や未登録propertyを使わない。
- `source`と`accessor`は排他的とし、暗黙の文字列・数値・日時変換を行わない。
- cellは`number | string | boolean | null`、timeはvalid `Date`またはsafe integer epoch millisecondsだけを許可する。
- missing、`undefined`、`NaN`、`Infinity`、object、`bigint`はerrorにする。
- row/cell/field上限超過は既定でerrorとし、明示的な`overflow: "truncate"`だけnotice付きで許可する。
- query context、filter、resolved range、AbortSignal、runtime `refId`、`maxRows`をそのまま維持する。
- Drizzle helperはdatabase型をgenericで受け、dialect固有runtime module、write database、application schemaをimportしない。
- errorのpublic message/detailsへrow value、SQL、credentialを含めない。

## 4. Work Packages

| WP | 実装内容 | 主なfile | 完了gate |
| --- | --- | --- | --- |
| AD0 | baselineと既存Data Frame/query contractのcharacterization | existing tests | focused tests、typecheck |
| AD1 | column union、strict cell conversion、metadata clone | `record-adapter.ts` | pure unit tests |
| AD2 | frame構築、shape、empty、limit、truncate notice | `record-adapter.ts` | schema/shape tests |
| AD3 | loader context、runtime refId、empty state、abort/error mapping | `record-query.ts` | query tests |
| AD4 | read database + typed selectのcomposition | `drizzle-query.ts` | helper tests |
| AD5 | SQLite fixture、public export、Quickstart | integration script、docs | SQLite/doc-link gate |
| AD6 | coverageとfull verification、handoff | release scripts、progress | full release gate |

同時に`in_progress`にするWPは1つだけとし、各WPのtest成功後に次へ進む。

## 5. 実装手順

### AD0: Baseline

1. `frame-builders`、`frame-normalizer`、`query-coordinator`のfocused testsを実行する。
2. `DashboardQueryHandlerContextV2`の`signal`、`maxRows`、`outputFrameRefs`を確認する。
3. `DASHBOARD_V2_LIMITS`とData Frame shape validatorを再利用し、adapter独自limitを作らない。

### AD1: Record contract

1. `source`または`accessor + key`のdiscriminated unionを定義する。
2. column key重複、role/type、label/config/labelsを既存schemaで検証する。
3. plain recordだけを許可し、input recordとcolumn metadataをmutationしない。
4. conversion failureを値を含まない`DashboardRecordAdapterError`へ集約する。

### AD2: Data Frame conversion

1. field-major Data Frameを明示column順で生成する。
2. row、field、cell limitを計算し、error/truncate policyを適用する。
3. 空結果でもprobe valuesを使って列定義のshape contractを検証する。
4. truncate時だけ`DATA_TRUNCATED` noticeを返す。
5. empty、missing、invalid type、shape mismatch、cell limitをtestする。

### AD3: Query helper

1. registration時に空recordでcolumn/schema/shapeをfail-fast検証する。
2. `load(context)`の前後でabortを確認する。
3. runtime `outputFrameRefs[0]`と`context.maxRows`をconverterへ渡す。
4. empty resultへ`emptyReason: "no-records"`を設定する。
5. adapter failureだけをnon-retryable `INVALID_HANDLER_RESULT`へ変換し、DB/network failureは保持する。

### AD4: Drizzle helper

1. `DefineRecordQueryInputV2`から`load`だけを置換する薄いwrapperにする。
2. database instanceとcontextを同一select callbackへ渡す。
3. dialect、driver、schemaを共通adapterからimportしないことを確認する。

### AD5: Integration and adoption

1. 一時SQLite DBをwriterで準備し、別のread-only connectionからselectを実行する。
2. Dashboard query handlerまで通し、frame valuesとread-only性を確認する。
3. adapter barrelとDashboard public barrelからexportする。
4. 30行以内のDrizzle QuickstartとRecord配列例を用意する。

### AD6: Release gate

次を順に実行する。

```bash
bunx vitest run api/modules/dashboard/v2/adapters
bun run verify:dashboard-adapter-sqlite
bun run typecheck
bun run lint
bun run format:check
bun run verify:dashboard-coverage
DASHBOARD_FRONTEND_COVERAGE_DIR=coverage/dashboard-frontend-<task> \
  E2E_PORT=<free-port> bun run verify:dashboard-release
git diff --check
```

`<task>`は英数字とhyphenだけのtask固有名、`<free-port>`は未使用portへ置き換えて実行する。
単独実行であることを確認できる場合は`DASHBOARD_FRONTEND_COVERAGE_DIR`を省略できる。

## 6. 受入条件と現在の判定

- [x] AD0〜AD6が順番に完了している。
- [x] 明示されていないrecord propertyがFrameへ出ない。
- [x] strict physical type、missing、invalid Date、non-finite numberがtestされている。
- [x] empty resultでもFrameを返せ、誤ったshape列定義はregistration時に失敗する。
- [x] explicit truncateだけがwarning notice付きで成功する。
- [x] context、AbortSignal、runtime refId、maxRowsが維持される。
- [x] read-only Drizzle queryとSQLite integrationが成功する。
- [x] dialect import、migration、runtime dependency、frontend runtime/transport変更が0である。
- [x] focused coverageとfull release gateが成功する。

判定のcommand、test数、coverage値は[進捗台帳](./progress.md)と
[リリース証跡](./release-evidence.md)にだけ記録し、本書へ複製しない。

## 7. Handoff

P0完了後に利用者の採用体験を確認する。SQL/Drizzleだけで価値検証できる場合はP0を維持し、固定HTTP APIやCI/CD pipelineの需要が確認できた場合だけP1へ進む。
P1の仕様とsecurity boundaryは[Data Source Adapters全体計画](./data-source-adapters.md)で管理する。
