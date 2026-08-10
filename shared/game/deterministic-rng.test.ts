import { describe, expect, it } from "vitest";
import {
	createRandomState,
	DeterministicRandomError,
	nextRandom,
} from "./deterministic-rng";
import { DEFAULT_GAME_RNG_SEED } from "./model";

describe("deterministic RNG", () => {
	it("creates the default serializable state", () => {
		expect(createRandomState()).toEqual({
			seed: DEFAULT_GAME_RNG_SEED,
			state: DEFAULT_GAME_RNG_SEED,
			draws: 0,
		});
	});

	it("produces the same immutable sequence for the same seed", () => {
		const original = createRandomState(42);
		let left = original;
		let right = createRandomState(42);
		const leftValues: number[] = [];
		const rightValues: number[] = [];

		for (let draw = 0; draw < 5; draw += 1) {
			const nextLeft = nextRandom(left);
			const nextRight = nextRandom(right);
			leftValues.push(nextLeft.value);
			rightValues.push(nextRight.value);
			left = nextLeft.state;
			right = nextRight.state;
		}

		expect(leftValues).toEqual(rightValues);
		expect(new Set(leftValues).size).toBeGreaterThan(1);
		expect(leftValues.every((value) => value >= 0 && value < 1)).toBe(true);
		expect(left.draws).toBe(5);
		expect(original).toEqual({ seed: 42, state: 42, draws: 0 });
	});

	it("produces different sequences from different seeds", () => {
		expect(nextRandom(createRandomState(1)).value).not.toBe(
			nextRandom(createRandomState(2)).value,
		);
		expect(createRandomState(-1).seed).toBe(0xffff_ffff);
	});

	it("rejects invalid seed, state, and draw counts", () => {
		for (const seed of [Number.NaN, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
			expect(() => createRandomState(seed)).toThrow(DeterministicRandomError);
		}

		expect(() =>
			nextRandom({ seed: 1.2, state: 1, draws: 0 }),
		).toThrow("Random seed");
		expect(() =>
			nextRandom({ seed: 1, state: Number.NaN, draws: 0 }),
		).toThrow("Random state");
		for (const draws of [-1, 0.5]) {
			expect(() => nextRandom({ seed: 1, state: 1, draws })).toThrow(
				"draw count",
			);
		}
	});
});
