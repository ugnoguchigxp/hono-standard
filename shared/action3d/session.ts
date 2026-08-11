import type { Action3dContentRegistry } from "./content";
import {
	ACTION3D_FIXED_STEP_MS,
	EMPTY_ACTION3D_INPUT,
	cloneAction3dState,
	type Action3dEvent,
	type Action3dInput,
	type Action3dState,
} from "./model";
import { stepAction3dState } from "./simulation";

export class Action3dSession {
	readonly content: Action3dContentRegistry;
	private state: Action3dState;
	private accumulatorMs = 0;
	constructor(initialState: Action3dState, content: Action3dContentRegistry) {
		if (initialState.contentVersion !== content.contentVersion)
			throw new Error("Action3D state and content versions do not match.");
		this.state = cloneAction3dState(initialState);
		this.content = content;
	}
	getState(): Action3dState {
		return cloneAction3dState(this.state);
	}
	restore(state: Action3dState): void {
		if (state.contentVersion !== this.content.contentVersion)
			throw new Error("Action3D state and content versions do not match.");
		this.state = cloneAction3dState(state);
		this.accumulatorMs = 0;
	}
	setPaused(paused: boolean): void {
		if (paused && this.state.phase === "playing") this.state.phase = "paused";
		else if (!paused && this.state.phase === "paused")
			this.state.phase = "playing";
	}
	advance(
		deltaMs: number,
		input: Action3dInput,
	): { state: Action3dState; events: Action3dEvent[] } {
		if (!Number.isFinite(deltaMs) || deltaMs < 0)
			throw new Error("Action3D delta must be a non-negative finite duration.");
		this.accumulatorMs = Math.min(
			this.accumulatorMs + deltaMs,
			ACTION3D_FIXED_STEP_MS * 8,
		);
		const events: Action3dEvent[] = [];
		let first = true;
		while (this.accumulatorMs >= ACTION3D_FIXED_STEP_MS) {
			const stepInput = first
				? input
				: {
						...input,
						jump: false,
						dodge: false,
						attack: false,
						lockOn: false,
						pause: false,
					};
			const result = stepAction3dState(
				this.state,
				this.content,
				stepInput,
				ACTION3D_FIXED_STEP_MS,
			);
			this.state = result.state;
			events.push(...result.events);
			this.accumulatorMs -= ACTION3D_FIXED_STEP_MS;
			first = false;
		}
		return { state: this.getState(), events };
	}
	tickIdle(deltaMs: number) {
		return this.advance(deltaMs, { ...EMPTY_ACTION3D_INPUT });
	}
}
