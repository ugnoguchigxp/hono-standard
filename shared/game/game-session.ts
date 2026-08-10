import type {
	BattleState,
	CharacterState,
	GameSessionCommand,
	GameSessionEvent,
	GameSessionEventEnvelope,
	GameSessionListener,
	GameSessionStatus,
	GameSessionTransition,
	GameState,
} from "./model";
import { advanceBattle, applyBattleCommand } from "./battle-engine";
import { moveFieldParty } from "./field-engine";

export class GameSessionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "GameSessionError";
	}
}

const cloneCharacter = (character: CharacterState): CharacterState => ({
	...character,
	ability: { ...character.ability },
});

export const cloneBattleState = (
	battle: BattleState | null,
): BattleState | null =>
	battle
		? {
				...battle,
				party: battle.party.map((member) => ({
					...cloneCharacter(member),
					side: member.side,
					actionGauge: member.actionGauge,
					defending: member.defending,
				})),
				enemies: battle.enemies.map((enemy) => ({
					...cloneCharacter(enemy),
					side: enemy.side,
					actionGauge: enemy.actionGauge,
					defending: enemy.defending,
				})),
			}
		: null;

export const cloneGameState = (state: GameState): GameState => ({
	...state,
	rng: { ...state.rng },
	field: {
		...state.field,
		partyPositions: state.field.partyPositions.map((position) => ({
			...position,
		})),
	},
	currentMap: {
		...state.currentMap,
		checkpoint: { ...state.currentMap.checkpoint },
	},
	party: {
		members: state.party.members.map(cloneCharacter),
	},
	story: {
		...state.story,
		flags: { ...state.story.flags },
		relationships: { ...state.story.relationships },
	},
	battle: cloneBattleState(state.battle),
});

const assertIdentifier = (value: string, label: string): void => {
	if (value.trim().length === 0) {
		throw new GameSessionError(`${label} must not be empty.`);
	}
};

const assertGridCoordinate = (value: number, label: string): void => {
	if (!Number.isSafeInteger(value) || value < 0) {
		throw new GameSessionError(`${label} must be a non-negative safe integer.`);
	}
};

const reduceCommand = (
	state: GameState,
	command: GameSessionCommand,
): { state: GameState; events: GameSessionEvent[]; changed: boolean } => {
	switch (command.type) {
		case "mode.enter": {
			if (state.mode === command.mode) {
				return { state, events: [], changed: false };
			}
			const next = cloneGameState(state);
			const previousMode = next.mode;
			next.mode = command.mode;
			return {
				state: next,
				events: [{ type: "mode.changed", previousMode, mode: command.mode }],
				changed: true,
			};
		}
		case "checkpoint.reached": {
			assertIdentifier(command.mapId, "Map ID");
			assertGridCoordinate(command.checkpoint.x, "Checkpoint x");
			assertGridCoordinate(command.checkpoint.y, "Checkpoint y");
			if (
				state.currentMap.id === command.mapId &&
				state.currentMap.checkpoint.x === command.checkpoint.x &&
				state.currentMap.checkpoint.y === command.checkpoint.y
			) {
				return { state, events: [], changed: false };
			}
			const next = cloneGameState(state);
			const previousMapId = next.currentMap.id;
			const previousCheckpoint = { ...next.currentMap.checkpoint };
			next.currentMap = {
				id: command.mapId,
				checkpoint: { ...command.checkpoint },
			};
			return {
				state: next,
				events: [
					{
						type: "checkpoint.reached",
						previousMapId,
						previousCheckpoint,
						mapId: command.mapId,
						checkpoint: { ...command.checkpoint },
					},
				],
				changed: true,
			};
		}
		case "story.flag.set": {
			assertIdentifier(command.flagId, "Story flag ID");
			const previousValue = state.story.flags[command.flagId];
			if (previousValue === command.value) {
				return { state, events: [], changed: false };
			}
			const next = cloneGameState(state);
			next.story.flags[command.flagId] = command.value;
			return {
				state: next,
				events: [
					{
						type: "story.flag.changed",
						flagId: command.flagId,
						previousValue: previousValue ?? null,
						value: command.value,
					},
				],
				changed: true,
			};
		}
		case "field.move": {
			if (state.mode !== "field") {
				throw new GameSessionError("Field movement requires field mode.");
			}
			const transition = moveFieldParty(state.field, command.direction);
			if (!transition.moved) {
				return { state, events: [], changed: false };
			}
			const next = cloneGameState(state);
			next.field = transition.state;
			const eventTriggered =
				transition.eventTriggered &&
				state.story.flags["signal-ruins-cleared"] !== true;
			next.field.eventTriggered = eventTriggered;
			return {
				state: next,
				events: [
					{
						type: "field.moved",
						partyPositions: transition.state.partyPositions.map((position) => ({
							...position,
						})),
						eventTriggered,
					},
				],
				changed: true,
			};
		}
		case "battle.start": {
			const next = cloneGameState(state);
			const previousMode = next.mode;
			next.mode = "battle";
			next.battle = cloneBattleState(command.battle);
			return {
				state: next,
				events: [
					...(previousMode === "battle"
						? []
						: [
								{
									type: "mode.changed" as const,
									previousMode,
									mode: "battle" as const,
								},
							]),
					{ type: "battle.started", battleId: command.battle.id },
				],
				changed: true,
			};
		}
		case "battle.tick": {
			if (state.mode !== "battle" || !state.battle) {
				throw new GameSessionError("Battle tick requires an active battle.");
			}
			const transition = advanceBattle(state.battle, command.deltaMs);
			if (transition.state === state.battle) {
				return { state, events: [], changed: false };
			}
			const next = cloneGameState(state);
			next.battle = transition.state;
			return {
				state: next,
				events: transition.events.map((battleEvent) => ({
					type: "battle.event",
					battleEvent,
				})),
				changed: true,
			};
		}
		case "battle.command": {
			if (state.mode !== "battle" || !state.battle) {
				throw new GameSessionError("Battle command requires an active battle.");
			}
			const transition = applyBattleCommand(state.battle, command.command);
			const next = cloneGameState(state);
			next.battle = transition.state;
			return {
				state: next,
				events: transition.events.map((battleEvent) => ({
					type: "battle.event",
					battleEvent,
				})),
				changed: true,
			};
		}
		case "battle.complete": {
			const completedBattle = state.battle;
			if (
				state.mode !== "battle" ||
				!completedBattle ||
				(completedBattle.phase !== "victory" &&
					completedBattle.phase !== "defeat")
			) {
				throw new GameSessionError(
					"Battle completion requires an ended battle.",
				);
			}
			const next = cloneGameState(state);
			const result = completedBattle.phase;
			if (result === "victory") {
				next.party.members = next.party.members.map((member) => {
					const combatant = completedBattle.party.find(
						(actor) => actor.id === member.id,
					);
					return combatant ? { ...member, hp: combatant.hp } : member;
				});
			}
			next.battle = null;
			next.mode = "field";
			next.field.eventTriggered = false;
			return {
				state: next,
				events: [
					{ type: "battle.completed", result },
					{ type: "mode.changed", previousMode: "battle", mode: "field" },
				],
				changed: true,
			};
		}
	}
};

export class GameSession {
	readonly id: string;
	private state: GameState;
	private sessionStatus: GameSessionStatus = "active";
	private eventSequence = 0;
	private readonly listeners = new Set<GameSessionListener>();

	constructor(options: { sessionId: string; initialState: GameState }) {
		assertIdentifier(options.sessionId, "Session ID");
		this.id = options.sessionId;
		this.state = cloneGameState(options.initialState);
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

	dispatch(command: GameSessionCommand): GameSessionTransition {
		this.assertActive();
		const reduced = reduceCommand(this.state, command);
		if (!reduced.changed) {
			return { state: this.snapshot(), events: [] };
		}
		reduced.state.revision = this.state.revision + 1;
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
			throw new GameSessionError("A closed session cannot be paused.");
		}
		this.sessionStatus = "paused";
		const event = this.createEvent({ type: "session.paused" });
		this.publish({ state: this.snapshot(), events: [event] });
		return event;
	}

	resume(): GameSessionEventEnvelope | null {
		if (this.sessionStatus === "active") return null;
		if (this.sessionStatus === "closed") {
			throw new GameSessionError("A closed session cannot be resumed.");
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
				`Commands require an active session; current status is ${this.sessionStatus}.`,
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
		if (transition.events.length === 0) return;
		for (const listener of this.listeners) listener(transition);
	}
}
