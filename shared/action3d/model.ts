export const ACTION3D_STATE_SCHEMA_VERSION = 2 as const;
export const ACTION3D_CONTENT_VERSION = "action3d-field-lab-1" as const;
export const ACTION3D_FIXED_STEP_MS = 1000 / 60;

export type Action3dVector3 = { x: number; y: number; z: number };
export type Action3dPhase =
	| "playing"
	| "paused"
	| "transitioning"
	| "victory"
	| "defeat";
export type PlayerLocomotion =
	| "idle"
	| "walk"
	| "run"
	| "jump"
	| "fall"
	| "dodge"
	| "attack"
	| "defeated";
export type EnemyActionState =
	| "idle"
	| "chase"
	| "windup"
	| "recover"
	| "stagger"
	| "defeated";

export type Action3dInput = {
	moveX: number;
	moveZ: number;
	cameraYaw: number;
	jump: boolean;
	sprint: boolean;
	dodge: boolean;
	attack: boolean;
	heavyAttack: boolean;
	lockOn: boolean;
	pause: boolean;
};

export const EMPTY_ACTION3D_INPUT: Readonly<Action3dInput> = Object.freeze({
	moveX: 0,
	moveZ: 0,
	cameraYaw: 0,
	jump: false,
	sprint: false,
	dodge: false,
	attack: false,
	heavyAttack: false,
	lockOn: false,
	pause: false,
});

export type Action3dPlayerState = {
	position: Action3dVector3;
	velocity: Action3dVector3;
	yaw: number;
	hp: number;
	maxHp: number;
	stamina: number;
	maxStamina: number;
	grounded: boolean;
	locomotion: PlayerLocomotion;
	activeAttackId: string | null;
	attackElapsedMs: number | null;
	attackComboIndex: number;
	attackQueued: boolean;
	attackHitEnemyIds: string[];
	dodgeElapsedMs: number | null;
	dodgeCooldownMs: number;
	invulnerableMs: number;
	lockOnEnemyId: string | null;
};

export type Action3dEnemyState = {
	id: string;
	archetypeId: string;
	position: Action3dVector3;
	yaw: number;
	hp: number;
	maxHp: number;
	state: EnemyActionState;
	stateElapsedMs: number;
	attackCooldownMs: number;
};

export type Action3dProjectileState = {
	id: string;
	ownerEnemyId: string;
	position: Action3dVector3;
	velocity: Action3dVector3;
	radius: number;
	damage: number;
	lifetimeMs: number;
};

export type Action3dPendingTransition = {
	exitId: string;
	worldId: string;
	spawnId: string;
};

export type Action3dState = {
	schemaVersion: typeof ACTION3D_STATE_SCHEMA_VERSION;
	contentVersion: string;
	revision: number;
	elapsedMs: number;
	phase: Action3dPhase;
	location: { worldId: string; spawnId: string; checkpointId: string };
	player: Action3dPlayerState;
	enemies: Action3dEnemyState[];
	projectiles: Action3dProjectileState[];
	completedWorldIds: string[];
	pendingTransition: Action3dPendingTransition | null;
};

export type Action3dEvent =
	| { type: "enemy-hit"; enemyId: string; damage: number }
	| { type: "player-hit"; enemyId: string; damage: number }
	| { type: "enemy-defeated"; enemyId: string }
	| { type: "projectile-spawned"; projectileId: string; enemyId: string }
	| {
			type: "world-transition-requested";
			exitId: string;
			worldId: string;
			spawnId: string;
	  }
	| { type: "world-entered"; worldId: string; spawnId: string }
	| { type: "victory"; checkpointId: string }
	| { type: "defeat" };

export const cloneAction3dState = (state: Action3dState): Action3dState =>
	structuredClone(state);
