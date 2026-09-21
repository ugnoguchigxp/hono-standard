# Learning-mode control smoke results

Executed 5 scenarios × seeds 1–3 × 4 learning modes, each for 60,000 simulation ms. Aggregate JSON records use the `scenario-mode-seed-N.json` naming pattern.

| Mode | Runs | Spike range | Final topology versions | Motor actions |
| --- | ---: | ---: | --- | ---: |
| full | 15 | 17,644–25,091 | 12,064 | 0 |
| frozen | 15 | 18,339–25,896 | 12,000 | 0 |
| no_reward | 15 | 17,644–25,091 | 12,064 | 0 |
| no_structural | 15 | 17,644–25,091 | 12,000 | 0 |

The frozen and no-structural topology versions remain at the initial count, as required by the mode contracts. All conditions again have zero motor-selected actions; therefore there is no evidence for behavioral learning or a full-vs-control advantage. This short matrix is a deterministic smoke comparison, not the planned 20-seed, 30-minute statistical evaluation.
