# Initial scenario smoke results

Executed on the local Bun runtime with `engineVersion=1`, `configVersion=1`, `learningMode=full`, seeds 1–3, and 60,000 simulation ms. The raw aggregate JSON records sit beside this file.

| Scenario | Seeds | Final energy | Final hunger | Final fatigue | Spike range | Topology version | Actions |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| food | 1–3 | .590 | .720 | .260 | 17,644–18,064 | 12,064 | 0 |
| shelter | 1–3 | .590 | .720 | .760 | 21,632–22,418 | 12,064 | 0 |
| mating | 1–3 | .590 | .720 | .260 | 20,513–21,260 | 12,064 | 0 |
| competing | 1–3 | .590 | .820 | .760 | 22,350–23,188 | 12,064 | 0 |
| risk | 1–3 | .590 | .820 | .760 | 24,352–25,091 | 12,064 | 0 |

## Interpretation

- A/B: activity and one structural maintenance pass are observable; this smoke run does not itself establish a learning effect.
- C/D: not evaluated. The planned read-only diagnostic fixture has not been implemented.
- E: **not achieved**. All 15 runs produced zero motor-selected actions, so no behavior comparison is justified.
- F: **partial**. The telemetry data path is available, but a successful action-to-reward-to-weight trace is absent because there were no actions.

This is a negative result, not a reason to add action rules or select favorable seeds. The planned 20-seed, 30-minute comparison and frozen/no-reward/no-structural controls remain unexecuted.
