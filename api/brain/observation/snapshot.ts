import type { Experiment } from "../experiment/experiment";
export function createSnapshot(experiment: Experiment) {
	return Object.freeze(structuredClone(experiment.snapshot()));
}
