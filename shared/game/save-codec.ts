import { z } from "zod";
import { createFieldStateAt } from "./field-engine";
import {
	GAME_CONTENT_VERSION,
	GAME_STATE_SCHEMA_VERSION,
	getGameStateInvariantIssues,
	type FieldDirection,
	type GameState,
} from "./model";

export const GAME_SAVE_FORMAT_VERSION = 1 as const;
export const AUTOSAVE_SLOT_ID = "autosave" as const;
const LEGACY_V2_CONTENT_VERSION = "signal-ruins-1" as const;

const nonNegativeInteger = z.number().int().nonnegative();
const gridPointSchema = z
	.object({ x: nonNegativeInteger, y: nonNegativeInteger })
	.strict();
const directionSchema = z.enum(["UP", "DOWN", "LEFT", "RIGHT"]);
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
		party: z.array(combatantSchema).min(1).max(8),
		enemies: z.array(combatantSchema).max(16),
	})
	.strict();
const legacyCurrentMapSchema = z
	.object({
		id: z.string().min(1),
		checkpoint: gridPointSchema,
	})
	.strict();
const locationSchema = z
	.object({
		mapId: z.string().min(1),
		entranceId: z.string().min(1),
		checkpointId: z.string().min(1),
	})
	.strict();
const fieldSchema = z
	.object({
		partyPositions: z.array(gridPointSchema).min(1).max(8),
		facing: directionSchema,
		pendingTriggerId: z.string().min(1).nullable(),
		stepsSinceEncounter: nonNegativeInteger.max(1_000_000).default(0),
	})
	.strict();
const partySchema = z
	.object({ members: z.array(characterSchema).min(1).max(8) })
	.strict();
const storySchema = z
	.object({
		chapter: z.string().min(1),
		scene: z.string().min(1),
		flags: z.record(z.string(), z.boolean()),
		relationships: z.record(z.string(), z.number().finite().min(-100).max(100)),
	})
	.strict();
const activeEventSchema = z
	.object({
		eventId: z.string().min(1),
		nodeId: z.string().min(1),
		status: z.enum(["running", "awaiting-confirm", "awaiting-choice"]),
		visibleLine: z
			.object({ speakerId: z.string().min(1), text: z.string().min(1) })
			.strict()
			.nullable(),
		choices: z
			.array(
				z.object({ id: z.string().min(1), text: z.string().min(1) }).strict(),
			)
			.max(4),
		actors: z
			.array(
				z
					.object({
						actorId: z.string().min(1),
						slot: z.enum(["left", "center", "right", "hidden"]),
						expression: z.string().min(1),
					})
					.strict(),
			)
			.max(8),
	})
	.strict();
const rngSchema = z
	.object({
		seed: nonNegativeInteger.max(0xffff_ffff),
		state: nonNegativeInteger.max(0xffff_ffff),
		draws: nonNegativeInteger,
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
		contentVersion: z.string().min(1),
		revision: nonNegativeInteger,
		rng: rngSchema,
		mode: z.enum(["field", "event", "battle"]),
		location: locationSchema,
		field: fieldSchema,
		event: activeEventSchema.nullable(),
		party: partySchema,
		story: storySchema,
		battle: battleSchema.nullable(),
	})
	.strict()
	.superRefine((state, context) => {
		for (const { path, message } of getGameStateInvariantIssues(state)) {
			context.addIssue({ code: "custom", path, message });
		}
	});

const legacyGameStateV3Schema = z
	.object({
		schemaVersion: z.literal(3),
		contentVersion: z.string().min(1),
		revision: nonNegativeInteger,
		rng: rngSchema,
		mode: z.enum(["field", "event", "battle"]),
		location: locationSchema,
		field: fieldSchema,
		party: partySchema,
		story: storySchema,
		battle: battleSchema.nullable(),
	})
	.strict();

const legacyGameStateV2Schema = z
	.object({
		schemaVersion: z.literal(2),
		contentVersion: z.literal(LEGACY_V2_CONTENT_VERSION),
		revision: nonNegativeInteger,
		rng: rngSchema,
		mode: z.enum(["field", "event", "battle"]),
		field: z
			.object({
				partyPositions: z.array(gridPointSchema).min(1).max(8),
				eventTriggered: z.boolean(),
			})
			.strict(),
		currentMap: legacyCurrentMapSchema,
		party: partySchema,
		story: storySchema,
		battle: battleSchema.nullable(),
	})
	.strict();

const legacyGameStateV1Schema = z
	.object({
		schemaVersion: z.literal(1),
		mode: z.enum(["field", "event", "battle"]),
		currentMap: legacyCurrentMapSchema,
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

const currentEnvelopeBaseSchema = z
	.object({
		formatVersion: z.literal(GAME_SAVE_FORMAT_VERSION),
		slotId: z.literal(AUTOSAVE_SLOT_ID),
		savedAt: savedAtSchema,
		state: z.unknown(),
	})
	.strict();

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

type LegacyLocation = {
	mapId: string;
	entranceId: string;
	checkpointId: string;
	position: { x: number; y: number };
	facing: FieldDirection;
};

const migrateLegacyLocation = (
	mapId: string,
	checkpoint: { x: number; y: number },
): LegacyLocation | null => {
	if (mapId !== "signal-ruins") return null;
	if (checkpoint.x === 3 && checkpoint.y === 6) {
		return {
			mapId,
			entranceId: "signal-ruins-entry",
			checkpointId: "signal-entry",
			position: { x: 8, y: 18 },
			facing: "RIGHT",
		};
	}
	if (checkpoint.x === 14 && checkpoint.y === 5) {
		return {
			mapId,
			entranceId: "signal-ruins-entry",
			checkpointId: "signal-core",
			position: { x: 31, y: 4 },
			facing: "RIGHT",
		};
	}
	return null;
};

const migrateV3ToV4 = (
	state: z.infer<typeof legacyGameStateV3Schema>,
): GameState => {
	const resumesBattle = state.mode === "battle" && state.battle !== null;
	return gameStateSchema.parse({
		...state,
		schemaVersion: GAME_STATE_SCHEMA_VERSION,
		contentVersion: state.contentVersion,
		mode: resumesBattle ? "battle" : "field",
		event: null,
		battle: resumesBattle ? state.battle : null,
	});
};

const migrateV2ToV4 = (
	state: z.infer<typeof legacyGameStateV2Schema>,
): GameState | null => {
	const migratedLocation = migrateLegacyLocation(
		state.currentMap.id,
		state.currentMap.checkpoint,
	);
	if (!migratedLocation) return null;
	const v3 = legacyGameStateV3Schema.parse({
		schemaVersion: 3,
		contentVersion: GAME_CONTENT_VERSION,
		revision: state.revision,
		rng: state.rng,
		mode: state.mode,
		location: {
			mapId: migratedLocation.mapId,
			entranceId: migratedLocation.entranceId,
			checkpointId: migratedLocation.checkpointId,
		},
		field: {
			partyPositions: createFieldStateAt(
				migratedLocation.position,
				migratedLocation.facing,
				state.field.partyPositions.length,
			).partyPositions,
			facing: migratedLocation.facing,
			pendingTriggerId: null,
		},
		party: state.party,
		story: state.story,
		battle: state.battle,
	});
	return migrateV3ToV4(v3);
};

const migrateV1ToV4 = (
	state: z.infer<typeof legacyGameStateV1Schema>,
): GameState | null => {
	const migratedLocation = migrateLegacyLocation(
		state.currentMap.id,
		state.currentMap.checkpoint,
	);
	if (!migratedLocation) return null;
	return migrateV2ToV4(
		legacyGameStateV2Schema.parse({
			schemaVersion: 2,
			contentVersion: "signal-ruins-1",
			revision: 0,
			rng: { seed: 0x4541_4457, state: 0x4541_4457, draws: 0 },
			mode: state.mode,
			field: {
				partyPositions: createFieldStateAt(
					state.currentMap.checkpoint,
					migratedLocation.facing,
				).partyPositions,
				eventTriggered: false,
			},
			currentMap: state.currentMap,
			party: state.party,
			story: state.story,
			battle: state.battle,
		}),
	);
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
		const current = currentSaveSchema.safeParse(value);
		if (current.success) {
			return { status: "ready", save: current.data, migrated: false };
		}
		const envelope = currentEnvelopeBaseSchema.safeParse(value);
		if (!envelope.success || !isRecord(value.state)) {
			return {
				status: "corrupt",
				message: "Save data does not match the current schema.",
			};
		}
		const stateVersion = value.state.schemaVersion;
		if (stateVersion === GAME_STATE_SCHEMA_VERSION) {
			return {
				status: "corrupt",
				message: "Save data does not match the current schema.",
			};
		}
		if (stateVersion === 3) {
			const parsed = legacyGameStateV3Schema.safeParse(value.state);
			if (!parsed.success) {
				return {
					status: "corrupt",
					message: "Version 3 save data is corrupt.",
				};
			}
			return {
				status: "ready",
				save: currentSaveSchema.parse({
					...envelope.data,
					state: migrateV3ToV4(parsed.data),
				}),
				migrated: true,
			};
		}
		if (stateVersion === 2) {
			if (value.state.contentVersion !== LEGACY_V2_CONTENT_VERSION) {
				return {
					status: "unsupported",
					message: `Version 2 content '${String(value.state.contentVersion)}' is not supported.`,
					stateVersion: 2,
				};
			}
			const parsed = legacyGameStateV2Schema.safeParse(value.state);
			if (!parsed.success) {
				return {
					status: "corrupt",
					message: "Version 2 save data is corrupt.",
				};
			}
			const migrated = migrateV2ToV4(parsed.data);
			if (!migrated) {
				return {
					status: "unsupported",
					message: "The legacy checkpoint location is not supported.",
					stateVersion: 2,
				};
			}
			return {
				status: "ready",
				save: currentSaveSchema.parse({ ...envelope.data, state: migrated }),
				migrated: true,
			};
		}
		if (typeof stateVersion === "number") {
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
		const migrated = migrateV1ToV4(parsed.data.state);
		if (!migrated) {
			return {
				status: "unsupported",
				message: "The legacy checkpoint location is not supported.",
				stateVersion: 1,
			};
		}
		return {
			status: "ready",
			save: currentSaveSchema.parse({
				formatVersion: GAME_SAVE_FORMAT_VERSION,
				slotId: AUTOSAVE_SLOT_ID,
				savedAt: parsed.data.savedAt,
				state: migrated,
			}),
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

	return { status: "corrupt", message: "Save format version is missing." };
}
