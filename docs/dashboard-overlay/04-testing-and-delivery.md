# 04: Dashboard Visualization Platform 検証・Gallery・Delivery 実装計画

## 1. 文書の位置づけ

この文書は、[00: コンセプト](./00-concept.md)のP10とP11を、Lunaが実装、検証、
variant適用判定、release準備まで完走できる粒度へ分解した正本である。

対象は「テストを増やすこと」だけではない。次を一つの品質systemとして実装する。

- Visualization Gallery
- renderer / preset conformance
- contract、Backend、Frontend、browserの回帰test
- visual regression
- accessibility regression
- bundleとbrowser performance budget
- security / privacy / resilience gate
- v1 compatibility、layout migration、variant適用matrix
- release evidence、rollback、handoff

01〜03で作った機能をもう一度別設計で作り直さない。04は、その実装を再現可能な証拠で
release可能にし、後続Visualizationが同じ品質gateへ追加される仕組みを作る。

### 1.1 開始条件

- [01: 共有契約](./01-contracts.md) C0〜C9がcomplete。
- [02: Backend](./02-backend.md) B0〜B12がcomplete。
- [03: Frontend](./03-frontend.md) F0〜F12がcomplete。
- `/dashboard`がv2 transportだけを使用する。
- `bun run verify`、focused coverage、E2E、bundle gateの直近成功記録がある。

開始条件が一つでも満たされない場合、04内で代替schema、mock-only Dashboard、暫定rendererを
作らない。未完了の正本へ戻り、そのWPを完了させる。

### 1.2 Lunaへの完了指示

現在のrepositoryではD0〜D10、05 V0〜V12、06 R0〜R13、07 K0〜K12、08 S0〜S13、D11の初回
variant matrixが完了済みである。Lunaは
[09: State Timeline・Status History・Uptime Grid・Annotations](./09-state-timeline-status-annotations.md)
T0〜T13へ進み、続いて
[10: Specialized Observability Visualization](./10-specialized-observability-visualizations.md) O0〜O18へ進む。
O18後にD11を126 preset candidateで再検証してD12へ進む。D4〜D11の既存結果は拡張前baselineとして
保持し、各拡張計画の最終quality/full packageで同等gateを再実行する。

1. [progress.md](./progress.md)で最初の`pending`を`in_progress`にする。
2. そのD packageの対象fileとtestだけを変更する。
3. package固有gateを通す。
4. 実行command、件数、結果、生成した証拠をprogressへ記録する。
5. 05→06→07→08→09→10の順に進み、10 O18後にD11を再検証する。
6. `complete`へ変更してから次へ進む。
7. D12完了前にtag、push、release公開を行わない。

`complete`は「コードを書いた」ではなく、そのpackageの必須証拠が再実行できる状態を指す。

### 1.3 正本の優先順位

競合時は次の順で解決する。

1. プロダクト境界: [00-concept.md](./00-concept.md)
2. wire contract: [01-contracts.md](./01-contracts.md)
3. Backend runtime: [02-backend.md](./02-backend.md)
4. Frontend runtime: [03-frontend.md](./03-frontend.md)
5. 検証、Gallery、release判定: この文書
6. 現在地と実行証拠: [progress.md](./progress.md)

04の都合で01〜03の公開契約を弱めない。矛盾が見つかった場合は、先に正本文書を更新し、
変更理由とmigrationを明記する。

## 2. 目的

完了時に次を保証する。

1. 現在の全Visualizationと全presetを、独立Galleryで決定的に確認できる。
2. Visualization追加時に、fixture、table fallback、a11y、visual、bundle testの追加漏れを
   machine-checkできる。
3. A1〜A8、v2 contract、Panel state、layout、lazy boundaryの回帰を層別testで検出できる。
4. pixel差分だけに依存せず、DOM意味、API連動、画像、性能を別gateで証明できる。
5. 通常route、Dashboard shell、renderer familyのbundle境界と容量を継続監視できる。
6. mainを基準に各canonical variant、`overlay/ssr`、`overlay/ssg`へ適用可能かを、
   一時worktreeで安全に判定できる。
7. release可否が担当者の記憶ではなく、version付きevidenceとchecklistで決まる。
8. rollback時にDB migrationやserver data rollbackを必要としないoverlayであることを確認する。

## 3. 完了後の状態

```text
shared Zod contracts
       │
       ├── contract / compatibility tests
       │
Backend registry ── deterministic Gallery Dashboard
       │                         │
       ├── API / abort / limit tests
       │                         ▼
Frontend registry ── Gallery route ── functional E2E
       │                         ├── visual regression
       ├── renderer harness      ├── accessibility
       └── bundle graph gate     └── performance smoke
                                      │
                                      ▼
                              release evidence
                                      │
                    variant worktrees / patch dry-run
                                      │
                                      ▼
                            release / rollback decision
```

最低限、次のcommandが存在し、役割が重複しない。

```text
bun run verify
bun run verify:dashboard-contract
bun run verify:dashboard-coverage
bun run verify:dashboard-frontend-coverage
bun run verify:dashboard-gallery
bun run verify:dashboard-e2e
bun run verify:dashboard-visual
bun run verify:dashboard-a11y
bun run verify:dashboard-performance
bun run verify:dashboard-bundle
bun run verify:dashboard-security
bun run verify:dashboard-doc-links
bun run verify:dashboard-release
```

`verify:dashboard-release`は上記を隠れて別条件で再実装しない。順に呼び、失敗commandを明示して
停止するorchestratorとする。

## 4. 対象

### 4.1 既存file

```text
package.json
playwright.config.ts
vite.config.ts
vitest.config.ts
vitest.dashboard.config.ts
vitest.dashboard-frontend.config.ts

scripts/e2e-server.ts
scripts/verify.ts
scripts/verify-dashboard-bundle.ts

tests/e2e/smoke.spec.ts

api/app/hono.ts
api/app/hono.test.ts
api/modules/dashboard/index.ts
api/modules/dashboard/v2/*
api/routes/dashboard.route.ts
api/routes/dashboard.route.test.ts

shared/schemas/dashboard/*

web/src/router.tsx
web/src/routes/dashboard-route*.tsx
web/src/domains/dashboard/v2/*
web/src/domains/dashboard/v2/visualizations/catalog.ts
web/src/styles.css

README.md
LLM_CONTEXT.md
docs/template-variant-management.md
docs/dashboard-overlay/progress.md
```

### 4.2 追加file

計画上の標準配置を次に固定する。既存命名規則と衝突する場合だけ同じ責務の近接fileへ統合する。

```text
api/modules/dashboard/v2/gallery-dashboard.ts
api/modules/dashboard/v2/gallery-dashboard.test.ts

web/src/routes/dashboard-gallery-route.tsx
web/src/routes/dashboard-gallery-route.lazy.tsx
web/src/domains/dashboard/v2/gallery/gallery-page.tsx
web/src/domains/dashboard/v2/gallery/gallery-readiness.ts
web/src/domains/dashboard/v2/gallery/gallery-readiness.test.ts

tests/e2e/auth.spec.ts
tests/e2e/showcase.spec.ts
tests/e2e/dashboard/dashboard-smoke.spec.ts
tests/e2e/dashboard/dashboard-filters.spec.ts
tests/e2e/dashboard/dashboard-layout.spec.ts
tests/e2e/dashboard/dashboard-states.spec.ts
tests/e2e/dashboard/dashboard-inspector.spec.ts
tests/e2e/dashboard/dashboard-mobile.spec.ts
tests/e2e/dashboard/dashboard-gallery.spec.ts
tests/e2e/dashboard/dashboard-helpers.ts

tests/visual/dashboard-gallery.visual.spec.ts
tests/visual/dashboard-gallery.visual.spec.ts-snapshots/*
tests/accessibility/dashboard.accessibility.spec.ts
tests/performance/dashboard.performance.spec.ts

playwright.dashboard.config.ts
playwright.visual.config.ts
playwright.accessibility.config.ts
playwright.performance.config.ts

scripts/dashboard-quality-config.ts
scripts/dashboard-bundle-budget.json
scripts/verify-dashboard-gallery.ts
scripts/verify-dashboard-gallery.test.ts
scripts/verify-dashboard-bundle.test.ts
scripts/verify-dashboard-release.ts

docs/dashboard-overlay/release-evidence.md
```

### 4.3 生成物

次はgit管理しない。

```text
coverage/
playwright-report/
test-results/
artifacts/dashboard-performance/
artifacts/dashboard-release/
dist-web/
data/e2e*.sqlite*
```

visual baseline PNGだけは仕様としてgit管理する。失敗時のactual、diff、trace、HTML reportは
生成物でありcommitしない。

### 4.4 対象外

- Core以外の新Visualization family実装
- 40種類のcatalogを04だけで埋めること
- WYSIWYG Panel editor
- external datasource plugin
- server-side Dashboard persistence
- alert、notification、on-call
- public embed
- PDF / PNG report生成
- arbitrary SQL / JavaScript
- 本番監視SLO基盤
- CI provider固有workflowの新設
- tag作成、push、GitHub Release公開

CI workflowが既に存在する場合はcommandを接続してよい。存在しない場合、localで再現可能なscriptを
先に完成させ、特定providerを必須前提にしない。

## 5. 現行実装監査

### 5.1 維持するもの

- shared v1/v2 Zod schemaとcompatibility helper
- authenticated Hono Dashboard API
- Backend limiter、timeout、AbortSignal、safe error envelope
- v2 manifest / variable / panel transport
- Frontend v2 registryとrenderer dynamic import
- Browser Transformation runtime
- generic Data Frame Table
- Field Config / Override解決
- Panel単位error boundaryとfallback
- RGL v2 layout、localStorage、mobile 1列
- Inspector sanitizeとsame-origin link
- backend / frontend focused coverage
- Vite manifestを読むbundle gate
- 期間filter、v2 transport、layout、mobile、Inspectorの既存Playwright証拠

### 5.2 解消する不足

1. `tests/e2e/smoke.spec.ts`へ認証、Dashboard、layoutが集中している。
2. 現在のE2Eはsuccess path中心で、全Panel stateを決定的に再現できない。
3. renderer / presetとGallery fixtureの1対1対応を検査する仕組みがない。
4. Visual regression baselineがない。
5. 自動accessibility scanとkeyboard-only journeyが分離されていない。
6. bundle gateはimport境界を検査するが、raw / gzip容量budgetを持たない。
7. browser上の変換budget、resize、dense fixtureの性能証拠がない。
8. production buildでInspector、secret、test hookが露出しないことを一括検査していない。
9. variant matrixは手順だけで、targetごとのevidence formatが固定されていない。
10. release判定、baseline更新、rollbackのownershipが曖昧である。
11. 現在のGallery相当画面がなく、将来renderer追加時の目視確認場所が統一されていない。
12. E2Eの既定port衝突時の扱いがcommandごとにばらつく。

### 5.3 既知baseline

D0開始時点の参考値であり、固定budgetではない。

- Backend focused coverageは80/80/80/70のthresholdを持つ。
- Frontend focused coverageは80/80/80/70のthresholdを持つ。
- 通常entry static graphにDashboard renderer dependencyはない。
- Dashboard routeから4 core rendererがdynamic importされる。
- chart rendererだけがRecharts graphへ到達する。
- stat / table rendererはRecharts graphへ到達しない。
- PlaywrightはChromium 1 project、直列、retry 0である。
- E2E serverは毎回専用SQLiteをmigration / seedして起動する。

D0ではこの値を再計測する。文書に書かれた古い件数を新しい成功証拠として転記しない。

## 6. 固定済み設計判断

実装中に次を再検討しない。

1. Galleryは`operations` Dashboardへ混ぜず、ID `visualization-gallery`の独立Dashboardにする。
2. Gallery routeは`/dashboard/gallery`とし、`/dashboard`と同じ認証境界を使う。
3. Gallery queryは決定的なin-memory fixtureで、DB schema、migration、seedを追加しない。
4. Galleryはv2 APIを実際に通す。Frontendへ巨大なmock responseを直書きしない。
5. test-only error injectionはPlaywright routeまたはinjected test runtimeで行い、公開APIへ
   `forceError`のようなparameterを追加しない。
6. Galleryは現在のcore renderer / presetだけを対象に開始し、将来の計画で追加する。
7. 全renderer typeと全presetは少なくとも1つのGallery success caseを必須とする。
8. table fallback、empty、partial、stale、truncated、errorはfamily横断scenarioとして持つ。
9. screenshot baselineはChromium、light theme、固定viewport、reduced motion、固定rangeで生成する。
10. screenshot差分でAPI semantics、keyboard操作、accessibilityを代替しない。
11. visual baselineの自動更新は禁止する。更新は専用commandとreview reasonを必要とする。
12. axe suppressionを画面全体や`.recharts-wrapper`全体へ設定しない。
13. 通常routeのinitial graphへGallery、RGL、Recharts、rendererを含めない。
14. Dashboard shell chunkへRechartsを含めない。
15. raw / gzip budgetはsource file sizeではなく、Vite manifestのtransitive graphで測る。
16. performance時刻のwall-clock絶対値だけを全環境hard gateにしない。決定的なlong task、
    transform budget、bundle budgetをhard gateとし、navigation timingは記録値にする。
17. variant検証はdetached temporary worktreeで行い、userのcurrent worktreeをswitchしない。
18. `git apply --3way`でconflictを隠さない。
19. release evidenceへsecret、cookie、token、raw SQL、response全件を保存しない。
20. Lunaは明示承認なしにcommit、tag、push、release公開をしない。

## 7. 品質モデル

### 7.1 test layer

| Layer | 証明すること | 証明しないこと |
| --- | --- | --- |
| Schema | JSON境界、version、limits、compatibility | Hono wiring、描画 |
| Pure unit | transform、formatter、layout、state priority | browser layout、network |
| Registry conformance | type/preset/config/fixture対応 | pixel品質 |
| API integration | auth、version、Zod、error、abort | React状態 |
| Component | renderer adapter、fallback、semantics | real chunk/network |
| Functional E2E | URL→API→UI、操作、persistence | 全pixel、全境界値 |
| Visual | overflow、重なり、token、欠落 | API意味、screen reader |
| Accessibility | WCAG rule、keyboard、name/role/value | デザイン好み |
| Performance | lazy graph、size、long task、upper-bound fixture | production SLO |
| Variant | patch適用とruntime差分 | 全業務queryの正しさ |

下位layerで高速かつ決定的に証明できる条件を、上位E2Eだけへ寄せない。

### 7.2 evidence key

全証拠は次のkeyで記録する。

```ts
type DashboardEvidence = {
  plan: "04";
  workPackage: `D${number}`;
  commit: string;
  branch: string;
  command: string;
  startedAt: string;
  durationMs: number;
  result: "pass" | "fail" | "blocked";
  summary: string;
  artifactPaths: string[];
};
```

`release-evidence.md`には要約だけを残す。machine generated JSONをcommitする必要はない。

### 7.3 failure classification

| Class | 例 | release |
| --- | --- | --- |
| Product regression | schema/API/render/layout不具合 | stop |
| Security regression | Inspector/secret/unsafe link露出 | stop |
| Accessibility regression | serious/critical violation、keyboard不能 | stop |
| Bundle regression | forbidden import、budget超過 | stop |
| Visual regression | 未承認diff | stop |
| Infrastructure | port占有、browser未install | rerun前に環境修復 |
| Pre-existing variant | target branch自身のbaseline failure | target rowをblocked、原因記録 |
| Flaky |同一SHAで非決定的失敗 | test隔離、原因修正までstop |

retryを増やしてflakyを隠さない。初期設定はretry 0を維持する。CIだけretryを導入する場合も、
first-attempt failureをreportし、Dashboard release gateは連続2回成功を要求する。

## 8. D0〜D12 Work Packages

| WP | 内容 | 主な完了gate |
| --- | --- | --- |
| D0 | prerequisite、baseline、差分監査 | current gates再現、baseline記録 |
| D1 | quality config、evidence、test分割基盤 | config/script unit test |
| D2 | Backend Gallery Dashboard | registry/API/gallery test |
| D3 | Frontend Gallery routeとreadiness | route/lazy/gallery E2E |
| D4 | contract / Backend conformance拡充 | schema/API/resilience matrix |
| D5 | Frontend / renderer conformance拡充 | renderer/state/table matrix |
| D6 | functional Playwright suite | dashboard E2E全journey |
| D7 | visual regression | canonical baseline pass |
| D8 | accessibility / reduced motion | axe + keyboard + mobile a11y |
| D9 | performance / bundle budget | graph、bytes、long task gate |
| D10 | security / privacy / resilience | production/security matrix |
| 05 V0〜V12 | Cartesian 18 variations | [05計画](./05-cartesian-visualizations.md)のfull gate |
| 06 R0〜R13 | non-Cartesian 18 variations | [06計画](./06-composition-relationship-hierarchy-flow.md)のfull gate |
| 07 K0〜K12 | KPI / Goal / Status 21 presets | [07計画](./07-kpi-goal-status-visualizations.md)のfull gate |
| 08 S0〜S13 | Distribution / Heatmap / Statistical 20 presets | [08計画](./08-distribution-heatmap-statistical-visualizations.md)のfull gate |
| 09 T0〜T13 | State / Uptime / Annotations | [09計画](./09-state-timeline-status-annotations.md)のfull gate |
| D11 | compatibility / variant / overlay packaging | detached worktree matrix |
| D12 | release candidate、rollback、docs、handoff | full release gateを2回成功 |

## 9. D0: prerequisiteとbaseline

### 9.1 開始時command

```bash
git branch --show-current
git rev-parse HEAD
git merge-base main HEAD
git status --short
bun --version
bun install --frozen-lockfile
```

現在のdirty worktreeはuser所有変更を含む。削除、reset、stash、checkoutしない。D0記録では
Dashboard関連差分と無関係差分を分けるが、所有権を推測して書き換えない。

### 9.2 prerequisite確認

```bash
bun run verify
bun run verify:dashboard-coverage
bun run verify:dashboard-frontend-coverage
E2E_PORT=5175 bun run verify:e2e
bun run verify:dashboard-bundle
git diff --check
```

5175も占有されている場合は空きportを選び、その値をevidenceへ記録する。固定portの失敗を
application failureとして扱わない。一方、既存serverの再利用は禁止し、毎回E2E専用DBとbuildを使う。

### 9.3 baseline inventory

次を記録する。

- branch、HEAD、mainとのmerge-base
- tracked / untracked files
- test file数、test数、coverage 4指標
- E2E test数とduration
- `dist-web/.vite/manifest.json`のentry、Dashboard shell、renderer entries
- graphごとのraw bytesとgzip bytes
- current Chromium version
- 代表viewportのDOM screenshot。baseline PNGとしてはまだcommitしない
- 既知failure、warning、port変更

### 9.4 characterization test

D1以降のrefactor前に次が既存testで証明されることを確認する。

- `/dashboard` auth redirect
- v2 Accept / `schemaVersion: 2`
- range URLとpanel request一致
- variable optionsとfilter伝播
- Chart/Table toggle
- renderer dynamic request
- unknown renderer table fallback
- layout save / reload / cancel
- mobile 1列
- Inspector sanitize

不足している場合、D0で新機能testは追加せず、一覧をD4〜D6の対象へ記録する。

### 9.5 D0完了gate

- 01〜03 completeを確認した。
- 現行full gatesを同一worktreeで再現した。
- baseline counts / coverage / bundle graphをprogressへ記録した。
- pre-existing failureがあればDashboard変更前からか切り分けた。
- D1で変更するtest infrastructure一覧が確定した。

## 10. D1: quality foundation

### 10.1 共通config

`scripts/dashboard-quality-config.ts`を単一の非UI品質設定とする。

```ts
export const dashboardQualityConfig = {
  schemaVersion: 1,
  dashboardIds: {
    demo: "operations",
    gallery: "visualization-gallery",
  },
  routes: {
    demo: "/dashboard",
    gallery: "/dashboard/gallery",
  },
  viewports: {
    desktop: { width: 1440, height: 1100 },
    tablet: { width: 834, height: 1112 },
    mobile: { width: 390, height: 844 },
  },
  visual: {
    maxDiffPixelRatio: 0.005,
    threshold: 0.15,
  },
  limits: {
    panelReadyMs: 5_000,
    transformMs: 100,
    longTaskMs: 100,
  },
} as const;
```

このfileはbrowser applicationからimportしない。test / script専用であり、通常bundleへ入れない。

### 10.2 Playwright config分割

`playwright.config.ts`を共通factoryへしてよいが、各commandのscopeを固定する。

| Config | testDir / match | 用途 |
| --- | --- | --- |
| base | `tests/e2e` | template全体 |
| dashboard | `tests/e2e/dashboard` | functional Dashboard |
| visual | `tests/visual` | screenshot |
| accessibility | `tests/accessibility` | axe / keyboard |
| performance | `tests/performance` | timing / long task |

共通条件:

- Chromium only
- `fullyParallel: false`
- `retries: 0`
- locale `en-US`
- timezone `UTC`
- color scheme `light`
- reduced motion `reduce`
- trace `retain-on-failure`
- screenshot `only-on-failure`。visual suiteのexpected screenshotは別
- E2E serverは`reuseExistingServer: false`
- portは`E2E_PORT`で上書き可能

### 10.3 E2E helper

`dashboard-helpers.ts`には次だけを置く。

```ts
loginAsDemoAdmin(page, redirect)
openDashboard(page, options)
waitForDashboardReady(page)
getPanel(page, accessibleName)
readPanelBoxes(page)
expectNoPanelOverlap(page)
fixedDashboardSearch()
```

assertionを巨大helperへ隠さない。helperはnavigation、安定待ち、重複locatorだけを共通化する。

`waitForTimeout`をready条件に使わない。animation settleのための待機が必要なら、product側へ
`data-dashboard-ready` / `data-renderer-ready`を追加し、その意味をD3で固定する。

### 10.4 test分割

既存`smoke.spec.ts`から次を移す。

- public route → `auth.spec.ts` / `showcase.spec.ts`
- login/logout → `auth.spec.ts`
- Dashboard functional → `tests/e2e/dashboard/*`

移動は挙動変更ではない。元testをcopyしたまま二重実行しない。

### 10.5 package scripts

```json
{
  "verify:dashboard-contract": "bunx vitest run shared/schemas/dashboard shared/schemas/dashboard.schema.test.ts",
  "verify:dashboard-gallery": "bun scripts/verify-dashboard-gallery.ts",
  "verify:dashboard-e2e": "playwright test --config playwright.dashboard.config.ts",
  "verify:dashboard-visual": "playwright test --config playwright.visual.config.ts",
  "verify:dashboard-a11y": "playwright test --config playwright.accessibility.config.ts",
  "verify:dashboard-performance": "playwright test --config playwright.performance.config.ts",
  "verify:dashboard-release": "bun scripts/verify-dashboard-release.ts"
}
```

既存`verify:e2e`はtemplate全体のE2Eとして維持する。

### 10.6 release evidence template

`release-evidence.md`に次のsectionを作る。

```text
Candidate metadata
Prerequisite gates
Contract / Backend / Frontend coverage
Functional E2E
Visual baselines
Accessibility
Performance / bundle
Security
Compatibility / migration
Variant matrix
Known limitations
Rollback
Final decision
```

値が未実行なら`pending`と書く。予定値をpassとして書かない。

### 10.7 D1 test

- quality configのID、route、viewportがunique / positive
- release orchestratorのcommand順とfail-fast
- bundle/gallery script unit fixture
- configごとのtestMatchが重複しない
- E2E DB、report、traceがgitignore対象
- `bun run verify:e2e`が既存public/auth/Dashboard smokeを失わない

### 10.8 D1完了gate

```bash
bunx vitest run scripts/verify-dashboard-gallery.test.ts scripts/verify-dashboard-bundle.test.ts
bun run typecheck
bun run lint
bun run format:check
E2E_PORT=5175 bun run verify:e2e
git diff --check
```

## 11. D2: Backend Visualization Gallery

### 11.1 Dashboard definition

`gallery-dashboard.ts`はnative v2 `DashboardDefinitionV2`を返す。

```ts
export const GALLERY_DASHBOARD_ID = "visualization-gallery";

export type GalleryCase = {
  id: string;
  visualizationType: string;
  preset: string;
  fixture: string;
  purpose: "success" | "state" | "limit" | "field-config";
};

export const galleryCases: readonly GalleryCase[];
export const galleryDashboardV2: DashboardDefinitionV2;
```

`GalleryCase`はwire contractではない。Gallery生成とconformance script用のcode-defined metadataである。

### 11.2 初期success case

現在のcatalogに対して最低限次を作る。

| Case ID | type / preset | Frame | 必須データ |
| --- | --- | --- | --- |
| `timeseries-line` | `core.timeseries/line` | timeseries | 2 series、zero、null、threshold |
| `timeseries-area` | `core.timeseries/area` | timeseries | positive values、gap、override |
| `bar-vertical` | `core.bar/vertical` | category | positive、zero、negative、long label |
| `stat-value` | `core.stat/value` | scalar | current、delta、mapping、threshold |
| `table-default` | `core.table/table` | table | time/string/number/boolean/null/link |

正確なpreset IDは03のdefinitionを読み、catalog実装と一致させる。文書例と異なる場合、
実装側IDを正本とし、Gallery caseと文書を同時更新する。

### 11.3 family横断state case

| Case ID | state | 期待UI |
| --- | --- | --- |
| `state-empty` | frame 0 rows | stable empty panel |
| `state-partial` | `partial: true` + notice | data + Partial badge |
| `state-stale` | old `dataThrough` | data + Stale badge |
| `state-truncated` | truncated + count | data + limit notice |
| `state-multiframe` | 2 declared frames | selected frameとtable切替 |
| `state-no-value` | scalar null | mapped no-value text |

network error、retry、transformation error、unknown rendererは公開Gallery handlerで生成しない。D5/D6で
injected queryまたはnetwork interceptionを使う。

### 11.4 fixture規則

- 全timestampは固定UTC epochから生成する。
- `Math.random()`、current `Date.now()`、locale依存labelを使わない。
- query requestのabsolute rangeがある場合も値の形は変えず、time fieldだけrangeへmapしてよい。
- array、field、rowの順序を安定させる。
- raw hex colorを使わない。
- secret、email、実在host、SQLを含めない。
- limit fixtureは共有上限内で、browserをDoSしない。
- handlerはDBを読まない。
- fixtureごとの期待shapeをquery definitionへ宣言する。

### 11.5 layout

- desktop 12 columns
- success caseは2列を基本にする
- state caseは2列
- panel minimum sizeはVisualization descriptor以上
- mobileはFrontend共通transformで1列
- layout IDはcase IDと同じ

### 11.6 registration

app compositionで`operations`と`visualization-gallery`を同じDashboard moduleへ登録する。

- auth middlewareを迂回しない
- `/api/dashboards/visualization-gallery`の既存generic endpointを使う
- Gallery専用route APIを増やさない
- productionでもfixture Dashboardを登録してよいが、READMEでstarter showcase / removal pointを明記する
- Galleryを無効化する新envは追加しない

### 11.7 Backend test

- definitionがstrict v2 schemaを通る
- registry startup validationを通る
- dashboard ID、panel ID、query ID、refId unique
- 全caseのtype/preset/optionsがBackend Visualization Registryでvalid
- 全layoutがminimum size以上
- deterministic queryを2回実行して同じnormalized frame
- success caseのshape minimum
- empty / partial / stale / truncated metadata
- multi-frame declared output一致
- authなし401
- manifest v2 success
- panel query v2 success
- v1 Acceptでnative v2を要求した場合の既定error契約維持
- responseにfixture internalsやfunctionがserializeされない

### 11.8 D2完了gate

```bash
bunx vitest run api/modules/dashboard/v2/gallery-dashboard.test.ts
bunx vitest run api/routes/dashboard.route.test.ts api/app/hono.test.ts
bun run verify:dashboard-coverage
bun run typecheck
git diff --check
```

## 12. D3: Frontend Gallery route

### 12.1 generic Dashboard page抽出

現行`dashboard-page.tsx`のhard-coded `operations`とroute IDを、次のconfigへ抽出する。

```ts
type DashboardPageConfig = {
  dashboardId: string;
  routeId: "/dashboard" | "/dashboard/gallery";
  loginRedirect: string;
  kicker: string;
  gallery: boolean;
};
```

共通化する責務:

- auth state
- manifest / variables / panels
- search reconciliation
- layout restore / edit / save / cancel / reset
- Panel shell
- Inspector
- error / retry

route固有に残すもの:

- dashboard ID
- TanStack Router `from`
- login redirect
- heading kicker
- Gallery説明とcase navigation

`useSearch({from})`の型を`as`で潰さない。route componentからtyped navigate/searchをadapterとして
共通bodyへ渡す設計でもよい。

### 12.2 route

```text
/dashboard                  -> operations
/dashboard/gallery          -> visualization-gallery
```

両routeは同じ軽量search parserを使う。Gallery route自体もroute-level lazyにする。

- root routeからstatic importするのはroute definitionとsearch parserだけ
- Gallery page、Grid、Panel、rendererをstatic importしない
- Gallery routeの閲覧で必要なrendererだけdynamic import
- 通常`/`、`/login`、`/showcase` graphへGalleryを入れない

### 12.3 Gallery UI

Gallery上部に次を表示する。

- title `Visualization gallery`
- この画面がdeterministic fixture / conformance用である説明
- case category jump links
- viewport / reduced motionの注意。test値は表示しない
- Operations Dashboardへ戻るlink

Panelは通常Panel shellを使う。Gallery専用の簡易card rendererを作らない。

### 12.4 readiness contract

E2E / visualの安定待ちをproduct stateとして実装する。

Dashboard root:

```html
<main
  data-dashboard-id="visualization-gallery"
  data-dashboard-ready="true|false"
>
```

Panel root:

```html
<article
  data-panel-id="timeseries-line"
  data-panel-state="pending|success|empty|partial|stale|error|incompatible"
  data-renderer-ready="true|false"
>
```

`data-dashboard-ready=true`の条件:

1. manifest success
2. required variable reconciliation完了
3. 全enabled panel queryがpendingではない
4. 各success panelのrenderer moduleがresolve
5. layout widthが0ではない

error / empty / incompatibleはsettled stateなのでDashboard readyを妨げない。retry中はfalse。

### 12.5 accessibility

- Gallery jump navigationは`nav` + accessible name
- case categoryはheading hierarchyを壊さない
- Panelの既存accessible labelを使う
- readiness attributeはa11y表示を代替しない
- Loading / retry / errorは既存live region contractを維持

### 12.6 D3 test

- unauthenticated Galleryが`Login required`を表示する
- login linkが`/login?redirect=%2Fdashboard%2Fgallery`を保持し、login後にGalleryへ戻る
- manifest IDが`visualization-gallery`
- all case panels render
- Chart/Tableが同一frame
- Gallery routeを開く前にGallery lazy chunk requestなし
- routeを開いた後に必要renderer chunk requestあり
- readiness false→true
- error panelがあってもsettled ready
- Operations layout localStorage keyとGallery keyが分離
- mobile 1列

### 12.7 D3完了gate

```bash
bunx vitest run web/src/domains/dashboard/v2/gallery web/src/domains/dashboard/v2/layout
bun run typecheck
bun run verify:dashboard-frontend-coverage
E2E_PORT=5175 bun run verify:dashboard-e2e -- --grep "gallery"
bun run verify:dashboard-bundle
git diff --check
```

package scriptへ追加引数を通せない場合は、直接Playwright config commandを使い、progressに記録する。

D3完了後に05〜09を開始するのが現行の順序である。現在のrepositoryではD4〜D11も先に
完了したため、その証拠はbaselineとして維持する。各拡張計画の最終quality/full packageで同等gateを
再実行し、09 T13後はこの文書のD11互換性matrixを再検証する。

## 13. D4: Contract / Backend conformance

このpackageの既存完了結果は05/06前baselineである。expanded candidateについては05 V11/V12と
06 R12/R13でGallery 36 visualization presetを含むcontract/coverage/browser gateを再実行する。

### 13.1 shared schema matrix

01のtestを次の観点で監査し、抜けだけを追加する。

#### Common

- ID min/max/pattern
- finite number、NaN、Infinity
- JSON depth/key/array/string budget
- cycle rejection
- range relative/absolute boundary
- timezone format
- filter key/value/count/duplicate
- strict unknown key rejection

#### Field Configuration

- unit全variant
- decimals auto/range
- min/max relation
- threshold order/duplicate
- value mapping exact/range/null
- matcher name/type/regex/frame
- override precedence
- unsafe regex / invalid token rejection
- link target/search JSON budget

#### Data Frame

- field length一致
- refId unique
- field name unique
- nullable value
- all physical field types
- semantic role compatibility
- scalar/timeseries/category/table shape minimum
- multi-frame order/ref binding
- declared output only
- rows/fields/frame/count limits

#### Visualization / Transformation

- descriptor/config二段階validation
- preset/default options
- supported shape
- size constraint
- capability flags
- input/output ref graph
- disabled transformation
- server/browser execution boundary
- transform option budget

#### Manifest / Transport

- schemaVersion explicit
- revision/layoutVersion
- query outputFrameRefs
- response counts/state/notices
- partial/truncated/stale representation
- all v1 inherited error codes
- `PANEL_TIMEOUT`
- error retryable consistency
- content type / Accept negotiation

#### Compatibility

- v1 line/area/bar/stat/table
- type-specific option mapping
- fill normalized once
- v1 error unchanged
- v1→v2→schema parse
- unsupported native v2→v1 request

### 13.2 Backend runtime matrix

#### Registry

- duplicate IDs
- variable missing/self/cycle
- query filter allowlist
- outputFrameRefs
- transformation graph missing/cycle/overwrite
- visualization unknown/config/preset/shape
- layout descriptor minimum
- public manifest strips function/schema

#### Coordinator / executor

- parallel query success order stable
- one query failure mapping
- hidden query behavior
- timeout while queued/running
- request abort while queued/running
- FIFO concurrency
- queue overflow + Retry-After
- actual handler settles after timeout without unhandled rejection
- limiter slot/listener release exactly once
- single Clock now per request
- interval/bucket limits
- transformation budget/abort/intermediate limits
- state merge severity

#### Route

- manifest/options/query auth 401
- unknown dashboard/panel/variable 404
- invalid params/body 400
- wrong/missing media version
- v1 and v2 response schema
- request ID propagation
- safe 500
- timeout 504 retryable
- overflow 429 retryable + header
- aborted response is not serialized
- JSON content type

### 13.3 A1〜A8 traceability

`release-evidence.md`に次のmatrixを作り、test名を1つ以上記録する。

| ID | Contract | Backend | Frontend/E2E |
| --- | --- | --- | --- |
| A1 variables | schema | options/dependency | URL/filter journey |
| A2 normalization | Data Frame/limits | normalizer | table/notice |
| A3 layout | manifest/layoutVersion | manifest | edit/persist/mobile |
| A4 field config | schema/resolver | manifest validation | renderer/table |
| A5 states | response/state | merge/error | panel states |
| A6 Inspector | safe metadata | response metadata | dev/prod sanitize |
| A7 drilldown | link schema | manifest | same-origin nav |
| A8 cancellation | error schema | limiter/abort | stale response ignored |

### 13.4 coverage policy

Backend focused thresholdを維持する。

```text
statements >= 80
lines      >= 80
functions  >= 80
branches   >= 70
```

新しいGallery definitionはproduction codeなのでcoverage対象に含める。fixture値の列挙だけを理由に
file全体をexcludeしない。純data部分だけ別fileへ分ける場合も、schema/registration pathをtestする。

### 13.5 D4完了gate

```bash
bun run verify:dashboard-contract
bun run verify:dashboard-coverage
bunx vitest run api/routes/dashboard.route.test.ts api/app/hono.test.ts
bun run typecheck
git diff --check
```

## 14. D5: Frontend / renderer conformance

### 14.1 catalog conformance script

`verify-dashboard-gallery.ts`はBackend Gallery metadataとFrontend catalog definitionを読み、次を
machine-checkする。

1. catalog type unique
2. Gallery case ID unique
3. catalog全typeにsuccess caseがある
4. descriptor全presetにsuccess caseがある
5. case presetがdescriptorに存在する
6. case optionsがdefinition config schemaを通る
7. Gallery layoutがminimum size以上
8. table fallback capabilityがcaseと矛盾しない
9. renderer loaderがcatalogから取得可能
10. catalogがrenderer moduleをstatic importしていない

scriptはAPI serverを起動しない。code-defined metadataをimportして検査する。Frontend rendererの
実描画はcomponent/E2Eへ任せる。

### 14.2 renderer harness

全renderer definitionに共通test helperを適用する。

```ts
assertVisualizationDefinition(definition)
renderVisualizationCase(definition, frames, options)
assertAccessibleSummary(definition, frames, options)
assertTableFallback(frames)
```

helperが検査する共通条件:

- strict options parse
- default preset parse
- supported shape accepts representative frame
- unsupported shape rejects with reason
- lazy loader returns Renderer
- render error is Panel boundaryで隔離
- accessible summary non-empty
- raw value path remains available
- CSS token resolutionを使いraw hexを要求しない
- empty/null/negative/zero/large valueでthrowしない

### 14.3 core.timeseries

- line / area presets
- stable series order
- null gap / connect behavior
- time sort前提を破らない
- multiple frames selection
- Tooltip keyboard代替summary
- Legend `aria-pressed` and hide/isolate
- threshold/reference representation
- reduced motionでanimation無効
- table同値

### 14.4 core.bar

- vertical category
- positive/zero/negative
- long label overflow
- multiple value fields
- Tooltip/Legend
- field override color/unit
- reduced motion
- table同値

### 14.5 core.stat

- value/null/NaN rejection
- decimal/unit
- delta positive/negative/zero
- threshold text + token
- value mapping
- no-value text
- Recharts dependencyなし
- accessible name includes raw or mapped meaning

### 14.6 core.table

- all physical field types
- caption/header semantics
- null/no-value
- format/raw value
- 100 rows/page
- pagination keyboard
- horizontal overflowはtable containerだけ
- safe link
- Recharts dependencyなし

### 14.7 Panel state priority

次のpriorityをpure testとcomponent testの両方で固定する。

```text
manifest/query disabled
  -> pending
  -> error without data
  -> transformation error
  -> incompatible / renderer load error / render error
  -> empty
  -> success

overlays:
  refreshing
  error with previous data
  partial
  truncated
  stale
  notices
```

overlayの組み合わせでもPanel heightを変えず、既存dataを消さない。

### 14.8 Frontend coverage

thresholdを維持する。

```text
statements >= 80
lines      >= 80
functions  >= 80
branches   >= 70
```

chart rendererをcoverage対象から除外する現行設定はD5で再評価する。jsdom/Recharts instrumentationが
不安定でも、model、definition、summary builderは必ず対象にする。renderer本体をexcludeする場合は
Gallery E2Eとvisual testのtest名をevidenceへ記録し、無証拠excludeを禁止する。

### 14.9 D5完了gate

```bash
bun run verify:dashboard-gallery
bun run verify:dashboard-frontend-coverage
bunx vitest run web/src/domains/dashboard/v2/visualizations web/src/domains/dashboard/v2/panel
bun run typecheck
bun run verify:dashboard-bundle
git diff --check
```

## 15. D6: Functional Playwright

### 15.1 suite構成

各specは独立loginを行い、順序依存を持たない。layout localStorageを使うtestは開始時にそのDashboard
keyだけをclearする。

### 15.2 dashboard smoke

1. unauthenticated `/dashboard` → `Login required`
2. login link → login成功 → original redirect
3. heading / variables / 4 operations panels
4. v2 manifest/options/query
5. required renderer chunks request
6. Dashboard ready
7. logout後保護

### 15.3 range / variable / API

1. initial default canonicalization
2. rangeを15mへ変更
3. URL `range=15m`
4. request body relative range
5. service変更
6. dependent region options requestにservice filter
7. invalid region selection repair
8. panel queryにreconciled filters
9. required filter確定前はqueryなし
10. browser back/forwardでstate復元
11. stale old responseが新filter UIへ反映されない

### 15.4 React Query states

network interceptionは共有v2 schemaに一致するresponseを返す。

- initial loading skeleton
- first 503 retryable → retry → success
- nonretryable 400 → manual Retry
- refresh中はprevious data保持
- refresh errorはUpdate failed overlay
- empty
- partial
- stale
- truncated
- transformation error
- unknown renderer → table fallback
- renderer chunk load failure → Panel error/fallback

interception fixtureも共有schemaでparseしてからfulfillするhelperを使う。型castだけで不正responseを
作らない。

### 15.5 layout

- View mode drag/resize不可
- Edit layout開始
- keyboard move up/down/left/right
- pointer drag smoke 1件
- pointer resize smoke 1件
- Save → reload persistence
- Cancel → saved state復帰
- Reset draft → Save → manifest default
- dirty button state
- operations/gallery key separation
- layoutVersion mismatch reset
- no overlap

pointer testは座標差を100px固定で断定せず、grid cell / relative position / persisted layoutを確認する。

### 15.6 Table / Inspector / link

- Chart→Table same requestId / same frame values
- pagination
- safe drilldown retains range/filter
- unsafe/external target rejected
- Inspector open/close/focus return
- requestId/duration/count
- token/cookie/SQLなし
- production Inspector controlなしはD10

### 15.7 mobile

viewport 390x844で次を確認する。

- 1 column
- Panel overlapなし
- width container以内
- edit move control keyboard/tap可
- horizontal page scrollなし
- Table containerだけ必要時scroll
- tooltip hover-only操作なし
- legendがoverflowしない

### 15.8 Gallery

- 全success case `data-renderer-ready=true`
- 全state caseの`data-panel-state`
- table fallback
- category jump
- desktop/mobile layout
- Galleryを開く前にGallery chunkなし
- 開いた後も未使用future renderer chunkなし

### 15.9 cancellation

Browser network abort自体の観測だけを主証拠にしない。

- unit: TanStack Query signalがfetchへ渡る
- API: Request signalがhandlerへ渡る
- E2E: filter A requestをdeferしfilter Bへ変更
- B responseを先に返す
- A responseを後から返すor abort
- UIとURLがBのまま

### 15.10 flake policy

- arbitrary `waitForTimeout`禁止。animation settle最大1箇所は理由comment必須
- locatorはrole/name/data IDを使いCSS実装詳細を避ける
- response待ちはrequest predicateとUI readyを両方確認
- screenshot assertionをfunctional suiteへ混ぜない
- failure traceを確認せずretry追加しない
- 同一testが3回中1回でも失敗するならD6 incomplete

### 15.11 D6完了gate

```bash
E2E_PORT=5175 bun run verify:dashboard-e2e
E2E_PORT=5175 bun run verify:e2e
E2E_PORT=5175 bun run verify:dashboard-e2e
git diff --check
```

Dashboard suiteを同一SHAで連続2回成功させる。2回目だけ成功した場合はpassにしない。

## 16. D7: Visual regression

### 16.1 canonical environment

baselineのcanonical環境を次に固定する。

- Playwright bundled Chromium
- viewport 1440x1100 / 390x844
- device scale factor 1
- locale `en-US`
- timezone `UTC`
- color scheme `light`
- reduced motion `reduce`
- fixed absolute range
- animation / cursor blink / caret非表示
- OS依存system font差を避け、app既定font stackをbuildに固定できない場合はCI Linuxをcanonicalとする

baseline filenameにbrowser versionを埋めない。Playwright更新は依存更新PRとしてbaseline reviewする。

### 16.2 screenshot set

最低限:

```text
gallery-desktop-success.png
gallery-desktop-states.png
gallery-mobile-success.png
operations-desktop.png
operations-mobile.png
panel-timeseries-line.png
panel-timeseries-area.png
panel-bar-vertical.png
panel-stat-value.png
panel-table-default.png
panel-table-overflow.png
```

full-page 1枚だけにしない。Gallery group screenshotとPanel単体を組み合わせ、差分原因を特定できる
粒度にする。

### 16.3 capture readiness

撮影前に必ず:

1. `data-dashboard-ready=true`
2. target全panel `data-renderer-ready=true`またはsettled state
3. `document.fonts.ready`
4. animation/transition duration 0 under test attribute
5. viewport width確定
6. focus/hoverを既定位置へ戻す

dynamic requestId、duration、current timeを含むInspectorはbaseline対象外。必要な場合はmaskする。

### 16.4 diff policy

```ts
expect(page).toHaveScreenshot(name, {
  animations: "disabled",
  caret: "hide",
  maxDiffPixelRatio: 0.005,
  threshold: 0.15,
});
```

値は初期方針である。差分を通すために上限を広げない。aliasing差ならPanel単体、mask、font固定を
先に修正する。

### 16.5 baseline update

更新手順:

```bash
E2E_PORT=5175 bunx playwright test --config playwright.visual.config.ts --update-snapshots
E2E_PORT=5175 bun run verify:dashboard-visual
git diff --stat -- tests/visual
```

更新時はrelease evidenceへ次を書く。

- change reason
- affected images
- expected UI change
- reviewerが確認すべき箇所
- unrelated pixel diffがないこと

Lunaはtest failureを解消する目的だけで理由なくbaseline更新しない。

### 16.6 visual review checklist

- Panel overlapなし
- title/description/control clippingなし
- chart plot areaが0でない
- axis/legend/tooltipがPanel外へ漏れない
- token colorがlight背景で意味を保つ
- thresholdがcolorだけに依存しない
- empty/error stateでlayout shiftなし
- mobile 1列とpage横scrollなし
- table header/value欠落なし
- focus outlineがclipされない

### 16.7 D7完了gate

```bash
E2E_PORT=5175 bun run verify:dashboard-visual
git diff --check
git status --short tests/visual
```

全expected baselineが存在し、actual/diff artifactがgit staged対象に混ざっていないことを確認する。

## 17. D8: Accessibility

### 17.1 dependency

browser accessibility automationには`@axe-core/playwright`をexact versionで追加する。

```bash
bun add --dev --exact @axe-core/playwright
```

追加前後のlockfile差分を確認する。runtime dependencyへ追加しない。

### 17.2 automated scan

対象:

- login後operations Dashboard
- Gallery success group
- Gallery state group
- Table mode
- Edit layout mode
- Inspector open
- mobile Dashboard

tags:

```text
wcag2a
wcag2aa
wcag21a
wcag21aa
wcag22aa
best-practice
```

serious / critical violationは0必須。moderate / minorも原則0とし、残す場合はrule、node、理由、
期限、ownerをevidenceへ記録する。新規violationをbaseline化しない。

### 17.3 suppression policy

許可条件:

1. tool false positiveを再現できる
2. manual checkで代替証拠がある
3. 最小node/ruleだけを除外する
4. commentにissueと削除条件を書く

禁止:

- `disableRules`でcolor contrast全体を消す
- Dashboard root全体をexclude
- `.recharts-wrapper`全体をexclude
- violation数だけassertして詳細を捨てる

### 17.4 keyboard journey

mouseを使わず次を完了できることをPlaywrightで確認する。

1. Dashboard controlsへ移動
2. range変更
3. variable選択
4. Panel Chart/Table切替
5. legend series hide / restore
6. Edit layout開始
7. Panel移動
8. Save / Cancel
9. Inspector open / close / triggerへfocus return
10. drilldown
11. table pagination

focus順がvisual layoutと大きく乖離しない。focus trapはInspectorだけに適用し、close後にtriggerへ戻す。

### 17.5 chart semantics

- Panel headingとchart accessible labelが対応
- screen reader summaryにseries、range、代表値
- Tooltipの情報がsummary/Tableから取得可能
- Legend buttonにnameとpressed state
- threshold/stateはtextを持つ
- reference lineはlabelを持つ
- decorative SVGは重複announceしない
- Table caption/header scope

### 17.6 reduced motion

`prefers-reduced-motion: reduce`で:

- Recharts animation無効
- layout transition無効または短縮
- spinner以外の連続animationなし
- content可視性を失わない

CSSだけでなくrenderer propも確認する。

### 17.7 mobile / touch

- target sizeを既存design system基準で確保
- hover-only tooltipに依存しない
- multiple selectがkeyboard/touchで操作可能
- horizontal table scroll中にpage navigationを阻害しない
- move controlにvisible label

### 17.8 D8完了gate

```bash
E2E_PORT=5175 bun run verify:dashboard-a11y
E2E_PORT=5175 bun run verify:dashboard-e2e -- --grep "keyboard"
bun run lint
bun run typecheck
git diff --check
```

## 18. D9: Performance and bundle

### 18.1 bundle graph terms

- `initial graph`: Vite entryからstatic importsで到達
- `dashboard shell graph`: Dashboard lazy routeからstatic importsで到達
- `renderer graph`: 各renderer entryからstatic importsで到達
- `exclusive bytes`: 親graphに既に存在するfileを除いたbytes
- `family shared graph`: chart renderer間で共有されるRecharts / Cartesian chunk

hash filenameへ依存せずmanifest keyとgraph traversalで識別する。

### 18.2 hard import boundary

必須assertion:

1. initial graphにDashboard lazy sourceなし
2. initial graphにRecharts / RGL / Galleryなし
3. Dashboard routeはentry dynamic importから到達
4. Gallery routeは独立dynamic import
5. Dashboard shellにRechartsなし
6. catalogにrenderer static importなし
7. timeseries / bar rendererだけchart family graphへ到達
8. stat / tableはRechartsへ到達しない
9. 未使用rendererはroute navigation前にrequestされない
10. Galleryは全rendererをeager importしない

source tokenだけでpackage検出しない。manifest graph、chunk source、known module markerを組み合わせる。

### 18.3 byte budget file

`dashboard-bundle-budget.json`:

```json
{
  "schemaVersion": 1,
  "graphs": {
    "initial": { "maxRawBytes": 0, "maxGzipBytes": 0 },
    "dashboardShellExclusive": { "maxRawBytes": 0, "maxGzipBytes": 0 },
    "galleryShellExclusive": { "maxRawBytes": 0, "maxGzipBytes": 0 },
    "chartFamilyShared": { "maxRawBytes": 0, "maxGzipBytes": 0 },
    "core.timeseries": { "maxRawBytes": 0, "maxGzipBytes": 0 },
    "core.bar": { "maxRawBytes": 0, "maxGzipBytes": 0 },
    "core.stat": { "maxRawBytes": 0, "maxGzipBytes": 0 },
    "core.table": { "maxRawBytes": 0, "maxGzipBytes": 0 }
  }
}
```

D9実装時に0を実測値から置換する。計算規則:

```text
maxRawBytes  = ceil(measuredRaw  * 1.10 / 1024) * 1024
maxGzipBytes = ceil(measuredGzip * 1.10 / 1024) * 1024
```

10%は初回headroomであり、自動増加させない。budget更新には、増加source、bytes、理由、代替検討を
release evidenceへ記録する。initial graphはDashboard以外の変更にも影響するため、Dashboard差分で
超過していないかmanifest diffを提示する。

### 18.4 bundle script test

synthetic manifest fixtureで次をtestする。

- static cycle
- missing entry
- dynamic import discovery
- shared chunk重複除外
- gzip deterministic
- forbidden dependency
- byte over budget
- renamed hash file
- renderer追加時のbudget missing failure

rendererをcatalogへ追加したのにbudget rowがない場合、scriptはfailする。

### 18.5 browser performance fixture

Galleryにupper-bound caseを1つ用意する。

- timeseries: contract上限以内のpoints × series
- table: 100 visible rows、総rowsはpagination対象
- browser transformation: budget付近だが100ms以内
- layout: 10〜12 Panelsのresize observation

current coreだけで不自然な巨大Dashboardを本番demoへ追加しない。Galleryのperformance groupとして
collapseまたは別sectionにする。

### 18.6 hard browser gates

- Browser transformation runtimeが自身の100ms budgetを超えない
- 8msごとのyield contractをunit fake schedulerで証明
- abort後にcommitしない
- dense fixtureでunhandled errorなし
- interaction中100ms超のLong Taskなし。PerformanceObserver未対応時はtest skipでpassにせず、
  Chromium project requirementとしてfailする
- layout resize callbackをframeあたり複数回高コスト実行しない
- Tableは100 rows/pageを超えてDOMへ描画しない

### 18.7 advisory metrics

次は環境差が大きいためhard thresholdではなく記録する。

- login後Dashboard ready
- Gallery first ready
- renderer chunk fetch duration
- Chart/Table toggle duration
- layout drag frame rate
- peak JS heap if Chromium exposes it

同一machine / browserで前回比25%以上悪化した場合はrelease review必須とする。絶対値だけで自動failに
しない。

### 18.8 D9完了gate

```bash
bunx vitest run scripts/verify-dashboard-bundle.test.ts
bun run verify:dashboard-bundle
E2E_PORT=5175 bun run verify:dashboard-performance
bun run build
git diff --check
```

## 19. D10: Security, privacy, resilience

### 19.1 auth / authorization boundary

- operations / Gallery manifest/options/queryはunauthenticated 401
- Frontend routeはLogin requiredとredirect付きlogin linkを表示
- login redirectはsame-origin pathだけ
- auth refresh並列single-flightをDashboard複数requestで確認
- logout後cacheされたPanel dataを保護画面へ表示しない
- user変更後にquery cache keyがidentity境界を跨がない

Dashboard / Panel個別RBACは対象外だが、将来authz hookを挿入できるservice boundaryを壊さない。

### 19.2 Inspector

development:

- requestId、duration、counts、state、noticesのみ
- request/response previewはsanitize済み
- bearer、cookie、refresh token、JWT、password、raw SQLなし

production build:

- Inspector buttonなし
- Inspector moduleがproduction Dashboard graphへ不要ならtree-shakeされる
- `VITE_E2E_INSPECTOR`を本番release commandへ設定しない
- built assetにfixture secret markerなし

### 19.3 links

- same-origin allowlist
- protocol-relative URL拒否
- `javascript:` / `data:`拒否
- encoded traversal / double decodeを拒否
- unknown target ID拒否
- structured searchだけをmerge
- secret key name allowlist/denylist
- external linkを将来許可するまで`target=_blank` pathなし

### 19.4 URL / variable privacy

- filtersへpassword/token/emailのdemo値を入れない
- unsupported search key canonicalizeで除去
- value length/count limit
- malformed JSONでcrashしない
- browser historyへInspector responseを保存しない
- localStorageはlayoutだけ。query data、auth、Inspectorを保存しない

### 19.5 rendering safety

- title/description/field valuesはReact text escape
- HTML rendererなし
- `dangerouslySetInnerHTML`なし、必要箇所をsource scan
- Table link text安全
- error messageはserver safe envelopeだけ
- raw stack、SQL、file pathをUIへ表示しない

### 19.6 resilience

- 429 `Retry-After`を尊重
- retryable codeだけ自動retry
- retry上限とbackoff
- filter変更でold request cancel
- timeout/abort listener cleanup
- renderer errorが他Panelへ波及しない
- one Panel failureでDashboard controls使用可能
- malformed responseはZod errorとしてsafe UI
- offline/online復帰でprevious data維持

### 19.7 production verification

E2E development serverだけではproduction Inspector非表示を証明できないため、production buildを
static/API serverで起動する専用smokeまたはcomponent build testを追加する。

最低assertion:

- `NODE_ENV=production`
- `VITE_E2E_INSPECTOR`未設定
- operations表示
- Inspector control 0
- Gallery auth維持
- built sourceのknown test secret marker 0

### 19.8 D10完了gate

```bash
bunx vitest run api/routes/dashboard.route.test.ts web/src/domains/dashboard/v2/inspector web/src/domains/dashboard/v2/links
E2E_PORT=5175 bun run verify:dashboard-e2e -- --grep "security|resilience"
bun run build
bun run verify:dashboard-bundle
bun run lint
git diff --check
```

## 20. D11: Compatibility, variant, packaging

### 20.1 compatibility matrix

#### wire

- v1 public schema/export unchanged
- v1 Dashboard registration remains readable through compatibility runtime
- v2 Frontend never silently downgrades
- unknown schemaVersion gives structured error
- Gallery is native v2 only

#### layout

- existing operations localStorage layoutVersion一致で復元
- layoutVersion不一致でdefault reset
- malformed JSONでreset
- Gallery key分離
- mobile derived layoutをdesktop saved layoutへ上書きしない

#### visualization config

- configSchemaVersion explicit
- deprecated presetにmigration pathがない限り削除しない
- unknown typeはPanel isolation
- Gallery conformanceがmissing presetを検出

### 20.2 target matrix

| Target | 必須範囲 |
| --- | --- |
| `main` | full release gate |
| `variant/sqlite` | patch、bootstrap、full gate |
| `variant/postgres` | patch、DB adapter差分、verify、Dashboard E2E |
| `variant/pgvector` | postgres差分 + Dashboard非依存確認 |
| `variant/rag` | route/auth衝突、verify、Dashboard smoke |
| `variant/turso` | libSQL adapter、verify、Dashboard E2E |
| `variant/cloudflare` | Worker signal/timeout、build、可能なruntime smoke |
| `overlay/ssr` | hydration、browser-only renderer、lazy route |
| `overlay/ssg` | Dashboard prerender除外、client navigation、lazy route |

DB variantごとにGallery queryを書き換えない。Galleryはin-memory、実運用operations handlerの
差し替え点だけがvariant固有である。

### 20.3 patch source

patchは現在のworking treeではなく、release candidate commit同士から作る。D12でcommit承認がない
段階ではdry-run用一時patchを作り、artifactとしてgit管理しない。

```bash
base=$(git merge-base main overlay/dashboard)
git diff --binary "$base"..overlay/dashboard > /tmp/overlay-dashboard.patch
```

未commit差分がある場合、このcommandだけでは含まれない。candidate commitが未作成ならvariant
matrixを`blocked_by_uncommitted_candidate`と記録し、成功扱いにしない。

commit承認前の再現可能なdry-runでは、current worktreeをswitchせず、一時indexから追跡・未追跡の
source/test/config/docsとexpected baselineを含むpatchを生成する。`coverage/`、`dist-*`、
`test-results/`、Playwright report/trace、SQLite DB、`node_modules/`は除外する。dry-runの
`main` / SSG / SSR / DB variant結果は適用可否の証跡として保存できるが、candidate SHAの代替には
ならず、release `ready`判定には使わない。

### 20.4 detached worktree protocol

targetごとに:

```bash
target=variant/sqlite
slug=${target//\//-}
path=/tmp/hono-standard-dashboard-${slug}
git worktree add --detach "$path" "$target"
git -C "$path" apply --check /tmp/overlay-dashboard.patch
git -C "$path" apply /tmp/overlay-dashboard.patch
bun install --frozen-lockfile --cwd "$path"
```

commandの`--cwd`対応が不確かな場合はworkdirを切り替えて実行する。current user worktreeをswitchしない。

各worktreeで:

```bash
bun run verify
bun run verify:dashboard-coverage
bun run verify:dashboard-frontend-coverage
E2E_PORT=<unique-port> bun run verify:dashboard-e2e
bun run verify:dashboard-bundle
git diff --check
```

CloudflareなどE2E serverがそのruntimeを再現しないtargetは、既存variant固有smokeを実行し、未実行
項目を`not_applicable`ではなく`not_run` + 理由にする。

### 20.5 conflict policy

conflict時:

1. file / hunk / target差分を記録
2. mainとのdriftかvariant固有compositionか分類
3. overlay core contractは変更しない
4. adapter/registration差分で解決可能か判断
5. temporary worktree内だけで試す
6. overlayへ必要な一般修正を戻す場合はD4〜D10を再実行

無理にapplyしたtargetをpassにしない。

### 20.6 SSG acceptance

`overlay/ssg`では必須:

- `/dashboard`と`/dashboard/gallery`をprerender route listへ含めない
- build時にauth APIを呼ばない
- static public routeからclient navigation可能
- hydration mismatchなし
- first navigationでDashboard lazy chunk取得
- rendererはPanel必要時に取得
- reload時はSSG fallback/server routing方針に一致

### 20.7 SSR acceptance

- server render中に`window` / `localStorage`参照なし
- Grid width確定前に壊れたlayoutをhydrateしない
- chart rendererはclient boundary
- hydration warningなし
- authenticated data fetch方針が既存SSR overlayと一致

### 20.8 packaging audit

patch / archiveへ含めない:

- `.env`
- SQLite DB
- coverage
- Playwright report/trace
- dist build
- screenshots actual/diff
- local release evidence artifact
- node_modules

含める:

- source
- migrations以外のDashboard module。Dashboard起因migrationは0
- shared schemas
- tests/config/scripts
- expected visual baselines
- docs
- lockfile

### 20.9 D11完了gate

- main row pass
- `overlay/ssg` row passを必須
- `overlay/ssr` row passを必須
- DB variantは全canonical rowにpass / blocked / not_run理由
- patch apply check結果
- Dashboard DB migration 0
- worktree cleanup前にresultをevidenceへ記録
- user current worktree/branch不変

worktree削除は内部に必要差分がないことを確認してから行う。

## 21. D12: Release candidate and handoff

### 21.1 release version

tag format:

```text
overlay-dashboard-v<major>.<minor>.<patch>
```

versionは既存公開tagと変更規模から決める。D12計画時点で`v0.1.0`へ固定しない。tag名候補を
evidenceへ書き、user承認まで作成しない。

### 21.2 final release orchestrator

`verify-dashboard-release.ts`は次をfail-fastで実行する。

```text
1. bun run verify
2. bun run verify:dashboard-contract
3. bun run verify:dashboard-coverage
4. bun run verify:dashboard-frontend-coverage
5. bun run verify:dashboard-gallery
6. bun run verify:dashboard-bundle
7. bun run verify:dashboard-e2e
8. bun run verify:dashboard-visual
9. bun run verify:dashboard-a11y
10. bun run verify:dashboard-performance
11. bun run verify:dashboard-security
12. bun run verify:dashboard-doc-links
13. git diff --check
```

- subprocess outputをstreamする
- exit codeを保持する
- secret env valueをprintしない
- portを`E2E_PORT`から全Playwright commandへ渡す
- 同一E2E serverをsuite間で暗黙共有しない
- 失敗後に後続gateを実行しない

### 21.3 full gate repeat

同一candidate SHAで2回実行する。

```bash
E2E_PORT=5175 bun run verify:dashboard-release
E2E_PORT=5175 bun run verify:dashboard-release
```

sourceまたはbaselineを変更したら連続成功countをresetする。文書だけのtypo修正は`git diff --check`
とlink checkを再実行し、candidate SHAが変わるため最終1回はfull gateを再実行する。

candidate commitが未作成のdry-runでは、同一working-tree snapshotでの連続成功を記録してよいが、
`same candidate SHA`の完了条件は満たさない。この状態の最終判定は
`ready_pending_candidate_commit_approval`とし、`ready`へ昇格させない。

### 21.4 release evidence

最終記録:

- candidate branch / SHA / merge-base
- Bun / Chromium version
- dependency additions / exact versions
- test counts
- coverage metrics
- visual baseline count
- axe violation count
- bundle graph raw/gzip actual vs budget
- browser advisory metrics
- A1〜A8 traceability
- variant matrix
- SSG/SSR evidence
- known limitations
- tag candidate
- rollback steps
- final decision `ready | ready_pending_candidate_commit_approval | not_ready`

failureを削除してきれいな結果だけにしない。最終passと、release判断に影響したfailureの解決概要を
残す。

### 21.5 docs

README:

- operations / Gallery routes
- login/bootstrap
- 実query差し替え点
- Gallery case追加方法
- verification commands
- overlay適用
- production Inspector注意

`docs/template-variant-management.md`:

- patch生成基点
- canonical matrix
- SSG/SSR条件
- release evidence
- tag naming

`LLM_CONTEXT.md`:

- 00〜04正本導線
- renderer追加時のcatalog + Gallery + tests
- release gate
- migration / lazy境界

### 21.6 rollback plan

overlay適用先:

1. deploymentを前release artifactへ戻す
2. overlay patch commitをrevertする
3. Dashboard route/navigation registrationを除去する
4. Dashboard module registrationを除去する
5. package dependenciesをlockfileごと戻す
6. 通常route/auth/showcase smokeを実行する

Dashboard overlayはDB migration、server Dashboard data、業務seedを追加しないため、DB rollbackは
不要でなければならない。もしD12でDashboard起因migrationが見つかったらrelease stopし、設計へ戻る。

localStorage:

- 古いlayoutはapp dataではない
- rollback後は未参照keyとして残ってもauth/data leakにならない
- 必要ならversioned keyだけを明示削除する
- generic `localStorage.clear()`を実行しない

### 21.7 release side effects

次は計画完了と別の、明示承認が必要な操作である。

- commit
- tag
- push
- pull request
- GitHub Release
- remote branch更新

D12はこれらの直前まで準備し、提案commandとevidenceをuserへ渡す。承認なしに実行しない。

### 21.8 D12完了gate

- D0〜D11 complete
- release orchestrator unit test
- same SHA full gate 2回成功
- release evidence全section記入
- visual baseline review済み
- accessibility blocker 0
- budget超過0
- production Inspector/secret露出0
- main、SSG、SSR required rows pass
- canonical DB variant結果記録
- rollback手順検証
- docsリンク切れ0
- tracked TODO / placeholder 0
- user所有の無関係変更をrelease対象に含めない

未commit dry-runで上記のruntime gateを通過しても、candidate SHAがない限りD12はpendingのままにする。
commit/tag/push/releaseの明示承認後にcandidate commitを作成し、そのSHAでvariant matrixとfull gateを
再実行してからD12をcompleteへ変更する。

## 22. Visualization追加時の継続契約

後続P2〜P7がVisualizationを追加するたび、同じPR / work packageで次を追加する。

```text
1. shared descriptor/config schema
2. Backend Visualization registration
3. Frontend definition/model/lazy renderer
4. catalog registration
5. Gallery success case for every preset
6. representative data + null/zero/negative/large fixture
7. renderer/component tests
8. table fallback assertion
9. accessible summary and keyboard behavior
10. visual baseline
11. renderer graph budget row
12. bundle/gallery/release gates
```

`verify:dashboard-gallery`が5または11の追加漏れをfailする。新rendererを一時的にconformanceから
除外するescape hatchは作らない。Specialized rendererでtable fallbackがsummaryになる場合も、
capabilityと期待policyを明示し、無検証にしない。

## 23. Command matrix

### D0

```bash
bun install --frozen-lockfile
bun run verify
bun run verify:dashboard-coverage
bun run verify:dashboard-frontend-coverage
E2E_PORT=5175 bun run verify:e2e
bun run verify:dashboard-bundle
```

### D1

```bash
bunx vitest run scripts/verify-dashboard-gallery.test.ts scripts/verify-dashboard-bundle.test.ts
bun run typecheck
bun run lint
bun run format:check
```

### D2

```bash
bunx vitest run api/modules/dashboard/v2/gallery-dashboard.test.ts api/routes/dashboard.route.test.ts api/app/hono.test.ts
bun run verify:dashboard-coverage
```

### D3

```bash
bunx vitest run web/src/domains/dashboard/v2/gallery
bun run verify:dashboard-frontend-coverage
E2E_PORT=5175 bun run verify:dashboard-e2e -- --grep gallery
bun run verify:dashboard-bundle
```

### D4

```bash
bun run verify:dashboard-contract
bun run verify:dashboard-coverage
```

### D5

```bash
bun run verify:dashboard-gallery
bun run verify:dashboard-frontend-coverage
bun run verify:dashboard-bundle
```

### D6

```bash
E2E_PORT=5175 bun run verify:dashboard-e2e
E2E_PORT=5175 bun run verify:e2e
E2E_PORT=5175 bun run verify:dashboard-e2e
```

### D7

```bash
E2E_PORT=5175 bun run verify:dashboard-visual
```

### D8

```bash
E2E_PORT=5175 bun run verify:dashboard-a11y
```

### D9

```bash
bunx vitest run scripts/verify-dashboard-bundle.test.ts
bun run verify:dashboard-bundle
E2E_PORT=5175 bun run verify:dashboard-performance
```

### D10

```bash
bun run build
E2E_PORT=5175 bun run verify:dashboard-e2e -- --grep "security|resilience"
bun run verify:dashboard-bundle
```

### D11

```bash
git worktree list
git apply --check /tmp/overlay-dashboard.patch
```

target worktreeごとにfull applicable gatesを実行する。

### D12

```bash
E2E_PORT=5175 bun run verify:dashboard-release
E2E_PORT=5175 bun run verify:dashboard-release
bun run verify:dashboard-doc-links
git diff --check
```

## 24. Stop条件

次の場合だけLunaは実装を止め、user判断を求める。

- 00〜03と04の要件が矛盾し、一意に解釈できない。
- Galleryのために公開APIへ任意error/fixture injectionを追加する必要がある。
- accessibility blockerを解消するため既存design system全体の大規模変更が必要である。
- bundle budget達成に公開renderer capability削除が必要である。
- variant適用にDB migration、secret、外部serviceが必須になる。
- production Inspector非表示を既存build architectureで保証できない。
- current user変更と同じ行を大規模に書き換え、保存できない。
- release candidate commit/tag/pushの権限が必要になった。

停止しない例:

- test数が多い。
- visual baseline調整が必要。
- flaky testの原因調査に時間がかかる。
- coverageが初回threshold未満。
- Playwright portが占有されている。
- axe violationが見つかった。
- bundle scriptのgraph計算が複雑。
- variant patch conflictがadapterで解決できる。

## 25. Failure handling

| Failure | 戻るWP | 対応 |
| --- | --- | --- |
| shared schema | D4 / 01 | public contractなら01更新 |
| Gallery registry | D2 | definition/fixture修正 |
| renderer conformance | D5 / 03 | model/renderer修正 |
| E2E state | D6 | unit/APIで原因分離 |
| visual diff | D7 | source修正or承認baseline更新 |
| axe | D8 | semantic/style修正 |
| bundle boundary | D9 / 03 | import graph修正 |
| performance | D9 | transform/render/virtualization修正 |
| secret/Inspector | D10 | release stop、sanitize/build修正 |
| compatibility | D11 / relevant plan | migration追加 |
| variant conflict | D11 | adapter、target blocked記録 |
| final gate | 該当最初のWP | D12をcompleteにしない |

修正で前段contractが変わった場合、後段だけ再実行しない。影響するD package以降を再実行する。

## 26. 完了条件

- [ ] 01 C0〜C9 complete。
- [ ] 02 B0〜B12 complete。
- [ ] 03 F0〜F12 complete。
- [ ] 05 V0〜V12 complete。
- [ ] 06 R0〜R13 complete。
- [ ] 07 K0〜K12 complete。
- [ ] 08 S0〜S13 complete。
- [ ] 09 T0〜T13 complete。
- [ ] D0〜D12 complete。
- [ ] independent Visualization Galleryが存在する。
- [ ] 全catalog type / presetにsuccess caseがある。
- [ ] Galleryは実v2 APIと共通Panel shellを使う。
- [ ] Gallery / rendererは通常initial graphにない。
- [ ] contract / Backend / Frontend focused coverage達成。
- [ ] A1〜A8 traceability完成。
- [ ] loading / retry / empty / partial / stale / truncated / error-with-data証拠。
- [ ] cancellation / timeout / limiter / queue overflow証拠。
- [ ] layout Save / Cancel / Reset / keyboard / pointer / mobile証拠。
- [ ] Chart/Table same-frame証拠。
- [ ] Inspector / links security証拠。
- [ ] visual baselineと未承認diff 0。
- [ ] serious / critical accessibility violation 0。
- [ ] keyboard-only journey成功。
- [ ] reduced motion成功。
- [ ] bundle import boundary成功。
- [ ]全graph raw/gzip budget内。
- [ ] Browser Transformation 100ms budget証拠。
- [ ] dense fixture long task gate成功。
- [ ] production Inspector / secret露出0。
- [ ] v1 wire compatibility維持。
- [ ] layout/config migration証拠。
- [ ] main、overlay/ssg、overlay/ssr matrix pass。
- [ ] canonical DB variant結果記録。
- [ ] Dashboard起因DB migration 0。
- [ ] release rollback手順完成。
- [ ] release evidence完成。
- [ ]同一candidate SHAでrelease gate 2回成功。
- [ ] docs link / diff check成功。
- [ ] tag/pushはuser承認まで未実行。

## 27. 次計画へ渡す成果

04完了後、06以降のVisualization計画は次を前提にしてよい。

```text
Quality platform:
  deterministic Gallery Dashboard
  renderer/preset conformance
  functional E2E harness
  visual regression
  accessibility automation
  bundle byte/import budgets
  browser performance fixture
  security/production checks
  variant/release evidence
```

新Visualization計画はPanel shell、query orchestration、test infrastructure、release scriptを
作り直さず、[22. Visualization追加時の継続契約](#22-visualization追加時の継続契約)を満たす。

## 28. 再開手順

1. [00-concept.md](./00-concept.md)を読む。
2. [progress.md](./progress.md)のValidation / Delivery節を読む。
3. 01 C9、02 B12、03 F12 completeを確認する。
4. `git branch --show-current`、`git status --short`。
5. current `in_progress` D packageを確認する。
6. 最後の成功commandを再実行する。
7. 失敗したらstatusをcompleteのままにせず該当Dへ戻す。
8. D0〜D10 completeかつ05未完了なら05の最初のpending V packageへ進む。
9. 05 V12 completeかつ06未完了なら06の最初のpending R packageへ進む。
10. 06 R13 completeかつ07未完了なら07の最初のpending K packageへ進む。
11. 07 K12 completeかつ08未完了なら08の最初のpending S packageへ進む。
12. 08 S13 completeかつ09未完了なら09の最初のpending T packageへ進む。
13. 09 T13 completeかつ10未完了なら10の最初のpending O packageへ進む。
14. 10 O18 completeならD11互換性matrixを126 preset candidateで再実行する。
15. release evidenceを同時更新する。
16. D12完了までtag/push/release公開へ進まない。
