import type { Experiment } from "../experiment/experiment";
export type TelemetryBatch = {
	schemaVersion: 1;
	runId: string;
	sequence: number;
	simTimeMs: number;
	status: string;
	topologyVersion: number;
	body: unknown;
	modulator: unknown;
	counters: unknown;
};
export function createTelemetry(
	experiment: Experiment,
	runId: string,
	sequence: number,
	status: string,
): TelemetryBatch {
	const snapshot = experiment.snapshot();
	return {
		schemaVersion: 1,
		runId,
		sequence,
		simTimeMs: snapshot.simTimeMs,
		status,
		topologyVersion: snapshot.topologyVersion,
		body: snapshot.body,
		modulator: snapshot.modulator,
		counters: snapshot.counters,
	};
}
