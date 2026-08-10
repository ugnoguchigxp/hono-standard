import { z } from "zod";
import { createInitialGameState } from "./demo-state";
import { createFieldStateAt } from "./field-engine";
import {
	GAME_CONTENT_VERSION,
	GAME_STATE_SCHEMA_VERSION,
	type GameState,
} from "./model";

export const GAME_SAVE_FORMAT_VERSION = 1 as const;
export const AUTOSAVE_SLOT_ID = "autosave" as const;

const nonNegativeInteger = z.number().int().nonnegative();
const gridPointSchema = z
	.object({ x: nonNegativeInteger, y: nonNegativeInteger })
	.strict();
const abilitySchema = z
	.object({
		id: z.string().min(1),
		name: z.string().min(1),
		powerPercent: z.number().finite(),
	})
	.strict();
const characterSchema = z
	.object({
		id: z.string().min(1),
		name: z.string().min(1),
		level: nonNegativeInteger,
		hp: nonNegativeInteger,
		maxHp: nonNegativeInteger,
		attack: z.number().finite(),
		defense: z.number().finite(),
		speed: z.number().finite(),
		ability: abilitySchema,
	})
	.strict();
const combatantSchema = characterSchema.extend({
	side: z.enum(["party", "enemy"]),
	actionGauge: z.number().finite().nonnegative(),
	defending: z.boolean(),
});
const battleSchema = z
	.object({
		id: z.string().min(1),
		phase: z.enum(["running", "awaiting-command", "victory", "defeat"]),
		elapsedMs: z.number().finite().nonnegative(),
		activeActorId: z.string().min(1).nullable(),
		party: z.array(combatantSchema),
		enemies: z.array(combatantSchema),
	})
	.strict();
const currentMapSchema = z
	.object({
		id: z.string().min(1),
		checkpoint: gridPointSchema,
	})
	.strict();
const partySchema = z.object({ members: z.array(characterSchema) }).strict();
const storySchema = z
	.object({
		chapter: z.string().min(1),
		scene: z.string().min(1),
		flags: z.record(z.string(), z.boolean()),
		relationships: z.record(z.string(), z.number().finite()),
	})
	.strict();
const savedAtSchema = z
	.string()
	.refine(
		(value) => !Number.isNaN(Date.parse(value)),
		"savedAt must be an ISO-compatible date string.",
	);

export const gameStateSchema: z.ZodType<GameState> = z
	.object({
		schemaVersion: z.literal(GAME_STATE_SCHEMA_VERSION),
		contentVersion: z.literal(GAME_CONTENT_VERSION),
		revision: nonNegativeInteger,
		rng: z
			.object({
				seed: nonNegativeInteger.max(0xffff_ffff),
				state: nonNegativeInteger.max(0xffff_ffff),
				draws: nonNegativeInteger,
			})
			.strict(),
		mode: z.enum(["field", "event", "battle"]),
		field: z
			.object({
				partyPositions: z.array(gridPointSchema).min(1),
				eventTriggered: z.boolean(),
			})
			.strict(),
		currentMap: currentMapSchema,
		party: partySchema,
		story: storySchema,
		battle: battleSchema.nullable(),
	})
	.strict();

const legacyGameStateV1Schema = z
	.object({
		schemaVersion: z.literal(1),
		mode: z.enum(["field", "event", "battle"]),
		currentMap: currentMapSchema,
		party: partySchema,
		story: storySchema,
		battle: battleSchema.nullable(),
	})
	.strict();

export type GameSaveEnvelope = {
	formatVersion: typeof GAME_SAVE_FORMAT_VERSION;
	slotId: typeof AUTOSAVE_SLOT_ID;
	savedAt: string;
	state: GameState;
};

export type GameSaveDecodeResult =
	| { status: "ready"; save: GameSaveEnvelope; migrated: boolean }
	| { status: "corrupt"; message: string }
	| {
			status: "unsupported";
			message: string;
			formatVersion?: number;
			stateVersion?: number;
	  };

const currentSaveSchema: z.ZodType<GameSaveEnvelope> = z
	.object({
		formatVersion: z.literal(GAME_SAVE_FORMAT_VERSION),
		slotId: z.literal(AUTOSAVE_SLOT_ID),
		savedAt: savedAtSchema,
		state: gameStateSchema,
	})
	.strict();

const legacySaveV0Schema = z
	.object({
		formatVersion: z.literal(0),
		savedAt: savedAtSchema,
		state: legacyGameStateV1Schema,
	})
	.strict();

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const migrateLegacyV0 = (
	legacy: z.infer<typeof legacySaveV0Schema>,
): GameSaveEnvelope => {
	const state = createInitialGameState();
	state.mode = legacy.state.mode;
	state.currentMap = legacy.state.currentMap;
	state.field = createFieldStateAt(legacy.state.currentMap.checkpoint);
	state.party = legacy.state.party;
	state.story = legacy.state.story;
	state.battle = legacy.state.battle;
	return {
		formatVersion: GAME_SAVE_FORMAT_VERSION,
		slotId: AUTOSAVE_SLOT_ID,
		savedAt: legacy.savedAt,
		state: gameStateSchema.parse(state),
	};
};

export function createGameSave(
	state: GameState,
	savedAt: string = new Date().toISOString(),
): GameSaveEnvelope {
	return currentSaveSchema.parse({
		formatVersion: GAME_SAVE_FORMAT_VERSION,
		slotId: AUTOSAVE_SLOT_ID,
		savedAt,
		state,
	});
}

export function serializeGameSave(state: GameState, savedAt?: string): string {
	return JSON.stringify(createGameSave(state, savedAt));
}

export function decodeGameSave(serialized: string): GameSaveDecodeResult {
	let value: unknown;
	try {
		value = JSON.parse(serialized);
	} catch {
		return { status: "corrupt", message: "Save data is not valid JSON." };
	}

	if (!isRecord(value)) {
		return { status: "corrupt", message: "Save data must be an object." };
	}

	const formatVersion = value.formatVersion;
	if (formatVersion === GAME_SAVE_FORMAT_VERSION) {
		const parsed = currentSaveSchema.safeParse(value);
		if (parsed.success) {
			return { status: "ready", save: parsed.data, migrated: false };
		}
		const stateVersion = isRecord(value.state)
			? value.state.schemaVersion
			: undefined;
		if (
			typeof stateVersion === "number" &&
			stateVersion !== GAME_STATE_SCHEMA_VERSION
		) {
			return {
				status: "unsupported",
				message: `Game State version ${stateVersion} is not supported.`,
				stateVersion,
			};
		}
		return {
			status: "corrupt",
			message: "Save data does not match the current schema.",
		};
	}

	if (formatVersion === 0) {
		const parsed = legacySaveV0Schema.safeParse(value);
		if (!parsed.success) {
			const stateVersion = isRecord(value.state)
				? value.state.schemaVersion
				: undefined;
			if (typeof stateVersion === "number" && stateVersion !== 1) {
				return {
					status: "unsupported",
					message: `Legacy Game State version ${stateVersion} is not supported.`,
					stateVersion,
				};
			}
			return {
				status: "corrupt",
				message: "Legacy save data is incomplete or corrupt.",
			};
		}
		return {
			status: "ready",
			save: migrateLegacyV0(parsed.data),
			migrated: true,
		};
	}

	if (typeof formatVersion === "number") {
		return {
			status: "unsupported",
			message: `Save format version ${formatVersion} is not supported.`,
			formatVersion,
		};
	}

	return {
		status: "corrupt",
		message: "Save format version is missing.",
	};
}
