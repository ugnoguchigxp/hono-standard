import { DEFAULT_GAME_RNG_SEED, type DeterministicRandomState } from "./model";

const UINT32_RANGE = 0x1_0000_0000;
const LCG_MULTIPLIER = 1_664_525;
const LCG_INCREMENT = 1_013_904_223;

export class DeterministicRandomError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DeterministicRandomError";
	}
}

const toUint32 = (value: number, label: string): number => {
	if (!Number.isSafeInteger(value)) {
		throw new DeterministicRandomError(`${label} must be a safe integer.`);
	}
	return value >>> 0;
};

const validateDraws = (draws: number): void => {
	if (!Number.isSafeInteger(draws) || draws < 0) {
		throw new DeterministicRandomError(
			"Random draw count must be a non-negative safe integer.",
		);
	}
};

export function createRandomState(
	seed: number = DEFAULT_GAME_RNG_SEED,
): DeterministicRandomState {
	const normalizedSeed = toUint32(seed, "Random seed");
	return {
		seed: normalizedSeed,
		state: normalizedSeed,
		draws: 0,
	};
}

export function nextRandom(random: DeterministicRandomState): {
	state: DeterministicRandomState;
	value: number;
} {
	const seed = toUint32(random.seed, "Random seed");
	const currentState = toUint32(random.state, "Random state");
	validateDraws(random.draws);
	const nextState =
		(Math.imul(currentState, LCG_MULTIPLIER) + LCG_INCREMENT) >>> 0;
	return {
		state: {
			seed,
			state: nextState,
			draws: random.draws + 1,
		},
		value: nextState / UINT32_RANGE,
	};
}
