import { z } from "zod";
import { GAME_IDS } from "../game-platform";
import { ACTION3D_STATE_SCHEMA_VERSION, type Action3dState } from "./model";

export const ACTION3D_SAVE_FORMAT_VERSION = 1 as const;
export const ACTION3D_AUTOSAVE_SLOT = "checkpoint" as const;

const vector = z
	.object({
		x: z.number().finite(),
		y: z.number().finite(),
		z: z.number().finite(),
	})
	.strict();
const enemyState = z.enum([
	"idle",
	"chase",
	"windup",
	"recover",
	"stagger",
	"defeated",
]);
const playerBase = {
	position: vector,
	velocity: vector,
	yaw: z.number().finite(),
	hp: z.number().nonnegative(),
	maxHp: z.number().positive(),
	stamina: z.number().nonnegative(),
	maxStamina: z.number().positive(),
	grounded: z.boolean(),
	locomotion: z.enum([
		"idle",
		"walk",
		"run",
		"jump",
		"fall",
		"dodge",
		"attack",
		"defeated",
	]),
	attackElapsedMs: z.number().nonnegative().nullable(),
	attackComboIndex: z.number().int().min(0).max(2),
	attackQueued: z.boolean(),
	attackHitEnemyIds: z.array(z.string()),
	dodgeElapsedMs: z.number().nonnegative().nullable(),
	dodgeCooldownMs: z.number().nonnegative(),
	invulnerableMs: z.number().nonnegative(),
	lockOnEnemyId: z.string().nullable(),
};
const location = z
	.object({
		worldId: z.string().min(1),
		spawnId: z.string().min(1),
		checkpointId: z.string().min(1),
	})
	.strict();

export const action3dStateSchema: z.ZodType<Action3dState> = z
	.object({
		schemaVersion: z.literal(ACTION3D_STATE_SCHEMA_VERSION),
		contentVersion: z.string().min(1),
		revision: z.number().int().nonnegative(),
		elapsedMs: z.number().nonnegative(),
		phase: z.enum(["playing", "paused", "transitioning", "victory", "defeat"]),
		location,
		player: z
			.object({ ...playerBase, activeAttackId: z.string().min(1).nullable() })
			.strict(),
		enemies: z
			.array(
				z
					.object({
						id: z.string().min(1),
						archetypeId: z.string().min(1),
						position: vector,
						yaw: z.number().finite(),
						hp: z.number().nonnegative(),
						maxHp: z.number().positive(),
						state: enemyState,
						stateElapsedMs: z.number().nonnegative(),
						attackCooldownMs: z.number().nonnegative(),
					})
					.strict(),
			)
			.max(32),
		projectiles: z
			.array(
				z
					.object({
						id: z.string().min(1),
						ownerEnemyId: z.string().min(1),
						position: vector,
						velocity: vector,
						radius: z.number().positive(),
						damage: z.number().int().positive(),
						lifetimeMs: z.number().positive(),
					})
					.strict(),
			)
			.max(128),
		completedWorldIds: z.array(z.string().min(1)).max(32),
		pendingTransition: z
			.object({
				exitId: z.string().min(1),
				worldId: z.string().min(1),
				spawnId: z.string().min(1),
			})
			.strict()
			.nullable(),
	})
	.strict();

const legacyStateSchema = z
	.object({
		schemaVersion: z.literal(1),
		contentVersion: z.string().min(1),
		revision: z.number().int().nonnegative(),
		elapsedMs: z.number().nonnegative(),
		phase: z.enum(["playing", "paused", "victory", "defeat"]),
		location,
		player: z.object(playerBase).strict(),
		enemies: z
			.array(
				z
					.object({
						id: z.string().min(1),
						position: vector,
						yaw: z.number().finite(),
						hp: z.number().nonnegative(),
						maxHp: z.number().positive(),
						state: enemyState,
						stateElapsedMs: z.number().nonnegative(),
						attackCooldownMs: z.number().nonnegative(),
					})
					.strict(),
			)
			.max(32),
	})
	.strict();

export type Action3dSaveEnvelope = {
	formatVersion: typeof ACTION3D_SAVE_FORMAT_VERSION;
	gameId: typeof GAME_IDS.action3d;
	slotId: typeof ACTION3D_AUTOSAVE_SLOT;
	savedAt: string;
	state: Action3dState;
};

const savedAt = z.string().refine((value) => !Number.isNaN(Date.parse(value)));
const envelopeSchema: z.ZodType<Action3dSaveEnvelope> = z
	.object({
		formatVersion: z.literal(ACTION3D_SAVE_FORMAT_VERSION),
		gameId: z.literal(GAME_IDS.action3d),
		slotId: z.literal(ACTION3D_AUTOSAVE_SLOT),
		savedAt,
		state: action3dStateSchema,
	})
	.strict();
const legacyEnvelopeSchema = z
	.object({
		formatVersion: z.literal(ACTION3D_SAVE_FORMAT_VERSION),
		gameId: z.literal(GAME_IDS.action3d),
		slotId: z.literal(ACTION3D_AUTOSAVE_SLOT),
		savedAt,
		state: legacyStateSchema,
	})
	.strict();

export type Action3dSaveDecodeResult =
	| { status: "ready"; save: Action3dSaveEnvelope; migrated: boolean }
	| { status: "corrupt"; message: string }
	| {
			status: "unsupported";
			message: string;
			formatVersion?: number;
			stateVersion?: number;
	  };

export const createAction3dSave = (
	state: Action3dState,
	savedAtValue = new Date().toISOString(),
): Action3dSaveEnvelope =>
	envelopeSchema.parse({
		formatVersion: ACTION3D_SAVE_FORMAT_VERSION,
		gameId: GAME_IDS.action3d,
		slotId: ACTION3D_AUTOSAVE_SLOT,
		savedAt: savedAtValue,
		state,
	});

const migrateLegacyState = (
	legacy: z.infer<typeof legacyStateSchema>,
): Action3dState => ({
	...legacy,
	schemaVersion: ACTION3D_STATE_SCHEMA_VERSION,
	player: {
		...legacy.player,
		activeAttackId:
			legacy.player.attackElapsedMs === null
				? null
				: `light-${legacy.player.attackComboIndex + 1}`,
	},
	enemies: legacy.enemies.map((enemy) => ({
		...enemy,
		archetypeId: "sentinel-melee",
	})),
	projectiles: [],
	completedWorldIds:
		legacy.phase === "victory" ? [legacy.location.worldId] : [],
	pendingTransition: null,
});

export function decodeAction3dSave(
	serialized: string,
): Action3dSaveDecodeResult {
	let raw: unknown;
	try {
		raw = JSON.parse(serialized);
	} catch {
		return {
			status: "corrupt",
			message: "The Action3D checkpoint is not valid JSON.",
		};
	}
	if (!raw || typeof raw !== "object")
		return {
			status: "corrupt",
			message: "The Action3D checkpoint has an invalid shape.",
		};
	const candidate = raw as Record<string, unknown>;
	if (candidate.formatVersion !== ACTION3D_SAVE_FORMAT_VERSION)
		return {
			status: "unsupported",
			message: "This Action3D checkpoint uses an unsupported save format.",
			formatVersion:
				typeof candidate.formatVersion === "number"
					? candidate.formatVersion
					: undefined,
		};
	const current = envelopeSchema.safeParse(raw);
	if (current.success)
		return { status: "ready", save: current.data, migrated: false };
	const stateVersion =
		candidate.state && typeof candidate.state === "object"
			? (candidate.state as Record<string, unknown>).schemaVersion
			: undefined;
	if (stateVersion === 1) {
		const legacy = legacyEnvelopeSchema.safeParse(raw);
		if (!legacy.success)
			return {
				status: "corrupt",
				message: "The Action3D checkpoint failed legacy validation.",
			};
		return {
			status: "ready",
			migrated: true,
			save: createAction3dSave(
				migrateLegacyState(legacy.data.state),
				legacy.data.savedAt,
			),
		};
	}
	if (
		typeof stateVersion === "number" &&
		stateVersion !== ACTION3D_STATE_SCHEMA_VERSION
	)
		return {
			status: "unsupported",
			message: "This Action3D checkpoint uses an unsupported state version.",
			stateVersion,
		};
	return {
		status: "corrupt",
		message: "The Action3D checkpoint failed validation.",
	};
}
