export const GAME_STATE_SCHEMA_VERSION = 5 as const;
export const GAME_CONTENT_VERSION = "data-driven-world-1" as const;
export const DEFAULT_GAME_RNG_SEED = 0x4541_4457;
export const ACTION_GAUGE_MAX = 1_000;

export type GameMode = "field" | "event" | "battle";

export type GridPoint = { x: number; y: number };
export type FieldDirection = "UP" | "DOWN" | "LEFT" | "RIGHT";

export type FieldState = {
	partyPositions: GridPoint[];
	facing: FieldDirection;
	pendingTriggerId: string | null;
	stepsSinceEncounter: number;
};

export type GameLocationState = {
	mapId: string;
	entranceId: string;
	checkpointId: string;
};

export type ActiveEventActorState = {
	actorId: string;
	slot: "left" | "center" | "right" | "hidden";
	expression: string;
};

export type ActiveEventChoiceState = {
	id: string;
	text: string;
};

export type ActiveEventState = {
	eventId: string;
	nodeId: string;
	status: "running" | "awaiting-confirm" | "awaiting-choice";
	visibleLine: { speakerId: string; text: string } | null;
	choices: ActiveEventChoiceState[];
	actors: ActiveEventActorState[];
};

export type AbilityDefinition = {
	id: string;
	name: string;
	description: string;
	kind: "damage" | "heal" | "status";
	target: "enemy-single" | "enemy-all" | "ally-single" | "ally-all" | "self";
	powerPercent: number;
	mpCost: number;
	element: BattleElement;
	statusEffect?: BattleStatusDefinition;
	statusChance?: number;
};

export type BattleElement =
	| "physical"
	| "fire"
	| "lightning"
	| "arcane"
	| "restoration";

export type BattleStatusDefinition = {
	id: string;
	name: string;
	description: string;
	polarity: "positive" | "negative";
	durationTurns: number;
	attackPercent: number;
	defensePercent: number;
	speedPercent: number;
	damagePercentMaxHp: number;
};

export type BattleStatusState = BattleStatusDefinition & {
	turnsRemaining: number;
};

export type CharacterState = {
	id: string;
	name: string;
	level: number;
	experience: number;
	hp: number;
	maxHp: number;
	mp: number;
	maxMp: number;
	attack: number;
	defense: number;
	speed: number;
	ability: AbilityDefinition;
	abilities: AbilityDefinition[];
};

export type EquipmentSlot = "weapon" | "armor" | "off-hand" | "relic";

export type CharacterEquipmentState = Record<EquipmentSlot, string | null>;

export type InventoryState = Record<string, number>;

export type PartyState = {
	members: CharacterState[];
	inventory: InventoryState;
	equipmentInventory: InventoryState;
	equipment: Record<string, CharacterEquipmentState>;
};

export type StoryState = {
	chapter: string;
	scene: string;
	flags: Record<string, boolean>;
	relationships: Record<string, number>;
};

export type DeterministicRandomState = {
	seed: number;
	state: number;
	draws: number;
};

export type BattleSide = "party" | "enemy";
export type BattlePhase =
	| "running"
	| "awaiting-command"
	| "victory"
	| "defeat"
	| "escaped";

export type BattleCombatant = CharacterState & {
	side: BattleSide;
	actionGauge: number;
	defending: boolean;
	statuses: BattleStatusState[];
	elementMultipliers: Partial<Record<BattleElement, number>>;
	aiPattern: string[];
	turnsTaken: number;
};

export type BattleItemDefinition = {
	id: string;
	name: string;
	description: string;
	effect: "restore-hp" | "restore-mp" | "revive" | "cure-status" | "none";
	power: number;
	statusIds: string[];
	target: "ally-single" | "ally-all";
};

export type BattleItemStack = BattleItemDefinition & { count: number };

export type BattleState = {
	id: string;
	phase: BattlePhase;
	elapsedMs: number;
	activeActorId: string | null;
	party: BattleCombatant[];
	enemies: BattleCombatant[];
	items: BattleItemStack[];
	canEscape: boolean;
};

export type BattleCommand =
	| {
			type: "attack";
			actorId: string;
			targetId: string;
	  }
	| {
			type: "ability";
			actorId: string;
			targetId: string;
			abilityId: string;
	  }
	| {
			type: "defend";
			actorId: string;
	  }
	| {
			type: "item";
			actorId: string;
			targetId: string;
			itemId: string;
	  }
	| {
			type: "escape";
			actorId: string;
	  };

export type BattleEvent =
	| {
			type: "gauge.ready";
			actorId: string;
	  }
	| {
			type: "action.damage";
			actorId: string;
			targetId: string;
			amount: number;
			abilityId?: string;
			element: BattleElement;
			multiplier: number;
	  }
	| {
			type: "action.heal";
			actorId: string;
			targetId: string;
			amount: number;
			abilityId?: string;
			itemId?: string;
	  }
	| {
			type: "resource.spent";
			actorId: string;
			amount: number;
			resource: "mp";
	  }
	| {
			type: "item.used";
			actorId: string;
			targetId: string;
			itemId: string;
			effect: BattleItemDefinition["effect"];
			amount: number;
	  }
	| {
			type: "status.applied";
			actorId: string;
			targetId: string;
			statusId: string;
	  }
	| {
			type: "status.expired";
			combatantId: string;
			statusId: string;
	  }
	| {
			type: "status.damage";
			combatantId: string;
			statusId: string;
			amount: number;
	  }
	| {
			type: "action.defend";
			actorId: string;
	  }
	| {
			type: "combatant.defeated";
			combatantId: string;
	  }
	| {
			type: "battle.ended";
			result: "victory" | "defeat" | "escaped";
	  };

export type BattleTransition = {
	state: BattleState;
	events: BattleEvent[];
};

export type GameState = {
	schemaVersion: typeof GAME_STATE_SCHEMA_VERSION;
	contentVersion: string;
	revision: number;
	rng: DeterministicRandomState;
	mode: GameMode;
	location: GameLocationState;
	field: FieldState;
	event: ActiveEventState | null;
	party: PartyState;
	story: StoryState;
	battle: BattleState | null;
};

export type GameStateInvariantIssue = {
	path: PropertyKey[];
	message: string;
};

export function getGameStateInvariantIssues(
	state: GameState,
): GameStateInvariantIssue[] {
	const issues: GameStateInvariantIssue[] = [];
	const add = (path: PropertyKey[], message: string) => {
		issues.push({ path, message });
	};
	if (state.mode === "field" && (state.event || state.battle)) {
		add(["mode"], "Field mode cannot contain an active event or battle.");
	}
	if (state.mode === "event" && (!state.event || state.battle)) {
		add(["mode"], "Event mode requires an active event and no active battle.");
	}
	if (state.mode === "battle" && !state.battle) {
		add(["mode"], "Battle mode requires an active battle.");
	}
	if (
		!Number.isSafeInteger(state.field.stepsSinceEncounter) ||
		state.field.stepsSinceEncounter < 0
	) {
		add(
			["field", "stepsSinceEncounter"],
			"Field encounter steps must be a non-negative safe integer.",
		);
	}
	if (state.mode === "event" && state.event?.status === "running") {
		add(
			["event", "status"],
			"A running event is only valid while its battle is active.",
		);
	}
	if (
		state.mode === "battle" &&
		state.event &&
		state.event.status !== "running"
	) {
		add(
			["event", "status"],
			"An event suspended by battle must be in running state.",
		);
	}
	if (state.event?.status === "awaiting-confirm") {
		if (!state.event.visibleLine) {
			add(
				["event", "visibleLine"],
				"A confirmable event requires a visible line.",
			);
		}
		if (state.event.choices.length > 0) {
			add(["event", "choices"], "A confirmable event cannot contain choices.");
		}
	}
	if (state.event?.status === "awaiting-choice") {
		if (!state.event.visibleLine || state.event.choices.length === 0) {
			add(
				["event"],
				"A choice event requires a prompt and at least one choice.",
			);
		}
	}
	if (
		state.event?.status === "running" &&
		(state.event.visibleLine || state.event.choices.length > 0)
	) {
		add(
			["event"],
			"A running event cannot contain pending presentation state.",
		);
	}

	if (!Number.isSafeInteger(state.revision) || state.revision < 0) {
		add(["revision"], "State revision must be a non-negative safe integer.");
	}
	for (const [key, value] of Object.entries(state.rng)) {
		if (!Number.isSafeInteger(value) || value < 0) {
			add(
				["rng", key],
				`Random state '${key}' must be a non-negative safe integer.`,
			);
		}
	}
	for (const [relationshipId, value] of Object.entries(
		state.story.relationships,
	)) {
		if (!Number.isFinite(value) || value < -100 || value > 100) {
			add(
				["story", "relationships", relationshipId],
				"Story relationships must remain between -100 and 100.",
			);
		}
	}

	const partyIds = new Set<string>();
	const validateCharacter = (
		character: CharacterState,
		path: PropertyKey[],
	): void => {
		if (!Number.isSafeInteger(character.level) || character.level < 1) {
			add(
				[...path, "level"],
				"Character level must be a positive safe integer.",
			);
		}
		if (
			!Number.isSafeInteger(character.experience) ||
			character.experience < 0
		) {
			add(
				[...path, "experience"],
				"Character experience must be a non-negative safe integer.",
			);
		}
		for (const resource of ["hp", "mp"] as const) {
			const maximumKey = resource === "hp" ? "maxHp" : "maxMp";
			const value = character[resource];
			const maximum = character[maximumKey];
			if (
				!Number.isSafeInteger(maximum) ||
				maximum < (resource === "hp" ? 1 : 0)
			) {
				add([...path, maximumKey], `Character ${maximumKey} is invalid.`);
			}
			if (!Number.isSafeInteger(value) || value < 0 || value > maximum) {
				add(
					[...path, resource],
					`Character ${resource.toUpperCase()} must be between zero and ${maximumKey}.`,
				);
			}
		}
		for (const stat of ["attack", "defense", "speed"] as const) {
			const minimum = stat === "defense" ? 0 : 1;
			if (!Number.isFinite(character[stat]) || character[stat] < minimum) {
				add([...path, stat], `Character ${stat} is outside its valid range.`);
			}
		}
		const abilityIds = new Set<string>();
		character.abilities.forEach((ability, abilityIndex) => {
			if (abilityIds.has(ability.id)) {
				add(
					[...path, "abilities", abilityIndex, "id"],
					`Character ability '${ability.id}' is duplicated.`,
				);
			}
			abilityIds.add(ability.id);
			if (
				!Number.isFinite(ability.powerPercent) ||
				ability.powerPercent < 0 ||
				!Number.isSafeInteger(ability.mpCost) ||
				ability.mpCost < 0
			) {
				add(
					[...path, "abilities", abilityIndex],
					`Character ability '${ability.id}' has invalid numeric values.`,
				);
			}
		});
		if (!abilityIds.has(character.ability.id)) {
			add(
				[...path, "ability"],
				"The selected character ability must be present in the learned ability list.",
			);
		}
	};

	state.party.members.forEach((member, index) => {
		if (partyIds.has(member.id)) {
			add(
				["party", "members", index, "id"],
				`Party member ID '${member.id}' is duplicated.`,
			);
		}
		partyIds.add(member.id);
		validateCharacter(member, ["party", "members", index]);
	});
	const positionKeys = new Set<string>();
	state.field.partyPositions.forEach((position, index) => {
		const key = `${position.x},${position.y}`;
		if (positionKeys.has(key)) {
			add(
				["field", "partyPositions", index],
				`Field party position '${key}' is duplicated.`,
			);
		}
		positionKeys.add(key);
	});
	for (const [collectionName, inventory] of [
		["inventory", state.party.inventory],
		["equipmentInventory", state.party.equipmentInventory],
	] as const) {
		for (const [itemId, count] of Object.entries(inventory)) {
			if (!Number.isSafeInteger(count) || count < 0) {
				add(
					["party", collectionName, itemId],
					`Inventory count for '${itemId}' must be a non-negative safe integer.`,
				);
			}
		}
	}
	for (const actorId of Object.keys(state.party.equipment)) {
		if (!partyIds.has(actorId)) {
			add(
				["party", "equipment", actorId],
				`Equipment loadout references non-party actor '${actorId}'.`,
			);
		}
	}

	if (state.event) {
		const actorIds = new Set<string>();
		state.event.actors.forEach((actor, index) => {
			if (actorIds.has(actor.actorId)) {
				add(
					["event", "actors", index, "actorId"],
					`Event actor '${actor.actorId}' is duplicated.`,
				);
			}
			actorIds.add(actor.actorId);
		});
	}

	if (state.battle) {
		const battle = state.battle;
		if (!Number.isFinite(battle.elapsedMs) || battle.elapsedMs < 0) {
			add(["battle", "elapsedMs"], "Battle elapsed time must be non-negative.");
		}
		const combatantIds = new Set<string>();
		const validateCombatants = (
			combatants: BattleCombatant[],
			expectedSide: BattleSide,
			collection: "party" | "enemies",
		): void => {
			combatants.forEach((combatant, index) => {
				const path: PropertyKey[] = ["battle", collection, index];
				validateCharacter(combatant, path);
				if (combatantIds.has(combatant.id)) {
					add(
						[...path, "id"],
						`Battle combatant ID '${combatant.id}' is duplicated.`,
					);
				}
				combatantIds.add(combatant.id);
				if (combatant.side !== expectedSide) {
					add(
						[...path, "side"],
						`Battle ${collection} combatants must use side '${expectedSide}'.`,
					);
				}
				if (
					!Number.isFinite(combatant.actionGauge) ||
					combatant.actionGauge < 0 ||
					combatant.actionGauge > ACTION_GAUGE_MAX
				) {
					add(
						[...path, "actionGauge"],
						`Battle action gauge must be between zero and ${ACTION_GAUGE_MAX}.`,
					);
				}
				if (
					!Number.isSafeInteger(combatant.turnsTaken) ||
					combatant.turnsTaken < 0
				) {
					add(
						[...path, "turnsTaken"],
						"Battle turns taken must be a non-negative safe integer.",
					);
				}
				const statusIds = new Set<string>();
				combatant.statuses.forEach((status, statusIndex) => {
					if (
						statusIds.has(status.id) ||
						!Number.isSafeInteger(status.turnsRemaining) ||
						status.turnsRemaining < 1
					) {
						add(
							[...path, "statuses", statusIndex],
							`Battle status '${status.id}' is duplicated or expired.`,
						);
					}
					statusIds.add(status.id);
				});
			});
		};
		validateCombatants(battle.party, "party", "party");
		validateCombatants(battle.enemies, "enemy", "enemies");

		const canonicalPartyIds = state.party.members.map(({ id }) => id);
		const battlePartyIds = battle.party.map(({ id }) => id);
		if (
			canonicalPartyIds.length !== battlePartyIds.length ||
			canonicalPartyIds.some((id, index) => battlePartyIds[index] !== id)
		) {
			add(
				["battle", "party"],
				"Battle party identity and order must match the persistent party.",
			);
		}
		battle.party.forEach((combatant, index) => {
			const member = state.party.members[index];
			if (
				member?.id === combatant.id &&
				(member.level !== combatant.level ||
					member.maxHp !== combatant.maxHp ||
					member.maxMp !== combatant.maxMp ||
					member.attack !== combatant.attack ||
					member.defense !== combatant.defense ||
					member.speed !== combatant.speed)
			) {
				add(
					["battle", "party", index],
					`Battle party member '${combatant.id}' does not match persistent stats.`,
				);
			}
		});

		const livingParty = battle.party.filter(({ hp }) => hp > 0);
		const livingEnemies = battle.enemies.filter(({ hp }) => hp > 0);
		if (battle.phase === "running") {
			if (battle.activeActorId !== null) {
				add(
					["battle", "activeActorId"],
					"Running battles cannot retain an active command actor.",
				);
			}
			if (livingParty.length === 0 || livingEnemies.length === 0) {
				add(
					["battle", "phase"],
					"Running battles require living combatants on both sides.",
				);
			}
		} else if (battle.phase === "awaiting-command") {
			const active = battle.party.find(
				(combatant) => combatant.id === battle.activeActorId,
			);
			if (
				!active ||
				active.hp <= 0 ||
				active.actionGauge < ACTION_GAUGE_MAX ||
				livingEnemies.length === 0
			) {
				add(
					["battle", "activeActorId"],
					"Awaiting-command battles require one living, ready party actor.",
				);
			}
		} else {
			if (battle.activeActorId !== null) {
				add(
					["battle", "activeActorId"],
					"Completed battles cannot retain an active command actor.",
				);
			}
			if (battle.phase === "victory" && livingEnemies.length > 0) {
				add(
					["battle", "phase"],
					"Victory requires every enemy to be defeated.",
				);
			}
			if (battle.phase === "defeat" && livingParty.length > 0) {
				add(["battle", "phase"], "Defeat requires every party member to fall.");
			}
		}
		const itemIds = new Set<string>();
		battle.items.forEach((item, index) => {
			if (
				itemIds.has(item.id) ||
				!Number.isSafeInteger(item.count) ||
				item.count < 0
			) {
				add(
					["battle", "items", index],
					`Battle item '${item.id}' is duplicated or has an invalid count.`,
				);
			}
			itemIds.add(item.id);
		});
	}
	return issues;
}

export type GameSessionStatus = "active" | "paused" | "closed";

export type GameSessionCommand =
	| { type: "checkpoint.reached"; checkpointId: string }
	| { type: "story.flag.set"; flagId: string; value: boolean }
	| {
			type: "story.relationship.adjust";
			relationshipId: string;
			amount: number;
	  }
	| { type: "field.move"; direction: FieldDirection }
	| { type: "field.trigger.resolve" }
	| { type: "party.item.use"; itemId: string; targetId: string }
	| {
			type: "party.equipment.change";
			actorId: string;
			slot: EquipmentSlot;
			equipmentId: string | null;
	  }
	| { type: "event.start"; eventId: string }
	| { type: "event.advance" }
	| { type: "event.choose"; choiceId: string }
	| { type: "battle.start"; battle: BattleState }
	| { type: "battle.retry" }
	| { type: "battle.tick"; deltaMs: number }
	| { type: "battle.command"; command: BattleCommand }
	| { type: "battle.complete" };

export type GameSessionEvent =
	| { type: "mode.changed"; previousMode: GameMode; mode: GameMode }
	| {
			type: "map.entered";
			previousMapId: string;
			mapId: string;
			entranceId: string;
			partyPositions: GridPoint[];
	  }
	| {
			type: "checkpoint.reached";
			mapId: string;
			previousCheckpointId: string;
			checkpointId: string;
	  }
	| {
			type: "story.flag.changed";
			flagId: string;
			previousValue: boolean | null;
			value: boolean;
	  }
	| {
			type: "story.relationship.changed";
			relationshipId: string;
			previousValue: number;
			value: number;
	  }
	| {
			type: "field.moved";
			partyPositions: GridPoint[];
			facing: FieldDirection;
			pendingTriggerId: string | null;
	  }
	| {
			type: "field.triggered";
			triggerId: string;
			kind: "event" | "map" | "checkpoint" | "recovery";
			targetId: string;
	  }
	| { type: "field.random-encounter"; encounterId: string }
	| {
			type: "party.recovered";
			triggerId: string;
			restoredHp: number;
			restoredMp: number;
	  }
	| {
			type: "party.item.used";
			itemId: string;
			targetId: string;
			amount: number;
	  }
	| {
			type: "party.equipment.changed";
			actorId: string;
			slot: EquipmentSlot;
			previousEquipmentId: string | null;
			equipmentId: string | null;
	  }
	| {
			type: "party.experience.gained";
			actorId: string;
			amount: number;
			total: number;
	  }
	| {
			type: "party.level.gained";
			actorId: string;
			previousLevel: number;
			level: number;
	  }
	| {
			type: "party.ability.learned";
			actorId: string;
			abilityId: string;
	  }
	| {
			type: "party.reward.received";
			encounterId: string;
			experience: number;
			items: Array<{ itemId: string; quantity: number }>;
	  }
	| { type: "event.started"; eventId: string }
	| {
			type: "dialogue.presented";
			eventId: string;
			speakerId: string;
			text: string;
	  }
	| {
			type: "choice.presented";
			eventId: string;
			choices: ActiveEventChoiceState[];
	  }
	| { type: "choice.selected"; eventId: string; choiceId: string }
	| {
			type: "event.actor.moved";
			eventId: string;
			actorId: string;
			slot: ActiveEventActorState["slot"];
	  }
	| {
			type: "event.actor.expression.changed";
			eventId: string;
			actorId: string;
			expression: string;
	  }
	| { type: "event.waited"; eventId: string; durationMs: number }
	| { type: "event.completed"; eventId: string }
	| { type: "battle.started"; battleId: string }
	| { type: "battle.event"; battleEvent: BattleEvent }
	| { type: "battle.completed"; result: "victory" | "defeat" | "escaped" }
	| { type: "session.paused" }
	| { type: "session.resumed" }
	| { type: "session.closed" };

export type GameSessionEventEnvelope = {
	sessionId: string;
	sequence: number;
	stateRevision: number;
	event: GameSessionEvent;
};

export type GameSessionTransition = {
	state: GameState;
	events: GameSessionEventEnvelope[];
};

export type GameSessionListener = (transition: GameSessionTransition) => void;
