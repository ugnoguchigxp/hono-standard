# Brain Sandbox operations

## Start and access

Run database migrations before starting the API, then sign in and open `/brain-sandbox`. The feature is authenticated; ownership checks intentionally return 404 for another user's run.

Create an experiment with a seed and scenario. Run, Pause, Step and Reset are server commands. Step advances exactly 100 simulation milliseconds. Speed changes scheduler target time only; it does not alter neural or learning constants.

## Persistence and restart

The service writes experiment metadata, checkpoints, command responses and terminal snapshots through the database single writer. Snapshots are observation artifacts, not resumable process images: they omit event-queue and PRNG-internal state. On startup, persisted `running` and `paused` experiments are marked `interrupted`; they are not silently resumed.

The runtime accepts at most one active run per user and four active runs per server. A process shutdown stops the scheduler and closes streams before closing the database.

## Limits and known results

Telemetry is an observation channel. It cannot advance simulation, and consumers should reconnect from a full snapshot after a disconnect. The current smoke matrix is documented in `results/initial-smoke-results.md`; it found no motor-selected actions in its 15 runs. This is explicitly an unachieved behavioral-learning result, not a configuration to conceal with action rules.

The final 20-seed, 30-minute comparison matrix, complete SSE backpressure limits, E2E coverage, and 95% project coverage gate are still pending. Do not treat the smoke result as validation of the hypothesis.
