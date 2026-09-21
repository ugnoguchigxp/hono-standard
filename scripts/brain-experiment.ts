import { createExperiment } from "../api/brain/experiment/experiment";
import { scenarios, type Scenario } from "../api/brain/experiment/scenario";
import type { LearningMode } from "../api/brain/core/types";
const values = process.argv.slice(2);
const get = (name: string, fallback?: string) =>
	values.includes(name) ? values[values.indexOf(name) + 1] : fallback;
const seed = Number(get("--seed", "1"));
const duration = Number(get("--duration-ms", "60000"));
const scenario = get("--scenario", "food");
const learningMode = get("--learning-mode", "full");
const output = get("--output");
const summaryOnly = values.includes("--summary");
if (
	!Number.isInteger(seed) ||
	seed < 0 ||
	seed > 0xffffffff ||
	!Number.isInteger(duration) ||
	duration < 1
)
	throw new Error(
		"--seed must be uint32 and --duration-ms must be a positive integer",
	);
if (!scenarios.includes(scenario as Scenario))
	throw new Error(`--scenario must be one of: ${scenarios.join(", ")}`);
if (
	!["full", "frozen", "no_reward", "no_structural"].includes(learningMode ?? "")
)
	throw new Error(
		"--learning-mode must be full, frozen, no_reward, or no_structural",
	);
const experiment = createExperiment(
	{ learningMode: learningMode as LearningMode },
	seed,
	scenario as Scenario,
);
let result = experiment.advanceTo(duration, 2000);
while (result.needsContinuation) result = experiment.advanceTo(duration, 2000);
const snapshot = experiment.snapshot();
const report = JSON.stringify(
	summaryOnly
		? {
				seed,
				scenario,
				learningMode,
				durationMs: duration,
				status: snapshot.status,
				simTimeMs: snapshot.simTimeMs,
				body: snapshot.body,
				counters: snapshot.counters,
				topologyVersion: snapshot.topologyVersion,
				actionCount: experiment.actions.length,
			}
		: {
				seed,
				scenario,
				durationMs: duration,
				actions: experiment.actions,
				snapshot,
			},
	null,
	2,
);
if (output) await Bun.write(output, report);
console.log(report);
