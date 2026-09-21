import type { ModulatorState } from "./modulator-state";
export function updateModulators(
	_state: ModulatorState,
	errorBefore: number,
	errorAfter: number,
	threat: number,
	novelty: number,
): ModulatorState {
	return {
		reward: Math.max(-1, Math.min(1, 5 * (errorBefore - errorAfter))),
		threat: Math.max(0, Math.min(1, threat)),
		novelty: Math.max(0, Math.min(1, novelty)),
		arousal: Math.max(0, Math.min(1, (errorAfter + threat) / 2)),
	};
}
