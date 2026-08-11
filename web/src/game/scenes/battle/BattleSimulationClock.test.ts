import { advanceBattle, createDemoBattleState, createInitialGameState } from "@shared/game";
import { describe, expect, it } from "vitest";
import { validateGameContentDirectory } from "../../../../../scripts/validate-game-content";
import {
	BATTLE_LOGICAL_STEP_MS,
	BattleSimulationClock,
} from "./BattleSimulationClock";

const registry = validateGameContentDirectory();

const simulate = (fps: number) => {
	const initial = createInitialGameState({ registry, rngSeed: 9 });
	let battle = createDemoBattleState(initial.party.members);
	const events: unknown[] = [];
	const clock = new BattleSimulationClock();
	for (let frame = 0; frame < fps * 2; frame += 1) {
		const tick = clock.advance(1_000 / fps, battle.phase === "running");
		for (let step = 0; step < tick.steps; step += 1) {
			if (battle.phase !== "running") break;
			const transition = advanceBattle(battle, BATTLE_LOGICAL_STEP_MS);
			battle = transition.state;
			events.push(...transition.events);
		}
	}
	return { battle, events };
};

describe("BattleSimulationClock", () => {
	it("produces identical logical battle state at 30, 60, and 120 fps", () => {
		expect(simulate(30)).toEqual(simulate(60));
		expect(simulate(120)).toEqual(simulate(60));
	});

	it("bounds catch-up work and reports discarded wall time", () => {
		const clock = new BattleSimulationClock();
		expect(clock.advance(1_250, true)).toEqual({
			steps: 5,
			interpolation: 0,
			droppedMs: 1_000,
		});
		expect(clock.advance(Number.NaN, true).steps).toBe(0);
		expect(clock.advance(-10, true).steps).toBe(0);
	});

	it("does not catch up time accumulated while presentation is paused", () => {
		const clock = new BattleSimulationClock();
		expect(clock.advance(49, true).steps).toBe(0);
		expect(clock.advance(1_000, false)).toEqual({
			steps: 0,
			interpolation: 0,
			droppedMs: 0,
		});
		expect(clock.advance(1, true).steps).toBe(0);
		clock.reset();
		expect(clock.advance(50, true).steps).toBe(1);
	});
});
