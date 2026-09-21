export type NeuronType = "excitatory" | "inhibitory";
export type NeuronRole = "sensory" | "internal" | "motor";
export type RunStatus =
	| "paused"
	| "running"
	| "completed"
	| "dead"
	| "failed"
	| "interrupted";
export type LearningMode = "full" | "frozen" | "no_reward" | "no_structural";
export type EventPhase = 1 | 2 | 3 | 4 | 5 | 6;

export type Position = Readonly<{ x: number; y: number }>;
export type Neuron = {
	id: number;
	type: NeuronType;
	role: NeuronRole;
	position: Position;
	potential: number;
	threshold: number;
	refractoryUntil: number;
	lastUpdatedAt: number;
	lastSpikeAt: number;
	activity: number;
	activityUpdatedAt: number;
	sensitivity: number;
};
export type Synapse = {
	id: number;
	source: number;
	target: number;
	type: NeuronType;
	weight: number;
	delayMs: number;
	createdAt: number;
	lastUsedAt: number;
	eligibility: number;
	traceUpdatedAt: number;
	preTrace: number;
	postTrace: number;
	lastPlasticityDelta: number;
};
export type BrainEvent = {
	atMs: number;
	phase: EventPhase;
	sequence: number;
	kind: "input" | "arrival" | "tick";
	neuronId?: number;
	synapseId?: number;
	strength?: number;
	tick?: string;
};
export type AdvanceResult = {
	simTimeMs: number;
	eventsProcessed: number;
	needsContinuation: boolean;
	terminalReason?: string;
};
export const terminalStatuses = new Set<RunStatus>([
	"completed",
	"dead",
	"failed",
	"interrupted",
]);
