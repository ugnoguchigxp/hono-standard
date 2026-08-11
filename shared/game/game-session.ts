import { advanceBattle, applyBattleCommand } from "./battle-engine";
import type {
	EventDefinitionV1,
	GameContentRegistry,
	MapDefinitionV1,
} from "./content";
import { advanceEvent, type EventEngineTransition } from "./event-engine";
import { createFieldStateAt, moveFieldParty } from "./field-engine";
import { nextRandom } from "./deterministic-rng";
import { getGameStateInvariantIssues } from "./model";
import type {
	ActiveEventState,
	BattleState,
	CharacterState,
	GameMode,
	GameSessionCommand,
	GameSessionEvent,
	GameSessionEventEnvelope,
	GameSessionListener,
	GameSessionStatus,
	GameSessionTransition,
	GameState,
} from "./model";

export type GameSessionErrorCode =
	| "invalid-command"
	| "invalid-content-reference"
	| "incompatible-content"
	| "invalid-state";

export class GameSessionError extends Error {
	readonly code: GameSessionErrorCode;

	constructor(code: GameSessionErrorCode, message: string) {
		super(message);
		this.name = "GameSessionError";
		this.code = code;
	}
}

export type EncounterProvider = (
	encounterId: string,
	party: readonly CharacterState[],
) => BattleState;

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

const cloneEventState = (
	event: ActiveEventState | null,
): ActiveEventState | null =>
	event
		? {
				...event,
				visibleLine: event.visibleLine ? { ...event.visibleLine } : null,
				choices: event.choices.map((choice) => ({ ...choice })),
				actors: event.actors.map((actor) => ({ ...actor })),
			}
		: null;

export const cloneGameState = (state: GameState): GameState => ({
	...state,
	rng: { ...state.rng },
	location: { ...state.location },
	field: {
		...state.field,
		partyPositions: state.field.partyPositions.map((position) => ({
			...position,
		})),
	},
	event: cloneEventState(state.event),
	party: {
		members: state.party.members.map(cloneCharacter),
	},
	story: {
		...state.story,
		flags: Object.assign(Object.create(null), state.story.flags),
		relationships: Object.assign(
			Object.create(null),
			state.story.relationships,
		),
	},
	battle: cloneBattleState(state.battle),
});

const assertIdentifier = (value: string, label: string): void => {
	if (value.trim().length === 0) {
		throw new GameSessionError(
			"invalid-command",
			`${label} must not be empty.`,
		);
	}
};

const assertStableIdentifier = (value: string, label: string): void => {
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
		throw new GameSessionError(
			"invalid-command",
			`${label} must be a stable kebab-case ID.`,
		);
	}
};

const assertRelationshipIdentifier = (value: string): void => {
	if (!/^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
		throw new GameSessionError(
			"invalid-command",
			"Relationship ID must contain two stable IDs separated by a colon.",
		);
	}
};

export function assertGameStateCompatible(
	state: GameState,
	content: GameContentRegistry,
): void {
	if (state.contentVersion !== content.contentVersion) {
		throw new GameSessionError(
			"incompatible-content",
			`Save content '${state.contentVersion}' is incompatible with '${content.contentVersion}'.`,
		);
	}
	const invariantIssue = getGameStateInvariantIssues(state)[0];
	if (invariantIssue) {
		throw new GameSessionError("invalid-state", invariantIssue.message);
	}
	let map: MapDefinitionV1;
	try {
		map = content.getMap(state.location.mapId);
	} catch {
		throw new GameSessionError(
			"invalid-content-reference",
			`State references unknown map '${state.location.mapId}'.`,
		);
	}
	if (!map.entrances.some(({ id }) => id === state.location.entranceId)) {
		throw new GameSessionError(
			"invalid-content-reference",
			`State references unknown entrance '${state.location.entranceId}'.`,
		);
	}
	if (!map.checkpoints.some(({ id }) => id === state.location.checkpointId)) {
		throw new GameSessionError(
			"invalid-content-reference",
			`State references unknown checkpoint '${state.location.checkpointId}'.`,
		);
	}
	if (state.field.partyPositions.length !== state.party.members.length) {
		throw new GameSessionError(
			"invalid-state",
			"Field positions must match the current party size.",
		);
	}
	for (const position of state.field.partyPositions) {
		if (
			!Number.isInteger(position.x) ||
			!Number.isInteger(position.y) ||
			position.x < 0 ||
			position.y < 0 ||
			position.x >= map.width ||
			position.y >= map.height ||
			content.isCollision(map.id, position.x, position.y)
		) {
			throw new GameSessionError(
				"invalid-state",
				`Field position '${position.x},${position.y}' is not walkable on map '${map.id}'.`,
			);
		}
	}
	for (const member of state.party.members) {
		if (!content.actorsById[member.id]) {
			throw new GameSessionError(
				"invalid-content-reference",
				`Party member '${member.id}' has no content actor.`,
			);
		}
	}
	if (state.field.pendingTriggerId) {
		const trigger = map.triggers.find(
			(candidate) => candidate.id === state.field.pendingTriggerId,
		);
		const leader = state.field.partyPositions[0];
		if (
			!trigger ||
			!leader ||
			trigger.position.x !== leader.x ||
			trigger.position.y !== leader.y
		) {
			throw new GameSessionError(
				"invalid-content-reference",
				`Pending trigger '${state.field.pendingTriggerId}' is not valid at the party position.`,
			);
		}
	}
	if (state.battle && !content.hasEncounter(state.battle.id)) {
		throw new GameSessionError(
			"invalid-content-reference",
			`State references unknown encounter '${state.battle.id}'.`,
		);
	}
	if (state.event) {
		let definition: EventDefinitionV1;
		try {
			definition = content.getEvent(state.event.eventId);
		} catch {
			throw new GameSessionError(
				"invalid-content-reference",
				`State references unknown event '${state.event.eventId}'.`,
			);
		}
		const node = definition.nodes.find(({ id }) => id === state.event?.nodeId);
		if (!node) {
			throw new GameSessionError(
				"invalid-content-reference",
				`State references unknown event node '${state.event.nodeId}'.`,
			);
		}
		if (
			(state.event.status === "awaiting-confirm" && node.type !== "line") ||
			(state.event.status === "awaiting-choice" && node.type !== "choice")
		) {
			throw new GameSessionError(
				"invalid-state",
				`Event '${state.event.eventId}' has an invalid runtime status for node '${node.id}'.`,
			);
		}
		const expectedActorIds = new Set(
			definition.presentation.actors.map((actor) => actor.actorId),
		);
		const savedActorIds = new Set(
			state.event.actors.map((actor) => actor.actorId),
		);
		if (
			state.event.actors.length !== expectedActorIds.size ||
			expectedActorIds.size !== savedActorIds.size ||
			[...expectedActorIds].some((actorId) => !savedActorIds.has(actorId))
		) {
			throw new GameSessionError(
				"invalid-content-reference",
				`Event '${state.event.eventId}' actor state is incompatible with its presentation.`,
			);
		}
		if (
			state.event.visibleLine &&
			!content.actorsById[state.event.visibleLine.speakerId]
		) {
			throw new GameSessionError(
				"invalid-content-reference",
				`Event '${state.event.eventId}' references unknown speaker '${state.event.visibleLine.speakerId}'.`,
			);
		}
		if (
			node.type === "choice" &&
			state.event.choices.some(
				(choice) => !node.choices.some(({ id }) => id === choice.id),
			)
		) {
			throw new GameSessionError(
				"invalid-content-reference",
				`Event '${state.event.eventId}' contains an unknown saved choice.`,
			);
		}
	}
}

type Reduction = {
	state: GameState;
	events: GameSessionEvent[];
	changed: boolean;
};

export class GameSession {
	readonly id: string;
	readonly content: GameContentRegistry;
	private state: GameState;
	private sessionStatus: GameSessionStatus = "active";
	private eventSequence = 0;
	private readonly listeners = new Set<GameSessionListener>();
	private readonly encounterProvider: EncounterProvider;

	constructor(options: {
		sessionId: string;
		initialState: GameState;
		registry: GameContentRegistry;
		encounterProvider: EncounterProvider;
	}) {
		assertIdentifier(options.sessionId, "Session ID");
		this.id = options.sessionId;
		this.content = options.registry;
		this.encounterProvider = options.encounterProvider;
		assertGameStateCompatible(options.initialState, this.content);
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
		const reduced = this.reduceCommand(this.state, command);
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

	private reduceCommand(
		state: GameState,
		command: GameSessionCommand,
	): Reduction {
		switch (command.type) {
			case "checkpoint.reached": {
				if (state.mode !== "field") {
					throw new GameSessionError(
						"invalid-command",
						"Direct checkpoint commands require field mode.",
					);
				}
				const next = cloneGameState(state);
				const events: GameSessionEvent[] = [];
				const changed = this.reachCheckpoint(
					next,
					command.checkpointId,
					events,
				);
				return { state: changed ? next : state, events, changed };
			}
			case "story.flag.set": {
				assertStableIdentifier(command.flagId, "Story flag ID");
				const previousValue = Object.hasOwn(state.story.flags, command.flagId)
					? state.story.flags[command.flagId]
					: undefined;
				if (previousValue === command.value) {
					return { state, events: [], changed: false };
				}
				const next = cloneGameState(state);
				const events: GameSessionEvent[] = [];
				this.setFlag(next, command.flagId, command.value, events);
				return { state: next, events, changed: true };
			}
			case "story.relationship.adjust": {
				assertRelationshipIdentifier(command.relationshipId);
				if (!Number.isFinite(command.amount) || command.amount === 0) {
					return { state, events: [], changed: false };
				}
				const next = cloneGameState(state);
				const events: GameSessionEvent[] = [];
				const changed = this.adjustRelationship(
					next,
					command.relationshipId,
					command.amount,
					events,
				);
				return { state: changed ? next : state, events, changed };
			}
			case "field.move": {
				if (state.mode !== "field") {
					throw new GameSessionError(
						"invalid-command",
						"Field movement requires field mode.",
					);
				}
				const map = this.content.getMap(state.location.mapId);
				const transition = moveFieldParty(
					state.field,
					command.direction,
					map,
					state.story,
					(point) => this.content.isCollision(map.id, point.x, point.y),
				);
				if (!transition.moved) return { state, events: [], changed: false };
				const next = cloneGameState(state);
				next.field = transition.state;
				const events: GameSessionEvent[] = [
					{
						type: "field.moved",
						partyPositions: transition.state.partyPositions.map((position) => ({
							...position,
						})),
						facing: transition.state.facing,
						pendingTriggerId: transition.state.pendingTriggerId,
					},
				];
				if (transition.trigger) {
					events.push({
						type: "field.triggered",
						triggerId: transition.trigger.id,
						kind: transition.trigger.kind,
						targetId: transition.trigger.targetId,
					});
				} else if (map.randomEncounter) {
					next.field.stepsSinceEncounter += 1;
					if (
						next.field.stepsSinceEncounter >= map.randomEncounter.minimumSteps
					) {
						const random = nextRandom(next.rng);
						next.rng = random.state;
						if (random.value < map.randomEncounter.chance) {
							const encounterId = map.randomEncounter.encounterId;
							const battle = this.encounterProvider(
								encounterId,
								next.party.members,
							);
							if (battle.id !== encounterId) {
								throw new GameSessionError(
									"invalid-content-reference",
									`Encounter provider returned '${battle.id}' for '${encounterId}'.`,
								);
							}
							next.field.stepsSinceEncounter = 0;
							events.push({
								type: "field.random-encounter",
								encounterId,
							});
							this.startBattle(next, battle, events);
						}
					}
				}
				return { state: next, events, changed: true };
			}
			case "field.trigger.resolve": {
				if (state.mode !== "field" || !state.field.pendingTriggerId) {
					throw new GameSessionError(
						"invalid-command",
						"Trigger resolution requires a pending field trigger.",
					);
				}
				const map = this.content.getMap(state.location.mapId);
				const trigger = map.triggers.find(
					(candidate) => candidate.id === state.field.pendingTriggerId,
				);
				if (!trigger) {
					throw new GameSessionError(
						"invalid-content-reference",
						`Pending trigger '${state.field.pendingTriggerId}' does not exist.`,
					);
				}
				const next = cloneGameState(state);
				next.field.pendingTriggerId = null;
				const events: GameSessionEvent[] = [];
				if (trigger.kind === "event") {
					this.startEvent(next, trigger.targetId, events);
				} else if (trigger.kind === "map") {
					this.enterMap(
						next,
						trigger.targetId,
						trigger.targetEntranceId,
						events,
					);
				} else if (trigger.kind === "checkpoint") {
					this.reachCheckpoint(next, trigger.targetId, events);
				} else {
					const restoredHp = next.party.members.reduce(
						(total, member) => total + Math.max(0, member.maxHp - member.hp),
						0,
					);
					next.party.members = next.party.members.map((member) => ({
						...member,
						hp: member.maxHp,
					}));
					next.field.stepsSinceEncounter = 0;
					events.push({
						type: "party.recovered",
						triggerId: trigger.id,
						restoredHp,
					});
				}
				return { state: next, events, changed: true };
			}
			case "event.start": {
				const next = cloneGameState(state);
				const events: GameSessionEvent[] = [];
				this.startEvent(next, command.eventId, events);
				return { state: next, events, changed: true };
			}
			case "event.advance":
			case "event.choose": {
				if (state.mode !== "event" || !state.event) {
					throw new GameSessionError(
						"invalid-command",
						"Event input requires an active event.",
					);
				}
				const definition = this.content.getEvent(state.event.eventId);
				const transition = advanceEvent(
					definition,
					state.event,
					state.story,
					command.type === "event.advance"
						? { type: "advance" }
						: { type: "choose", choiceId: command.choiceId },
				);
				const next = cloneGameState(state);
				const events: GameSessionEvent[] = [];
				this.applyEventTransition(next, transition, events);
				return { state: next, events, changed: true };
			}
			case "battle.start": {
				if (state.event && state.mode !== "battle") {
					throw new GameSessionError(
						"invalid-command",
						"Direct battle start cannot interrupt an active event.",
					);
				}
				const next = cloneGameState(state);
				const events: GameSessionEvent[] = [];
				this.startBattle(next, command.battle, events);
				return { state: next, events, changed: true };
			}
			case "battle.retry": {
				if (
					state.mode !== "battle" ||
					!state.battle ||
					state.battle.phase !== "defeat"
				) {
					throw new GameSessionError(
						"invalid-command",
						"Battle retry requires a defeated battle.",
					);
				}
				const next = cloneGameState(state);
				const events: GameSessionEvent[] = [];
				const battle = this.encounterProvider(
					state.battle.id,
					state.party.members,
				);
				if (battle.id !== state.battle.id) {
					throw new GameSessionError(
						"invalid-content-reference",
						`Encounter provider returned '${battle.id}' for '${state.battle.id}'.`,
					);
				}
				this.startBattle(next, battle, events);
				return { state: next, events, changed: true };
			}
			case "battle.tick": {
				if (state.mode !== "battle" || !state.battle) {
					throw new GameSessionError(
						"invalid-command",
						"Battle tick requires an active battle.",
					);
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
					throw new GameSessionError(
						"invalid-command",
						"Battle command requires an active battle.",
					);
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
						"invalid-command",
						"Battle completion requires an ended battle.",
					);
				}
				const next = cloneGameState(state);
				const events: GameSessionEvent[] = [];
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
				events.push({ type: "battle.completed", result });
				if (result === "victory" && next.event) {
					this.changeMode(next, "event", events);
					const definition = this.content.getEvent(next.event.eventId);
					const transition = advanceEvent(definition, next.event, next.story, {
						type: "resume",
					});
					this.applyEventTransition(next, transition, events);
				} else {
					next.event = null;
					next.field.pendingTriggerId = null;
					this.changeMode(next, "field", events);
				}
				return { state: next, events, changed: true };
			}
		}
	}

	private startEvent(
		state: GameState,
		eventId: string,
		events: GameSessionEvent[],
	): void {
		let definition: EventDefinitionV1;
		try {
			definition = this.content.getEvent(eventId);
		} catch {
			throw new GameSessionError(
				"invalid-content-reference",
				`Cannot start unknown event '${eventId}'.`,
			);
		}
		if (state.event) {
			throw new GameSessionError(
				"invalid-command",
				"An event is already active.",
			);
		}
		if (state.battle) {
			throw new GameSessionError(
				"invalid-command",
				"An event cannot start during an active battle.",
			);
		}
		this.changeMode(state, "event", events);
		const transition = advanceEvent(definition, null, state.story, {
			type: "start",
		});
		this.applyEventTransition(state, transition, events);
	}

	private applyEventTransition(
		state: GameState,
		transition: EventEngineTransition,
		events: GameSessionEvent[],
	): void {
		state.event = transition.event;
		const completionEvent = transition.events.find(
			(event) => event.type === "event.completed",
		);
		events.push(
			...transition.events.filter((event) => event.type !== "event.completed"),
		);
		let completionPublished = false;
		for (const operation of transition.operations) {
			switch (operation.type) {
				case "flag.set":
					this.setFlag(state, operation.flagId, operation.value, events);
					break;
				case "relationship.adjust":
					this.adjustRelationship(
						state,
						operation.relationshipId,
						operation.amount,
						events,
					);
					break;
				case "battle.start": {
					const battle = this.encounterProvider(
						operation.encounterId,
						state.party.members,
					);
					if (battle.id !== operation.encounterId) {
						throw new GameSessionError(
							"invalid-content-reference",
							`Encounter provider returned '${battle.id}' for '${operation.encounterId}'.`,
						);
					}
					this.startBattle(state, battle, events);
					break;
				}
				case "map.enter":
					this.enterMap(state, operation.mapId, operation.entranceId, events);
					break;
				case "checkpoint.reach":
					this.reachCheckpoint(state, operation.checkpointId, events);
					break;
				case "event.complete":
					state.event = null;
					if (completionEvent) {
						events.push(completionEvent);
						completionPublished = true;
					}
					this.changeMode(state, "field", events);
					break;
			}
		}
		if (completionEvent && !completionPublished) events.push(completionEvent);
	}

	private setFlag(
		state: GameState,
		flagId: string,
		value: boolean,
		events: GameSessionEvent[],
	): boolean {
		const previousValue = Object.hasOwn(state.story.flags, flagId)
			? state.story.flags[flagId]
			: undefined;
		if (previousValue === value) return false;
		state.story.flags[flagId] = value;
		events.push({
			type: "story.flag.changed",
			flagId,
			previousValue: previousValue ?? null,
			value,
		});
		return true;
	}

	private adjustRelationship(
		state: GameState,
		relationshipId: string,
		amount: number,
		events: GameSessionEvent[],
	): boolean {
		const previousValue = Object.hasOwn(
			state.story.relationships,
			relationshipId,
		)
			? state.story.relationships[relationshipId]
			: 0;
		const value = Math.max(-100, Math.min(100, previousValue + amount));
		if (value === previousValue) return false;
		state.story.relationships[relationshipId] = value;
		events.push({
			type: "story.relationship.changed",
			relationshipId,
			previousValue,
			value,
		});
		return true;
	}

	private enterMap(
		state: GameState,
		mapId: string,
		entranceId: string,
		events: GameSessionEvent[],
	): void {
		let map: MapDefinitionV1;
		try {
			map = this.content.getMap(mapId);
		} catch {
			throw new GameSessionError(
				"invalid-content-reference",
				`Cannot enter unknown map '${mapId}'.`,
			);
		}
		const entrance = map.entrances.find(({ id }) => id === entranceId);
		if (!entrance) {
			throw new GameSessionError(
				"invalid-content-reference",
				`Cannot enter unknown entrance '${mapId}:${entranceId}'.`,
			);
		}
		const previousMapId = state.location.mapId;
		state.location = {
			mapId,
			entranceId,
			checkpointId: entrance.checkpointId,
		};
		state.field = createFieldStateAt(
			entrance.position,
			entrance.facing,
			state.party.members.length,
		);
		state.event = null;
		state.battle = null;
		this.changeMode(state, "field", events);
		events.push({
			type: "map.entered",
			previousMapId,
			mapId,
			entranceId,
			partyPositions: state.field.partyPositions.map((position) => ({
				...position,
			})),
		});
	}

	private reachCheckpoint(
		state: GameState,
		checkpointId: string,
		events: GameSessionEvent[],
	): boolean {
		assertIdentifier(checkpointId, "Checkpoint ID");
		const map = this.content.getMap(state.location.mapId);
		if (!map.checkpoints.some(({ id }) => id === checkpointId)) {
			throw new GameSessionError(
				"invalid-content-reference",
				`Map '${map.id}' has no checkpoint '${checkpointId}'.`,
			);
		}
		const previousCheckpointId = state.location.checkpointId;
		state.location.checkpointId = checkpointId;
		events.push({
			type: "checkpoint.reached",
			mapId: map.id,
			previousCheckpointId,
			checkpointId,
		});
		return true;
	}

	private startBattle(
		state: GameState,
		battle: BattleState,
		events: GameSessionEvent[],
	): void {
		if (!this.content.hasEncounter(battle.id)) {
			throw new GameSessionError(
				"invalid-content-reference",
				`Cannot start unknown encounter '${battle.id}'.`,
			);
		}
		this.changeMode(state, "battle", events);
		state.battle = cloneBattleState(battle);
		events.push({ type: "battle.started", battleId: battle.id });
	}

	private changeMode(
		state: GameState,
		mode: GameMode,
		events: GameSessionEvent[],
	): void {
		if (state.mode === mode) return;
		const previousMode = state.mode;
		state.mode = mode;
		events.push({ type: "mode.changed", previousMode, mode });
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
		for (const listener of this.listeners) listener(transition);
	}
}
