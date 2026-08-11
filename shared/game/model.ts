export const GAME_STATE_SCHEMA_VERSION = 4 as const;
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
	powerPercent: number;
};

export type CharacterState = {
	id: string;
	name: string;
	level: number;
	hp: number;
	maxHp: number;
	attack: number;
	defense: number;
	speed: number;
	ability: AbilityDefinition;
};

export type PartyState = {
	members: CharacterState[];
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
export type BattlePhase = "running" | "awaiting-command" | "victory" | "defeat";

export type BattleCombatant = CharacterState & {
	side: BattleSide;
	actionGauge: number;
	defending: boolean;
};

export type BattleState = {
	id: string;
	phase: BattlePhase;
	elapsedMs: number;
	activeActorId: string | null;
	party: BattleCombatant[];
	enemies: BattleCombatant[];
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
			result: "victory" | "defeat";
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
	| { type: "battle.completed"; result: "victory" | "defeat" }
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
