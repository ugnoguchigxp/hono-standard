import type { GameContentRegistry } from "./content";
import type {
	GameSessionCommand,
	GameSessionEvent,
	GameSessionEventEnvelope,
	GameSessionListener,
	GameSessionStatus,
	GameSessionTransition,
	GameState,
} from "./model";
import {
	GameSessionError,
	type GameSessionListenerErrorSink,
} from "./session/errors";
import { type EncounterProvider, GameSessionReducer } from "./session/reducer";
import { cloneGameState } from "./session/state-clone";
import { assertGameStateCompatible } from "./session/state-compatibility";

export {
	GameSessionError,
	type GameSessionErrorCode,
	type GameSessionListenerErrorContext,
	type GameSessionListenerErrorSink,
} from "./session/errors";
export type { EncounterProvider } from "./session/reducer";
export { cloneBattleState, cloneGameState } from "./session/state-clone";
export { assertGameStateCompatible } from "./session/state-compatibility";

export type GameSessionSelectorListener<TValue> = (
	value: TValue,
	previousValue: TValue,
	transition: GameSessionTransition,
) => void;

const assertIdentifier = (value: string, label: string): void => {
	if (value.trim().length === 0) {
		throw new GameSessionError(
			"invalid-command",
			`${label} must not be empty.`,
		);
	}
};

export class GameSession {
	readonly id: string;
	private contentRegistry: GameContentRegistry;
	private state: GameState;
	private sessionStatus: GameSessionStatus = "active";
	private eventSequence = 0;
	private readonly listeners = new Set<GameSessionListener>();
	private readonly reducer: GameSessionReducer;
	private readonly listenerErrorSink?: GameSessionListenerErrorSink;

	constructor(options: {
		sessionId: string;
		initialState: GameState;
		registry: GameContentRegistry;
		encounterProvider: EncounterProvider;
		listenerErrorSink?: GameSessionListenerErrorSink;
	}) {
		assertIdentifier(options.sessionId, "Session ID");
		this.id = options.sessionId;
		this.contentRegistry = options.registry;
		this.reducer = new GameSessionReducer(
			options.registry,
			options.encounterProvider,
		);
		this.listenerErrorSink = options.listenerErrorSink;
		assertGameStateCompatible(options.initialState, this.content);
		this.state = cloneGameState(options.initialState);
	}

	get content(): GameContentRegistry {
		return this.contentRegistry;
	}

	replaceContent(registry: GameContentRegistry): void {
		assertGameStateCompatible(this.state, registry);
		this.contentRegistry = registry;
		this.reducer.replaceContent(registry);
	}

	get status(): GameSessionStatus {
		return this.sessionStatus;
	}

	get sequence(): number {
		return this.eventSequence;
	}

	get revision(): number {
		return this.state.revision;
	}

	snapshot(): GameState {
		return cloneGameState(this.state);
	}

	subscribe(listener: GameSessionListener): () => void {
		this.listeners.add(listener);
		return () => {
			this.listeners.delete(listener);
		};
	}

	subscribeSelector<TValue>(
		selector: (state: GameState) => TValue,
		listener: GameSessionSelectorListener<TValue>,
		isEqual: (left: TValue, right: TValue) => boolean = Object.is,
	): () => void {
		let previousValue = selector(this.snapshot());
		return this.subscribe((transition) => {
			const value = selector(transition.state);
			if (isEqual(previousValue, value)) return;
			const previous = previousValue;
			previousValue = value;
			listener(value, previous, transition);
		});
	}

	dispatch(command: GameSessionCommand): GameSessionTransition {
		this.assertActive();
		const reduced = this.reducer.reduce(this.state, command);
		if (!reduced.changed) {
			return { state: this.snapshot(), events: [] };
		}
		reduced.state.revision = this.state.revision + 1;
		assertGameStateCompatible(reduced.state, this.content);
		this.state = reduced.state;
		const transition = {
			state: this.snapshot(),
			events: reduced.events.map((event) => this.createEvent(event)),
		};
		this.publish(transition);
		return transition;
	}

	pause(): GameSessionEventEnvelope | null {
		if (this.sessionStatus === "paused") return null;
		if (this.sessionStatus === "closed") {
			throw new GameSessionError(
				"invalid-state",
				"A closed session cannot be paused.",
			);
		}
		this.sessionStatus = "paused";
		const event = this.createEvent({ type: "session.paused" });
		this.publish({ state: this.snapshot(), events: [event] });
		return event;
	}

	resume(): GameSessionEventEnvelope | null {
		if (this.sessionStatus === "active") return null;
		if (this.sessionStatus === "closed") {
			throw new GameSessionError(
				"invalid-state",
				"A closed session cannot be resumed.",
			);
		}
		this.sessionStatus = "active";
		const event = this.createEvent({ type: "session.resumed" });
		this.publish({ state: this.snapshot(), events: [event] });
		return event;
	}

	close(): GameSessionEventEnvelope | null {
		if (this.sessionStatus === "closed") return null;
		this.sessionStatus = "closed";
		const event = this.createEvent({ type: "session.closed" });
		this.publish({ state: this.snapshot(), events: [event] });
		this.listeners.clear();
		return event;
	}

	private assertActive(): void {
		if (this.sessionStatus !== "active") {
			throw new GameSessionError(
				"invalid-state",
				`Session commands require active status; current status is ${this.sessionStatus}.`,
			);
		}
	}

	private createEvent(event: GameSessionEvent): GameSessionEventEnvelope {
		this.eventSequence += 1;
		return {
			sessionId: this.id,
			sequence: this.eventSequence,
			stateRevision: this.state.revision,
			event,
		};
	}

	private publish(transition: GameSessionTransition): void {
		for (const listener of this.listeners) {
			try {
				listener(transition);
			} catch (error) {
				try {
					this.listenerErrorSink?.(error, {
						sessionId: this.id,
						sequence: this.eventSequence,
						stateRevision: this.state.revision,
					});
				} catch {
					// Diagnostics must not change a committed game transition.
				}
			}
		}
	}
}
