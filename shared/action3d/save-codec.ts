import { z } from "zod";
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
const enemy = z
	.object({
		id: z.string().min(1),
		position: vector,
		yaw: z.number().finite(),
		hp: z.number().nonnegative(),
		maxHp: z.number().positive(),
		state: z.enum([
			"idle",
			"chase",
			"windup",
			"recover",
			"stagger",
			"defeated",
		]),
		stateElapsedMs: z.number().nonnegative(),
		attackCooldownMs: z.number().nonnegative(),
	})
	.strict();
export const action3dStateSchema: z.ZodType<Action3dState> = z
	.object({
		schemaVersion: z.literal(ACTION3D_STATE_SCHEMA_VERSION),
		contentVersion: z.string().min(1),
		revision: z.number().int().nonnegative(),
		elapsedMs: z.number().nonnegative(),
		phase: z.enum(["playing", "paused", "victory", "defeat"]),
		location: z
			.object({
				worldId: z.string().min(1),
				spawnId: z.string().min(1),
				checkpointId: z.string().min(1),
			})
			.strict(),
		player: z
			.object({
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
				attackHitEnemyIds: z.array(z.string()),
				dodgeElapsedMs: z.number().nonnegative().nullable(),
				dodgeCooldownMs: z.number().nonnegative(),
				invulnerableMs: z.number().nonnegative(),
				lockOnEnemyId: z.string().nullable(),
			})
			.strict(),
		enemies: z.array(enemy).max(32),
	})
	.strict();
export type Action3dSaveEnvelope = {
	formatVersion: typeof ACTION3D_SAVE_FORMAT_VERSION;
	slotId: typeof ACTION3D_AUTOSAVE_SLOT;
	savedAt: string;
	state: Action3dState;
};
const envelopeSchema: z.ZodType<Action3dSaveEnvelope> = z
	.object({
		formatVersion: z.literal(ACTION3D_SAVE_FORMAT_VERSION),
		slotId: z.literal(ACTION3D_AUTOSAVE_SLOT),
		savedAt: z.string().refine((value) => !Number.isNaN(Date.parse(value))),
		state: action3dStateSchema,
	})
	.strict();
export type Action3dSaveDecodeResult =
	| { status: "ready"; save: Action3dSaveEnvelope }
	| { status: "corrupt"; message: string }
	| {
			status: "unsupported";
			message: string;
			formatVersion?: number;
			stateVersion?: number;
	  };
export const createAction3dSave = (
	state: Action3dState,
	savedAt = new Date().toISOString(),
): Action3dSaveEnvelope =>
	envelopeSchema.parse({
		formatVersion: ACTION3D_SAVE_FORMAT_VERSION,
		slotId: ACTION3D_AUTOSAVE_SLOT,
		savedAt,
		state,
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
	const result = envelopeSchema.safeParse(raw);
	if (!result.success) {
		const stateVersion =
			candidate.state && typeof candidate.state === "object"
				? (candidate.state as Record<string, unknown>).schemaVersion
				: undefined;
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
	return { status: "ready", save: result.data };
}
