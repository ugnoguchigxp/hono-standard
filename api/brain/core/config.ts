import type { LearningMode } from "./types";

export const ENGINE_VERSION = 1;
export const CONFIG_VERSION = 1;
export type BrainConfig = Readonly<{
	engineVersion: number;
	configVersion: number;
	neuronCount: number;
	inhibitoryFraction: number;
	sensoryChannels: number;
	sensoryPerChannel: number;
	motorActions: number;
	motorPerAction: number;
	initialOutdegree: number;
	maxOutdegree: number;
	synapseBudget: number;
	distanceLambda: number;
	minDelayMs: number;
	maxDelayMs: number;
	minWeight: number;
	maxWeight: number;
	restingPotential: number;
	threshold: number;
	tauMs: number;
	refractoryMs: number;
	minPotential: number;
	queueLimit: number;
	learningMode: LearningMode;
	stdpLearningRate: number;
}>;
export const defaultBrainConfig: BrainConfig = Object.freeze({
	engineVersion: ENGINE_VERSION,
	configVersion: CONFIG_VERSION,
	neuronCount: 1000,
	inhibitoryFraction: 0.2,
	sensoryChannels: 12,
	sensoryPerChannel: 4,
	motorActions: 6,
	motorPerAction: 4,
	initialOutdegree: 12,
	maxOutdegree: 32,
	synapseBudget: 20000,
	distanceLambda: 0.15,
	minDelayMs: 1,
	maxDelayMs: 20,
	minWeight: 0.05,
	maxWeight: 1,
	restingPotential: 0,
	threshold: 1,
	tauMs: 20,
	refractoryMs: 3,
	minPotential: -2,
	queueLimit: 100000,
	learningMode: "full",
	stdpLearningRate: 0.01,
});
export type ConfigOverrides = Partial<
	Omit<BrainConfig, "engineVersion" | "configVersion">
>;
const integer = (value: number, name: string, min: number, max: number) => {
	if (!Number.isInteger(value) || value < min || value > max)
		throw new RangeError(
			`${name} must be an integer between ${min} and ${max}`,
		);
};
const finite = (value: number, name: string, min: number, max: number) => {
	if (!Number.isFinite(value) || value < min || value > max)
		throw new RangeError(`${name} must be between ${min} and ${max}`);
};
export function resolveBrainConfig(
	overrides: ConfigOverrides = {},
): BrainConfig {
	for (const key of Object.keys(overrides))
		if (!(key in defaultBrainConfig))
			throw new RangeError(`Unknown config key: ${key}`);
	const config = { ...defaultBrainConfig, ...overrides };
	integer(config.neuronCount, "neuronCount", 100, 2000);
	finite(config.inhibitoryFraction, "inhibitoryFraction", 0, 0.9);
	integer(config.initialOutdegree, "initialOutdegree", 0, 32);
	integer(config.maxOutdegree, "maxOutdegree", config.initialOutdegree, 32);
	integer(config.synapseBudget, "synapseBudget", 1, 20000);
	integer(config.minDelayMs, "minDelayMs", 1, 20);
	integer(config.maxDelayMs, "maxDelayMs", config.minDelayMs, 20);
	finite(config.minWeight, "minWeight", 0, 1);
	finite(config.maxWeight, "maxWeight", config.minWeight, 1);
	finite(config.threshold, "threshold", 0.3, 3);
	if (
		config.sensoryChannels * config.sensoryPerChannel +
			config.motorActions * config.motorPerAction >=
		config.neuronCount
	)
		throw new RangeError(
			"neuronCount is too small for sensory and motor populations",
		);
	if (config.initialOutdegree * config.neuronCount > config.synapseBudget)
		throw new RangeError("synapseBudget cannot contain initial topology");
	return Object.freeze(config);
}
