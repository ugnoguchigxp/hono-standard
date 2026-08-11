import { z } from "zod";

export const CONTENT_MANIFEST_VERSION = 1 as const;
export const MAX_CONTENT_COLLECTION_SIZE = 256;
export const MAX_EVENT_NODES = 512;
export const MAX_CONDITION_DEPTH = 8;

export const stableIdSchema = z
	.string()
	.min(1)
	.max(80)
	.regex(
		/^[a-z0-9]+(?:-[a-z0-9]+)*$/,
		"IDs must use stable kebab-case values.",
	);

export const relationshipIdSchema = z
	.string()
	.min(3)
	.max(161)
	.regex(
		/^[a-z0-9]+(?:-[a-z0-9]+)*:[a-z0-9]+(?:-[a-z0-9]+)*$/,
		"Relationship IDs must contain two kebab-case IDs separated by a colon.",
	);

export const gridPointSchema = z
	.object({
		x: z.number().int().nonnegative().max(1_024),
		y: z.number().int().nonnegative().max(1_024),
	})
	.strict();

export const fieldDirectionSchema = z.enum(["UP", "DOWN", "LEFT", "RIGHT"]);

const flagConditionSchema = z
	.object({
		type: z.literal("flag.equals"),
		flagId: stableIdSchema,
		value: z.boolean(),
	})
	.strict();
const relationshipGteConditionSchema = z
	.object({
		type: z.literal("relationship.gte"),
		relationshipId: relationshipIdSchema,
		value: z.number().int().min(-100).max(100),
	})
	.strict();
const relationshipLteConditionSchema = z
	.object({
		type: z.literal("relationship.lte"),
		relationshipId: relationshipIdSchema,
		value: z.number().int().min(-100).max(100),
	})
	.strict();

export type ContentCondition =
	| z.infer<typeof flagConditionSchema>
	| z.infer<typeof relationshipGteConditionSchema>
	| z.infer<typeof relationshipLteConditionSchema>
	| { type: "all" | "any"; conditions: ContentCondition[] }
	| { type: "not"; condition: ContentCondition };

export const contentConditionSchema: z.ZodType<ContentCondition> = z.lazy(() =>
	z.union([
		flagConditionSchema,
		relationshipGteConditionSchema,
		relationshipLteConditionSchema,
		z
			.object({
				type: z.enum(["all", "any"]),
				conditions: z
					.array(contentConditionSchema)
					.min(1)
					.max(MAX_CONTENT_COLLECTION_SIZE),
			})
			.strict(),
		z
			.object({
				type: z.literal("not"),
				condition: contentConditionSchema,
			})
			.strict(),
	]),
);

export const assetDefinitionSchema = z
	.object({
		id: stableIdSchema,
		type: z.literal("image"),
		url: z
			.string()
			.min(1)
			.max(240)
			.refine(
				(value) =>
					value.startsWith("/assets/game/") &&
					!value.includes("..") &&
					!/%2e/i.test(value) &&
					!value.includes(":") &&
					!value.includes("\\"),
				"Asset URLs must be same-origin paths below /assets/game/ without traversal.",
			),
	})
	.strict();

export const actorDefinitionSchema = z
	.object({
		id: stableIdSchema,
		displayName: z.string().min(1).max(48),
		textureKey: stableIdSchema,
	})
	.strict();

export const battleElementSchema = z.enum([
	"physical",
	"fire",
	"lightning",
	"arcane",
	"restoration",
]);

export const battleTargetSchema = z.enum([
	"enemy-single",
	"enemy-all",
	"ally-single",
	"ally-all",
	"self",
]);

export const statusEffectDefinitionSchema = z
	.object({
		id: stableIdSchema,
		displayName: z.string().min(1).max(48),
		description: z.string().min(1).max(180),
		polarity: z.enum(["positive", "negative"]),
		durationTurns: z.number().int().positive().max(9),
		attackPercent: z.number().int().min(-90).max(200).default(0),
		defensePercent: z.number().int().min(-90).max(200).default(0),
		speedPercent: z.number().int().min(-90).max(200).default(0),
		damagePercentMaxHp: z.number().int().nonnegative().max(50).default(0),
	})
	.strict();

export const abilityDefinitionSchema = z
	.object({
		id: stableIdSchema,
		displayName: z.string().min(1).max(48),
		description: z.string().min(1).max(180),
		kind: z.enum(["damage", "heal", "status"]),
		target: battleTargetSchema,
		powerPercent: z.number().int().nonnegative().max(500),
		mpCost: z.number().int().nonnegative().max(999),
		element: battleElementSchema,
		statusEffectId: stableIdSchema.optional(),
		statusChance: z.number().min(0).max(1).optional(),
	})
	.strict()
	.superRefine((ability, context) => {
		if (ability.kind === "status" && !ability.statusEffectId) {
			context.addIssue({
				code: "custom",
				path: ["statusEffectId"],
				message: "Status abilities require a status effect ID.",
			});
		}
		if (ability.kind === "heal" && ability.target.startsWith("enemy")) {
			context.addIssue({
				code: "custom",
				path: ["target"],
				message: "Healing abilities must target allies or self.",
			});
		}
	});

const statBlockSchema = z
	.object({
		maxHp: z.number().int().positive().max(99_999),
		maxMp: z.number().int().nonnegative().max(9_999),
		attack: z.number().int().positive().max(9_999),
		defense: z.number().int().nonnegative().max(9_999),
		speed: z.number().int().positive().max(999),
	})
	.strict();

const equipmentLoadoutSchema = z
	.object({
		weapon: stableIdSchema.nullable(),
		armor: stableIdSchema.nullable(),
		"off-hand": stableIdSchema.nullable(),
		relic: stableIdSchema.nullable(),
	})
	.strict();

export const characterDefinitionSchema = z
	.object({
		id: stableIdSchema,
		job: z.string().min(1).max(48),
		initialLevel: z.number().int().positive().max(50),
		baseStats: statBlockSchema,
		growthPerLevel: statBlockSchema,
		abilityUnlocks: z
			.array(
				z
					.object({
						level: z.number().int().positive().max(50),
						abilityId: stableIdSchema,
					})
					.strict(),
			)
			.min(1)
			.max(32),
		initialEquipment: equipmentLoadoutSchema,
	})
	.strict();

export const itemDefinitionSchema = z
	.object({
		id: stableIdSchema,
		displayName: z.string().min(1).max(48),
		description: z.string().min(1).max(180),
		kind: z.enum(["consumable", "key"]),
		initialQuantity: z.number().int().nonnegative().max(99).default(0),
		effect: z.enum([
			"restore-hp",
			"restore-mp",
			"revive",
			"cure-status",
			"none",
		]),
		power: z.number().int().nonnegative().max(9_999),
		statusIds: z.array(stableIdSchema).max(16).default([]),
		target: z.enum(["ally-single", "ally-all"]),
	})
	.strict();

export const equipmentDefinitionSchema = z
	.object({
		id: stableIdSchema,
		displayName: z.string().min(1).max(48),
		description: z.string().min(1).max(180),
		slot: z.enum(["weapon", "armor", "off-hand", "relic"]),
		actorIds: z.array(stableIdSchema).min(1).max(8),
		initialQuantity: z.number().int().nonnegative().max(99).default(0),
		modifiers: z
			.object({
				maxHp: z.number().int().min(-9_999).max(9_999).default(0),
				maxMp: z.number().int().min(-9_999).max(9_999).default(0),
				attack: z.number().int().min(-999).max(999).default(0),
				defense: z.number().int().min(-999).max(999).default(0),
				speed: z.number().int().min(-99).max(99).default(0),
			})
			.strict(),
	})
	.strict();

export const enemyDefinitionSchema = z
	.object({
		id: stableIdSchema,
		displayName: z.string().min(1).max(64),
		level: z.number().int().positive().max(99),
		stats: statBlockSchema,
		elementMultipliers: z
			.partialRecord(battleElementSchema, z.number().positive().max(4))
			.default({}),
		abilityIds: z.array(stableIdSchema).max(16),
		aiPattern: z.array(stableIdSchema).min(1).max(16),
	})
	.strict();

const encounterRewardSchema = z
	.object({
		experience: z.number().int().nonnegative().max(999_999),
		items: z
			.array(
				z
					.object({
						itemId: stableIdSchema,
						quantity: z.number().int().positive().max(99),
						chance: z.number().positive().max(1),
					})
					.strict(),
			)
			.max(16),
	})
	.strict();

export const encounterDefinitionSchema = z
	.object({
		id: stableIdSchema,
		displayName: z.string().min(1).max(80),
		enemyIds: z.array(stableIdSchema).min(1).max(8),
		boss: z.boolean(),
		canEscape: z.boolean(),
		rewards: encounterRewardSchema,
	})
	.strict();

const collisionRegionSchema = z
	.object({
		id: stableIdSchema,
		x: z.number().int().nonnegative(),
		y: z.number().int().nonnegative(),
		width: z.number().int().positive().max(1_024),
		height: z.number().int().positive().max(1_024),
	})
	.strict();

const entranceSchema = z
	.object({
		id: stableIdSchema,
		position: gridPointSchema,
		facing: fieldDirectionSchema,
		checkpointId: stableIdSchema,
	})
	.strict();

const checkpointSchema = z
	.object({
		id: stableIdSchema,
		position: gridPointSchema,
	})
	.strict();

const markerSchema = z
	.object({
		shape: z.enum(["circle", "diamond", "gate", "spring"]),
		color: z
			.string()
			.regex(
				/^#[0-9a-fA-F]{6}$/,
				"Marker colors must be six-digit hex values.",
			),
		pulse: z.boolean().default(true),
	})
	.strict();

const eventTriggerSchema = z
	.object({
		id: stableIdSchema,
		kind: z.literal("event"),
		position: gridPointSchema,
		targetId: stableIdSchema,
		condition: contentConditionSchema.optional(),
		marker: markerSchema.optional(),
	})
	.strict();
const mapTransitionTriggerSchema = z
	.object({
		id: stableIdSchema,
		kind: z.literal("map"),
		position: gridPointSchema,
		targetId: stableIdSchema,
		targetEntranceId: stableIdSchema,
		condition: contentConditionSchema.optional(),
		marker: markerSchema.optional(),
	})
	.strict();
const checkpointTriggerSchema = z
	.object({
		id: stableIdSchema,
		kind: z.literal("checkpoint"),
		position: gridPointSchema,
		targetId: stableIdSchema,
		condition: contentConditionSchema.optional(),
		marker: markerSchema.optional(),
	})
	.strict();
const recoveryTriggerSchema = z
	.object({
		id: stableIdSchema,
		kind: z.literal("recovery"),
		position: gridPointSchema,
		targetId: z.literal("party"),
		condition: contentConditionSchema.optional(),
		marker: markerSchema.optional(),
	})
	.strict();

export const mapTriggerSchema = z.discriminatedUnion("kind", [
	eventTriggerSchema,
	mapTransitionTriggerSchema,
	checkpointTriggerSchema,
	recoveryTriggerSchema,
]);

const randomEncounterSchema = z
	.object({
		encounterId: stableIdSchema,
		minimumSteps: z.number().int().positive().max(100),
		chance: z.number().positive().max(1),
	})
	.strict();

export const mapDefinitionSchema = z
	.object({
		id: stableIdSchema,
		displayName: z.string().min(1).max(80),
		objective: z.string().min(1).max(180),
		width: z.number().int().positive().max(256),
		height: z.number().int().positive().max(256),
		tileSize: z.number().int().positive().max(128),
		backgroundAssetId: stableIdSchema,
		battleBackgroundAssetId: stableIdSchema,
		entrances: z.array(entranceSchema).min(1).max(MAX_CONTENT_COLLECTION_SIZE),
		checkpoints: z
			.array(checkpointSchema)
			.min(1)
			.max(MAX_CONTENT_COLLECTION_SIZE),
		collisionRegions: z
			.array(collisionRegionSchema)
			.max(MAX_CONTENT_COLLECTION_SIZE),
		randomEncounter: randomEncounterSchema.optional(),
		triggers: z.array(mapTriggerSchema).max(MAX_CONTENT_COLLECTION_SIZE),
	})
	.strict();

const nodeBase = {
	id: stableIdSchema,
	condition: contentConditionSchema.optional(),
};
const lineNodeSchema = z
	.object({
		...nodeBase,
		type: z.literal("line"),
		speakerId: stableIdSchema,
		text: z.string().min(1).max(420),
		nextNodeId: stableIdSchema,
	})
	.strict();
const waitNodeSchema = z
	.object({
		...nodeBase,
		type: z.literal("wait"),
		durationMs: z.number().int().nonnegative().max(10_000),
		nextNodeId: stableIdSchema,
	})
	.strict();
const actorMoveNodeSchema = z
	.object({
		...nodeBase,
		type: z.literal("actor.move"),
		actorId: stableIdSchema,
		slot: z.enum(["left", "center", "right", "hidden"]),
		nextNodeId: stableIdSchema,
	})
	.strict();
const actorExpressionNodeSchema = z
	.object({
		...nodeBase,
		type: z.literal("actor.expression"),
		actorId: stableIdSchema,
		expression: stableIdSchema,
		nextNodeId: stableIdSchema,
	})
	.strict();
const choiceNodeSchema = z
	.object({
		...nodeBase,
		type: z.literal("choice"),
		prompt: z.string().min(1).max(220),
		choices: z
			.array(
				z
					.object({
						id: stableIdSchema,
						text: z.string().min(1).max(180),
						nextNodeId: stableIdSchema,
						condition: contentConditionSchema.optional(),
					})
					.strict(),
			)
			.min(2)
			.max(4),
	})
	.strict();
const flagSetNodeSchema = z
	.object({
		...nodeBase,
		type: z.literal("flag.set"),
		flagId: stableIdSchema,
		value: z.boolean(),
		nextNodeId: stableIdSchema,
	})
	.strict();
const relationshipAdjustNodeSchema = z
	.object({
		...nodeBase,
		type: z.literal("relationship.adjust"),
		relationshipId: relationshipIdSchema,
		amount: z.number().int().min(-200).max(200),
		nextNodeId: stableIdSchema,
	})
	.strict();
const battleStartNodeSchema = z
	.object({
		...nodeBase,
		type: z.literal("battle.start"),
		encounterId: stableIdSchema,
		nextNodeId: stableIdSchema,
	})
	.strict();
const mapEnterNodeSchema = z
	.object({
		...nodeBase,
		type: z.literal("map.enter"),
		mapId: stableIdSchema,
		entranceId: stableIdSchema,
	})
	.strict();
const checkpointReachNodeSchema = z
	.object({
		...nodeBase,
		type: z.literal("checkpoint.reach"),
		mapId: stableIdSchema,
		checkpointId: stableIdSchema,
		nextNodeId: stableIdSchema,
	})
	.strict();
const endNodeSchema = z
	.object({
		...nodeBase,
		type: z.literal("end"),
	})
	.strict();

export const eventNodeSchema = z.discriminatedUnion("type", [
	lineNodeSchema,
	waitNodeSchema,
	actorMoveNodeSchema,
	actorExpressionNodeSchema,
	choiceNodeSchema,
	flagSetNodeSchema,
	relationshipAdjustNodeSchema,
	battleStartNodeSchema,
	mapEnterNodeSchema,
	checkpointReachNodeSchema,
	endNodeSchema,
]);

export const eventDefinitionSchema = z
	.object({
		id: stableIdSchema,
		title: z.string().min(1).max(100),
		presentation: z
			.object({
				backgroundAssetId: stableIdSchema,
				actors: z
					.array(
						z
							.object({
								actorId: stableIdSchema,
								slot: z.enum(["left", "center", "right", "hidden"]),
								expression: stableIdSchema,
							})
							.strict(),
					)
					.max(8),
			})
			.strict(),
		entryNodeId: stableIdSchema,
		nodes: z.array(eventNodeSchema).min(1).max(MAX_EVENT_NODES),
	})
	.strict();

const documentPathSchema = z
	.string()
	.min(1)
	.max(160)
	.refine(
		(value) =>
			!value.startsWith("/") &&
			!value.includes("..") &&
			!value.includes(":") &&
			!value.includes("\\") &&
			value.endsWith(".json"),
		"Content document paths must be relative JSON paths without traversal.",
	);

const bundledDocumentSchema = z
	.object({ id: stableIdSchema, path: documentPathSchema })
	.strict();

export const contentBundleSchema = z
	.object({
		id: stableIdSchema,
		maps: z.array(bundledDocumentSchema).max(32),
		events: z.array(bundledDocumentSchema).max(MAX_CONTENT_COLLECTION_SIZE),
	})
	.strict();

export const contentManifestSchema = z
	.object({
		manifestVersion: z.literal(CONTENT_MANIFEST_VERSION),
		contentVersion: stableIdSchema,
		entryPoint: z
			.object({ mapId: stableIdSchema, entranceId: stableIdSchema })
			.strict(),
		entryBundleId: stableIdSchema,
		bundles: z
			.array(contentBundleSchema)
			.min(1)
			.max(MAX_CONTENT_COLLECTION_SIZE),
		documents: z
			.object({
				maps: z
					.array(documentPathSchema)
					.min(1)
					.max(MAX_CONTENT_COLLECTION_SIZE),
				events: z
					.array(documentPathSchema)
					.min(1)
					.max(MAX_CONTENT_COLLECTION_SIZE),
			})
			.strict(),
		assets: z
			.array(assetDefinitionSchema)
			.min(1)
			.max(MAX_CONTENT_COLLECTION_SIZE),
		actors: z
			.array(actorDefinitionSchema)
			.min(1)
			.max(MAX_CONTENT_COLLECTION_SIZE),
		statusEffects: z
			.array(statusEffectDefinitionSchema)
			.max(MAX_CONTENT_COLLECTION_SIZE)
			.default([]),
		abilities: z
			.array(abilityDefinitionSchema)
			.max(MAX_CONTENT_COLLECTION_SIZE)
			.default([]),
		characters: z
			.array(characterDefinitionSchema)
			.max(MAX_CONTENT_COLLECTION_SIZE)
			.default([]),
		items: z
			.array(itemDefinitionSchema)
			.max(MAX_CONTENT_COLLECTION_SIZE)
			.default([]),
		equipment: z
			.array(equipmentDefinitionSchema)
			.max(MAX_CONTENT_COLLECTION_SIZE)
			.default([]),
		enemies: z
			.array(enemyDefinitionSchema)
			.max(MAX_CONTENT_COLLECTION_SIZE)
			.default([]),
		encounters: z
			.array(encounterDefinitionSchema)
			.max(MAX_CONTENT_COLLECTION_SIZE)
			.default([]),
		encounterIds: z
			.array(stableIdSchema)
			.max(MAX_CONTENT_COLLECTION_SIZE)
			.default([]),
	})
	.strict();

export type ContentManifestV1 = z.infer<typeof contentManifestSchema>;
export type AssetDefinitionV1 = z.infer<typeof assetDefinitionSchema>;
export type ActorDefinitionV1 = z.infer<typeof actorDefinitionSchema>;
export type StatusEffectDefinitionV1 = z.infer<
	typeof statusEffectDefinitionSchema
>;
export type AbilityContentDefinitionV1 = z.infer<
	typeof abilityDefinitionSchema
>;
export type CharacterDefinitionV1 = z.infer<typeof characterDefinitionSchema>;
export type ItemDefinitionV1 = z.infer<typeof itemDefinitionSchema>;
export type EquipmentDefinitionV1 = z.infer<typeof equipmentDefinitionSchema>;
export type EnemyDefinitionV1 = z.infer<typeof enemyDefinitionSchema>;
export type EncounterDefinitionV1 = z.infer<typeof encounterDefinitionSchema>;
export type MapDefinitionV1 = z.infer<typeof mapDefinitionSchema>;
export type MapTriggerV1 = z.infer<typeof mapTriggerSchema>;
export type EventDefinitionV1 = z.infer<typeof eventDefinitionSchema>;
export type EventNodeV1 = z.infer<typeof eventNodeSchema>;
export type EventChoiceV1 = Extract<
	EventNodeV1,
	{ type: "choice" }
>["choices"][number];
