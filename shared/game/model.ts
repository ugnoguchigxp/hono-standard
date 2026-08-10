export const GAME_STATE_SCHEMA_VERSION = 2 as const;
export const GAME_CONTENT_VERSION = "signal-ruins-1" as const;
export const DEFAULT_GAME_RNG_SEED = 0x4541_4457;
export const ACTION_GAUGE_MAX = 1_000;

export type GameMode = "field" | "event" | "battle";

export type GridPoint = { x: number; y: number };
export type FieldDirection = "UP" | "DOWN" | "LEFT" | "RIGHT";

export type FieldState = {
	partyPositions: GridPoint[];
	eventTriggered: boolean;
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
	contentVersion: typeof GAME_CONTENT_VERSION;
	revision: number;
	rng: DeterministicRandomState;
	mode: GameMode;
	field: FieldState;
	currentMap: {
		id: string;
		checkpoint: { x: number; y: number };
	};
	party: PartyState;
	story: StoryState;
	battle: BattleState | null;
};

export type GameSessionStatus = "active" | "paused" | "closed";

export type GameSessionCommand =
	| {
			type: "mode.enter";
			mode: GameMode;
	  }
	| {
			type: "checkpoint.reached";
			mapId: string;
			checkpoint: { x: number; y: number };
	  }
	| {
			type: "story.flag.set";
			flagId: string;
			value: boolean;
	  }
	| {
			type: "field.move";
			direction: FieldDirection;
	  }
	| {
			type: "battle.start";
			battle: BattleState;
	  }
	| {
			type: "battle.tick";
			deltaMs: number;
	  }
	| {
			type: "battle.command";
			command: BattleCommand;
	  }
	| {
			type: "battle.complete";
	  };

export type GameSessionEvent =
	| {
			type: "mode.changed";
			previousMode: GameMode;
			mode: GameMode;
	  }
	| {
			type: "checkpoint.reached";
			previousMapId: string;
			previousCheckpoint: { x: number; y: number };
			mapId: string;
			checkpoint: { x: number; y: number };
	  }
	| {
			type: "story.flag.changed";
			flagId: string;
			previousValue: boolean | null;
			value: boolean;
	  }
	| {
			type: "field.moved";
			partyPositions: GridPoint[];
			eventTriggered: boolean;
	  }
	| {
			type: "battle.started";
			battleId: string;
	  }
	| {
			type: "battle.event";
			battleEvent: BattleEvent;
	  }
	| {
			type: "battle.completed";
			result: "victory" | "defeat";
	  }
	| {
			type: "session.paused";
	  }
	| {
			type: "session.resumed";
	  }
	| {
			type: "session.closed";
	  };

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
