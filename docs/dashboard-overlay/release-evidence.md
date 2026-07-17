# Dashboard Overlay Release Evidence

## Candidate metadata

- Branch: `overlay/dashboard`
- Base / merge-base: `8004e4982e76559f0658ca899f405d79e8816919`
- Candidate: current working-tree snapshot, uncommitted
- Bun / Node: `1.3.14 / v24.11.1`
- Browser: Playwright bundled Chromium, light theme, UTC, reduced motion
- Candidate patch artifact: `/tmp/overlay-dashboard-working.patch` (not git-managed)

## Local quality gates

- `bun run verify`: pass
- `bun run verify:dashboard-contract`: pass, 12 files / 28 tests
- `bun run verify:dashboard-coverage`: pass, 78 files / 250 tests; 84.30% statements, 71.91% branches, 92.30% functions, 85.72% lines
- `bun run verify:dashboard-frontend-coverage`: pass, 22 files / 59 tests; 85.80% statements, 73.65% branches, 84.97% functions, 87.59% lines
- `bun run verify:dashboard-gallery`: pass, 26 cases (18 Cartesian preset cases plus state fixtures)
- `bun run verify:dashboard-doc-links`: pass
- `git diff --check`: pass

## Dependencies and traceability

- Runtime additions: `react-grid-layout@2.2.3`, `recharts@3.9.2`
- Test additions: `@axe-core/playwright@4.11.0`, `@testing-library/dom@10.4.1`, `@testing-library/jest-dom@6.9.1`, `@testing-library/react@16.3.2`, `@testing-library/user-event@14.6.1`, `jsdom@29.1.1`
- Release orchestrator unit test: `scripts/verify-dashboard-release.test.ts`, 1 file / 2 tests
- Documentation link unit/gate test: `scripts/verify-dashboard-doc-links.test.ts`, 1 file / 1 test

| Trace | Representative evidence |
| --- | --- |
| A1 variables | `api/modules/dashboard/v2/variable-options-executor.test.ts`: dependency projection and cancellation |
| A2 normalization | `api/modules/dashboard/v2/frame-normalizer.test.ts`: normalized frame/state contract |
| A3 layout | `web/src/domains/dashboard/v2/layout/layout.test.tsx`: versioned restore, save/cancel/reset, keyboard ordering |
| A4 field config | `shared/schemas/dashboard/field-config.schema.test.ts`: thresholds, units, safe links |
| A5 states | `web/src/domains/dashboard/v2/panel/panel-runtime.test.tsx`: loading/empty/error/fallback and panel isolation |
| A6 Inspector | `web/src/domains/dashboard/v2/inspector/inspector.test.tsx`: sanitized metadata and sensitive frame redaction |
| A7 drilldown | `shared/schemas/dashboard/field-config.schema.test.ts`: same-origin link validation |
| A8 cancellation | `api/modules/dashboard/abort-signals.test.ts` and `api/modules/dashboard/v2/query-coordinator.test.ts`: abort, timeout, and limiter release |

## Browser gates

- Dashboard E2E: 3/3
- Visual: 2/2; 7 tracked baselines (canonical plus family/complex panel baselines), unapproved diff 0
- Accessibility: 2/2; serious/critical axe violations 0
- Performance: 1/1; no long task over the configured 100ms fixture budget
- Security: 14 production JavaScript assets scanned; unsafe HTML and test-secret markers 0
- Browser advisory: Gallery rendered 26 panels; long-task hard gate remained below 100ms. Navigation timing is recorded by the performance test but is not used as an environment-hard absolute.

Visual readiness now waits for settled panel loading, fonts, two animation frames, and 30 consecutive equal layout snapshots. The Cartesian review intentionally changed palette resolution, time-axis formatting, range legend grouping, and Waterfall connectors; the four affected baselines were inspected before update, and the visual suite then passed without an unapproved diff.

## Bundle

- Initial graph: raw/gzip `806100 / 233747`
- Dashboard shell: raw/gzip `279137 / 78001`
- Budget: initial `900000 / 260000`; shell `320000 / 90000`
- Result: pass. Cartesian renderer sharing is verified from the emitted dependency graph rather than a chunk filename; forbidden imports and byte budgets remain enforced.

## Specialized observability extension (2026-07-17)

- Catalog: 6 renderer types × 5 presets = 30 new presets; cumulative success catalog 126 and Gallery 132 cases including state/integration fixtures.
- Contracts/models: `specialized-visualizations.schema.ts`, graph/OHLC/log/trace/profile/geo models, 9 additive roles, and 7 reserved shapes; no runtime dependency added.
- Unit/integration: `bun run typecheck`, `bun run lint`, `bun run format:check`, focused Dashboard Vitest (72 files / 197 tests), and frontend coverage (57 files / 162 tests; statements 84.38%, branches 70.04%, functions 84.94%, lines 86.83%) pass.
- Browser: E2E 3/3, visual 5/5, accessibility 3/3, performance 1/1, and security 76 production assets pass.
- Gallery and bundle: `bun run verify:dashboard-gallery` (132 cases) and `bun run verify:dashboard-bundle` pass. Bundle gate measured initial `838073 / 239993` and shell `244543 / 71654` raw/gzip bytes.
- Remaining handoff: implement [Data Source Adapters](./data-source-adapters.md) AD0〜AD10, then run 04 D11 against the adapter candidate. Visualization roadmap P8 remains a later plan. No commit, tag, push, or release side effect was performed.

## Release orchestrator

- Orchestrator unit test: pass, 1 file / 2 tests; verifies gate order, streamed child output, and fail-fast behavior
- `E2E_PORT=5227 bun run verify:dashboard-release`: pass
- `E2E_PORT=5228 bun run verify:dashboard-release`: pass
- `E2E_PORT=5234 bun run verify:dashboard-release`: pass (documentation-link gate included)
- `E2E_PORT=5235 bun run verify:dashboard-release`: pass (same working-tree snapshot, second run)
- `E2E_PORT=5175 bun run verify:dashboard-release`: pass after Cartesian review hardening and visual baseline review
- Both runs used the same uncommitted working-tree snapshot; no source or baseline changed between runs.

## Compatibility and migration

- v1 wire/schema compatibility tests: pass
- layout/config normalization and Gallery key separation: pass
- Dashboard-specific DB migration: 0
- Gallery uses native v2 transport and the common `PanelShell`; no public force-error API or Gallery DB seed was added.
- SSG/SSR: detached `verify` and release runs passed with the variant build paths; Dashboard routes remain client/lazy paths rather than prerendered data routes.

## Variant matrix

| Target | Patch check / adaptation | Runtime result | Evidence |
| --- | --- | --- | --- |
| `main` | strict `git apply --check` + apply | pass | full release gate in detached worktree |
| `variant/sqlite` | strict `git apply --check` + apply | pass | full release gate in detached worktree |
| `overlay/ssg` | shared SSG composition files excluded from strict patch; Dashboard API/route manually integrated in temp worktree | pass | typecheck, `verify`, full release gate; `build:ssg` path retained |
| `overlay/ssr` | shared SSR composition files excluded from strict patch; Dashboard API/route manually integrated in temp worktree | pass | typecheck, `verify`, full release gate; SSR build/hydration path retained |
| `variant/postgres` | strict `git apply --check` | blocked | variant drift in app/db/auth composition; no 3-way apply used |
| `variant/pgvector` | strict `git apply --check` | blocked | variant drift in app/db/auth composition; no 3-way apply used |
| `variant/rag` | strict `git apply --check` | blocked | substantial route/app composition drift; no 3-way apply used |
| `variant/turso` | strict `git apply --check` | blocked | DB adapter drift; no 3-way apply used |
| `variant/cloudflare` | strict `git apply --check` | blocked | runtime/app composition drift; no 3-way apply used |

All detached worktrees were created under `/tmp/hono-standard-dashboard-20260717-0916b-*`; the user worktree stayed on `overlay/dashboard` and was never switched, staged, committed, tagged, or pushed. Blocked DB rows are explicit and are not counted as pass.

## Rollback

1. Return deployment to the previous artifact or revert the approved overlay commit.
2. Remove Dashboard route/navigation and module registration.
3. Restore package and lockfile changes.
4. Run normal auth, showcase, and protected-route smoke tests.
5. Do not run a DB rollback: this overlay adds no Dashboard migration, business seed, or server Dashboard data.

## Final decision

`ready_pending_candidate_commit_approval` — implementation, local full gates, and required `main`/SSG/SSR plus SQLite detached verification are complete. The candidate remains uncommitted because commit/tag/push/release side effects require explicit user approval. PostgreSQL-family variants are recorded as blocked by strict patch conflicts and need target-specific adapter work before those releases.

- Tag candidate: pending version selection and candidate commit approval.
- Known limitations: no candidate SHA exists yet; PostgreSQL-family rows remain blocked by strict variant drift.
