export const BATTLE_LOGICAL_STEP_MS = 50;
export const BATTLE_MAX_STEPS_PER_FRAME = 5;
const BATTLE_MAX_ACCEPTED_DELTA_MS =
	BATTLE_LOGICAL_STEP_MS * BATTLE_MAX_STEPS_PER_FRAME;

export type BattleClockAdvance = {
	steps: number;
	interpolation: number;
	droppedMs: number;
};

export class BattleSimulationClock {
	private accumulatorMs = 0;

	reset(): void {
		this.accumulatorMs = 0;
	}

	advance(deltaMs: number, running: boolean): BattleClockAdvance {
		if (!running) {
			this.accumulatorMs = 0;
			return { steps: 0, interpolation: 0, droppedMs: 0 };
		}
		const validDelta = Number.isFinite(deltaMs) && deltaMs > 0 ? deltaMs : 0;
		const acceptedDelta = Math.min(validDelta, BATTLE_MAX_ACCEPTED_DELTA_MS);
		const droppedMs = Math.max(0, validDelta - acceptedDelta);
		this.accumulatorMs += acceptedDelta;
		let steps = 0;
		while (
			this.accumulatorMs + Number.EPSILON >= BATTLE_LOGICAL_STEP_MS &&
			steps < BATTLE_MAX_STEPS_PER_FRAME
		) {
			this.accumulatorMs -= BATTLE_LOGICAL_STEP_MS;
			steps += 1;
		}
		if (steps === BATTLE_MAX_STEPS_PER_FRAME) {
			this.accumulatorMs = Math.min(
				this.accumulatorMs,
				BATTLE_LOGICAL_STEP_MS - Number.EPSILON,
			);
		}
		return {
			steps,
			interpolation: Math.max(
				0,
				Math.min(1, this.accumulatorMs / BATTLE_LOGICAL_STEP_MS),
			),
			droppedMs,
		};
	}
}
