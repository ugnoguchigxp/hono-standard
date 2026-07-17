# 01: Dashboard Visualization Platform 共有契約 実装計画

## 1. 文書の位置づけ

この文書は [Dashboard Visualization Platform コンセプト](./00-concept.md) を実装へ落とし込む最初の計画書である。

対象は、Visualization Platform v2 の共有契約、schema versioning、Data Frame、Field Configuration、Visualization / Transformation の登録契約、v1 compatibility である。

Backend executor、Frontend renderer、Panel editor、個別 Visualization の描画アルゴリズムは後続計画で実装する。この計画では、それらが依存する共有型と検証境界を先に固定する。

この文書を完了せずに、P0 runtime以降のVisualization Platform実装へ進んではならない。

### 1.1 正本の優先順位

記述が競合した場合は次の順で判断する。

1. [00-concept.md](./00-concept.md)の目的、非目標、設計原則
2. この文書のv2共有契約
3. 現行v1実装の実際の挙動
4. 旧計画書中の例示コード

現行v1の互換性を維持する必要はあるが、旧計画書の例示と実装が異なる場合は実装をbaselineとする。

### 1.2 Lunaへの完了指示

Lunaはこの文書のC0〜C9を順番に実行する。現行repositoryではC0〜C8は完了済みで、
Backend深掘りで判明したC9だけが未完了である。完了済みWPを作り直さずC9から再開する。

- Work Packageを飛ばさない。
- 同時に`in_progress`にするWork Packageは1つだけにする。
- 各Work Packageのtestが成功するまで次へ進まない。
- v1 exportを削除・改名しない。
- Backend / Frontend consumerをこの計画内でv2へ全面移行しない。
- 設計判断が必要になった場合は「固定判断」と「Stop条件」を先に確認する。
- 単なる型エラー、test失敗、実装量の多さはStop条件ではない。

## 2. 目的

現行の共有契約は次の4種類のデータと5種類の表示を前提としている。

```text
PanelData:
  timeseries | category | stat | table

visualization.type:
  line | area | bar | stat | table
```

この構造のまま40以上の表示バリエーションを追加すると、次の問題が起きる。

- VisualizationごとにPanelData variantが増える。
- `PanelChart`へ条件分岐が集中する。
- 同じデータを別Visualizationで再利用しにくい。
- Heatmap、State Timeline、Node Graph、Traceなどを表現できない。
- Transformationの入出力型を共通化できない。
- Visualization固有optionを1つのflat schemaへ追加し続けることになる。
- schema変更時にlocalStorage、manifest、API responseの互換性を判断できない。

この計画では、v1を維持したまま次のv2基盤を追加する。

1. column-oriented Data Frame
2. physical field typeとsemantic role
3. shared Field ConfigurationとOverride
4. registryで検証するVisualization envelope
5. registryで検証するTransformation envelope
6. 複数query / 複数frameを扱えるPanel manifest
7. version付きmanifest / query response
8. v1からv2への決定的な変換

## 3. 完了後の状態

この計画が完了した時点では、次の状態になっていること。

- 既存Dashboard v1が変更前と同じ挙動で動く。
- 既存import path `shared/schemas/dashboard.schema.ts` が維持される。
- v1 schemaとv2 schemaが明確に分離される。
- v2 Data Frameがscalar、timeseries、category、table、matrix、state、hierarchy、graph、logs、traces、profile、geoを表現できる。
- v2 manifestが複数query binding、transformations、Visualization envelopeを持てる。
- Visualization / Transformation optionはJSON構造検証後、registry固有schemaで二段階検証できる。
- v1 PanelDataをv2 Data Frameへ変換するcompatibility helperがある。
- schema version不一致を明示的に検出できる。
- valid / invalid / migration fixtureが揃っている。
- shared契約だけで型check、unit test、既存Dashboard testが成功する。

この時点では新しいグラフを描画しなくてよい。描画を始める前提が完成していることが成果である。

## 4. 対象

### 4.1 実装対象

```text
shared/schemas/dashboard.schema.ts
shared/schemas/dashboard.schema.test.ts
shared/schemas/dashboard/
```

追加するファイル:

```text
shared/schemas/dashboard/common.schema.ts
shared/schemas/dashboard/json-value.schema.ts
shared/schemas/dashboard/legacy-v1.schema.ts
shared/schemas/dashboard/field-config.schema.ts
shared/schemas/dashboard/data-frame.schema.ts
shared/schemas/dashboard/field-config-resolution.ts
shared/schemas/dashboard/visualization.schema.ts
shared/schemas/dashboard/transformation.schema.ts
shared/schemas/dashboard/manifest-v2.schema.ts
shared/schemas/dashboard/transport-v2.schema.ts
shared/schemas/dashboard/compatibility.ts
shared/schemas/dashboard/index.ts

shared/schemas/dashboard/common.schema.test.ts
shared/schemas/dashboard/json-value.schema.test.ts
shared/schemas/dashboard/field-config.schema.test.ts
shared/schemas/dashboard/data-frame.schema.test.ts
shared/schemas/dashboard/field-config-resolution.test.ts
shared/schemas/dashboard/visualization.schema.test.ts
shared/schemas/dashboard/transformation.schema.test.ts
shared/schemas/dashboard/manifest-v2.schema.test.ts
shared/schemas/dashboard/transport-v2.schema.test.ts
shared/schemas/dashboard/compatibility.test.ts
```

fixtureはtest fileへ巨大なobjectを直接書かず、次へ分離する。

```text
shared/schemas/dashboard/test-fixtures.ts
```

### 4.2 変更を許可する関連文書

```text
docs/dashboard-overlay/progress.md
docs/dashboard-overlay/02-backend.md
docs/dashboard-overlay/03-frontend.md
LLM_CONTEXT.md
```

02 / 03はv2契約の参照先だけを更新し、Backend / Frontend実装手順の全面改稿はそれぞれの計画開始時に行う。

### 4.3 対象外

- Backend query executorのv2対応
- Frontend rendererのv2対応
- Visualization Registryのruntime実装
- Transformation実行エンジン
- Panel editor
- 新しいRecharts component
- API endpointの切り替え
- v1 schema / helper / exportの削除
- 新規runtime dependency

## 5. 現行baseline

実装開始前に次を記録する。

```bash
git branch --show-current
git status --short
bunx vitest run shared/schemas/dashboard.schema.test.ts
bunx tsc --noEmit
bun run verify:dashboard-coverage
```

現行v1の正本は、計画当時の例示ではなく次のファイルである。

```text
shared/schemas/dashboard.schema.ts
shared/schemas/dashboard.schema.test.ts
api/modules/dashboard/types.ts
api/modules/dashboard/normalize-result.ts
api/modules/dashboard/result-builders.ts
api/modules/dashboard/demo-dashboard.ts
web/src/domains/dashboard/chart.tsx
web/src/domains/dashboard/table.tsx
```

### 5.1 現行v1で維持するexport

少なくとも次のexport名は、この計画中に意味を変更しない。

```text
DASHBOARD_LIMITS
dashboardEntityIdSchema
dashboardPanelIdSchema
relativeRangeValueSchema
dashboardRangeSchema
dashboardFiltersSchema
dashboardTimezoneSchema
dashboardQueryContextSchema
chartColorTokenSchema
seriesMetaSchema
tableColumnSchema
variableOptionSchema
variableManifestSchema
panelLayoutSchema
thresholdSchema
valueMappingSchema
referenceLineSchema
panelLinkSchema
panelVisualizationSchema
panelManifestSchema
dashboardManifestSchema
publicDashboardManifestSchema
timeSeriesDataSchema
categoryDataSchema
statDataSchema
tableDataSchema
panelDataStateSchema
panelDataSchema
panelQueryRequestSchema
variableOptionsRequestSchema
panelQueryResponseSchema
dashboardErrorCodeSchema
dashboardErrorResponseSchema
variableOptionsResponseSchema
```

対応する`z.infer`型exportも維持する。

### 5.2 現行v1のcharacterization

C0で次の挙動をtestとして固定する。

- relative rangeは`kind: "relative"`を使う。
- absolute rangeはoffset付きISO datetimeを要求する。
- color tokenはCSS variable形式`--color-*`を許可する。
- `panelVisualizationSchema.type`は5種類だけを許可する。
- PanelDataは4種類だけを許可する。
- timeseries/categoryのseries keyは64文字以内。
- table cellはstring / finite number / boolean / null。
- v1 responseには`schemaVersion`がない。
- v1 errorは`{ error: { code, message, requestId, retryable } }`形式。

このcharacterization testがない状態でファイル分割を始めない。

## 6. 固定済み設計判断

実装中に次を再検討しない。

1. v1を直接v2へ書き換えず、併設する。
2. 既存`dashboard.schema.ts`はpublic compatibility barrelとして残す。
3. v2のschema versionは数値`2`とする。
4. v2の正規化データ形式はcolumn-oriented Data Frameとする。
5. fieldのphysical typeとsemantic roleを分離する。
6. Data Frameのfield配列順は表示上の安定順として維持する。
7. field valuesはnullableだが`undefined`を許可しない。
8. 全fieldのvalues長は同一でなければならない。
9. Visualization / Transformation optionはJSON valueだけを許可する。
10. optionの構造検証とregistry固有schema検証を分ける。
11. unknown Visualization typeはtransport parseでは拒否せず、registry validationでincompatibleとして扱えるようにする。
12. code-defined Dashboard登録時はunknown typeを許可せず、登録済みdescriptorを要求する。
13. Panelは複数query bindingと複数frameを扱える契約にする。
14. query bindingの`refId`はPanel内で一意とする。
15. v2のquery responseは`frames`を返し、v1 `data`と混在させない。
16. silent truncationは禁止する。明示的truncationはstructured noticeを必須とする。
17. raw hex colorをmanifestへ保存せず、CSS variable tokenを使う。
18. v2のtable fallbackはData Frameから機械的に生成可能でなければならない。
19. schema fileはReact、Recharts、Hono、DB driverへ依存しない。
20. この計画で追加runtime dependencyはZod以外に増やさない。
21. v2の固定shape object schemaは`.strict()`とし、未知fieldを黙って除去しない。
22. v1 schemaのunknown key挙動は変更しない。

### 6.1 Strict object policy

`.strict()`を適用する:

- Field
- Data Frame
- Field Configuration
- Override
- Link
- Visualization / Transformation envelope
- Manifest
- Query request / response
- Notice / error

dynamic keyを許可する:

- filters
- field labels
- JSON options
- JSON error details

type固有Visualization / Transformation option schemaも`.strict()`を必須とする。

## 7. Module構成と依存方向

依存方向を次に固定する。

```text
common.schema
      ↓
json-value.schema
      ↓
field-config.schema
      ↓
data-frame.schema
      ↓
field-config-resolution
      ↓
visualization.schema
transformation.schema
      ↓
manifest-v2.schema
      ↓
transport-v2.schema
      ↓
compatibility
      ↓
index
      ↓
dashboard.schema.ts compatibility barrel
```

`legacy-v1.schema.ts`はv1 contractを保持し、`compatibility.ts`だけがv1とv2の両方をimportしてよい。

禁止する循環:

- Data FrameがVisualizationをimportする。
- Field ConfigurationがManifestをimportする。
- v1 schemaがv2 schemaをimportする。
- schema moduleがcompatibility helperをimportする。

## 8. C0〜C9 Work Packages

| WP | 内容 | 完了gate |
| --- | --- | --- |
| C0 | baselineとv1 characterization | 既存schema test、追加characterization test、typecheck |
| C1 | v1 schema抽出とbarrel化 | 全既存import無変更、verify成功 |
| C2 | common primitive、JSON value、v2 limits | common/json unit test |
| C3 | Field ConfigurationとOverride | field-config unit test |
| C4 | Data Frame、shape contract、effective field config resolution | data-frame/resolution unit test、cell budget test |
| C5 | Visualization / Transformation envelope | envelope、descriptor、二段階validation test |
| C6 | v2 Manifest / Transport / Error | manifest/transport round-trip test |
| C7 | v1→v2 compatibility helper |全4種PanelData migration fixture |
| C8 | public export、文書、full verification | typecheck、target test、verify、diff check |
| C9 | Backend prerequisite contract addendum | multi-frame binding/error code test、full verify |

各WPの開始時と完了時に[進捗台帳](./progress.md)へ記録する。

## 9. C0: baselineとcharacterization

### 9.1 作業

`shared/schemas/dashboard.schema.test.ts`へ、現在の実装挙動を固定するtestを追加する。

最低限追加するtest:

1. 既存代表manifestがparseできる。
2. v1 manifestに`schemaVersion`がなくてもparseできる。
3. v1 visualizationへ未知typeを渡すと失敗する。
4. v1 PanelDataへ未知kindを渡すと失敗する。
5. CSS variable token以外を拒否する。
6. absolute rangeでoffsetなしdatetimeを拒否する。
7. table mixed primitive cellを許可する。
8. error envelopeのshapeを固定する。
9. public manifestからstatic optionsが除去可能なshapeである。
10. default適用後のparse結果をsnapshotではなく明示値で確認する。

### 9.2 完了gate

```bash
bunx vitest run shared/schemas/dashboard.schema.test.ts
bunx tsc --noEmit
```

## 10. C1: v1 schema抽出

### 10.1 作業

現在の`shared/schemas/dashboard.schema.ts`を機械的に`legacy-v1.schema.ts`へ移す。

この時点では次を変更しない。

- field名
- default
- max/min
- error message
- exported typeの意味
- parse結果

`shared/schemas/dashboard/index.ts`からv1をre-exportし、既存`shared/schemas/dashboard.schema.ts`は次の役割だけにする。

```ts
export * from "./dashboard/index";
```

実際の相対pathはrepositoryのTypeScript resolutionに合わせる。

### 10.2 注意点

- 同名exportをv1とv2で作らない。
- v2は必ず`V2`または`v2`が名前から判別できるexport名にする。
- unversioned exportはC8完了時点でもv1を指す。
- formatterだけを理由に既存schemaを変更しない。

### 10.3 完了gate

```bash
bunx vitest run shared/schemas/dashboard.schema.test.ts
bunx tsc --noEmit
bun run verify
```

`git diff`でC1がファイル移動とre-export以外の意味変更を含まないことを確認する。

## 11. C2: common primitiveとv2 limits

### 11.1 Version

```ts
export const DASHBOARD_SCHEMA_VERSION_V1 = 1 as const;
export const DASHBOARD_SCHEMA_VERSION_V2 = 2 as const;

export const dashboardSchemaVersionSchema = z.union([
	z.literal(DASHBOARD_SCHEMA_VERSION_V1),
	z.literal(DASHBOARD_SCHEMA_VERSION_V2),
]);
```

v1 payloadはwire上にversionを持たない。compatibility helper内ではversion 1として扱う。

### 11.2 ID

用途別にschemaを分ける。

```ts
dashboardIdSchema
dashboardPanelIdSchemaV2
dashboardVariableIdSchema
dashboardQueryIdSchema
dashboardTransformationInstanceIdSchema
dashboardVisualizationTypeIdSchema
dashboardPresetIdSchema
dashboardFrameRefIdSchema
dashboardFieldKeySchema
```

規則:

| ID | Pattern | Max |
| --- | --- | ---: |
| Dashboard / Panel / Variable / Query | `^[a-z][a-z0-9-]*$` | 64 |
| Visualization / Transformation type | `^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$` | 80 |
| Preset | `^[a-z][a-z0-9-]*$` | 64 |
| Frame refId | `^[A-Z][A-Z0-9]*$` | 8 |
| Field key | `^[A-Za-z_][A-Za-z0-9_.:-]*$` | 80 |
| Transformation instance | `^[a-z][a-z0-9-]*$` | 64 |

Built-in type IDはnamespaceを持つ。

```text
core.timeseries
core.bar
core.stat
core.table
core.heatmap
core.state-timeline
core.reduce
core.sort
```

### 11.3 v2 limits

v1の`DASHBOARD_LIMITS`を変更せず、次を追加する。

```ts
export const DASHBOARD_V2_LIMITS = {
	maxFramesPerResponse: 16,
	maxFieldsPerFrame: 64,
	maxRowsPerFrame: 2_000,
	maxCellsPerFrame: 100_000,
	maxCellsPerResponse: 250_000,
	maxFieldRoles: 4,
	maxFieldLabels: 20,
	maxLabelLength: 128,
	maxCellStringLength: 8_192,
	maxNotices: 50,
	maxTransformationsPerPanel: 20,
	maxOverridesPerPanel: 50,
	maxQueriesPerPanel: 8,
	maxVisualizationOptionsBytes: 32_768,
	maxTransformationOptionsBytes: 16_384,
	maxErrorDetailsBytes: 16_384,
	maxJsonDepth: 8,
	maxJsonObjectKeys: 128,
	maxJsonArrayItems: 2_000,
	maxLinksPerPanel: 10,
	maxThresholdSteps: 20,
	maxValueMappings: 50,
	maxVariableOptions: 1_000,
	maxStaticVariableOptions: 100,
} as const;
```

limitはschemaの構造上限である。Backend runtimeはこれ以下の実行limitを設定してよい。

### 11.4 JSON value

Visualization / Transformation optionsへ許可する値を定義する。

```ts
type DashboardJsonValue =
	| null
	| boolean
	| number
	| string
	| DashboardJsonValue[]
	| { [key: string]: DashboardJsonValue };
```

Rules:

- numberはfiniteのみ。
- `undefined`、function、symbol、bigint、Date、Map、Setを拒否する。
- objectはplain objectだけを許可する。
- prototype pollution key `__proto__`、`prototype`、`constructor`を拒否する。
- depth、key数、array item数、serialized byte数を検証する。
- 循環参照は`INVALID_JSON_VALUE`として拒否する。

naiveなrecursive Zod schemaへ循環objectを渡すと、budget検証前に再帰し続ける可能性がある。実装順を次に固定する。

1. `validateDashboardJsonValue(value, limits)`がiterative traversalで型、循環、depth、件数、forbidden keyを検証する。
2. traversal成功後だけ`JSON.stringify`と`TextEncoder`でbyte数を測る。
3. `dashboardJsonValueSchema`は`z.unknown().superRefine()`から同じvalidatorを呼ぶ。
4. `dashboardJsonObjectSchema`はrootがplain objectであることも要求する。

```ts
type DashboardJsonLimits = {
	maxDepth: number;
	maxObjectKeys: number;
	maxArrayItems: number;
	maxBytes: number;
};

type DashboardJsonValidationIssue = {
	code:
		| "INVALID_JSON_TYPE"
		| "CIRCULAR_REFERENCE"
		| "JSON_DEPTH_EXCEEDED"
		| "JSON_OBJECT_KEYS_EXCEEDED"
		| "JSON_ARRAY_ITEMS_EXCEEDED"
		| "JSON_BYTES_EXCEEDED"
		| "FORBIDDEN_JSON_KEY";
	path: Array<string | number>;
	message: string;
};

validateDashboardJsonValue(
	value: unknown,
	limits: DashboardJsonLimits,
): {
	valid: boolean;
	issues: DashboardJsonValidationIssue[];
}
```

plain objectはprototypeが`Object.prototype`または`null`のobjectとする。

`maxObjectKeys`と`maxArrayItems`は各object / array単位に適用する。`maxBytes`はroot value全体に適用する。

`dashboardJsonValueSchema`単体ではVisualization用の32KiB budgetをdefaultとして使う。Transformation envelopeは`superRefine`で16KiB budgetを再適用する。

`validateDashboardJsonBudget`という別名は作らず、型検証とbudget検証を上記1 helperへ集約する。C8のpublic exportも`validateDashboardJsonValue`へ統一する。

Visualization preset解決用に次のpure helperも実装する。

```ts
mergeDashboardJsonObjects(
	base: DashboardJsonObject,
	patch: DashboardJsonObject,
): DashboardJsonObject
```

Merge rules:

- plain object同士はkey単位で再帰merge。
- arrayはpatch側で全置換。
- primitiveとnullはpatch側で置換。
- patchに存在しないkeyはbaseを維持。
- `undefined`はcontract上存在しない。
- inputをmutationしない。
- forbidden keyを持つinputはmerge前に拒否する。
- merge後にJSON budgetを再検証する。

### 11.5 Range、timezone、filter

v2ではv1のwire形式を維持する。

```ts
type DashboardRangeV2 =
	| { kind: "relative"; value: "15m" | "1h" | "6h" | "24h" | "7d" }
	| { kind: "absolute"; from: string; to: string };

type DashboardFiltersV2 = Record<string, string[]>;
```

Rules:

- absolute datetimeはoffset付きISO。
- `from < to`。
- timezoneはtrim後1〜64文字。
- timezoneの実在性はServer registryで検証する。
- filter key/value limitはv1を維持する。
- schema parseはfilter順を変更しない。
- 重複除去、sort、空配列除去はcanonicalization helperの責務であり、Zod parseへ暗黙に混ぜない。
- v2 export名を用意しても、内部では安全にv1 schemaを再利用してよい。

### 11.6 test

- ID valid / invalid / max length
- finite number
- plain object
- forbidden key
- depth 8成功 / 9失敗
- byte上限境界
- circular reference
- JSON object merge、array replacement、immutability
- Date / Map / function拒否

## 12. C3: Field Configuration

### 12.1 Color token

v2でもCSS variable tokenを使用する。

```ts
export const dashboardColorTokenSchema = z
	.string()
	.regex(/^--[a-z0-9]+(?:-[a-z0-9]+)*$/)
	.max(80);
```

raw hex、rgb、hslはmanifest contractとして許可しない。

### 12.2 Unit

unitは自由文字列ではなく、既知unitまたはcustom labelとして表現する。

```ts
type FieldUnit =
	| { kind: "none" }
	| { kind: "short" }
	| { kind: "percent"; scale: "unit" | "hundred" }
	| { kind: "bytes"; base: 1000 | 1024 }
	| { kind: "duration"; unit: "ns" | "us" | "ms" | "s" | "m" | "h" | "d" }
	| { kind: "rate"; suffix: string }
	| { kind: "currency"; code: string }
	| { kind: "custom"; suffix: string };
```

Rules:

- currency codeは`^[A-Z]{3}$`。
- suffixは最大16文字。
- v1 string unitはcompatibility helperで対応する。
- unit formatterの実装はFrontend計画へ渡す。

Percent scale:

- `scale: "unit"`は`0.024`を`2.4%`として表示する。
- `scale: "hundred"`は`2.4`を`2.4%`として表示する。
- schemaは値を変換しない。formatterだけがscaleを適用する。

### 12.3 Threshold

```ts
type ThresholdConfigV2 = {
	mode: "absolute" | "percentage";
	steps: Array<{
		value: number | null;
		colorToken: DashboardColorToken;
		label?: string;
	}>;
};
```

Rules:

- `steps`は1〜20件。
- 最初のstepだけ`value: null`を許可し、baselineを表す。
- 2件目以降はfinite number。
- 2件目以降はvalue昇順。
- percentage modeの値は0〜100。
- labelは最大80文字。
- 同値stepを拒否する。

Threshold match:

- absolute modeは`step.value <= field value`を満たす最後のstepを採用する。
- percentage modeは`(value - min) / (max - min) * 100`へ変換してから同じ規則を使う。
- percentage modeはeffective field configにfiniteなmin/maxがあり、`min < max`であることをregistry validationで要求する。
- null valueはthresholdへmatchしない。

### 12.4 Value mapping

v2で次を許可する。

```ts
type ValueMappingV2 =
	| {
			kind: "value";
			value: string | number | boolean;
			text: string;
			colorToken?: DashboardColorToken;
	  }
	| {
			kind: "range";
			from: number;
			to: number;
			text: string;
			colorToken?: DashboardColorToken;
	  }
	| {
			kind: "null";
			text: string;
			colorToken?: DashboardColorToken;
	  };
```

Rules:

- textは1〜80文字。
- value mappingのnumberはfinite。
- rangeは`from <= to`。
- mappingは配列順で最初にmatchしたものを採用する。
- value mappingはprimitive値を`Object.is`相当で比較する。
- range mappingは両端を含む。
- null mappingはnullだけにmatchし、undefinedはcontract上存在しない。
- 同一value mappingの重複はregistry validationで拒否する。
- regex mappingはこの計画では追加しない。

### 12.5 Standard Field Configuration

```ts
type StandardFieldConfigV2 = {
	displayName?: string;
	description?: string;
	unit: FieldUnit;
	decimals: "auto" | number;
	min?: number;
	max?: number;
	noValueText: string;
	textAlign: "auto" | "left" | "center" | "right";
	color?: {
		mode: "fixed" | "palette";
		token?: DashboardColorToken;
		palette?: "categorical" | "sequential" | "diverging" | "status";
	};
	thresholds?: ThresholdConfigV2;
	valueMappings: ValueMappingV2[];
	links: PanelLinkV2[];
};
```

Defaults:

```text
unit = { kind: "none" }
decimals = "auto"
noValueText = "—"
textAlign = "auto"
valueMappings = []
links = []
```

Validation:

- decimalsは0〜8。
- min / maxはfinite。
- minとmaxが両方ある場合`min < max`。
- fixed colorはtoken必須、paletteは禁止。
- palette colorはpalette必須、tokenは禁止。
- noValueTextは最大32文字。
- textAlignはTable、Key/Value、Tooltipの表示hintであり、Chart rendererは無視してよい。

Patch:

```ts
type StandardFieldConfigPatchV2 = Partial<StandardFieldConfigV2>;
```

`color`、`thresholds`などのnested objectをさらに`.partial()`にはしない。指定する場合はそのobject全体がvalidでなければならない。

### 12.6 Field Override

Matcher:

```ts
type FieldMatcherV2 =
	| {
			kind: "field-name";
			fieldKey: string;
	  }
	| {
			kind: "field-type";
			fieldType: DashboardFieldType;
	  }
	| {
			kind: "field-role";
			role: DashboardFieldRole;
	  }
	| {
			kind: "field-regex";
			pattern: string;
			flags: "" | "i";
	  }
	| {
			kind: "frame-ref";
			refId: string;
	  }
	| {
			kind: "query-ref";
			refId: string;
	  }
	| {
			kind: "transformation-ref";
			id: string;
	  };
```

```ts
type FieldOverrideV2 = {
	id: string;
	matcher: FieldMatcherV2;
	properties: StandardFieldConfigPatchV2;
};
```

Rules:

- override IDはDashboard entity ID pattern、最大64文字。
- override IDはPanel内で一意。
- propertiesは少なくとも1 fieldを持つ。
- regex patternは最大128文字。
- regex flagは`i`だけを許可する。
- invalid regexはschema validationで拒否する。
- common field propertyだけをこの計画でoverride可能にする。
- Visualization固有overrideは後続計画でproperty unionを拡張する。

Regex matcher:

- registry validation時に1度だけcompileする。
- fieldごとのrender中に毎回compileしない。
- 対象は最大80文字のfield key、最大64 fieldsに限定する。
- numeric backreference、named backreference、positive/negative lookbehindを拒否する。
- `\1`〜`\9`、`\k<...>`、`(?<=...)`、`(?<!...)`を検出したらinvalidとする。

### 12.7 Effective Field Configuration

最終設定の適用順を次に固定する。

```text
Standard defaults
  → VisualizationSpec.fieldConfig
  → Data Frame Field.config
  → matching overrides in manifest order
```

後の設定が前の設定を上書きする。

Merge rules:

- scalar propertyは後勝ち。
- `unit`、`color`、`thresholds`はobject単位で置換し、深いmergeをしない。
- `valueMappings`と`links`は配列単位で置換し、暗黙連結しない。
- overrideは配列順に評価し、複数matchした場合は後のoverrideを優先する。
- `undefined`は「指定なし」、空配列は「明示的に無し」を表す。
- effective config生成はinputをmutationしないpure functionにする。

共有型として次をexportする。

```ts
resolveEffectiveFieldConfig(
	panelConfig: StandardFieldConfigV2,
	fieldConfig: StandardFieldConfigPatchV2 | undefined,
	overrides: FieldOverrideV2[],
	context: {
		frameRefId: string;
		source: DashboardFrameSourceV2;
		fieldKey: string;
		fieldType: DashboardFieldType;
		fieldRoles: DashboardFieldRole[];
	},
): StandardFieldConfigV2
```

このhelperは`field-config-resolution.ts`へ置く。`field-config.schema.ts`からData Frame型をimportして循環を作らない。

### 12.8 Link

v1のsame-origin方針を維持し、v2ではsourceを拡張する。

```ts
type LinkValueSourceV2 =
	| {
			kind: "field";
			fieldKey: string;
	  }
	| {
			kind: "filter";
			variableId: string;
			format: "first" | "comma" | "json";
	  }
	| {
			kind: "constant";
			value: string | number | boolean;
	  }
	| { kind: "dashboard-range-from" }
	| { kind: "dashboard-range-to" }
	| { kind: "frame-ref" };
```

PanelLinkV2:

```ts
type PanelLinkV2 = {
	id: string;
	title: string;
	targetId: string;
	to: string;
	search: Record<string, LinkValueSourceV2>;
	includeRange: boolean;
	includeFilters: boolean;
	openInNewTab: boolean;
};
```

Rules:

- idはDashboard entity ID pattern、最大64文字。
- titleは1〜80文字。
- `to`は`/`始まり。
- targetIdはFrontend route allowlistのstable ID。
- `//`、`\`、`://`を拒否する。
- openInNewTabはsame-originでも明示設定が必要。
- undefined sourceはlink disabled。
- secret / auth dataをsourceにできない。
- search keyは1〜64文字。
- field sourceはclick datumまたはtable rowに存在する値だけを使う。
- filter format `first`は先頭値、`comma`は`,`結合、`json`はJSON配列文字列。
- filterが空の場合はsource unresolvedとしてsearch keyを出力しない。
- dashboard-range-from/to sourceは現在表示中のPanel query responseにある`resolvedRange`のabsolute ISO datetimeを使う。
- `includeRange`はsourceとは別に、元のDashboard range descriptorを既存search param形式で引き継ぐ。
- 同じlinks配列内でid重複を拒否する。
- Standard Field ConfigurationとPanel footer linksの各配列に最大10件を適用する。

Defaults:

```text
search = {}
includeRange = false
includeFilters = false
openInNewTab = false
filter.format = comma
```

## 13. C4: Data Frame

### 13.1 physical field type

```ts
export const dashboardFieldTypeSchema = z.enum([
	"time",
	"number",
	"string",
	"boolean",
]);
```

物理型を増やさず、duration、geo、traceなどはsemantic roleとunitで表す。

### 13.2 semantic role

```text
time
value
category
series
x
y
lower
upper
min
max
q1
median
q3
size
bin-start
bin-end
count
state
start-time
end-time
id
parent-id
source
target
latitude
longitude
level
severity
message
url
trace-id
span-id
parent-span-id
duration
open
high
low
close
volume
self
total
```

1 fieldは最大4 roleを持てる。

Role compatibility:

| Role | 許可physical type |
| --- | --- |
| time / start-time / end-time | time |
| value / duration / lower / upper / min / max / q1 / median / q3 / size / bin-start / bin-end / count / open / high / low / close / volume / self / total | number |
| latitude / longitude | number |
| x / y | time / number / string |
| state | string / number / boolean |
| id / parent-id / source / target | string |
| trace-id / span-id / parent-span-id | string |
| level | number |
| severity / message / url / category / series | string |

role重複を拒否する。

### 13.3 Field

Fieldはphysical typeごとのdiscriminated unionにする。

```ts
type TimeField = FieldBase & {
	type: "time";
	values: Array<number | null>;
};

type NumberField = FieldBase & {
	type: "number";
	values: Array<number | null>;
};

type StringField = FieldBase & {
	type: "string";
	values: Array<string | null>;
};

type BooleanField = FieldBase & {
	type: "boolean";
	values: Array<boolean | null>;
};
```

FieldBase:

```ts
type FieldBase = {
	key: string;
	label: string;
	roles: DashboardFieldRole[];
	labels: Record<string, string>;
	config?: StandardFieldConfigPatchV2;
};
```

Rules:

- keyはFrame内で一意。
- labelは1〜128文字。
- labelsはdimension metadataで、最大20 key。
- label keyは`dashboardFieldKeySchema`、valueは最大128文字。
- numberはfinite。
- timeはepoch millisecondsのsafe integer。
- string cellは最大8,192文字。
- valuesは最大2,000件。
- `undefined`は禁止。

Defaults:

```text
roles = []
labels = {}
config = undefined
```

### 13.4 Data Frame

```ts
type DashboardDataFrameV2 = {
	schemaVersion: 2;
	refId: string;
	source: DashboardFrameSourceV2;
	name: string;
	fields: DashboardFieldV2[];
	meta: {
		shapeHint?: DashboardDataShape;
		queryId?: string;
		custom?: DashboardJsonObject;
	};
};
```

Frame source:

```ts
type DashboardFrameSourceV2 =
	| {
			kind: "query";
			refId: string;
	  }
	| {
			kind: "transformation";
			id: string;
	  };
```

Data shape:

```text
scalar
timeseries
category
table
distribution
matrix
state-interval
hierarchy
graph-nodes
graph-edges
logs
traces
profile
geo
ohlc
```

Rules:

- schemaVersionは必ず2。
- refIdはresponse内で一意。
- query sourceのrefIdはPanel query bindingを参照する。
- transformation sourceのidはPanel transformation instanceを参照する。
- nameは1〜128文字。
- fieldは1〜64件。
- 全field values長は同一。
- 0 rowを許可するがresponse stateにempty reasonが必要。
- cells=`fieldCount * rowCount`。
- 1 Frame最大100,000 cells。
- response全体最大250,000 cells。
- shapeHintはproducerのhintであり、compatibility validatorがrole構成を検証する。
- meta.customもJSON budgetを適用する。

Default:

```text
meta = {}
```

`data-frame.schema.ts`は構造schemaに加えて次をexportする。

```ts
validateDashboardDataFrameShape(
	frame: DashboardDataFrameV2,
): DashboardDataFrameShapeValidationResult
```

Result:

```ts
type DashboardDataFrameShapeValidationResult =
	| { valid: true; shape: DashboardDataShape }
	| {
			valid: false;
			shape: DashboardDataShape;
			issues: Array<{
				code: string;
				message: string;
				fieldKey?: string;
			}>;
	  };
```

Zod structural parse成功とshape compatibility成功を別の結果にする。`shapeHint`がない場合の自動推定は後続runtime計画で実装し、この計画では明示hintの検証だけを必須とする。

### 13.5 shape minimum requirements

| Shape | 最低要件 |
| --- | --- |
| scalar | 非empty時は1 row、number/string/boolean fieldが1件以上 |
| timeseries | time role 1件と、number value role 1件以上、またはnumber lower/upper roleの組 |
| category | category role 1件と、number value role 1件以上、またはfive-number summary |
| table | field 1件以上 |
| distribution | number value、bin-start/bin-end/count、five-number summaryのいずれか |
| matrix | x role、y role、number valueまたはcount |
| state-interval | start-time、任意end-time、state |
| hierarchy | id、任意parent-id、number value |
| graph-nodes | id、任意label/value |
| graph-edges | source、target、任意value |
| logs | time、message、任意severity |
| traces | trace-id、span-id、start-time、duration |
| profile | levelまたはparent-id、selfまたはtotal |
| geo | latitude、longitude |
| ohlc | time、open、high、low、close |

`shapeHint`があるのに最低要件を満たさない場合はinvalid。

five-number summaryは`min`, `q1`, `median`, `q3`, `max`の5 roleが全て揃うことを意味する。

0 row Frameはempty response用として全shapeで許可する。0 row時も必要なfield metadataとroleは保持し、row cardinalityに関する要件だけを免除する。

### 13.6 multi-frame rules

- Query responseは1〜16 Frame。
- refIdはresponse内で一意。
- query sourceはPanel query bindingに存在しなければならない。
- query source FrameのrefIdは、そのbindingのoutputFrameRefsに存在しなければならない。
- transformation sourceはPanel transformation specに存在しなければならない。
- 同一query bindingから複数Frameを返す場合、sourceは同じquery refIdを使い、Frame refIdは`A`, `A1`, `A2`のような安定した一意値を使う。
- 複数queryをjoinしたFrameは`{ kind: "transformation", id: "<instance-id>" }`をsourceにする。
- Node Graphはnodes frameとedges frameを分ける。
- Join前の複数queryはそれぞれ別refIdを使う。
- table fallbackはFrame単位に生成する。

Frame sourceのPanel binding / transformation存在確認はData Frame単体schemaでは行わず、Panel query responseをmanifest contextと照合するruntime validatorの責務とする。

共有pure helperとして次を実装する。

```ts
validatePanelFramesAgainstManifest(
	panel: PanelManifestV2,
	frames: DashboardDataFrameV2[],
): {
	valid: boolean;
	issues: Array<{
		code:
			| "UNKNOWN_QUERY_REF"
			| "UNKNOWN_TRANSFORMATION_REF"
			| "UNDECLARED_QUERY_OUTPUT"
			| "DUPLICATE_FRAME_REF"
			| "FRAME_SHAPE_INVALID";
		message: string;
		frameRefId?: string;
		sourceId?: string;
	}>;
}
```

このhelperはquery handlerの存在やVisualization compatibilityを検証しない。Panel bindingとFrame identity / shapeだけを検証する。

## 14. C5: Visualization契約

### 14.1 二段階validation

Visualization設定は次の順で検証する。

1. `visualizationSpecV2Schema`でtransport安全性を検証する。
2. `type`に対応するruntime definitionをregistryから取得する。
3. runtime definitionの`configSchema`で`options`を検証する。
4. presetがdescriptorに存在するか検証する。
5. Data Frame shapeとのcompatibilityを検証する。

Transport schemaはunknown type IDを構造上は許可する。これにより、optional rendererが未導入でもDashboard全体をparseできる。

Code-defined Dashboardをregistryへ登録するときは、unknown typeを起動時errorにする。

### 14.2 Visualization spec

```ts
type VisualizationSpecV2 = {
	type: string;
	preset?: string;
	frameRefs: string[];
	options: DashboardJsonObject;
	fieldConfig: StandardFieldConfigV2;
	overrides: FieldOverrideV2[];
	tableFallback: {
		enabled: boolean;
		defaultView: "visualization" | "table";
	};
};
```

Defaults:

```text
options = {}
fieldConfig = standard defaults
overrides = []
tableFallback.enabled = true
tableFallback.defaultView = visualization
```

Rules:

- frameRefsは1〜16件。
- frameRefs内の重複を拒否する。
- query binding refIdまたは有効な先行transformation output refIdだけを参照できる。
- disabled transformationのoutput refIdを参照できない。
- selected FrameがsupportedShapesを満たすかはregistry validationで確認する。

### 14.3 Descriptor contract

```ts
type VisualizationDescriptor = {
	type: string;
	displayName: string;
	description: string;
	category:
		| "time"
		| "category"
		| "distribution"
		| "relationship"
		| "kpi"
		| "status"
		| "hierarchy"
		| "flow"
		| "observability"
		| "data";
	configSchemaVersion: number;
	presets: VisualizationPresetDescriptor[];
	defaultPreset: string;
	supportedShapes: DashboardDataShape[];
	minimumSize: { w: number; h: number };
	recommendedSize: { w: number; h: number };
	capabilities: VisualizationCapabilities;
};
```

Capabilities:

```text
legend
tooltip
sharedCrosshair
zoom
rangeSelection
annotations
fieldOverrides
tableFallback
exportImage
exportData
mobileSummary
```

DescriptorにReact componentやdynamic import functionを含めない。共有descriptorはserializable metadataだけにする。renderer loaderはFrontend registryの責務である。

runtime側はdescriptorを次のdefinitionで包む。

```ts
type VisualizationDefinition<TConfig> = {
	descriptor: VisualizationDescriptor;
	configSchema: z.ZodType<TConfig>;
	defaultOptionsByPreset: Record<string, DashboardJsonObject>;
};
```

`VisualizationDefinition`はregistry実装用TypeScript型であり、API responseへserializeしない。

Preset descriptor:

```ts
type VisualizationPresetDescriptor = {
	id: string;
	displayName: string;
	description: string;
};
```

Rules:

- preset IDはdescriptor内で一意。
- defaultPresetはpresets内に存在する。
- defaultOptionsByPresetは全presetに対応するkeyを持ち、余分なkeyを持たない。
- default optionsはconfigSchemaでparse成功しなければならない。

Config resolution:

1. spec.preset、未指定ならdescriptor.defaultPresetを選ぶ。
2. defaultOptionsByPresetのbaseへspec.optionsを`mergeDashboardJsonObjects`でmergeする。
3. merge後JSON budgetを検証する。
4. configSchemaでparseする。
5. parse後のtyped configだけをrendererへ渡す。

### 14.4 Built-in type予約

次のIDをbuilt-in用に予約する。

```text
core.timeseries
core.bar
core.composed
core.stat
core.gauge
core.bar-gauge
core.bullet
core.progress
core.traffic-light
core.histogram
core.heatmap
core.scatter
core.pie
core.radar
core.radial-bar
core.funnel
core.treemap
core.sunburst
core.sankey
core.state-timeline
core.status-history
core.calendar-heatmap
core.uptime-grid
core.node-graph
core.candlestick
core.table
core.pivot-table
core.key-value
observability.logs
observability.trace-waterfall
observability.flame-graph
geo.map
```

この計画で全descriptorを実装する必要はない。予約IDの重複を防ぐschema fixtureを持つ。

### 14.5 Visualization option budget

- optionsはplain JSON object。
- 最大32KiB。
- 最大depth 8。
- object key最大128。
- option schema versionはdescriptorが持つ。
- unknown optionはdescriptor側schemaを`.strict()`として拒否する。

## 15. C5: Transformation契約

### 15.1 Transformation spec

```ts
type TransformationSpecV2 = {
	id: string;
	type: string;
	disabled: boolean;
	execution: "server" | "browser";
	inputFrameRefs: string[];
	outputFrameRefId: string;
	options: DashboardJsonObject;
};
```

Rules:

- Panel内最大20件。
- IDはPanel内で一意。
- 配列順が実行順。
- disabled transformationは設定を保持したまま実行しない。
- executionはserver/browserを明示し、autoは許可しない。
- inputFrameRefsは1〜16件で、重複を拒否する。
- inputFrameRefsはquery bindingまたは先行する有効transformation outputだけを参照できる。
- outputFrameRefIdはPanel内のquery binding refIdおよび他transformation outputと重複しない。
- outputFrameRefIdを自身のinputにできない。
- 01/P1では1 transformationにつき1 output Frameへ限定する。
- disabled transformationのoutputFrameRefIdは存在しないものとして後続参照を検証する。
- type固有schemaはregistry descriptorが持つ。
- options最大16KiB。
- server executionはdescriptor.serverCapable=trueを要求する。
- browser executionはdescriptor.browserCapable=trueを要求する。

Defaults:

```text
disabled = false
execution = browser
options = {}
```

### 15.2 Transformation descriptor

```ts
type TransformationDescriptor = {
	type: string;
	displayName: string;
	description: string;
	configSchemaVersion: number;
	inputShapes: DashboardDataShape[] | ["any"];
	outputShape: DashboardDataShape | "preserve" | "dynamic";
	serverCapable: boolean;
	browserCapable: boolean;
};
```

runtime definition:

```ts
type TransformationDefinition<TConfig> = {
	descriptor: TransformationDescriptor;
	configSchema: z.ZodType<TConfig>;
};
```

definitionはAPI responseへserializeしない。

### 15.3 初期予約typeとoption contract

| Type | 必須option | 主要validation |
| --- | --- | --- |
| `core.reduce` | reducers、fields | reducerはlatest/first/min/max/average/sum/count |
| `core.rate` | field、unit | number field、unitはsecond/minute/hour |
| `core.difference` | fields、mode | absolute/percentage |
| `core.moving-average` | field、window | window 2〜500 |
| `core.cumulative-sum` | fields | number field |
| `core.group-by` | groupFields、reducers | group field 1件以上 |
| `core.sort` | by | field/direction/nulls |
| `core.limit` | count、direction | count 1〜2000、head/tail |
| `core.histogram` | field、bucket | bucket countまたはsize |
| `core.filter-fields` | include/exclude | matcher 1件以上 |
| `core.filter-rows` | conditions、operator | all/any |
| `core.rename-fields` | mappings | source重複禁止 |
| `core.calculate-field` | outputField、expression | expression AST、文字列eval禁止 |
| `core.join` | frames、keys、mode | inner/left/outer |
| `core.pivot` | rowFields、columnField、valueField | field重複禁止 |
| `core.fill-missing` | fields、mode | null/zero/previous/constant |
| `core.time-bucket` | timeField、interval、reducers | interval正数 |
| `core.threshold-to-state` | field、thresholds | threshold config必須 |

`calculate-field`は任意JavaScript文字列を受け付けない。式は後続P1で定義するJSON ASTを使う。

この表はP1で作るtype固有schemaの必須契約である。

01で実装する範囲:

- generic `TransformationSpecV2`
- generic `TransformationDescriptor`
- runtime `TransformationDefinition<TConfig>`型
- reserved type ID定数
- fake definitionを使った二段階validation fixture

01で実装しない範囲:

- `reduceTransformationOptionsSchema`などのtype固有schema
- calculate expression AST schema
- transformation execution

type固有schemaと実行アルゴリズムはP1で、この表を変更せず深掘りする。

## 16. C6: Manifest v2

### 16.1 Query binding

```ts
type PanelQueryBindingV2 = {
	refId: string;
	queryId: string;
	outputFrameRefs: string[];
	hidden: boolean;
};
```

Rules:

- 1 Panelあたり1〜8件。
- refIdはPanel内で一意。
- outputFrameRefsは1〜4件。
- outputFrameRefs内の重複を拒否する。
- query binding間でoutputFrameRefsが重複してはならない。
- 単一Frame queryは`outputFrameRefs: [refId]`を使う。
- multi-frame queryは`AN`, `AE`のような安定したFrame refIdを明示する。
- queryId重複は許可するがrefIdは分ける。
- hidden queryもTransformation入力には使える。
- public manifestにhandler、SQL、DB configを含めない。

Default:

```text
hidden = false
```

### 16.2 Layout

```ts
type PanelLayoutV2 = {
	x: number;
	y: number;
	w: number;
	h: number;
	minW: number;
	minH: number;
	maxW?: number;
	maxH?: number;
};
```

Rules:

- desktopは12 column。
- `x + w <= 12`。
- `1 <= minW <= w`。
- maxWがある場合`w <= maxW <= 12`。
- `1 <= minH <= h`。
- maxHがある場合`h <= maxH <= 24`。
- x/yは0以上。
- wは1〜12。
- hは1〜24。
- default `minW=1`, `minH=1`。
- mobile layoutはmanifestへ保存しない。

### 16.3 Panel manifest

```ts
type PanelManifestV2 = {
	id: string;
	title: string;
	description: string;
	layout: PanelLayoutV2;
	queries: PanelQueryBindingV2[];
	transformations: TransformationSpecV2[];
	visualization: VisualizationSpecV2;
	accessibleLabel: string;
	links: PanelLinkV2[];
};
```

Rules:

- Panel IDはDashboard内で一意。
- query refIdはPanel内で一意。
- transformation IDはPanel内で一意。
- 全query outputFrameRefsとtransformation outputFrameRefIdを合わせて一意。
- transformation inputはquery outputFrameRefまたは先行する有効transformation outputだけを参照する。
- visualization.frameRefsはquery outputFrameRefまたは有効transformation outputだけを参照する。
- Panel linksは最大10件。
- `accessibleLabel`は1〜256文字。
- titleは1〜128文字。
- descriptionは最大512文字。
- Visualization内部のfield linksとPanel footer linksを区別する。

Defaults:

```text
description = ""
transformations = []
links = []
```

### 16.4 Dashboard manifest

```ts
type DashboardManifestV2 = {
	schemaVersion: 2;
	revision: number;
	id: string;
	title: string;
	description: string;
	layoutVersion: number;
	defaultRange: DashboardRangeV2;
	defaultTimezone: string;
	defaultRefreshSeconds: number;
	variables: VariableManifestV2[];
	panels: PanelManifestV2[];
	inspectorEnabled: boolean;
};
```

Versionの意味:

- `schemaVersion`: contract format。常に2。
- `revision`: Dashboard定義内容のrevision。1以上。
- `layoutVersion`: localStorage layout invalidation用。1以上。

Increment rules:

- title、variables、queries、transformations、Visualization設定などmanifestの意味が変わったらrevisionを増やす。
- default layout、panel ID、layout constraintが変わり保存済みlayoutを無効化すべき場合だけlayoutVersionを増やす。
- schemaVersionは共有contract migration時だけ変更する。
- revision/layoutVersionはtimestampから自動生成せず、code-defined整数として管理する。

Rules:

- titleは1〜128文字。
- descriptionは最大512文字。
- panel 1〜50件。
- variable 0〜20件。
- defaultRefreshSecondsは0〜3,600。
- panel / variable IDはDashboard内で一意。
- query bindingが参照するqueryIdの存在確認はServer registryで行う。
- timezoneの実在性確認はServer registryで行う。
- static option本体はpublic manifestから除去する。

Defaults:

```text
defaultRefreshSeconds = 0
variables = []
inspectorEnabled = true
```

### 16.5 Variable v2

v1 shapeを基本的に維持し、次を正本とする。

```ts
type VariableManifestV2 = {
	id: string;
	label: string;
	description?: string;
	selection: "single" | "multiple";
	required: boolean;
	defaultValues: string[];
	dependsOn: string[];
	source:
		| {
				kind: "static";
				options: VariableOptionV2[];
		  }
		| {
				kind: "query";
				queryId: string;
		  };
};

type VariableOptionV2 = {
	value: string;
	label: string;
	disabled: boolean;
};
```

Defaults:

```text
required = false
defaultValues = []
dependsOn = []
disabled = false
```

Rules:

- labelは1〜128文字。
- descriptionは最大512文字。
- option valueは1〜128文字。
- option labelは1〜128文字。
- option valueはsource内で一意。
- static sourceは最大`DASHBOARD_V2_LIMITS.maxStaticVariableOptions`件。
- `includeAll`はまだ追加しない。
- public manifestではstatic options本体を除去する。

required/default/dependency ruleはv1を維持する。

具体的には:

- single variableのdefaultValuesは0〜1件。
- required singleはdefaultを1件持つ。
- multiple variableは最大50件。
- required multipleはdefaultを1件以上持つ。
- defaultValues内の重複を拒否する。
- static sourceのdefaultは全てoptionsに存在する。
- query sourceのdefault存在確認はoptions取得後に行う。
- dependsOnは同一Dashboard内の先行variableだけを参照する。
- self reference、unknown dependency、cycleを拒否する。
- query options handlerにはdependsOnで宣言したfilterだけをdependency inputとして渡す。

## 17. C6: Transport v2

### 17.1 Query request

```ts
type PanelQueryRequestV2 = {
	schemaVersion: 2;
	range: DashboardRangeV2;
	timezone: string;
	filters: DashboardFiltersV2;
	maxDataPoints: number;
	maxRows: number;
};
```

Defaults:

```text
maxDataPoints = 800
maxRows = 2000
filters = {}
```

`maxDataPoints`はtime-based queryのbucket上限、`maxRows`はtable/log等のrow上限である。

Rules:

- schemaVersionは2。
- maxDataPointsは1〜2,000の整数。
- maxRowsは1〜2,000の整数。
- range/timezone/filterはC2のv2 schemaを再利用する。

### 17.2 Structured notice

```ts
type DashboardNoticeV2 = {
	severity: "info" | "warning";
	code: string;
	message: string;
	frameRefId?: string;
	fieldKey?: string;
};
```

codeは`^[A-Z][A-Z0-9_]*$`、最大64文字。

- messageは1〜512文字。
- frameRefIdはv2 frame refId。
- fieldKeyはv2 field key。
- response内最大`DASHBOARD_V2_LIMITS.maxNotices`件。

### 17.3 Data state

```ts
type PanelDataStateV2 = {
	emptyReason?:
		| "no-records"
		| "filter-no-match"
		| "not-configured";
	partial: boolean;
	truncated: boolean;
	notices: DashboardNoticeV2[];
	dataThrough?: string;
	staleAfterMs?: number;
};
```

Rules:

- 全Frameが0 rowならemptyReason必須。
- 1件以上のFrameにrowがある場合はemptyReasonを拒否する。
- partial=trueならwarning notice必須。
- truncated=trueなら`DATA_TRUNCATED` warning必須。
- silent truncationは禁止。
- dataThroughはoffset付きISO datetime。
- staleAfterMsは正整数。
- incompatible visualizationはquery data stateではなく、Frontend registryが導出するrender stateである。

Defaults:

```text
partial = false
truncated = false
notices = []
```

### 17.4 Counts

```ts
type PanelQueryCountsV2 = {
	frames: number;
	fields: number;
	rows: number;
	cells: number;
};
```

CountsはBackend normalizerが算出し、handler入力を信用しない。

- 全fieldはnonnegative integer。
- framesはFrame数。
- fieldsは全Frameのfield数合計。
- rowsは全Frameのrow数合計。同じquery由来でもFrameごとに加算する。
- cellsは全Frameの`fieldCount * rowCount`合計。
- v1のseriesCountに相当する値はData Frame共通countへ含めない。必要なVisualizationがroleから算出する。

### 17.5 Query response

```ts
type PanelQueryResponseV2 = {
	schemaVersion: 2;
	requestId: string;
	generatedAt: string;
	resolvedRange: {
		from: string;
		to: string;
	};
	intervalMs?: number;
	durationMs: number;
	counts: PanelQueryCountsV2;
	state: PanelDataStateV2;
	frames: DashboardDataFrameV2[];
};
```

Rules:

- requestIdはUUID。
- datetimeはoffset必須。
- resolvedRangeは`from < to`。
- intervalMsはtime bucketを使用した場合だけ返し、正整数。
- durationMsはnonnegative integer。
- framesは1〜16件。empty responseでも0件にせず、0 row Frameを返す。
- countsはframes実体と一致する。
- response全体cell budgetを超えたらerror。

### 17.6 Manifest transport

```ts
type PublicVariableManifestV2 = Omit<VariableManifestV2, "source"> & {
	source:
		| { kind: "static" }
		| { kind: "query"; queryId: string };
};

type PublicDashboardManifestV2 = Omit<
	DashboardManifestV2,
	"variables"
> & {
	variables: PublicVariableManifestV2[];
};
```

Rules:

- static sourceからoptions本体を除去する。
- query sourceはqueryIdを保持する。
- public変換後に`publicDashboardManifestV2Schema`で再parseする。
- function、handler、DB情報はどのsourceにも含めない。

### 17.7 Variable options transport

```ts
type VariableOptionsRequestV2 = {
	schemaVersion: 2;
	range: DashboardRangeV2;
	timezone: string;
	filters: DashboardFiltersV2;
};

type VariableOptionsResponseV2 = {
	schemaVersion: 2;
	variableId: string;
	options: VariableOptionV2[];
};
```

Rules:

- filters default `{}`。
- option最大`DASHBOARD_V2_LIMITS.maxVariableOptions`件。Dashboard manifestのstatic埋め込み上限とは分ける。
- duplicate option valueを拒否する。
- response orderはBackend registryがlabel/value順へ安定化する。

### 17.8 Version detection

同一API pathでv1/v2を移行できるよう、payload version検出を共通化する。

```ts
detectDashboardPayloadVersion(value: unknown): 1 | 2
```

Rules:

- plain objectで`schemaVersion === 2`ならv2。
- `schemaVersion` fieldがなければv1候補。
- `schemaVersion === 1`は明示v1として許可してよいが、v1 schema自体へfieldを追加しない。
- 1/2以外は`SCHEMA_VERSION_UNSUPPORTED`。
- v1候補は必ずv1 schemaでもparseする。field欠落だけでv1扱いして信用しない。

次のany-version schema/helperをexportする。

```text
dashboardManifestAnyVersionSchema
panelQueryRequestAnyVersionSchema
panelQueryResponseAnyVersionSchema
variableOptionsRequestAnyVersionSchema
variableOptionsResponseAnyVersionSchema
```

parse結果はversionを判別できるdiscriminated wrapperへする。

```ts
type VersionedPayload<TV1, TV2> =
	| { version: 1; value: TV1 }
	| { version: 2; value: TV2 };
```

### 17.9 Error

v1 error envelopeを維持し、v2 codeを追加する。

```text
SCHEMA_VERSION_UNSUPPORTED
PANEL_TIMEOUT
FRAME_LIMIT_EXCEEDED
FIELD_LIMIT_EXCEEDED
CELL_LIMIT_EXCEEDED
VISUALIZATION_NOT_REGISTERED
VISUALIZATION_CONFIG_INVALID
INCOMPATIBLE_VISUALIZATION
TRANSFORMATION_NOT_REGISTERED
TRANSFORMATION_CONFIG_INVALID
TRANSFORMATION_FAILED
INVALID_DATA_FRAME
INVALID_JSON_VALUE
```

HTTP mapping:

| Code | HTTP | retryable |
| --- | ---: | --- |
| schema/config/compatibility invalid | 400 | false |
| not registered in code-defined manifest | startup error、runtimeなら500 | false |
| frame/field/cell limit | 422 | false |
| transformation failed due to data | 422 | false |
| panel timeout | 504 | true |
| handler/query infrastructure failure | 500/504 | error policyに従う |

Error `details`へ許可する値もDashboard JSON valueに限定し、secretを含めない。

- messageは1〜512文字。
- requestIdはUUID。
- retryableはboolean。
- detailsはplain JSON object、最大`DASHBOARD_V2_LIMITS.maxErrorDetailsBytes`。

v1 unversioned error schemaを変更せず、次を追加する。

```ts
dashboardErrorCodeV2Schema
dashboardErrorResponseV2Schema
```

`PANEL_TIMEOUT`はv2で追加する。個別query/variable handlerのtimeoutは既存
`HANDLER_TIMEOUT`、Panel全体のdeadline超過は`PANEL_TIMEOUT`、caller切断は
`REQUEST_CANCELLED`として区別する。

v2 error envelopeも既存client互換のため外形を維持する。

```ts
{
	error: {
		code,
		message,
		requestId,
		retryable,
		details?,
	}
}
```

## 18. C7: v1 compatibility

### 18.1 原則

- v1 handlerとUIをこの計画中に削除しない。
- migrationは決定的でなければならない。
- input objectをmutationしない。
- warningが必要な変換はstructured noticeを返す。
- v1で表現できないv2設定をv1へ逆変換しない。
- helperの入口で対応するv1 schemaをparseする。
- sort、gap fill、aggregation、duplicate timestamp修正を行わない。
- v1 normalizerが保証する意味制約を暗黙に再構成しない。
- unknown series key、duplicate series key、duplicate table columnなど変換不能な入力はerrorにする。

```ts
class DashboardCompatibilityError extends Error {
	constructor(
		readonly code:
			| "INVALID_LEGACY_DATA"
			| "INVALID_LEGACY_MANIFEST"
			| "NOTICE_LIMIT_EXCEEDED",
		message: string,
		readonly path?: Array<string | number>,
	) {
		super(message);
		this.name = "DashboardCompatibilityError";
	}
}
```

このerrorをpublic exportする。

### 18.2 helper

```ts
legacyPanelDataToFrames(
	data: PanelData,
	options: {
		refId: string;
		queryRefId?: string;
		frameName: string;
	},
): {
	frames: DashboardDataFrameV2[];
	notices: DashboardNoticeV2[];
}
```

```ts
legacyVisualizationToV2(
	visualization: PanelVisualization,
): VisualizationSpecV2
```

```ts
legacyPanelManifestToV2(
	panel: PanelManifest,
): PanelManifestV2
```

```ts
legacyDashboardManifestToV2(
	manifest: DashboardManifest,
): DashboardManifestV2
```

```ts
legacyPublicDashboardManifestToV2(
	manifest: PublicDashboardManifest,
): PublicDashboardManifestV2
```

```ts
legacyPanelDataStateToV2(
	state: PanelDataState,
): PanelDataStateV2
```

```ts
legacyPanelQueryRequestToV2(
	request: PanelQueryRequest,
): PanelQueryRequestV2
```

```ts
legacyPanelQueryResponseToV2(
	response: PanelQueryResponse,
	options: {
		refId: string;
		queryRefId?: string;
		frameName: string;
	},
): PanelQueryResponseV2
```

```ts
legacyVariableOptionsRequestToV2(
	request: VariableOptionsRequest,
): VariableOptionsRequestV2
```

```ts
legacyVariableOptionsResponseToV2(
	response: VariableOptionsResponse,
): VariableOptionsResponseV2
```

Request / variable mapping:

- schemaVersion=2。
- range、timezone、filters、maxDataPointsを維持する。
- v1 PanelQueryRequestのmaxRowsは存在しないため2,000を補う。
- Variable options requestはrange、timezone、filtersを維持する。
- Variable options responseはvariableId/optionsを維持し、option.disabled=falseを補う。

Panel query response変換規則:

- schemaVersion=2。
- requestId、generatedAt、resolvedRange、intervalMs、durationMsを維持する。
- `legacyPanelDataToFrames`でframesを生成する。
- v1のrowCount / seriesCountは信用せず、生成後Frameからv2 countsを再計算する。
- v1 stateのwarningsは`severity: "warning"`、code=`LEGACY_WARNING`のnoticeへ変換する。
- partial、emptyReason、dataThrough、staleAfterMsを維持する。
- truncated=false。
- compatibility helper自身が追加したnoticeをstate.noticesへ後置する。
- notice orderはv1 warnings、compatibility noticeの順で安定させる。
- compatibility noticeはcodeごとに最大1件へ集約する。
- 全noticeが`DASHBOARD_V2_LIMITS.maxNotices`を超える場合は変換を失敗させる。noticeを暗黙に捨てない。

### 18.3 timeseries変換

Input:

```text
series metadata
rows[{time, values}]
```

Output:

- time field:
  - key=`time`
  - type=`time`
  - roles=`["time"]`
- seriesごとにnumber field:
  - key=series.key
  - type=`number`
  - roles=`["value"]`
  - label/configはseries metadataから変換
- series定義順に旧key→v2 key mapを作り、row.valuesは旧keyから読み、新keyへ書く。
- metadataに存在しないrow value keyは`INVALID_LEGACY_DATA`。
- metadataにあるがrowにないvalueはnull。
- series.unitをFieldUnitへ変換し、series.decimalPlacesをfield config decimalsへ設定する。
- series.colorTokenがある場合だけfield configへfixed colorとして設定する。未指定時はcolor propertyを省略する。
- row順はinput順を維持する。sortはnormalizer責務。
- missing series valueはnull。
- refIdは指定値。
- sourceは`{ kind: "query", refId: options.queryRefId ?? options.refId }`。
- shapeHint=`timeseries`。

### 18.3.1 legacy field key変換

v1 series key / table column keyはv2より緩いため、次のhelperを使う。

```ts
legacyFieldKeyToV2(
	key: string,
	usedKeys: Set<string>,
): {
	key: string;
	sanitized: boolean;
}
```

Algorithm:

1. 前後空白を除去する。
2. `[A-Za-z0-9_.:-]`以外の連続文字を`_`へ置換する。
3. 先頭が`[A-Za-z_]`でなければ`_`を付ける。
4. 連続する`_`を1つへまとめる。
5. 空になった場合は`field`とする。
6. 最大80文字へ切り詰める。
7. usedKeysと衝突した場合は`_2`, `_3`を末尾へ付ける。suffix込みで80文字以内に切り詰める。
8. 元keyと異なる場合はsanitized=true。

変換後keyは同じinput順とusedKeysに対して常に同じになること。

1 response内のsanitize noticeはfieldごとに増やさず、次の1件へ集約する。

```text
code=LEGACY_FIELD_KEYS_SANITIZED
message="<count> legacy field keys were sanitized."
```

元keyはfield labelまたは既存series/column labelへ残し、noticeへ全keyを列挙しない。

### 18.4 category変換

- category field:
  - key=`category`
  - type=`string`
  - roles=`["category"]`
- seriesごとにnumber value field。
- shapeHint=`category`。

### 18.5 stat変換

valueが非nullなら1 row Frame、nullなら0 row Frameへ変換する。

```text
value: number field、role=value
previous: 存在する場合number field
delta: 存在する場合number field
```

- series metadataがある場合、value fieldのkey/label/configへ使う。
- series metadataがない場合、value fieldはkey=`value`、label=`Value`。
- previous/delta fieldはkey=`previous` / `delta`を使い、衝突時はlegacy key変換のsuffix規則を使う。
- value nullの場合、field metadataは作るが全field valuesを空配列にする。
- shapeHint=`scalar`。
- empty判定はresponse stateで行う。

### 18.6 table変換

columnごとにfieldを作る。

Physical type inference:

1. nullを除外する。
2. 非null値が0件ならstring fieldとする。
3. 全値が同じprimitive typeなら対応type。
4. number/string等が混在する場合はstringへ変換する。
5. mixed変換時は`LEGACY_MIXED_COLUMN_COERCED` noticeを追加する。

Rules:

- numberはfiniteであることを再確認する。
- booleanは`"true"`へ変換せずbooleanを維持する。
- mixed string化ではnullをnullのまま維持する。
- table columnのunit/decimalPlacesをfield configへ変換する。
- table columnのalignをfield configのtextAlignへ変換する。
- shapeHint=`table`。

mixed columnが複数あってもnoticeは1件へ集約し、messageへ件数だけを含める。

### 18.7 visualization変換

| v1 type | v2 type | preset |
| --- | --- | --- |
| line | `core.timeseries` | `line` |
| area | `core.timeseries` | `area` |
| bar | `core.bar` | `vertical` |
| stat | `core.stat` | `value` |
| table | `core.table` | `table` |

Mapping:

- frameRefs=`["A"]`。
- unit string -> FieldUnit。既知suffixを認識し、不明ならcustom。
- decimalPlaces -> decimals。
- thresholds -> v2 absolute threshold。baseline stepを先頭へ追加する。
- valueMappings -> v2 mapping。
- referenceLines -> Visualization options。
- fill/connectNulls/yAxisScale/yAxisMin/yAxisMax/showLegend -> type固有options。
- legacyVisualizationToV2ではfieldConfig.linksを空にする。
- v1 visualization.linksはlegacyPanelManifestToV2がPanelManifestV2.linksへ移す。現在のfooter placementを変えない。
- v1 field source `key` -> v2 `fieldKey`。
- v1 filter source `key` -> v2 `variableId`、format=`comma`。
- v1 constant sourceは値を維持する。

Unit migration table:

| v1 unit | v2 |
| --- | --- |
| `""` | `{ kind: "none" }` |
| `%` | `{ kind: "percent", scale: "hundred" }` |
| `ns/us/ms/s/m/h/d` | `{ kind: "duration", unit }` |
| `B` | `{ kind: "bytes", base: 1000 }` |
| `bytes` | `{ kind: "bytes", base: 1024 }` |
| `*/s`形式 | `{ kind: "rate", suffix: original }` |
| その他 | `{ kind: "custom", suffix: original }` |

Threshold migration:

- baseline stepとして`{ value: null, colorToken: "--color-muted" }`を追加する。
- v1 thresholdを順序維持で後続stepへ変換する。
- v1 thresholdが空ならv2 thresholds自体を省略する。

### 18.8 manifest変換

- schemaVersion=2。
- revision=1。
- layoutVersionは維持。
- panel.queryId -> `queries: [{ refId: "A", queryId, outputFrameRefs: ["A"], hidden: false }]`。
- transformations=[]。
- visualization.frameRefs=`["A"]`。
- panel.visualization.links -> panel.links。
- layout minW=1/minH=1を補う。
- variableはv2 shapeへcopy。
- static public options除去規則を維持する。

### 18.9 compatibility test

最低fixture:

- multi-series timeseries with null
- category with 2 series
- stat with previous/delta
- stat null
- homogeneous table
- mixed table
- all-null table column
- invalid-for-v2 legacy field key
- sanitized key collision
- all 5 visualization types
- thresholds / mappings / links
- full demo manifest
- full v1 panel query response
- warningsからstructured noticesへの変換
- any-version detection

全fixtureでinput mutationがないことを確認する。

## 19. C8: public export

### 19.1 v1 export

unversioned名はv1を指し続ける。

```ts
export {
	panelDataSchema,
	panelManifestSchema,
	panelQueryResponseSchema,
	// ...
} from "./legacy-v1.schema";
```

### 19.2 v2 export

v2は名前から判別できるようにする。

Common:

```text
DASHBOARD_SCHEMA_VERSION_V1
DASHBOARD_SCHEMA_VERSION_V2
DASHBOARD_V2_LIMITS
dashboardSchemaVersionSchema
dashboardIdSchema
dashboardPanelIdSchemaV2
dashboardVariableIdSchema
dashboardQueryIdSchema
dashboardTransformationInstanceIdSchema
dashboardVisualizationTypeIdSchema
dashboardPresetIdSchema
dashboardFrameRefIdSchema
dashboardFieldKeySchema
dashboardRangeV2Schema
dashboardFiltersV2Schema
dashboardTimezoneV2Schema
dashboardJsonValueSchema
dashboardJsonObjectSchema
validateDashboardJsonValue
mergeDashboardJsonObjects
detectDashboardPayloadVersion
```

Field / Frame:

```text
dashboardColorTokenSchema
fieldUnitV2Schema
thresholdConfigV2Schema
valueMappingV2Schema
standardFieldConfigV2Schema
standardFieldConfigPatchV2Schema
resolveEffectiveFieldConfig
fieldMatcherV2Schema
fieldOverrideV2Schema
panelLinkV2Schema
dashboardFieldTypeSchema
dashboardFieldRoleSchema
dashboardFieldV2Schema
dashboardDataShapeSchema
dashboardFrameSourceV2Schema
dashboardDataFrameV2Schema
validateDashboardDataFrameShape
validatePanelFramesAgainstManifest
```

Visualization / Transformation:

```text
visualizationSpecV2Schema
visualizationPresetDescriptorSchema
visualizationCapabilitiesSchema
visualizationDescriptorSchema
transformationSpecV2Schema
transformationDescriptorSchema
RESERVED_VISUALIZATION_TYPE_IDS
RESERVED_TRANSFORMATION_TYPE_IDS
```

Manifest / Transport:

```text
variableOptionV2Schema
variableManifestV2Schema
panelQueryBindingV2Schema
panelLayoutV2Schema
panelManifestV2Schema
dashboardManifestV2Schema
publicVariableManifestV2Schema
publicDashboardManifestV2Schema
dashboardNoticeV2Schema
panelDataStateV2Schema
panelQueryCountsV2Schema
panelQueryRequestV2Schema
panelQueryResponseV2Schema
variableOptionsRequestV2Schema
variableOptionsResponseV2Schema
dashboardErrorCodeV2Schema
dashboardErrorResponseV2Schema
dashboardManifestAnyVersionSchema
panelQueryRequestAnyVersionSchema
panelQueryResponseAnyVersionSchema
variableOptionsRequestAnyVersionSchema
variableOptionsResponseAnyVersionSchema
```

Compatibility:

```text
legacyPanelDataToFrames
legacyPanelDataStateToV2
legacyFieldKeyToV2
DashboardCompatibilityError
legacyVisualizationToV2
legacyPanelManifestToV2
legacyDashboardManifestToV2
legacyPublicDashboardManifestToV2
legacyPanelQueryRequestToV2
legacyPanelQueryResponseToV2
legacyVariableOptionsRequestToV2
legacyVariableOptionsResponseToV2
```

対応するTypeScript型をすべてexportする。

### 19.3 import rule

consumerは引き続き次からimportする。

```ts
import { ... } from "@shared/schemas/dashboard.schema";
```

内部moduleへのdeep importはshared schema自身のtest以外では禁止する。

## 20. C9: Backend prerequisite contract addendum

C0〜C8実装後のBackend / Frontend runtime設計レビューで、shared transportと
compatibility helperへ追加で必要な契約が3点判明した。runtime側へprivateな
代替schemaやlegacy専用例外を作らず、C9で共有契約を追補する。

### C9.1 Query output Frame宣言

`PanelQueryBindingV2`へ次を追加する。

```ts
outputFrameRefs: string[];
```

Schema / semantic rules:

- 1〜4件。
- binding内で一意。
- Panel内の全bindingを通して一意。
- query `refId`自体の一意性も従来通り維持する。
- 単一Frame queryのdefaultを暗黙追加しない。callerは`[refId]`を明示する。
- transformation inputとvisualization frameRefsは、query `refId`ではなく
  全`outputFrameRefs`をavailable Frame集合として検証する。
- transformation outputとのcollisionも全`outputFrameRefs`に対して検証する。

Compatibility:

```ts
legacy panel -> {
	refId: "A",
	queryId,
	outputFrameRefs: ["A"],
	hidden: false,
}
```

fixture、compatibility helper、public manifest schemaを同時に更新する。

### C9.2 Panel timeout error

`dashboardErrorCodeV2Schema`はv1 codeを全て含んだ上で、v2追加codeと
`PANEL_TIMEOUT`を受け付ける。

- 個別query/variable deadlineは`HANDLER_TIMEOUT`。
- Panel全体deadlineは`PANEL_TIMEOUT`。
- caller abortは`REQUEST_CANCELLED`。
- `PANEL_TIMEOUT`はHTTP 504、`retryable=true`をBackend計画の正本とする。
- `DASHBOARD_NOT_FOUND`、`PANEL_NOT_FOUND`、`VARIABLE_NOT_FOUND`、
  `EXECUTION_LIMIT_REACHED`、`INVALID_HANDLER_RESULT`など既存v1 codeもv2 envelopeで
  parseできなければならない。
- `dashboardErrorCodeSchema`自体へv2 codeを追加してはならない。

### C9.3 Legacy Visualization option正規化

`legacyVisualizationToV2()`は全Visualizationへ同じchart optionsを渡さず、typeごとに
必要なoptionsだけを出力する。

| Legacy | v2 type/preset | options |
| --- | --- | --- |
| line | core.timeseries / line | showLegend、connectNulls、axis、referenceLines |
| area | core.timeseries / area | showLegend、connectNulls、axis、referenceLines |
| bar | core.bar / vertical | showLegend、axis、referenceLines |
| stat | core.stat / value | `{}` |
| table | core.table / table | `{}` |

`fill`はv1 Backend normalization時点で適用済みなのでv2 renderer optionへ移さない。
threshold、value mapping、unit、decimalsは従来通り`fieldConfig`へ移す。

### C9.4 Test

最低限追加する。

- 1/4 output Frame binding
- empty、5件、binding内duplicate rejection
- binding間output collision
- transformation output collision
- transformation input / visualization refがoutputFrameRefsを参照可能
- undeclared query refの参照拒否
- legacy manifest migrationが`outputFrameRefs:["A"]`
- `PANEL_TIMEOUT` error response parse
- v1 error codeをv2 error envelopeでparse
- v1 error schemaへ`PANEL_TIMEOUT`が混入しない
- legacy Stat/Table optionsが空object
- legacy Timeseries/Bar optionsがtype固有shape
- public barrel export / no deep import

### C9.5 完了gate

```bash
bunx vitest run \
  shared/schemas/dashboard/manifest-v2.schema.test.ts \
  shared/schemas/dashboard/transport-v2.schema.test.ts \
  shared/schemas/dashboard/compatibility.test.ts \
  shared/schemas/dashboard.schema.test.ts
bunx tsc --noEmit
bun run verify
bun run verify:dashboard-coverage
git diff --check
```

C9完了後にだけ02 Backend B0を開始する。

## 21. Registry validation boundary

共有schemaだけでは、Visualization / Transformationの`options`を最終確定できない。

後続runtimeは必ず次のAPIを実装する。

```ts
parseVisualizationSpec(
	spec: VisualizationSpecV2,
	registry: VisualizationRegistry,
): ParsedVisualizationSpec
```

```ts
parseTransformationSpec(
	spec: TransformationSpecV2,
	registry: TransformationRegistry,
): ParsedTransformationSpec
```

この計画ではruntime registryを実装しないが、definition型と二段階validation fixtureを用意する。

test用fake definition:

```text
type=core.timeseries
presets=line/area/step
options={showLegend:boolean, connectNulls:boolean}
supportedShapes=timeseries
```

検証scenario:

- valid options成功
- unknown option失敗
- unknown preset失敗
- unknown typeをtransport schemaは受理
- code-defined registry validationはunknown typeを拒否
- incompatible shapeを検出

## 22. Test fixture方針

### 21.1 Factory

`test-fixtures.ts`へ次を作る。

```text
createNumberField
createTimeField
createStringField
createBooleanField
createDataFrame
createTimeseriesFrame
createCategoryFrame
createTableFrame
createPanelManifestV2
createDashboardManifestV2
createPanelQueryResponseV2
createLegacyPanelDataFixtures
```

Factoryはvalid defaultを返し、testごとにpartial overrideできる。

### 21.2 禁止

- 1行の巨大manifest literal
- snapshotだけでschemaを検証するtest
- `as any`でinvalid fixtureを作る
- production schemaをtest都合で`.passthrough()`にする
- random値に依存するtest

### 21.3 Boundary matrix

各limitで最低限次を確認する。

- max-1
- max
- max+1
- 0
- negative
- non-integer

該当しない型では無理に全組み合わせを増やさない。

## 23. 必須test matrix

### 22.1 Common / JSON

- ID pattern
- namespace type ID
- frame refId
- field key
- finite number
- ISO offset datetime
- JSON primitive / object / array
- invalid object type
- unknown fixed-shape property
- forbidden key
- depth / keys / items / bytes
- circular reference

### 22.2 Field config

- unit全variant
- decimals auto / 0 / 8 / 9
- min/max
- fixed / palette color
- threshold baseline
- threshold sort / duplicate
- percentage range
- value/range/null mapping
- override matcher
- invalid regex
- empty override properties
- same-origin link
- effective config precedence
- array replacement rather than concatenation
- multiple matching overrides with later-wins behavior
- input immutability

### 22.3 Data Frame

- physical field全4種
- semantic role compatibility
- duplicate role
- duplicate field key
- unequal values length
- 0 row
- finite / safe integer
- string length
- frame / field / row / cell limit
- response total cell limit
- duplicate refId
- query / transformation source
- sourceがmanifestに存在すること
- shape minimum requirements
- range-band timeseries
- histogram bin fields
- five-number summary

### 22.4 Visualization / Transformation

- envelope defaults
- option JSON budget
- descriptor round-trip
- defaultPreset existence
- preset default options coverage
- preset/options merge and final config parse
- reserved ID uniqueness
- duplicate transformation instance ID
- max transformation count
- execution capability mismatch
- two-stage validation fixture

### 22.5 Manifest / Transport

- representative Dashboard v2
- duplicate panel / variable / refId / transformation ID
- duplicate/undeclared query outputFrameRefs
- transformation forward/self reference
- transformation output collision
- disabled transformation output reference
- visualization frameRefs validity
- layout x+w
- layout min/max
- public static source
- query request defaults
- variable options v2 request/response
- any-version wrapper
- any-version panel/variable request
- response count consistency
- empty state
- partial notice
- truncated notice
- unsupported schema version
- v2 error codes

### 22.6 Compatibility

- PanelData全4種
- Visualization全5種
- full demo manifest
- full public demo manifest
- v1 panel/variable request
- v1 variable options response
- full panel query response
- mixed table notice
- no input mutation
- deterministic output

## 24. 実行手順

Lunaは各turnで次を実行する。

### 23.1 開始時

```bash
git branch --show-current
git status --short
sed -n '1,260p' docs/dashboard-overlay/01-contracts.md
sed -n '1,220p' docs/dashboard-overlay/progress.md
```

文書が長いため、対象WPの節も必ず個別に読む。冒頭だけ読んで実装を開始しない。

### 23.2 WP開始

進捗台帳へ記録する。

```text
Contract plan: 01
Work package: Cx
Status: in_progress
Started at:
Baseline command:
Planned files:
```

### 23.3 実装中

- `rg`で既存export consumerを確認してから移動する。
- 1つのWPで無関係なBackend / Frontendを変更しない。
- schemaのdefaultはtestで明示する。
- Zod `.superRefine()`のerror pathを具体的にする。
- invalid dataをsilent normalizeしない。
- compatibility helperだけは明記された決定的変換を行う。

### 23.4 WP完了

対象test、typecheck、diff checkを実行し、結果を台帳へ記録する。

```text
Files changed:
Commands:
Verification:
Known issues:
Next command:
Completed at:
```

## 25. Work Package別command

### C0

```bash
bunx vitest run shared/schemas/dashboard.schema.test.ts
bunx tsc --noEmit
```

### C1

```bash
bunx vitest run shared/schemas/dashboard.schema.test.ts
bun run verify
```

### C2

```bash
bunx vitest run \
  shared/schemas/dashboard/common.schema.test.ts \
  shared/schemas/dashboard/json-value.schema.test.ts
bunx tsc --noEmit
```

### C3

```bash
bunx vitest run shared/schemas/dashboard/field-config.schema.test.ts
bunx tsc --noEmit
```

### C4

```bash
bunx vitest run \
  shared/schemas/dashboard/data-frame.schema.test.ts \
  shared/schemas/dashboard/field-config-resolution.test.ts
bunx tsc --noEmit
```

### C5

```bash
bunx vitest run \
  shared/schemas/dashboard/visualization.schema.test.ts \
  shared/schemas/dashboard/transformation.schema.test.ts
bunx tsc --noEmit
```

### C6

```bash
bunx vitest run \
  shared/schemas/dashboard/manifest-v2.schema.test.ts \
  shared/schemas/dashboard/transport-v2.schema.test.ts
bunx tsc --noEmit
```

### C7

```bash
bunx vitest run shared/schemas/dashboard/compatibility.test.ts
bunx tsc --noEmit
```

### C8

```bash
bunx vitest run shared/schemas/dashboard
bunx vitest run shared/schemas/dashboard.schema.test.ts
bun run verify
bun run verify:dashboard-coverage
bun run verify:e2e
bun run verify:dashboard-bundle
rg -n 'schemas/dashboard/' api web scripts tests shared \
  --glob '!shared/schemas/dashboard/**'
git diff --check
```

共有契約しか変更していなくても、C8では既存Dashboard全体のgateを通す。v1 compatibilityを証明するためである。

上記`rg`はconsumerのdeep importが0件で成功条件とする。0件時のexit code 1は「違反なし」なので、実行結果を台帳へ明記し、verify失敗とは扱わない。

### C9

```bash
bunx vitest run \
  shared/schemas/dashboard/manifest-v2.schema.test.ts \
  shared/schemas/dashboard/transport-v2.schema.test.ts \
  shared/schemas/dashboard/compatibility.test.ts \
  shared/schemas/dashboard.schema.test.ts
bunx tsc --noEmit
bun run verify
bun run verify:dashboard-coverage
git diff --check
```

## 26. Stop条件

次の場合だけ停止してユーザー判断を求める。

- v1 exportを維持したままv2を追加できない循環依存が発生した。
- Zod以外のruntime dependencyが必須になった。
- Data Frameで表現できない、コンセプト上必須のデータ形状が見つかった。
- v1→v2変換が非決定的になり、データ損失方針を一意に決められない。
- security contractを弱めないとJSON optionやlinkを扱えない。
- ユーザー所有の未コミット変更と同じschema行を大規模に変更する必要がある。

停止しない例:

- test追加に時間がかかる。
- TypeScript inferenceが複雑。
- Zod schemaが長くなる。
- 既存formatterが新unitをまだ表示できない。
- Backend / Frontendがまだv2を使用していない。

## 27. 完了条件

すべて満たした場合だけ01を完了とする。

- [ ] C0〜C9が全てcomplete。
- [ ] v1 characterization testがある。
- [ ] v1 exportとimport pathが維持されている。
- [ ] v2 common primitiveとlimitが実装されている。
- [ ] JSON valueとbudget validationが実装されている。
- [ ] Field Configuration、Threshold、Mapping、Override、Link v2が実装されている。
- [ ] Data Frameとphysical type / semantic roleが実装されている。
- [ ] shape minimum requirementsがtestされている。
- [ ] Visualization spec / descriptorが実装されている。
- [ ] Transformation spec / descriptorが実装されている。
- [ ] Manifest v2とTransport v2が実装されている。
- [ ] query bindingが1〜4件のoutputFrameRefsを宣言できる。
- [ ] query/transformation output Frame ref collisionが共有schemaで拒否される。
- [ ] v2 error codeが追加されている。
- [ ] `PANEL_TIMEOUT`がv1 error schemaを変えずv2へ追加されている。
- [ ] v1 PanelData全4種をData Frameへ変換できる。
- [ ] v1 Visualization全5種をv2へ変換できる。
- [ ] full demo manifest migration testが成功する。
- [ ] public manifest、panel request/response、variable request/responseをv2へ変換できる。
- [ ] input mutationがない。
- [ ] reserved type IDに重複がない。
- [ ] target unit testが成功する。
- [ ] `bun run verify`が成功する。
- [ ] `bun run verify:dashboard-coverage`が成功する。
- [ ] `bun run verify:e2e`が成功する。
- [ ] `bun run verify:dashboard-bundle`が成功する。
- [ ] `git diff --check`が成功する。
- [ ] 進捗台帳へfiles、commands、結果、次計画が記録されている。

## 28. 次計画へ渡す成果

C9を含む01完了後、次の計画は次を前提にしてよい。

```text
P0 runtime:
  Visualization Registry
  Transformation Registry
  v2 manifest registry validation
  Data Frame normalizer
  v1 adapter integration

P1 transformations:
  予約済みTransformation option contract
  Data Frame input/output

P2+ renderers:
  Visualization descriptor
  supportedShapes
  Field Configuration
  table fallback
```

次計画開始時にunversioned v1 exportを即削除しない。BackendとFrontendがv2へ移行し、migration gateを通した別計画でdeprecated化する。

## 29. 再開手順

中断後は次の順で再開する。

1. [00-concept.md](./00-concept.md)を読む。
2. この文書の「現在のWork Package」対象節を全文読む。
3. [progress.md](./progress.md)で最後の成功commandを確認する。
4. `git status --short`で既存変更を確認する。
5. 最後の成功commandを再実行する。
6. 最初の未完了checkboxではなく、`in_progress`のWork Packageを続ける。
7. `in_progress`がなければ最初のpending Work Packageを開始する。

C9完了後は、進捗台帳の次計画を02 Backend B0へ更新する。
