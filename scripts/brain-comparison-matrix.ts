import { existsSync } from "node:fs";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createExperiment } from "../api/brain/experiment/experiment";
import { scenarios, type Scenario } from "../api/brain/experiment/scenario";
import type { LearningMode } from "../api/brain/core/types";

const options = process.argv.slice(2);
const value = (name: string, fallback: string) => {
	const index = options.indexOf(name);
	return index < 0 ? fallback : (options[index + 1] ?? fallback);
};
const durationMs = Number(value("--duration-ms", "1800000"));
const output = value(
	"--output",
	"docs/brain-sandbox/results/comparison-matrix.json",
);
const seedMax = Number(value("--seed-max", "20"));
if (!Number.isInteger(durationMs) || durationMs < 1)
	throw new Error("--duration-ms must be a positive integer");
if (!Number.isInteger(seedMax) || seedMax < 1 || seedMax > 0xffffffff)
	throw new Error("--seed-max must be a positive integer");

const modes: LearningMode[] = ["full", "frozen", "no_reward", "no_structural"];
type Row = {
	scenario: Scenario;
	seed: number;
	learningMode: LearningMode;
	durationMs: number;
	[key: string]: unknown;
};
const rows: Row[] = existsSync(output)
	? (
			(JSON.parse(await readFile(output, "utf8")) as { rows?: Row[] }).rows ??
			[]
		).filter((row) => row.durationMs === durationMs && row.seed <= seedMax)
	: [];
const completed = new Set(
	rows.map((row) => `${row.scenario}:${row.seed}:${row.learningMode}`),
);
await mkdir(dirname(output), { recursive: true });
const persist = async () =>
	Bun.write(
		output,
		JSON.stringify(
			{
				schemaVersion: 1,
				generatedAt: new Date().toISOString(),
				durationMs,
				seedRange: [1, seedMax],
				modes,
				scenarios,
				rows,
			},
			null,
			2,
		),
	);
for (const scenario of scenarios) {
	for (let seed = 1; seed <= seedMax; seed++) {
		for (const learningMode of modes) {
			if (completed.has(`${scenario}:${seed}:${learningMode}`)) continue;
			const experiment = createExperiment({ learningMode }, seed, scenario);
			let result = experiment.advanceTo(durationMs, 2000);
			while (result.needsContinuation)
				result = experiment.advanceTo(durationMs, 2000);
			const snapshot = experiment.snapshot();
			rows.push({
				scenario: scenario as Scenario,
				seed,
				learningMode,
				durationMs,
				status: snapshot.status,
				simTimeMs: snapshot.simTimeMs,
				terminalReason: snapshot.terminalReason,
				body: snapshot.body,
				counters: snapshot.counters,
				topologyVersion: snapshot.topologyVersion,
				actionCount: experiment.actions.length,
			});
			await persist();
		}
	}
}
await persist();
console.log(join(process.cwd(), output));
