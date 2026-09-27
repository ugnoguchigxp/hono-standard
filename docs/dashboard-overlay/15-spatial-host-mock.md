# Spatial physical PC mock

The Spatial view includes one simulated physical PC (`physical-host`) connected to `runtime`. It does not read metrics from the machine running this app. CPU, load average, memory, and disk are separate selectable resource objects. Explicit links show `PC → CPU → Load average` and `PC → Memory / Disk`. Each object and link has its own health; the PC shows the aggregate health. The HTML detail shows exact values and units.

In a non-production environment, open the Spatial surface and use the **Mock scenario** select in the header to switch between normal and fault patterns. The select is disabled when the live connection is unavailable. The current Snapshot determines the selected option.

All endpoints below are under `/api/observatory`, require the existing app session, and return `Cache-Control: no-store`. Mutations are disabled in production (404). This simulator is in process; changes are shared by viewers of the same server process and are lost on restart.

| Method | Path | Action |
| --- | --- | --- |
| GET | `/mock/state` | Full snapshot, including the PC |
| GET | `/mock/stream` | SSE snapshots and updates |
| GET | `/mock/scenarios` | Available patterns and current pattern |
| POST | `/mock/scenario` | Select a pattern with `{ "scenario": "host-memory-pressure" }` |
| GET | `/mock/host` | Current PC mock values |
| POST | `/mock/host` | Replace all PC values with the JSON object below |
| DELETE | `/mock/host` | Remove the custom override and return to the selected pattern |

PC patterns: `normal`, `host-idle`, `host-cpu-saturated`, `host-load-spike`, `host-memory-pressure`, `host-disk-pressure`, `host-mixed-pressure`, and `host-offline`. Existing task, runtime, and total-signal-loss patterns remain available. Selecting a different scenario clears a custom PC override. A custom override remains active across simulation ticks until a different scenario is selected or `DELETE /mock/host` is called.

Example JSON for `POST /mock/host`:

```json
{
  "logicalCores": 8,
  "cpuUsage": 0.95,
  "load1": 9.2,
  "load5": 6.8,
  "load15": 2.1,
  "memoryUsedBytes": 12884901888,
  "memoryTotalBytes": 17179869184,
  "diskUsedBytes": 193273528320,
  "diskTotalBytes": 549755813888
}
```

`cpuUsage` is a fraction from 0 to 1. Used memory and disk must not exceed their totals. The mock assigns `degraded` when CPU reaches 85%, memory or disk reaches 90%, or 1-minute load reaches the logical core count. It assigns `fault` when memory or disk reaches 98%, or load reaches twice the core count. `host-offline` is `disconnected` independently of the last numeric values. The status is a demonstration rule, not a production alert policy.
