import { advanceBattle, applyBattleCommand } from "../battle-engine";
import type {
	EventDefinitionV1,
	GameContentRegistry,
	MapDefinitionV1,
} from "../content";
import { nextRandom } from "../deterministic-rng";
import { advanceEvent, type EventEngineTransition } from "../event-engine";
import { createFieldStateAt, moveFieldParty } from "../field-engine";
import type {
	BattleState,
	CharacterState,
	GameMode,
	GameSessionCommand,
	GameSessionEvent,
	GameState,
	InventoryState,
} from "../model";
import {
	changePartyEquipment,
	consumePartyItem,
	grantExperience,
} from "../progression-engine";
import { GameSessionError } from "./errors";
import { cloneBattleState, cloneGameState } from "./state-clone";

export type EncounterProvider = (
	encounterId: string,
	party: readonly CharacterState[],
	inventory?: InventoryState,
) => BattleState;

export type GameStateReduction = {
	state: GameState;
	events: GameSessionEvent[];
	changed: boolean;
};

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

export class GameSessionReducer {
	constructor(
		private contentRegistry: GameContentRegistry,
		private readonly encounterProvider: EncounterProvider,
	) {}

	replaceContent(content: GameContentRegistry): void {
		this.contentRegistry = content;
	}

	private get content(): GameContentRegistry {
		return this.contentRegistry;
	}

	reduce(state: GameState, command: GameSessionCommand): GameStateReduction {
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
								next.party.inventory,
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
					const restoredMp = next.party.members.reduce(
						(total, member) => total + Math.max(0, member.maxMp - member.mp),
						0,
					);
					next.party.members = next.party.members.map((member) => ({
						...member,
						hp: member.maxHp,
						mp: member.maxMp,
					}));
					next.field.stepsSinceEncounter = 0;
					events.push({
						type: "party.recovered",
						triggerId: trigger.id,
						restoredHp,
						restoredMp,
					});
				}
				return { state: next, events, changed: true };
			}
			case "party.item.use": {
				if (state.mode !== "field") {
					throw new GameSessionError(
						"invalid-command",
						"Field item use requires field mode.",
					);
				}
				assertStableIdentifier(command.itemId, "Item ID");
				assertStableIdentifier(command.targetId, "Target ID");
				const used = consumePartyItem(
					state.party,
					command.itemId,
					command.targetId,
					this.content,
				);
				if (!used) {
					throw new GameSessionError(
						"invalid-command",
						"The selected item cannot be used on that target.",
					);
				}
				const next = cloneGameState(state);
				next.party = used.party;
				return {
					state: next,
					events: [
						{
							type: "party.item.used",
							itemId: command.itemId,
							targetId: command.targetId,
							amount: used.amount,
						},
					],
					changed: true,
				};
			}
			case "party.equipment.change": {
				if (state.mode !== "field") {
					throw new GameSessionError(
						"invalid-command",
						"Equipment changes require field mode.",
					);
				}
				const previousEquipmentId =
					state.party.equipment[command.actorId]?.[command.slot] ?? null;
				const party = changePartyEquipment(
					state.party,
					command.actorId,
					command.slot,
					command.equipmentId,
					this.content,
				);
				if (!party) {
					throw new GameSessionError(
						"invalid-command",
						"The selected equipment cannot be equipped in that slot.",
					);
				}
				const next = cloneGameState(state);
				next.party = party;
				return {
					state: next,
					events: [
						{
							type: "party.equipment.changed",
							actorId: command.actorId,
							slot: command.slot,
							previousEquipmentId,
							equipmentId: command.equipmentId,
						},
					],
					changed: true,
				};
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
					state.party.inventory,
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
						completedBattle.phase !== "defeat" &&
						completedBattle.phase !== "escaped")
				) {
					throw new GameSessionError(
						"invalid-command",
						"Battle completion requires an ended battle.",
					);
				}
				const next = cloneGameState(state);
				const events: GameSessionEvent[] = [];
				const result = completedBattle.phase;
				if (result !== "defeat") {
					next.party.members = next.party.members.map((member) => {
						const combatant = completedBattle.party.find(
							(actor) => actor.id === member.id,
						);
						return combatant
							? { ...member, hp: combatant.hp, mp: combatant.mp }
							: member;
					});
					for (const item of completedBattle.items) {
						if (item.count > 0) next.party.inventory[item.id] = item.count;
						else delete next.party.inventory[item.id];
					}
				}
				if (result === "victory") {
					this.applyEncounterRewards(next, completedBattle.id, events);
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
						state.party.inventory,
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
					this.reachCheckpoint(
						state,
						operation.checkpointId,
						events,
						operation.mapId,
					);
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

	private applyEncounterRewards(
		state: GameState,
		encounterId: string,
		events: GameSessionEvent[],
	): void {
		const encounter = this.content.getEncounter(encounterId);
		state.party.members = state.party.members.map((member) => {
			const loadout = state.party.equipment[member.id];
			if (!loadout) {
				throw new GameSessionError(
					"invalid-state",
					`Party member '${member.id}' has no equipment loadout.`,
				);
			}
			const gained = grantExperience(
				member,
				encounter.rewards.experience,
				loadout,
				this.content,
			);
			events.push(...gained.events);
			return gained.member;
		});

		const awardedItems: Array<{ itemId: string; quantity: number }> = [];
		for (const reward of encounter.rewards.items) {
			const random = nextRandom(state.rng);
			state.rng = random.state;
			if (random.value >= reward.chance) continue;
			state.party.inventory[reward.itemId] =
				(state.party.inventory[reward.itemId] ?? 0) + reward.quantity;
			awardedItems.push({
				itemId: reward.itemId,
				quantity: reward.quantity,
			});
		}
		events.push({
			type: "party.reward.received",
			encounterId,
			experience: encounter.rewards.experience,
			items: awardedItems,
		});
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
			(point) =>
				point.x >= 0 &&
				point.y >= 0 &&
				point.x < map.width &&
				point.y < map.height &&
				!this.content.isCollision(map.id, point.x, point.y),
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
		expectedMapId = state.location.mapId,
	): boolean {
		assertIdentifier(checkpointId, "Checkpoint ID");
		if (state.location.mapId !== expectedMapId) {
			throw new GameSessionError(
				"invalid-content-reference",
				`Checkpoint '${expectedMapId}:${checkpointId}' cannot be reached while on map '${state.location.mapId}'.`,
			);
		}
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
}
