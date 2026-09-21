# Organic Brain Sandbox experiment protocol

This protocol evaluates the implemented simulation, not biological intelligence. Every record must include the CLI version, seed, scenario, resolved config, and engine version.

## Fixed comparison

Run each scenario (`food`, `shelter`, `mating`, `competing`, `risk`) with seeds 1, 2, and 3 for 60,000 simulation ms, then repeat with `learningMode=full`, `frozen`, `no_reward`, and `no_structural`. Keep the same seed/config for all modes.

```sh
bun scripts/brain-experiment.ts --scenario food --seed 1 --duration-ms 60000
```

全比較マトリクスは、次のバッチが固定したscenario・seed・learning modeの組をJSONへ保存する。

```sh
bun scripts/brain-comparison-matrix.ts --duration-ms 1800000 --seed-max 20 --output docs/brain-sandbox/results/comparison-matrix.json
```

長時間実行を中断した場合は出力が作成されないため、完走したファイルだけを比較結果として扱う。

Do not select successful seeds or alter input based on an observed action. Store the complete JSON output as an aggregate record; raw spike histories are intentionally not persisted.

## Interpretation

- A: inspect eligibility, reward and `lastPlasticityDelta` for an active synapse.
- B: compare topology versions and added/removed edge counts while asserting neuron identity/position/type are unchanged.
- C/D: require a separate, read-only diagnostic fixture before claiming reproducible local patterns or body-dependent response.
- E: compare integrated homeostatic error, successful interactions and survival across seed-paired controls. A non-improving result is a valid negative outcome.
- F: relate sensor input, motor count, action, body change, reward and edge delta on one simulation timeline.

Current implementation status: the scenario/seed/learning-mode comparisons are runnable, but the required 20-seed, 30-minute experiment matrix and its reported result table have not yet been executed.
