import { z } from "zod";
import { createFieldStateAt } from "./field-engine";
import {
	GAME_CONTENT_VERSION,
	GAME_STATE_SCHEMA_VERSION,
	getGameStateInvariantIssues,
	type BattleState,
	type CharacterState,
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
const legacyAbilitySchema = z
	.object({
		id: z.string().min(1),
		name: z.string().min(1),
		powerPercent: z.number().finite(),
	})
	.strict();
const battleElementSchema = z.enum([
	"physical",
	"fire",
	"lightning",
	"arcane",
	"restoration",
]);
const statusDefinitionSchema = z
	.object({
		id: z.string().min(1),
		name: z.string().min(1),
		description: z.string(),
		polarity: z.enum(["positive", "negative"]),
		durationTurns: z.number().int().positive(),
		attackPercent: z.number().finite(),
		defensePercent: z.number().finite(),
		speedPercent: z.number().finite(),
		damagePercentMaxHp: z.number().finite().nonnegative(),
	})
	.strict();
const statusStateSchema = statusDefinitionSchema.extend({
	turnsRemaining: z.number().int().positive(),
});
const abilitySchema = z
	.object({
		id: z.string().min(1),
		name: z.string().min(1),
		description: z.string(),
		kind: z.enum(["damage", "heal", "status"]),
		target: z.enum([
			"enemy-single",
			"enemy-all",
			"ally-single",
			"ally-all",
			"self",
		]),
		powerPercent: z.number().finite().nonnegative(),
		mpCost: z.number().int().nonnegative(),
		element: battleElementSchema,
		statusEffect: statusDefinitionSchema.optional(),
		statusChance: z.number().min(0).max(1).optional(),
	})
	.strict();
const legacyCharacterSchema = z
	.object({
		id: z.string().min(1),
		name: z.string().min(1),
		level: nonNegativeInteger,
		hp: nonNegativeInteger,
		maxHp: nonNegativeInteger,
		attack: z.number().finite(),
		defense: z.number().finite(),
		speed: z.number().finite(),
		ability: legacyAbilitySchema,
	})
	.strict();
const characterSchema = z
	.object({
		id: z.string().min(1),
		name: z.string().min(1),
		level: z.number().int().positive().max(50),
		experience: nonNegativeInteger,
		hp: nonNegativeInteger,
		maxHp: z.number().int().positive(),
		mp: nonNegativeInteger,
		maxMp: nonNegativeInteger,
		attack: z.number().finite().positive(),
		defense: z.number().finite().nonnegative(),
		speed: z.number().finite().positive(),
		ability: abilitySchema,
		abilities: z.array(abilitySchema).min(1).max(32),
	})
	.strict();
const combatantSchema = characterSchema.extend({
	side: z.enum(["party", "enemy"]),
	actionGauge: z.number().finite().nonnegative(),
	defending: z.boolean(),
	statuses: z.array(statusStateSchema).max(16),
	elementMultipliers: z.partialRecord(
		battleElementSchema,
		z.number().positive(),
	),
	aiPattern: z.array(z.string().min(1)).max(16),
	turnsTaken: nonNegativeInteger,
});
const battleItemSchema = z
	.object({
		id: z.string().min(1),
		name: z.string().min(1),
		description: z.string(),
		effect: z.enum([
			"restore-hp",
			"restore-mp",
			"revive",
			"cure-status",
			"none",
		]),
		power: nonNegativeInteger,
		statusIds: z.array(z.string().min(1)).max(16),
		target: z.enum(["ally-single", "ally-all"]),
		count: nonNegativeInteger,
	})
	.strict();
const battleSchema = z
	.object({
		id: z.string().min(1),
		phase: z.enum([
			"running",
			"awaiting-command",
			"victory",
			"defeat",
			"escaped",
		]),
		elapsedMs: z.number().finite().nonnegative(),
		activeActorId: z.string().min(1).nullable(),
		party: z.array(combatantSchema).min(1).max(8),
		enemies: z.array(combatantSchema).max(16),
		items: z.array(battleItemSchema).max(64),
		canEscape: z.boolean(),
	})
	.strict();
const legacyCombatantSchema = legacyCharacterSchema.extend({
	side: z.enum(["party", "enemy"]),
	actionGauge: z.number().finite().nonnegative(),
	defending: z.boolean(),
});
const legacyBattleSchema = z
	.object({
		id: z.string().min(1),
		phase: z.enum(["running", "awaiting-command", "victory", "defeat"]),
		elapsedMs: z.number().finite().nonnegative(),
		activeActorId: z.string().min(1).nullable(),
		party: z.array(legacyCombatantSchema).min(1).max(8),
		enemies: z.array(legacyCombatantSchema).max(16),
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
const equipmentLoadoutSchema = z
	.object({
		weapon: z.string().min(1).nullable(),
		armor: z.string().min(1).nullable(),
		"off-hand": z.string().min(1).nullable(),
		relic: z.string().min(1).nullable(),
	})
	.strict();
const inventorySchema = z.record(z.string().min(1), nonNegativeInteger);
const partySchema = z
	.object({ members: z.array(characterSchema).min(1).max(8) })
	.extend({
		inventory: inventorySchema,
		equipmentInventory: inventorySchema,
		equipment: z.record(z.string().min(1), equipmentLoadoutSchema),
	})
	.strict();
const legacyPartySchema = z
	.object({ members: z.array(legacyCharacterSchema).min(1).max(8) })
	.strict();
const migratablePartySchema = z.union([partySchema, legacyPartySchema]);
const migratableBattleSchema = z.union([battleSchema, legacyBattleSchema]);
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

const legacyGameStateV4Schema = z
	.object({
		schemaVersion: z.literal(4),
		contentVersion: z.string().min(1),
		revision: nonNegativeInteger,
		rng: rngSchema,
		mode: z.enum(["field", "event", "battle"]),
		location: locationSchema,
		field: fieldSchema,
		event: activeEventSchema.nullable(),
		party: migratablePartySchema,
		story: storySchema,
		battle: migratableBattleSchema.nullable(),
	})
	.strict();

const legacyGameStateV3Schema = z
	.object({
		schemaVersion: z.literal(3),
		contentVersion: z.string().min(1),
		revision: nonNegativeInteger,
		rng: rngSchema,
		mode: z.enum(["field", "event", "battle"]),
		location: locationSchema,
		field: fieldSchema,
		party: migratablePartySchema,
		story: storySchema,
		battle: migratableBattleSchema.nullable(),
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
		party: migratablePartySchema,
		story: storySchema,
		battle: migratableBattleSchema.nullable(),
	})
	.strict();

const legacyGameStateV1Schema = z
	.object({
		schemaVersion: z.literal(1),
		mode: z.enum(["field", "event", "battle"]),
		currentMap: legacyCurrentMapSchema,
		party: migratablePartySchema,
		story: storySchema,
		battle: migratableBattleSchema.nullable(),
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

type LegacyCharacter = z.infer<typeof legacyCharacterSchema>;
type LegacyBattle = z.infer<typeof legacyBattleSchema>;
type MigratableCharacter = LegacyCharacter | CharacterState;
type MigratableBattle = LegacyBattle | BattleState;

const legacyEquipment: Record<
	string,
	{
		weapon: string | null;
		armor: string | null;
		"off-hand": string | null;
		relic: string | null;
	}
> = {
	mira: {
		weapon: "rune-blade",
		armor: "dawn-mail",
		"off-hand": "signal-guard",
		relic: null,
	},
	sol: {
		weapon: "steel-spear",
		armor: "knight-plate",
		"off-hand": "guard-shield",
		relic: "red-plume",
	},
	lune: {
		weapon: "echo-staff",
		armor: "sage-robe",
		"off-hand": "crystal-tome",
		relic: "moon-charm",
	},
};

const legacyMaxMp: Record<string, number> = { mira: 18, sol: 14, lune: 42 };

const migrateLegacyAbility = (ability: LegacyCharacter["ability"]) => ({
	...ability,
	description: ability.name,
	kind: "damage" as const,
	target: "enemy-single" as const,
	mpCost: 0,
	element: "physical" as const,
});

const migrateLegacyCharacter = (
	character: MigratableCharacter,
): CharacterState => {
	if ("abilities" in character) {
		return {
			...character,
			ability: { ...character.ability },
			abilities: character.abilities.map((ability) => ({ ...ability })),
		};
	}
	const ability = migrateLegacyAbility(character.ability);
	const maxMp = legacyMaxMp[character.id] ?? 0;
	return {
		...character,
		experience: character.level <= 1 ? 0 : 100 * (character.level - 1) ** 2,
		mp: maxMp,
		maxMp,
		ability,
		abilities: [ability],
	};
};

const migrateLegacyBattle = (
	battle: MigratableBattle | null,
	inventory: Record<string, number>,
): BattleState | null => {
	if (battle && "items" in battle) return structuredClone(battle);
	return battle
		? {
				...battle,
				party: battle.party.map((member) => ({
					...migrateLegacyCharacter(member),
					side: member.side,
					actionGauge: member.actionGauge,
					defending: member.defending,
					statuses: [],
					elementMultipliers: {},
					aiPattern: [],
					turnsTaken: 0,
				})),
				enemies: battle.enemies.map((enemy) => ({
					...migrateLegacyCharacter(enemy),
					side: enemy.side,
					actionGauge: enemy.actionGauge,
					defending: enemy.defending,
					statuses: [],
					elementMultipliers: {},
					aiPattern: [enemy.ability.id],
					turnsTaken: 0,
				})),
				items: Object.entries(inventory).flatMap(([id, count]) =>
					id === "potion"
						? [
								{
									id,
									name: "Potion",
									description: "Restores 50 HP to one ally.",
									effect: "restore-hp" as const,
									power: 50,
									statusIds: [],
									target: "ally-single" as const,
									count,
								},
							]
						: [],
				),
				canEscape: battle.id !== "signal-ruins-encounter",
			}
		: null;
};

const migrateV4ToV5 = (
	state: z.infer<typeof legacyGameStateV4Schema>,
): GameState => {
	const inventory = {
		potion: 5,
		ether: 3,
		antidote: 3,
		"phoenix-feather": 1,
		"echo-shard": 1,
	};
	return gameStateSchema.parse({
		...state,
		schemaVersion: GAME_STATE_SCHEMA_VERSION,
		party: {
			members: state.party.members.map(migrateLegacyCharacter),
			inventory,
			equipmentInventory: { "tempered-blade": 1, "swift-band": 1 },
			equipment: Object.fromEntries(
				state.party.members.map((member) => [
					member.id,
					legacyEquipment[member.id] ?? {
						weapon: null,
						armor: null,
						"off-hand": null,
						relic: null,
					},
				]),
			),
		},
		battle: migrateLegacyBattle(state.battle, inventory),
	});
};

const migrateV3ToV5 = (
	state: z.infer<typeof legacyGameStateV3Schema>,
): GameState => {
	const resumesBattle = state.mode === "battle" && state.battle !== null;
	const v4 = legacyGameStateV4Schema.parse({
		...state,
		schemaVersion: 4,
		contentVersion: state.contentVersion,
		mode: resumesBattle ? "battle" : "field",
		event: null,
		battle: resumesBattle ? state.battle : null,
	});
	return migrateV4ToV5(v4);
};

const migrateV2ToV5 = (
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
	return migrateV3ToV5(v3);
};

const migrateV1ToV5 = (
	state: z.infer<typeof legacyGameStateV1Schema>,
): GameState | null => {
	const migratedLocation = migrateLegacyLocation(
		state.currentMap.id,
		state.currentMap.checkpoint,
	);
	if (!migratedLocation) return null;
	return migrateV2ToV5(
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
		if (stateVersion === 4) {
			const parsed = legacyGameStateV4Schema.safeParse(value.state);
			if (!parsed.success) {
				return {
					status: "corrupt",
					message: "Version 4 save data is corrupt.",
				};
			}
			return {
				status: "ready",
				save: currentSaveSchema.parse({
					...envelope.data,
					state: migrateV4ToV5(parsed.data),
				}),
				migrated: true,
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
					state: migrateV3ToV5(parsed.data),
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
			const migrated = migrateV2ToV5(parsed.data);
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
		const migrated = migrateV1ToV5(parsed.data.state);
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
