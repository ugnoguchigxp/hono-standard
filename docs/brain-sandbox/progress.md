# Organic Brain Sandbox progress

Implementation plan: [brain-sandbox-implementation-plan.md](../brain-sandbox-implementation-plan.md).

## Baseline

- Start commit and pre-existing working-tree changes were preserved. Existing changes: `.github/workflows/verify.yml`, `README.md`, `bun.lock`, `docs/operations.md`, `package.json`, `playwright.config.ts`, and `templates/authless/README.md`.
- T00: completed the design/source review and baseline recording. The workspace contains the preserved concept document.

## Completed implementation slices

- T01–T04: added validated config/contracts, deterministic named PRNG streams, bounded `(time, phase, sequence)` heap, fixed-node topology/network ownership, and event-driven integrate-and-fire runtime.
- T05–T06: connected local pre/post traces and delayed reward application to the runtime, plus bounded homeostasis and structural maintenance. Node identity, type and position remain immutable.
- T07–T10: added a bounded grid/body model, sensory encoding, motor decoding, telemetry/snapshot helpers, bounded recorder, and a headless experiment entry point (`bun scripts/brain-experiment.ts --scenario food --seed 1 --duration-ms 60000`).
- T11–T12: added persistence schema/migration and a durable adapter for create/control/checkpoint/terminal snapshots. Startup marks incomplete runs as `interrupted`; a singleton cooperative scheduler is stopped before DB shutdown.
- The experiment list merges active runtimes with durable history; completed snapshots remain readable from persistence after the runtime registry no longer has the run.
- T13–T15 (initial integration): added authenticated experiment/control/snapshot/export/inspector APIs, in-process ownership/control service, and a protected browser route with basic Create/Run/Pause/Step/Reset controls.
- T14–T15 (partial): added server-sent event snapshots, sequenced batch notifications, heartbeat/abort cleanup, shutdown closure, chunk-safe browser-side SSE parsing, and reconnecting observation state.
- SSE now enforces the planned maximum of two concurrent subscriptions per owner and releases the slot on cancellation/shutdown.
- The SSE client uses the same cookie/401-refresh transport as the rest of the protected API.
- T20 authless isolation: generator now explicitly removes brain runtime, persistence, routes, schemas, CLI, UI, and brain migration from the authless template; generator contract test passes.
- Browser E2E covers login, creation, Step, Run, Pause and Reset in both Chromium and mobile Chromium. The E2E test deliberately uses separate seeded users because active-run ownership is limited per user.
- T16–T17 (partial): added world/body and fixed-layout neural-network Canvas views from observation snapshots.
- T18 (partial): added a read-only timeline and aggregate metrics panel sourced from the same observation snapshot.
- T19 (partial): documented a reproducible scenario/seed/learning-mode protocol. The CLI now validates scenario and learning mode and can write a JSON report.
- A comparison-matrix batch now fixes all five scenarios, seed 1–20, and four learning modes into one JSON artifact; the full 30-minute matrix has not yet completed on this host.
- Executed the initial 5-scenario × 3-seed × 60-second smoke matrix. Results record the negative finding that no motor-selected actions occurred; see `results/initial-smoke-results.md`.
- Executed the corresponding four-mode control smoke matrix. `frozen` and `no_structural` retain initial topology, while every condition still has zero motor-selected actions; see `results/control-smoke-results.md`.

## Verification recorded

- `bun run typecheck` passed.
- `bun run build:web` passed.
- `bun scripts/brain-experiment.ts --scenario food --seed 1 --duration-ms 1000` passed.
- `bun scripts/brain-experiment.ts --scenario food --seed 1 --duration-ms 60000` completed with deterministic event processing.
- `bun run verify` reaches its full unit suite successfully, but correctly fails the existing 95% coverage gate: the newly added brain/UI/API source is not yet covered sufficiently (statements 92.77%, branches 86.23%, functions 92.22%, lines 94.01%). No threshold was lowered.
- `bun run verify:e2e` passes all 22 browser tests across Chromium and mobile Chromium.
- The backup-recovery and graceful-shutdown integration tests pass after making the scheduler timer non-owning (`unref`): it cannot keep CLI processes alive after their DB runtime closes.
- `bun run audit` was executed and reports five pre-existing moderate advisories in direct Hono/Vitest dependency ranges. No dependency update was applied because `package.json` and `bun.lock` were already user-modified before this work.

## Remaining plan items

T11 DB adapter integration coverage, T13 full API contract, T14 backpressure/subscription-limit enforcement, T15 reconnecting client/store completion, T16–T20 visualization, experiment protocol, E2E, performance and delivery gates remain to be completed. Full coverage for the implemented modules is also still required.
