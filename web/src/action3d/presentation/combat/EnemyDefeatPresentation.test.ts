import { describe, expect, it } from "vitest";
import {
	ENEMY_DEFEAT_SETTLE_MS,
	getEnemyDefeatPresentation,
} from "./EnemyDefeatPresentation";

describe("enemy defeat presentation", () => {
	it("starts upright and reaches a stable fallen pose", () => {
		expect(getEnemyDefeatPresentation(0, 0)).toEqual({
			progress: 0,
			rotationZ: 0,
			settled: false,
		});
		const settled = getEnemyDefeatPresentation(ENEMY_DEFEAT_SETTLE_MS, 0);
		expect(settled.progress).toBe(1);
		expect(settled.rotationZ).toBeCloseTo(1.28);
		expect(settled.settled).toBe(true);
	});

	it("clamps time and alternates fall direction without changing progress", () => {
		const beforeStart = getEnemyDefeatPresentation(-200, 1);
		const longAfterEnd = getEnemyDefeatPresentation(99_000, 1);
		expect(beforeStart.progress).toBe(0);
		expect(longAfterEnd.progress).toBe(1);
		expect(longAfterEnd.rotationZ).toBeCloseTo(-1.28);
		expect(longAfterEnd.settled).toBe(true);
	});

	it("advances monotonically with an eased middle frame", () => {
		const samples = [0, 200, 600, 900, ENEMY_DEFEAT_SETTLE_MS].map(
			(elapsedMs) => getEnemyDefeatPresentation(elapsedMs, 0).progress,
		);
		expect(samples).toEqual([...samples].sort((left, right) => left - right));
		expect(samples[2]).toBeCloseTo(0.5);
	});
});
