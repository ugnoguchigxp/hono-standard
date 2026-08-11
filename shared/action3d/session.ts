import type { Action3dContentRegistry } from "./content";
import {
	ACTION3D_FIXED_STEP_MS,
	EMPTY_ACTION3D_INPUT,
	cloneAction3dState,
	type Action3dEvent,
	type Action3dInput,
	type Action3dState,
} from "./model";
import { createAction3dWorldState, stepOwnedAction3dState } from "./simulation";

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
	/**
	 * Returns the session-owned state for synchronous render-loop reads. Callers
	 * must not mutate or retain this view beyond the current frame.
	 */
	getFrameState(): Readonly<Action3dState> {
		return this.state;
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
	enterWorld(worldId: string, spawnId: string): Action3dState {
		this.state = createAction3dWorldState(
			this.state,
			this.content,
			worldId,
			spawnId,
		);
		this.accumulatorMs = 0;
		return this.getState();
	}
	advance(
		deltaMs: number,
		input: Action3dInput,
	): { state: Action3dState; events: Action3dEvent[] } {
		const events = this.advanceOwnedState(deltaMs, input);
		return { state: this.getState(), events };
	}
	/**
	 * Render-loop variant whose state is borrowed until the next session write.
	 * UI, save, and asynchronous consumers must use getState() instead.
	 */
	advanceFrame(
		deltaMs: number,
		input: Action3dInput,
	): { state: Readonly<Action3dState>; events: Action3dEvent[] } {
		const events = this.advanceOwnedState(deltaMs, input);
		return { state: this.state, events };
	}
	private advanceOwnedState(
		deltaMs: number,
		input: Action3dInput,
	): Action3dEvent[] {
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
						heavyAttack: false,
						lockOn: false,
						pause: false,
					};
			const stepEvents = stepOwnedAction3dState(
				this.state,
				this.content,
				stepInput,
				ACTION3D_FIXED_STEP_MS,
			);
			events.push(...stepEvents);
			this.accumulatorMs -= ACTION3D_FIXED_STEP_MS;
			first = false;
		}
		return events;
	}
	tickIdle(deltaMs: number) {
		return this.advance(deltaMs, { ...EMPTY_ACTION3D_INPUT });
	}
}
