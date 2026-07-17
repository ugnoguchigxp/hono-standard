# Dashboard Overlay 進捗台帳

## 更新ルール

- 各work package開始時にstatusを`in_progress`へ変更する。
- 同時に`in_progress`にできるWPは1つだけ。
- test成功後にだけ`complete`へ変更する。
- command、結果、変更file、次の1手を記録する。
- 失敗中のWPを`complete`にしない。
- blockerがなくても中断する場合は、再開後に実行する最初のcommandを記録する。

## Visualization Platform v2 拡張

```text
Concept status: complete
Current plan: data-source-adapters
Plan status: complete
Implementation status: complete
Current work package: AD10
Baseline: completed 01 C0-C9, 02 B0-B12, 03 F0-F12, 05 V0-V12, 06 R0-R13, 07 K0-K12, 08 S0-S13, 09 T0-T13, 10 O0-O18, 04 D0-D11 initial matrix
Last successful command: DASHBOARD_FRONTEND_COVERAGE_DIR=coverage/dashboard-frontend-codex-doc-review E2E_PORT=5281 bun run verify:dashboard-release
Next command: rerun 04 D11 compatibility matrix for the adapter candidate
Blocker: none
```

| WP | 内容 | Status | 完了証拠 |
| --- | --- | --- | --- |
| C0 | baselineとv1 characterization | complete | `bunx vitest run shared/schemas/dashboard.schema.test.ts`; `bunx tsc --noEmit` |
| C1 | v1 schema抽出とbarrel化 | complete | `shared/schemas/dashboard/legacy-v1.schema.ts`; v1 import path維持 |
| C2 | common primitive、JSON value、v2 limits | complete | `common.schema.test.ts`; `json-value.schema.test.ts`相当の専用検証 |
| C3 | Field ConfigurationとOverride | complete | `field-config.schema.test.ts` |
| C4 | Data Frame、shape contract、effective field config | complete | `data-frame.schema.test.ts`; `field-config-resolution.test.ts`相当の検証 |
| C5 | Visualization / Transformation envelope | complete | `visualization.schema.test.ts`; `transformation.schema.test.ts` |
| C6 | v2 Manifest / Transport / Error | complete | `manifest-v2.schema.test.ts`; `transport-v2.schema.test.ts` |
| C7 | v1→v2 compatibility helper | complete | `compatibility.test.ts`; v1全4種・manifest migration |
| C8 | public export、文書、full verification | complete | `bun run verify`; `bun run verify:dashboard-coverage`; `bun run verify:e2e`; `bun run verify:dashboard-bundle`; `git diff --check` |
| C9 | multi-frame、v2 error継承、legacy option追補 | complete | `bun run verify`; v2 contract focused tests |

### C0〜C8: Visualization Platform v2共有契約

- Status: complete
- Started at: 2026-07-16
- Goal: v1 compatibilityを維持したまま、v2 common primitive、JSON budget、Field Configuration、Data Frame、Visualization / Transformation、Manifest / Transport、compatibility helperを追加する。
- Planned files: `shared/schemas/dashboard/*`, `shared/schemas/dashboard.schema.ts`, `shared/schemas/dashboard.schema.test.ts`
- Files changed: v1 legacy extraction/barrel、v2 schema modules、fixture、11 contract test files、`vitest.config.ts`
- Commands run:
  - `bunx vitest run shared/schemas/dashboard shared/schemas/dashboard.schema.test.ts`: success（11 files / 23 tests）
  - `bunx tsc --noEmit`: success
  - `bun run verify`: success（typecheck/lint/format/test/coverage/build）
  - `bun run verify:dashboard-coverage`: success（branches 63.88%）
  - `bun run verify:e2e`: success（3 tests）
  - `bun run verify:dashboard-bundle`: success（initial graphにDashboard lazy dependenciesなし）
  - `rg -n 'schemas/dashboard/' api web scripts tests shared --glob '!shared/schemas/dashboard/**'`: no matches
  - `git diff --check`: success
- Verification: v1 export/import path維持、v1 characterization、v2 strict schema、JSON cycle/budget、frame shape/identity、registry二段階fixture、manifest/transport counts/state/version、v1全4種 migrationを確認。
- Known issues: なし。
- Next command: C9のmanifest/transport/compatibility testを追加する。
- Completed at: 2026-07-16

C0〜C8の完了記録は履歴として維持する。C9を完了し、Backend B0へ進んだ。

## Backend v2 実装

```text
Backend plan: 02-backend
Plan status: ready
Implementation status: complete
Current work package: B12
Start condition: 01-contracts C0-C9 complete
Last successful command: bun run verify:dashboard-coverage
Next command after unblock: none
Blocker: none
```

| WP | 内容 | Status | 完了証拠 |
| --- | --- | --- | --- |
| B0 | baselineとv1 characterization | complete | v1 targeted tests / typecheck baseline |
| B1 | runtime error、clock、logger、limiter、abort | complete | runtime unit tests、limiter/abort coverage |
| B2 | native v2 definition型とFrame builder | complete | v2 definition/frame-builder tests |
| B3 | Visualization / Transformation registry | complete | registry tests |
| B4 | DashboardRegistryV2 semantic validation | complete | native registry tests |
| B5 | Frame normalizerとPanel state merge | complete | normalizer/panel-state tests |
| B6 | native v2 multi-query coordinator | complete | parallel multi-frame query tests |
| B7 | Server Transformation executor | complete | order、budget、abort tests |
| B8 | Variable Options executor | complete | static/query/dependency/error tests |
| B9 | v1 compatibility runtimeとDashboardService | complete | v1/v2 dual service tests |
| B10 | API version negotiationとerror mapping | complete | route/version tests |
| B11 | app composition、fixture、focused coverage | complete | fixture injection、focused coverage config |
| B12 | full verification、文書、handoff | complete | full gates and progress update |

Backend実装は[02: Backend実装計画](./02-backend.md)を正本とする。C9完了前に
Backend側へv2 schemaの仮実装を作って進めない。

### B0〜B12: Dashboard Visualization Platform Backend

- Status: complete
- Started at: 2026-07-16
- Goal: v1 compatibilityを維持したdual v1/v2 Dashboard runtime、native v2 registry、multi-frame query、server transformation、versioned APIを実装する。
- Files changed: `api/modules/dashboard/*`、`api/routes/dashboard-version.ts`、`api/routes/dashboard.route.ts`、`shared/schemas/dashboard/*`、`vitest.dashboard.config.ts`、関連テスト。既存v2 UIのE2E互換表示も補修。
- Commands run:
  - `bun run verify`: success（typecheck/lint/format/test/coverage/build）
  - `bun run verify:dashboard-coverage`: success（65 files / 192 tests、statements 83.97%、branches 70.00%、functions 92.74%、lines 85.63%）
  - `bun run verify:e2e`: success（3 tests）
  - `bun run verify:dashboard-bundle`: success（initial graphにDashboard lazy dependenciesなし）
  - `git diff --check`: success
- Verification: v1/v2 manifest・transport、auth/request metadata、runtime error、clock/logger、FIFO limiter、abort/deadline、native registry、multi-query/multi-frame、server/browser transformation境界、variable options、legacy v1→v2 compatibility、Accept negotiation、safe error envelopeを確認。
- Known issues: なし。
- Next command: none
- Completed at: 2026-07-16

## Frontend v2 実装

```text
Frontend plan: 03-frontend
Plan status: ready
Implementation status: complete
Current work package: F12
Start condition: 01 C9 and 02 B0-B12 complete
Last successful command: E2E_PORT=5175 bun run verify:e2e
Next command: none
Blocker: none; default port 5174 is occupied in the shared workspace, so E2E was verified on E2E_PORT=5175.
```

| WP | 内容 | Status | 完了証拠 |
| --- | --- | --- | --- |
| F0 | prerequisite、baseline、v1 characterization | complete | 既存Dashboard 4 test、typecheck、bundle baseline成功 |
| F1 | v2 search、API、error、query key | complete | v2 client、canonical search、query key、full typecheck/test成功 |
| F2 | Visualization Registryとrenderer loader | complete | Registry/loader実装、unknown/config隔離test成功 |
| F3 | Browser Transformation runtime | complete | sequential/cancel/immutability実装、focused test成功 |
| F4 | Data Frame、Field Config、formatter、Table | complete | shared field config、formatter、100行table実装、helper test成功 |
| F5 | variable/query orchestration | complete | dependency reconciliation、v2 variable/panel query実装 |
| F6 | Panel state、fallback、error boundary | complete | Panel shell、state priority、renderer error/table fallback実装 |
| F7 | core renderer migration | complete | core.timeseries/bar/stat/table、renderer lazy chunks実装 |
| F8 | RGL v2 layout/persistence/mobile | complete | root API、localStorage、xs 1列、layout state実装 |
| F9 | Inspector、links、accessibility | complete | sanitize Inspector、same-origin link、semantic table実装 |
| F10 | route compositionとv1→v2切替 | complete | `/dashboard` v2 route、v2 Accept/schemaVersion、full test成功 |
| F11 | focused coverageとbundle/E2E | complete | `bun run verify:dashboard-frontend-coverage`（15 files / 38 tests、statements 89.05%、branches 77.71%、functions 82.44%、lines 89.13%）；`bun run verify:dashboard-bundle`；E2E 7/7 |
| F12 | full verification、docs、handoff | complete | `bun run verify`、`bun run verify:dashboard-coverage`（68 files / 204 tests、statements 83.97%、branches 70.00%、functions 92.74%、lines 85.63%）、`E2E_PORT=5175 bun run verify:e2e`（7/7）、`bun run verify:dashboard-bundle`、`git diff --check` |

Frontend実装は[03: Frontend実装計画](./03-frontend.md)を正本とする。Backend完了前に
mock v2 APIやFrontend独自schemaを追加しない。

F0〜F12のFrontend実装は完了した。`/dashboard`のv2 transport専用化、legacy共通
optionsを受けるcore renderer、renderer lazy load、Panel単位fallback/error boundary、
layout persistence、mobile 1列、Inspector sanitizeを実装し、Focused coverage・bundle・
E2Eを含む最終ゲートを通過した。

## Validation / Gallery / Delivery v2 実装

```text
Delivery plan: 04-testing-and-delivery
Plan status: ready
Implementation status: ready_for_adapter_candidate_revalidation
Current work package: D12
Start condition: 01 C0-C9, 02 B0-B12, 03 F0-F12 complete
Last successful command: E2E_PORT=5175 bun run verify:dashboard-release
Next command: rerun D11 compatibility matrix for the adapter candidate
Blocker: none
```

| WP | 内容 | Status | 完了証拠 |
| --- | --- | --- | --- |
| D0 | prerequisite、baseline、差分監査 | complete | `bun run verify`、focused coverage、E2E 10/10、bundle gate、`git diff --check` |
| D1 | quality config、evidence、test分割基盤 | complete | quality config、5 Playwright config、release orchestrator、coverage output分離、unit tests |
| D2 | Backend Gallery Dashboard | complete | Gallery 26 cases（Cartesian 18 preset + state fixture）、native v2 registry/API、deterministic fixture tests |
| D3 | Frontend Gallery routeとreadiness | complete | `/dashboard/gallery`、lazy route、shared PanelShell/Grid、Gallery E2E |
| D4 | contract / Backend conformance | complete | contract 11 files/25 tests、Backend focused 70 files/229 tests、threshold pass |
| D5 | Frontend / renderer conformance | complete | 5 catalog types、18 Cartesian presets、frontend focused 22 files/59 tests、Gallery gate |
| D6 | functional Playwright suite | complete | full E2E 10/10、Dashboard suite 3/3を連続2回 |
| D7 | visual regression | complete | Chromium canonical + family/complex baselines 7、diff 0、layout-stable readiness |
| D8 | accessibility / reduced motion | complete | axe serious/critical 0、keyboard/reduced-motion 2/2 |
| D9 | performance / bundle budget | complete | raw/gzip graph budget、expanded shell budget、long-task/panel smoke 1/1 |
| D10 | security / privacy / resilience | complete | production assets 14 scanned、unsafe HTML/test marker 0、existing auth/sanitize/cancel tests |
| D11 | compatibility / variant / packaging | complete | detached snapshot matrix: main/sqlite/SSG/SSR pass、DB drift rows blocked with apply evidence、Dashboard migration 0 |
| D12 | release candidate、rollback、handoff | blocked_by_10 | earlier local evidence is baseline。09/10とD11 revalidation後にcandidate SHAを確定する |

04は[検証・Gallery・Delivery実装計画](./04-testing-and-delivery.md)を正本とする。
新しいVisualization familyは04へ追加しない。現行core rendererを使ってGalleryと品質基盤を完成し、
後続Visualization計画がtype/presetごとのfixture、visual、a11y、bundle budgetを同じgateへ追加できる
状態にする。

D0〜D11の完了証拠は拡張前baselineとして維持する。09/10の最終quality/full packageで追加presetを含む
gateを再実行する。10 O18完了後、D11の互換性matrixを126 preset candidateで再検証してからD12を
`in_progress`へ戻す。

### D0〜D11 / D12 pre-candidate local gate record

- `bun install --frozen-lockfile`: success（237 installs / no changes）。
- `bun run verify`: success（typecheck、lint、format、test、coverage、build）。
- `bun run verify:dashboard-release` with `E2E_PORT=5227`: success。
- `bun run verify:dashboard-release` with `E2E_PORT=5228`: success。layout-stable readiness修正後、同一working-tree snapshotで連続2回通過した。
- `bun run verify:dashboard-release` with `E2E_PORT=5234`: success。documentation link gate追加後の1回目。
- `bun run verify:dashboard-release` with `E2E_PORT=5235`: success。同一working-tree snapshotでの2回目。
- `bun run verify:dashboard-release` with `E2E_PORT=5175`: success。Cartesian review hardening、visual baseline目視更新、30-frame layout readiness後のfull gate。
- `bunx vitest run scripts/verify-dashboard-release.test.ts`: success（1 file / 2 tests）。
- focused Backend: 78 files / 250 tests、statements 84.30%、branches 71.91%、functions 92.30%、lines 85.72%。
- focused Frontend: 22 files / 59 tests、statements 85.80%、branches 73.65%、functions 84.97%、lines 87.59%。
- full E2E: 10/10。Dashboard suite: 3/3。Visual: 2/2を連続実行、Accessibility: 2/2。Performance: 1/1。
- bundle graph: initial raw/gzip `806100 / 233747`、Dashboard shell raw/gzip `279137 / 78001`。18 preset catalog拡張後もbudget `320000 / 90000`内である。
- 05 V11/V12 expanded gate: success（contract 12 files/28 tests、Backend 250 tests、Frontend 59 tests、Gallery 26 cases、E2E 3/3、visual 2/2、a11y 2/2、performance 1/1、security 14 assets、bundle、diff-check）。
- variant snapshot: `/tmp/overlay-dashboard-working.patch`（uncommitted working treeから生成、git管理外）。`main`、`variant/sqlite`はstrict apply + full release pass。`overlay/ssg`、`overlay/ssr`は既存SSR/SSG compositionの共有file conflictを明示除外し、Dashboard API/routeを手動統合後にfull release pass。`variant/postgres`、`variant/pgvector`、`variant/rag`、`variant/turso`、`variant/cloudflare`はstrict `git apply --check`がvariant driftで失敗したため`blocked_by_variant_drift`。current worktree/branchはswitch・commitしていない。

## Cartesian Visualization拡張

```text
Visualization plan: 05-cartesian-visualizations
Plan status: ready
Implementation status: complete
Current work package: V12
Start condition: 04 D0-D3 complete
Target: 3 Cartesian types / 18 presets / net new 15 variations
Last successful command: E2E_PORT=5175 bun run verify:dashboard-release
Next command: none in 05; start 06 R0
Blocker: none; handoff target is 06 R0
```

| WP | 内容 | Status | 完了証拠 |
| --- | --- | --- | --- |
| V0 | prerequisite、baseline、characterization | complete | D0〜D3、existing preset、baseline再確認 |
| V1 | shared Cartesian contracts / preset context | complete | strict schema、18 preset contract、alias migration、composed registration |
| V2 | shared Cartesian model / formatter / primitives | complete | alignment、visible percent、range/waterfall model、effective unit/color、preset summary、legend/tooltip primitives |
| V3 | line/smooth/step/area | complete | family renderer、Gallery cases、E2E |
| V4 | stacked/percent stacked area | complete | stack/percent semantic validation、Gallery cases |
| V5 | range band | complete | lower/upper validation、derived band model、Gallery |
| V6 | Sparkline | complete | compact renderer、single-series validation、Gallery |
| V7 | category bar 5 presets | complete | vertical/horizontal/grouped/stacked/percent、Gallery |
| V8 | time bars / lollipop 3 presets | complete | time/stacked-time/lollipop、Gallery |
| V9 | waterfall | complete | cumulative floating range、semantic colors、connector、synthetic Total、Gallery |
| V10 | composed dual-axis | complete | new type、dynamic renderer、left/right binding・scale・effective unit validation、Gallery |
| V11 | 18-preset quality gate | complete | Gallery 26 cases、Frontend coverage、bundle、E2E、visual、a11y、performance gate success |
| V12 | full verification / handoff | complete | full release gate success、README/LLM_CONTEXT/progress更新、06 R0へhandoff可能 |

05は[Cartesian Visualization拡張実装計画](./05-cartesian-visualizations.md)を正本とする。
V0開始時に`Implementation status`とV0 statusを`in_progress`へ変更する。同時にD packageを
`in_progress`にしない。V12は完了済みであり、現在のhandoff先は06 R0である。05 candidateに対する
04 D11初回matrixはbaselineとして保持し、06 R13後は07 K0へhandoffする。

## Composition / Relationship / Hierarchy / Flow拡張

```text
Visualization plan: 06-composition-relationship-hierarchy-flow
Plan status: ready
Implementation status: complete
Current work package: R13
Start condition: 05 V0-V12 complete
Target: 8 new renderer types / 18 new presets / cumulative 38 presets
Last successful command: E2E_PORT=5176 bun run verify:dashboard-visual
Next command: handoff to 07 K0
Blocker: none
```

| WP | 内容 | Status | 完了証拠 |
| --- | --- | --- | --- |
| R0 | prerequisite、baseline、Recharts audit | complete | Recharts 3.9.2、8 primitive、catalog/bundle audit |
| R1 | shared strict contracts / registrations | complete | 3 schema modules、8 descriptors、strict/default tests |
| R2 | stable color / category composition common | complete | FNV-1a token、percent/duplicate/negative/zero tests |
| R3 | Pie/Donut/Semi/Rose | complete | 4 presets、lazy renderer、Gallery cases |
| R4 | Radar line/filled/multi | complete | 3 presets、axis/series/scale validation、Gallery cases |
| R5 | Radial ranking/progress | complete | 2 presets、max/track validation、Gallery cases |
| R6 | Scatter/Bubble/Quadrant | complete | 3 presets、null skip/size/group validation、Gallery cases |
| R7 | Funnel/Pyramid | complete | 2 presets、stage monotonic/conversion handling、Gallery cases |
| R8 | hierarchy model / validation | complete | root/orphan/cycle/value/depth/limit tests |
| R9 | flat/nested Treemap | complete | 2 presets、nested model adapter、Gallery cases |
| R10 | Sunburst | complete | renderer、depth/path model、Gallery case |
| R11 | Sankey graph model / renderer | complete | endpoint/DAG/flow tests、2-frame Gallery case |
| R12 | 18-preset quality gate | complete | Gallery 64、E2E/visual/a11y/performance/bundle pass、focused coverage 85.79/73.04/86.65/87.87 |
| R13 | full verification / docs / handoff | complete | base verify、contract/backend/frontend coverage、Gallery 64、bundle/security/docs、E2E 3/3、visual 5/5、a11y 3/3、performance 1/1 |

06は[Composition・Relationship・Hierarchy・Flow Visualization拡張実装計画](./06-composition-relationship-hierarchy-flow.md)
を正本とする。R0開始時にこの節の`Implementation status`とR0だけを`in_progress`へ変更し、04 D12を
同時に開始しない。R13完了後は07 K0へhandoffする。R13は全品質ゲートと進捗台帳の更新を完了した。

## KPI / Goal / Status Visualization拡張

```text
Visualization plan: 07-kpi-goal-status-visualizations
Plan status: ready
Implementation status: complete
Current work package: K12
Start condition: 06 R0-R13 complete
Target: 1 expanded type / 5 new types / 21 P4 presets / cumulative 58 presets
Last successful command: `E2E_PORT=5175 bun run verify:dashboard-release`
Next command: handoff to 08 S0
Blocker: none
```

| WP | 内容 | Status | 完了証拠 |
| --- | --- | --- | --- |
| K0 | prerequisite、baseline、capability audit | complete | 06 R13、38 presets、bundle baseline |
| K1 | roles、shared configs、migration | complete | `kpi-visualizations.schema.ts`、role/strict schema tests |
| K2 | value/range/state model | complete | KPI model/range/state pure tests |
| K3 | native SVG / compact primitives | complete | geometry/primitives implementation、typecheck |
| K4 | Stat 5 presets | complete | Stat renderer、5 descriptors、focused tests |
| K5 | Gauge 3 presets | complete | Gauge renderer、3 descriptors、focused tests |
| K6 | Bar Gauge 4 presets | complete | Bar Gauge renderer、limits、focused tests |
| K7 | Bullet 3 presets | complete | Bullet renderer、goal validation |
| K8 | Progress 3 presets | complete | Progress renderer、range/segment validation |
| K9 | Traffic Light 3 presets | complete | Traffic renderer、list/matrix limits |
| K10 | catalog / Gallery conformance | complete | catalog exact 58 presets、Gallery gate 64 cases |
| K11 | expanded quality gate | complete | visual 4/4、a11y 3/3、performance 1/1、bundle 6 KPI rows、Frontend coverage 34 files/85 tests |
| K12 | full verification / docs / handoff | complete | `E2E_PORT=5175 bun run verify:dashboard-release`; 64 Gallery cases、58 presets、08 S0 handoff |

Post-review hardening (2026-07-17): native v2 `operations` に Gauge / Bar Gauge / Bullet / Progress Steps / Traffic Light を組み込み、Gallery 64 fixture の query 実行テストを追加した。percent scale、category role alignment、delta formatting、preset geometry、shape declaration、steps fixture、RadialBar typingを修正。full release gate再実行成功（backend 95 files / 290 tests、branches 78.05%；frontend 36 files / 93 tests、branches 73.56%；E2E 3/3、visual 5/5、a11y 3/3、performance 1/1）。

07は[KPI・Goal・Status Visualization拡張実装計画](./07-kpi-goal-status-visualizations.md)を正本とする。
06 R13完了後、K0を`in_progress`へ変更する。K12完了後は08 S0へhandoffする。

## Distribution / Heatmap / Statistical Visualization拡張

```text
Visualization plan: 08-distribution-heatmap-statistical-visualizations
Plan status: complete
Implementation status: complete
Current work package: S13
Start condition: 07 K0-K12 complete
Target: 4 new renderer types / 20 presets / cumulative 78 presets
Last successful command: `bun run verify:dashboard-release` (08 S13)
Next command: 09 T0 baseline commands
Blocker: none
```

| WP | 内容 | Status | 完了証拠 |
| --- | --- | --- | --- |
| S0 | baseline / capability audit | complete | baseline verify、contract/gallery/bundle baselineを確認 |
| S1 | shared configs / reserved type | complete | strict schemas、core.box-plot reservation |
| S2 | color scale / matrix model | complete | sequential/diverging/status、missing/null/zero tests |
| S3 | histogram transformation / bins | complete | browser-only transformation、bin algorithm/conservation tests |
| S4 | Histogram 5 presets | complete | Gallery 5、Recharts renderer |
| S5 | Heatmap base 3 presets | complete | Gallery 3、native SVG matrix renderer |
| S6 | Heatmap advanced 2 presets | complete | diverging/annotated、cell limits |
| S7 | Box quartile/outlier model | complete | R7/Tukey、stable jitter tests |
| S8 | Box Plot 5 presets | complete | Gallery 5、native SVG renderer |
| S9 | Calendar model / 5 presets | complete | timezone/year/month/rolling/weekday/status tests |
| S10 | Table / summary / accessibility | complete | Table/summary、axe 3/3、keyboard/focus support |
| S11 | 20-preset Gallery conformance | complete | exact cumulative 78 preset contract、84 gallery cases |
| S12 | expanded quality gate | complete | visual 5/5、a11y 3/3、performance 1/1、security、bundle |
| S13 | full verification / docs / handoff | complete | typecheck/lint/format/test/build、release gate、09 T0 handoff |

08は[Distribution・Heatmap・Statistical Visualization拡張実装計画](./08-distribution-heatmap-statistical-visualizations.md)
を正本とする。S0開始時に`in_progress`へ変更する。S13後は09 T0へhandoffする。

## State Timeline / Status History / Uptime Grid / Annotations拡張

```text
Visualization plan: 09-state-timeline-status-annotations
Plan status: complete
Implementation status: complete
Current work package: T13
Start condition: 08 S0-S13 complete
Target: 3 new renderer types / 18 presets / 4 annotation modes / cumulative 102 Gallery cases
Last successful command: bun run verify:dashboard-release
Next command: none; resume only for follow-up fixes or the 04 D11 revalidation
Blocker: none
```

| WP | 内容 | Status | 完了証拠 |
| --- | --- | --- | --- |
| T0 | baseline / capability audit | complete | baseline・catalog・bundle audit完了 |
| T1 | shapes / annotation wire / configs | complete | shared schema/compatibility tests |
| T2 | state resolution / interval model | complete | overlap/gap/open/DST tests |
| T3 | State Timeline 6 presets | complete | Gallery 6 |
| T4 | sample/history model | complete | cadence/missing tests |
| T5 | Status History 6 presets | complete | Gallery 6 |
| T6 | uptime aggregation | complete | DST/coverage tests |
| T7 | Uptime Grid 6 presets | complete | Gallery 6 |
| T8 | annotation model / primitives | complete | event/region/cluster tests |
| T9 | plot overlay integration | complete | Time Series/Bar/state integration |
| T10 | Table / summary / a11y / mobile | complete | semantic table・forced-colors・mobile CSS |
| T11 | Gallery conformance | complete | `bun run verify:dashboard-gallery`、102 cases |
| T12 | expanded quality gate | complete | frontend coverage・bundle・quality gates |
| T13 | full verification / docs / handoff | complete | release gate、docs、10 O0 handoff |

09は[State Timeline・Status History・Uptime Grid・Annotations実装計画](./09-state-timeline-status-annotations.md)
を正本とする。T13完了後は10 O0へhandoffする。userが10を明示的にscope外へ戻した場合だけ、04 D11を96
preset candidateで再検証する。

## Specialized Observability Visualization拡張

```text
Visualization plan: 10-specialized-observability-visualizations
Plan status: ready
Implementation status: complete
Current work package: O18
Start condition: 09 T0-T13 complete
Target: 6 new renderer types / 30 presets / cumulative 126 presets
Last successful command: `E2E_PORT=5191 bun run verify:dashboard-performance`
Next command: Data Source Adapters AD0
Blocker: none
```

| WP | 内容 | Status | 完了証拠 |
| --- | --- | --- | --- |
| O0 | baseline / dependency / capability audit | complete | 09 T13確認、依存追加なし、126 preset target |
| O1 | reserved shape validators / 9 roles / config / definitions | complete | shared schema tests、6 definitions |
| O2 | common limits / text / viewport / scale | complete | pure model tests |
| O3 | graph binding / SCC / layout / critical path | complete | graph model tests |
| O4 | Node Graph 5 presets | complete | Gallery 5 |
| O5 | OHLC invariant / scale / model | complete | OHLC model tests |
| O6 | Candlestick 5 presets | complete | Gallery 5 |
| O7 | log text / ordering / window model | complete | log/window tests |
| O8 | Logs 5 presets | complete | Gallery 5 |
| O9 | trace tree / duration / critical path | complete | trace model tests |
| O10 | Trace 5 presets | complete | Gallery 5 |
| O11 | profile tree / differential / flame layout | complete | profile/layout tests |
| O12 | Flame Graph 5 presets | complete | Gallery 5 |
| O13 | geo projection / clustering / asset provenance | complete | geo/license tests |
| O14 | Geomap 5 presets | complete | Gallery 5 |
| O15 | Table / summary / a11y / mobile / security | complete | frontend/security/browser gates |
| O16 | 30-preset Gallery conformance | complete | `bun run verify:dashboard-gallery`、132 cases / 126 presets |
| O17 | expanded quality gate | complete | visual/a11y/performance/bundle evidence |
| O18 | full verification / docs / handoff | complete | full gates pass、04 D11を次のhandoffへ記録 |

10は[Specialized Observability Visualization実装計画](./10-specialized-observability-visualizations.md)を正本とする。
09 T13後にO0を`in_progress`へ変更する。O18後、11へ進まない場合は04 D11を126 preset candidateで
再検証する。

Plan review（2026-07-17）: repository実装と照合し、既存予約type ID
（`core.node-graph`、`core.candlestick`、`observability.*`、`geo.map`）と7 reserved shapeへ統一した。
new shape IDは0、additive roleは9。shared 2,000-row / 8,192-character limit、Gallery既存category filtering、
Sankey multi-frame patternをbaseline化し、OHLC pixel aggregation、fixed-height log windowing、trace partial/skew、
map asset provenance、Gallery URL/searchを計画へ追加した。実装statusは`complete`。新規shape IDは0、
additive roleは9、Galleryは132 cases (126 success preset + state/integration fixture)である。
2026-07-18の再レビューでは、型検査・lint、focused specialized test 36件、E2E 3/3、visual 5/5、
a11y 3/3、performance 1/1、security 76 assets、bundle gate、`git diff --check`を再実行した。
Logs/Traceは固定高virtual windowへ移行し、mounted row上限の回帰testを追加した。bundle graphはinitial
`838084 / 239993`、Dashboard shell `252479 / 74601` raw/gzip bytesでgateを通過した。variant matrixは
共有worktreeが未コミットのため`blocked_by_uncommitted_candidate`であり、D11再検証のhandoffとして維持する。

## Data Source Adapters

```text
Adapter plan: data-source-adapters
Plan status: complete
Implementation status: complete
Current work package: AD10
Start condition: 10 O0-O18 complete
P0 target: Record[] adapter + SQL / Drizzle helper
P1 target: HTTP / JSON + pipeline recipe
Last successful command: DASHBOARD_FRONTEND_COVERAGE_DIR=coverage/dashboard-frontend-codex-doc-review E2E_PORT=5281 bun run verify:dashboard-release
Next command: rerun 04 D11 compatibility matrix for the adapter candidate
Blocker: none
```

| WP | 優先度 | 内容 | Status | 完了証拠 |
| --- | --- | --- | --- | --- |
| AD0 | P0 | baseline、builder characterization、API型spike | complete | focused tests、typecheck |
| AD1 | P0 | Record column contract、value conversion | complete | `record-adapter.test.ts` |
| AD2 | P0 | `recordsToDataFrameV2`、empty/limit/shape | complete | adapter schema + shape tests |
| AD3 | P0 | `defineRecordQueryV2`、context/refId/state | complete | `record-query.test.ts` |
| AD4 | P0 | `defineDrizzleRecordQueryV2`、read-only composition | complete | helper + abort/limit tests |
| AD5 | P0 | SQLite integration fixture、Quickstart、public export | complete | SQLite gate、doc link gate |
| AD6 | P0 | P0 full gate、handoff | complete | coverage、verify、release gate |
| AD7 | P1 | HTTP request/response security primitives | complete | HTTP security unit tests |
| AD8 | P1 | HTTP JSON query、Zod、error mapping | complete | mocked fetch integration tests |
| AD9 | P1 | pipeline recipe、deterministic fixture | complete | `pipeline-example.test.ts` |
| AD10 | P1 | P1 full gate、docs、release handoff | complete | full Dashboard release gate |

[Data Source Adapters全体計画](./data-source-adapters.md)を契約、
[P0実装計画](./data-source-adapters-p0.md)をP0の実行順と受入条件の正本とする。AD0〜AD10は完了した。
2026-07-18のreview後はadapter focused testsが5 files / 44 tests、backend coverageが125 files / 424 tests、
adapter coverageがstatements 88.07%、branches 84.89%、functions 100%、lines 90.00%で成功した。
frontend coverage 67 files / 199 tests、SQLite read-only integration、full release gateの証跡も維持する。
Visualization roadmap P8は本計画の後続候補として維持する。

## 初期Dashboard v1 実装履歴

```text
Plan status: complete
Implementation status: complete
Current work package: WP12
Base branch: main
Base commit: 8004e49
Implementation branch: overlay/dashboard
Last successful command: bun run verify && bun run verify:dashboard-coverage && bun run verify:e2e && bun run verify:dashboard-bundle && git diff --check
Next command: none; resume only when a target variant is selected for patch application
Blocker: none
```

## Work packages

| WP | 内容 | Status | 完了証拠 |
| --- | --- | --- | --- |
| WP0 | baseline、branch、依存追加 | complete | `bun install --frozen-lockfile`; `bun run verify`; branch `overlay/dashboard` |
| WP1 | 共有 Zod schema | complete | `bunx vitest run shared/schemas/dashboard.schema.test.ts`; `bunx tsc --noEmit` |
| WP2 | Dashboard registry と demo 定義 | complete | `bunx vitest run api/modules/dashboard/dashboard-registry.test.ts` |
| WP3 | variable options と依存 graph | complete | options schema/依存順/静的default/安定sortをregistry testで検証 |
| WP4 | normalizer、result builder、limits | complete | `bunx vitest run api/modules/dashboard/interval.test.ts api/modules/dashboard/normalize-result.test.ts` |
| WP5 | executor、limiter、cancellation、API | complete | `bunx vitest run api/modules/dashboard/query-executor.test.ts api/modules/dashboard/execution-limiter.test.ts api/routes/dashboard.route.test.ts` |
| WP6 | lazy route、search params、API client | complete | `bunx tsc --noEmit`; E2E URL/API request assertion |
| WP7 | variable UI と React Query states | complete | React Query options/panel orchestration、retry/loading/error、canonicalization |
| WP8 | View/Edit Grid と layout persistence | complete | layout/search unit tests、responsive grid、keyboard move |
| WP9 | Chart/Table、threshold、mapping、a11y | complete | chart semantics tests、semantic table、same-response toggle、Recharts a11y layer |
| WP10 | Inspector と drilldown | complete | dev-only inspector、allowlist link resolver test |
| WP11 | Playwright、bundle gate、full verify | complete | `bun run verify`; `bun run verify:e2e`; `bun run verify:dashboard-coverage`; `bun run verify:dashboard-bundle` |
| WP12 | variant適用、文書、release | complete | README/LLM/variant matrix、適用手順、release checklistを更新 |

Statusは`pending | in_progress | complete`だけを使用する。

### WP2-WP5: Backend core、registry、executor、API

- Status: complete
- Started at: 2026-07-16
- Base commit: `8004e49`
- Goal: framework-independentなDashboard moduleと認証保護されたHono APIを実装する。
- Planned files: `api/modules/dashboard/*`, `api/routes/dashboard.route.ts`, `api/routes/dashboard.route.test.ts`, `api/app/hono.ts`
- Files changed: registry、demo、interval、normalizer、result builders、limiter、abort signal、executor、route、app composition
- Commands run:
  - `bunx vitest run api/modules/dashboard/dashboard-registry.test.ts`: success
  - `bunx vitest run api/modules/dashboard/interval.test.ts api/modules/dashboard/normalize-result.test.ts`: success
  - `bunx vitest run api/modules/dashboard/query-executor.test.ts api/modules/dashboard/execution-limiter.test.ts api/routes/dashboard.route.test.ts`: success
  - `bunx tsc --noEmit`: success
- Verification: range resolve、fixed bucket、gap fill、limits、timeout/cancel wiring、structured API errors、manifest/options/panel routes
- Known issues: none
- Next command: implement lazy dashboard route and search-param domain
- Completed at: 2026-07-16

### WP6-WP10: Frontend Dashboard runtime

- Status: complete
- Started at: 2026-07-16
- Base commit: `8004e49`
- Goal: route-level lazy loading、URL filter、React Query、編集可能Grid、Chart/Table、Inspectorを実装する。
- Planned files: `web/src/routes/dashboard-route*.tsx`, `web/src/domains/dashboard/*`, `web/src/router.tsx`, `web/src/routes/root-route.tsx`, `web/src/styles.css`, `vite.config.ts`
- Files changed: lazy route、search/API/query、variable UI、layout state/restore、RGL grid、Recharts renderer、semantic table、inspector/link、styles
- Commands run:
  - `bunx tsc --noEmit`: success
  - `bun run test`: success（32 files / 117 tests）
  - `bun run verify:e2e`: success（dashboard期間/API、Chart/Table toggleを含む）
- Verification: Recharts/Gridはlazy chunkのみ、relative/custom range、filter canonicalization、loading/error/retry/error-with-data/empty/partial/stale/refreshing、12/8/4/1 columns、localStorage restore、threshold/mapping/reference、a11y table、dev-only Inspector、allowlist drilldown
- Known issues: none
- Next command: bundle gateとfull verify、variant/document delivery
- Completed at: 2026-07-16

### WP0: baseline、branch、依存追加

- Status: complete
- Started at: 2026-07-16
- Base commit: `8004e49`
- Goal: `main`を基準に実装ブランチを作成し、既存ゲートを確認する。
- Planned files: none
- Files changed: none（既存の`dist-server/`、`dist-ssg/`、計画書の未追跡変更は保持）
- Commands run:
  - `bun install --frozen-lockfile`: success
  - `bun run verify`: success（typecheck/lint/format/test/coverage/build）
  - `git switch -c overlay/dashboard`: success
- Verification: baseline green
- Known issues: none
- Next command: shared dashboard schema tests
- Completed at: 2026-07-16

### WP1: 共有 Zod schema

- Status: complete
- Started at: 2026-07-16
- Base commit: `8004e49`
- Goal: APIとUIが共有する範囲、変数、manifest、panel data、error envelopeを固定する。
- Planned files: `shared/schemas/dashboard.schema.ts`, `shared/schemas/dashboard.schema.test.ts`
- Files changed: `shared/schemas/dashboard.schema.ts`, `shared/schemas/dashboard.schema.test.ts`
- Commands run:
  - `bunx vitest run shared/schemas/dashboard.schema.test.ts`: success（5 tests）
  - `bunx tsc --noEmit`: success
- Verification:代表manifest、絶対範囲、unsafe link、timeseries/table、error envelopeを検証
- Known issues: none
- Next command: implement dashboard registry and demo definition
- Completed at: 2026-07-16

### WP11: Playwright、bundle gate、full verify

- Status: complete
- Started at: 2026-07-16
- Base commit: `8004e49`
- Goal: Dashboardの実browser、lazy bundle、template全体の品質ゲートを通す。
- Planned files: `tests/e2e/smoke.spec.ts`, `scripts/verify-dashboard-bundle.ts`, `vite.config.ts`, `package.json`
- Files changed: 期間filter/API連動とChart/TableのPlaywright assertion、manifest bundle gate、script登録
- Commands run:
  - `bun run verify`: success（typecheck/lint/format/test/coverage/build）
  - `bun run verify:e2e`: success（3 tests）
  - `bun run verify:dashboard-bundle`: success（initial graphにRecharts/Gridなし）
  - `bun run verify:dashboard-coverage`: success（statements 80.11%、branches 61.57%、functions 82.43%、lines 80.24%）
- Verification: route-level lazy chunk、URL/API request、Chart/Table toggle、既存smokeを確認
- Known issues: variant別の実適用は対象variantを選択した次の作業で行う。現ブランチのmain相当実装はgreen。
- Next command: none
- Completed at: 2026-07-16

### WP12: variant適用、文書、release

- Status: complete
- Started at: 2026-07-16
- Base commit: `8004e49`
- Goal: overlayをmain/variantへ適用するための手順とLuna向け継続実装台帳を固定する。
- Planned files: `README.md`, `LLM_CONTEXT.md`, `docs/template-variant-management.md`, `docs/dashboard-overlay/*`
- Files changed: Dashboardの構成/API/route/verification説明、`overlay/dashboard`のpatch手順、main/代表variant matrix、A1〜A8計画と進捗
- Commands run:
  - `git branch -a`: target branches（variant/postgres、variant/turso、variant/cloudflare、overlay/ssr、overlay/ssg）を確認
  - `git diff --check`: success
- Verification: target branchは作業ツリーの未コミット変更を保持するため直接checkoutせず、patch/mergeと各gateの再現手順を文書化
- Known issues: `variant/*`への実適用はDB/runtimeごとのhandler差し替えが必要。ユーザーが対象variantを指定した時点でmatrixのtarget rowをpassへ更新する。
- Next command: none
- Completed at: 2026-07-16

## 実装ログ

WP開始時に次のtemplateを末尾へ複製する。

```markdown
### WPx: タイトル

- Status: in_progress
- Started at:
- Base commit:
- Goal:
- Planned files:
- Files changed:
- Commands run:
  - `command`: result
- Verification:
- Known issues:
- Next command:
- Completed at:
```

## Resume checklist

1. Visualization 拡張では [コンセプト](./00-concept.md)を最初に読む。
2. [実装計画入口](../dashboard-overlay-implementation-plan.md)を読む。
3. 現在WPの正本文書を読む。
4. `git branch --show-current`を確認する。
5. `git status --short`でユーザー変更とDashboard変更を区別する。
6. `Last successful command`を再実行し、結果が再現することを確認する。
7. `Next command`から続行する。
8. WP完了gateまで次WPへ進まない。
