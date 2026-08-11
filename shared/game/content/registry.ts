import {
	createFieldStateAt,
	FieldPlacementError,
	MAX_FIELD_PARTY_SIZE,
} from "../field-placement";
import { GameContentRegistry } from "./runtime-registry";
import {
	type ContentCondition,
	type ContentManifestV1,
	contentManifestSchema,
	type EventDefinitionV1,
	type EventNodeV1,
	eventDefinitionSchema,
	MAX_CONDITION_DEPTH,
	type MapDefinitionV1,
	mapDefinitionSchema,
} from "./schema";

export { evaluateContentCondition } from "./conditions";
export { GameContentRegistry } from "./runtime-registry";

export type ContentValidationIssue = {
	documentPath: string;
	dataPath: string;
	code:
		| "schema"
		| "duplicate"
		| "reference"
		| "bounds"
		| "placement"
		| "graph"
		| "asset"
		| "limit";
	message: string;
};

export class ContentValidationError extends Error {
	readonly issues: readonly ContentValidationIssue[];

	constructor(issues: readonly ContentValidationIssue[]) {
		super(
			`Game content validation failed with ${issues.length} issue${issues.length === 1 ? "" : "s"}.`,
		);
		this.name = "ContentValidationError";
		this.issues = Object.freeze(
			issues.map((issue) => Object.freeze({ ...issue })),
		);
	}
}

export type RawContentDocument = { path: string; data: unknown };
export type RawGameContentBundle = {
	manifestPath?: string;
	manifest: unknown;
	maps: RawContentDocument[];
	events: RawContentDocument[];
	assetExists?: (url: string) => boolean;
};

const zodIssues = (
	documentPath: string,
	error: { issues: Array<{ path: PropertyKey[]; message: string }> },
): ContentValidationIssue[] =>
	error.issues.map((issue) => ({
		documentPath,
		dataPath:
			issue.path.length === 0
				? "$"
				: `$.${issue.path.map((part) => String(part)).join(".")}`,
		code: "schema",
		message: issue.message,
	}));

const addDuplicateIssues = (
	values: readonly { id: string }[],
	documentPath: string,
	dataPath: string,
	issues: ContentValidationIssue[],
): void => {
	const seen = new Set<string>();
	values.forEach((value, index) => {
		if (seen.has(value.id)) {
			issues.push({
				documentPath,
				dataPath: `${dataPath}.${index}.id`,
				code: "duplicate",
				message: `Duplicate ID '${value.id}'.`,
			});
		}
		seen.add(value.id);
	});
};

const validateConditionDepth = (
	condition: ContentCondition | undefined,
	documentPath: string,
	dataPath: string,
	issues: ContentValidationIssue[],
	depth = 1,
): void => {
	if (!condition) return;
	if (depth > MAX_CONDITION_DEPTH) {
		issues.push({
			documentPath,
			dataPath,
			code: "limit",
			message: `Condition nesting exceeds ${MAX_CONDITION_DEPTH} levels.`,
		});
		return;
	}
	if (condition.type === "all" || condition.type === "any") {
		condition.conditions.forEach((child, index) => {
			validateConditionDepth(
				child,
				documentPath,
				`${dataPath}.conditions.${index}`,
				issues,
				depth + 1,
			);
		});
	} else if (condition.type === "not") {
		validateConditionDepth(
			condition.condition,
			documentPath,
			`${dataPath}.condition`,
			issues,
			depth + 1,
		);
	}
};

const nodeTargets = (node: EventNodeV1): string[] => {
	if (node.type === "choice")
		return node.choices.map((choice) => choice.nextNodeId);
	if (node.type === "map.enter" || node.type === "end") return [];
	return [node.nextNodeId];
};

type ParsedDocument<T> = { path: string; data: T };

export function parseContentManifest(
	raw: unknown,
	documentPath = "manifest.json",
): ContentManifestV1 {
	const parsed = contentManifestSchema.safeParse(raw);
	if (!parsed.success) {
		throw new ContentValidationError(zodIssues(documentPath, parsed.error));
	}
	return parsed.data;
}

export function parseGameContentBundle(
	raw: RawGameContentBundle,
	options: { allowPartial?: boolean } = {},
): GameContentRegistry {
	const manifestPath = raw.manifestPath ?? "manifest.json";
	const issues: ContentValidationIssue[] = [];
	const manifestResult = contentManifestSchema.safeParse(raw.manifest);
	if (!manifestResult.success) {
		throw new ContentValidationError(
			zodIssues(manifestPath, manifestResult.error),
		);
	}
	const manifest = manifestResult.data;
	const bundledMaps = manifest.bundles.flatMap((bundle) => bundle.maps);
	const bundledEvents = manifest.bundles.flatMap((bundle) => bundle.events);
	const knownMapIds = new Set(bundledMaps.map(({ id }) => id));
	const knownEventIds = new Set(bundledEvents.map(({ id }) => id));
	const expectedMapIdByPath = new Map(
		bundledMaps.map(({ id, path }) => [path, id]),
	);
	const expectedEventIdByPath = new Map(
		bundledEvents.map(({ id, path }) => [path, id]),
	);
	addDuplicateIssues(manifest.bundles, manifestPath, "$.bundles", issues);
	addDuplicateIssues(bundledMaps, manifestPath, "$.bundles.maps", issues);
	addDuplicateIssues(bundledEvents, manifestPath, "$.bundles.events", issues);
	const entryBundle = manifest.bundles.find(
		({ id }) => id === manifest.entryBundleId,
	);
	if (!entryBundle) {
		issues.push({
			documentPath: manifestPath,
			dataPath: "$.entryBundleId",
			code: "reference",
			message: `Entry bundle '${manifest.entryBundleId}' does not exist.`,
		});
	} else if (
		!entryBundle.maps.some(({ id }) => id === manifest.entryPoint.mapId)
	) {
		issues.push({
			documentPath: manifestPath,
			dataPath: "$.entryBundleId",
			code: "reference",
			message: `Entry bundle '${manifest.entryBundleId}' does not contain entry map '${manifest.entryPoint.mapId}'.`,
		});
	}
	for (const [kind, declaredPaths, bundledDocuments] of [
		["maps", manifest.documents.maps, bundledMaps],
		["events", manifest.documents.events, bundledEvents],
	] as const) {
		const bundledPaths = bundledDocuments.map(({ path }) => path);
		for (const path of declaredPaths) {
			if (bundledPaths.filter((candidate) => candidate === path).length !== 1) {
				issues.push({
					documentPath: manifestPath,
					dataPath: `$.bundles`,
					code: "reference",
					message: `Declared ${kind} document '${path}' must belong to exactly one bundle.`,
				});
			}
		}
		for (const path of bundledPaths) {
			if (!declaredPaths.includes(path)) {
				issues.push({
					documentPath: manifestPath,
					dataPath: "$.bundles",
					code: "reference",
					message: `Bundle ${kind} document '${path}' is not declared in the manifest document list.`,
				});
			}
		}
	}

	const parseDocuments = <T>(
		documents: RawContentDocument[],
		paths: readonly string[],
		schema: typeof mapDefinitionSchema | typeof eventDefinitionSchema,
	): ParsedDocument<T>[] => {
		const byPath = new Map(
			documents.map((document) => [document.path, document]),
		);
		const parsed: ParsedDocument<T>[] = [];
		const selectedPaths = options.allowPartial
			? documents.map(({ path }) => path)
			: paths;
		for (const path of selectedPaths) {
			if (!paths.includes(path)) {
				issues.push({
					documentPath: path,
					dataPath: "$",
					code: "reference",
					message: `Content document '${path}' is not declared by the manifest.`,
				});
				continue;
			}
			const document = byPath.get(path);
			if (!document) {
				issues.push({
					documentPath: manifestPath,
					dataPath: "$.documents",
					code: "reference",
					message: `Referenced content document '${path}' was not loaded.`,
				});
				continue;
			}
			const result = schema.safeParse(document.data);
			if (!result.success) {
				issues.push(...zodIssues(path, result.error));
				continue;
			}
			parsed.push({ path, data: result.data as T });
		}
		return parsed;
	};

	const maps = parseDocuments<MapDefinitionV1>(
		raw.maps,
		manifest.documents.maps,
		mapDefinitionSchema,
	);
	const events = parseDocuments<EventDefinitionV1>(
		raw.events,
		manifest.documents.events,
		eventDefinitionSchema,
	);
	for (const { path, data } of maps) {
		const expectedId = expectedMapIdByPath.get(path);
		if (expectedId !== data.id) {
			issues.push({
				documentPath: path,
				dataPath: "$.id",
				code: "reference",
				message: `Map document '${path}' must define bundled ID '${String(expectedId)}'.`,
			});
		}
	}
	for (const { path, data } of events) {
		const expectedId = expectedEventIdByPath.get(path);
		if (expectedId !== data.id) {
			issues.push({
				documentPath: path,
				dataPath: "$.id",
				code: "reference",
				message: `Event document '${path}' must define bundled ID '${String(expectedId)}'.`,
			});
		}
	}

	addDuplicateIssues(manifest.assets, manifestPath, "$.assets", issues);
	addDuplicateIssues(manifest.actors, manifestPath, "$.actors", issues);
	addDuplicateIssues(
		manifest.encounterIds.map((id) => ({ id })),
		manifestPath,
		"$.encounterIds",
		issues,
	);
	addDuplicateIssues(
		maps.map(({ data }) => data),
		manifestPath,
		"$.documents.maps",
		issues,
	);
	addDuplicateIssues(
		events.map(({ data }) => data),
		manifestPath,
		"$.documents.events",
		issues,
	);

	const mapIndex = new Map(
		maps.map((document) => [document.data.id, document]),
	);
	const eventIndex = new Map(
		events.map((document) => [document.data.id, document]),
	);
	const assetIds = new Set(manifest.assets.map((asset) => asset.id));
	const actorIds = new Set(manifest.actors.map((actor) => actor.id));
	for (const [field, values] of [
		["statusEffects", manifest.statusEffects],
		["abilities", manifest.abilities],
		["characters", manifest.characters],
		["items", manifest.items],
		["equipment", manifest.equipment],
		["enemies", manifest.enemies],
		["encounters", manifest.encounters],
	] as const) {
		addDuplicateIssues(values, manifestPath, `$.${field}`, issues);
	}
	const statusEffectIds = new Set(manifest.statusEffects.map(({ id }) => id));
	const abilityIds = new Set(manifest.abilities.map(({ id }) => id));
	const itemIds = new Set(manifest.items.map(({ id }) => id));
	const equipmentIds = new Set(manifest.equipment.map(({ id }) => id));
	const enemyIds = new Set(manifest.enemies.map(({ id }) => id));
	const encounterIds = new Set([
		...manifest.encounterIds,
		...manifest.encounters.map(({ id }) => id),
	]);
	manifest.abilities.forEach((ability, index) => {
		if (
			ability.statusEffectId &&
			!statusEffectIds.has(ability.statusEffectId)
		) {
			issues.push({
				documentPath: manifestPath,
				dataPath: `$.abilities.${index}.statusEffectId`,
				code: "reference",
				message: `Ability '${ability.id}' references missing status effect '${ability.statusEffectId}'.`,
			});
		}
	});
	manifest.characters.forEach((character, index) => {
		if (!actorIds.has(character.id)) {
			issues.push({
				documentPath: manifestPath,
				dataPath: `$.characters.${index}.id`,
				code: "reference",
				message: `Character '${character.id}' has no matching actor.`,
			});
		}
		character.abilityUnlocks.forEach((unlock, unlockIndex) => {
			if (!abilityIds.has(unlock.abilityId)) {
				issues.push({
					documentPath: manifestPath,
					dataPath: `$.characters.${index}.abilityUnlocks.${unlockIndex}.abilityId`,
					code: "reference",
					message: `Character '${character.id}' references missing ability '${unlock.abilityId}'.`,
				});
			}
		});
		for (const [slot, equipmentId] of Object.entries(
			character.initialEquipment,
		)) {
			if (equipmentId && !equipmentIds.has(equipmentId)) {
				issues.push({
					documentPath: manifestPath,
					dataPath: `$.characters.${index}.initialEquipment.${slot}`,
					code: "reference",
					message: `Character '${character.id}' references missing equipment '${equipmentId}'.`,
				});
			}
		}
	});
	manifest.items.forEach((item, index) => {
		item.statusIds.forEach((statusId, statusIndex) => {
			if (!statusEffectIds.has(statusId)) {
				issues.push({
					documentPath: manifestPath,
					dataPath: `$.items.${index}.statusIds.${statusIndex}`,
					code: "reference",
					message: `Item '${item.id}' references missing status effect '${statusId}'.`,
				});
			}
		});
	});
	manifest.equipment.forEach((equipment, index) => {
		equipment.actorIds.forEach((actorId, actorIndex) => {
			if (!actorIds.has(actorId)) {
				issues.push({
					documentPath: manifestPath,
					dataPath: `$.equipment.${index}.actorIds.${actorIndex}`,
					code: "reference",
					message: `Equipment '${equipment.id}' references missing actor '${actorId}'.`,
				});
			}
		});
	});
	manifest.enemies.forEach((enemy, index) => {
		for (const [field, ids] of [
			["abilityIds", enemy.abilityIds],
			["aiPattern", enemy.aiPattern],
		] as const) {
			ids.forEach((abilityId, abilityIndex) => {
				if (!abilityIds.has(abilityId)) {
					issues.push({
						documentPath: manifestPath,
						dataPath: `$.enemies.${index}.${field}.${abilityIndex}`,
						code: "reference",
						message: `Enemy '${enemy.id}' references missing ability '${abilityId}'.`,
					});
				}
			});
		}
	});
	manifest.encounters.forEach((encounter, index) => {
		encounter.enemyIds.forEach((enemyId, enemyIndex) => {
			if (!enemyIds.has(enemyId)) {
				issues.push({
					documentPath: manifestPath,
					dataPath: `$.encounters.${index}.enemyIds.${enemyIndex}`,
					code: "reference",
					message: `Encounter '${encounter.id}' references missing enemy '${enemyId}'.`,
				});
			}
		});
		encounter.rewards.items.forEach((reward, rewardIndex) => {
			if (!itemIds.has(reward.itemId)) {
				issues.push({
					documentPath: manifestPath,
					dataPath: `$.encounters.${index}.rewards.items.${rewardIndex}.itemId`,
					code: "reference",
					message: `Encounter '${encounter.id}' references missing reward item '${reward.itemId}'.`,
				});
			}
		});
	});

	const entryMap = mapIndex.get(manifest.entryPoint.mapId)?.data;
	if (
		!entryMap &&
		(!options.allowPartial || !knownMapIds.has(manifest.entryPoint.mapId))
	) {
		issues.push({
			documentPath: manifestPath,
			dataPath: "$.entryPoint.mapId",
			code: "reference",
			message: `Entry map '${manifest.entryPoint.mapId}' does not exist.`,
		});
	} else if (
		entryMap &&
		!entryMap.entrances.some(
			(entrance) => entrance.id === manifest.entryPoint.entranceId,
		)
	) {
		issues.push({
			documentPath: manifestPath,
			dataPath: "$.entryPoint.entranceId",
			code: "reference",
			message: `Entry entrance '${manifest.entryPoint.entranceId}' does not exist in map '${entryMap.id}'.`,
		});
	}

	for (const { path, data: map } of maps) {
		addDuplicateIssues(map.entrances, path, "$.entrances", issues);
		addDuplicateIssues(map.checkpoints, path, "$.checkpoints", issues);
		addDuplicateIssues(
			map.collisionRegions,
			path,
			"$.collisionRegions",
			issues,
		);
		addDuplicateIssues(map.triggers, path, "$.triggers", issues);
		const inBounds = (point: { x: number; y: number }) =>
			point.x < map.width && point.y < map.height;
		const isCollision = (point: { x: number; y: number }) =>
			map.collisionRegions.some(
				(region) =>
					point.x >= region.x &&
					point.x < region.x + region.width &&
					point.y >= region.y &&
					point.y < region.y + region.height,
			);
		const isWalkable = (point: { x: number; y: number }) =>
			inBounds(point) && !isCollision(point);
		map.entrances.forEach((entrance, index) => {
			if (!inBounds(entrance.position)) {
				issues.push({
					documentPath: path,
					dataPath: `$.entrances.${index}.position`,
					code: "bounds",
					message: `Entrance '${entrance.id}' is outside map bounds.`,
				});
			} else if (isCollision(entrance.position)) {
				issues.push({
					documentPath: path,
					dataPath: `$.entrances.${index}.position`,
					code: "placement",
					message: `Entrance '${entrance.id}' is placed on collision geometry.`,
				});
			} else {
				try {
					createFieldStateAt(
						entrance.position,
						entrance.facing,
						MAX_FIELD_PARTY_SIZE,
						isWalkable,
					);
				} catch (error) {
					if (!(error instanceof FieldPlacementError)) throw error;
					issues.push({
						documentPath: path,
						dataPath: `$.entrances.${index}.position`,
						code: "placement",
						message: `Entrance '${entrance.id}' cannot hold a full party formation.`,
					});
				}
			}
			if (!map.checkpoints.some(({ id }) => id === entrance.checkpointId)) {
				issues.push({
					documentPath: path,
					dataPath: `$.entrances.${index}.checkpointId`,
					code: "reference",
					message: `Entrance '${entrance.id}' references missing checkpoint '${entrance.checkpointId}'.`,
				});
			}
		});
		map.checkpoints.forEach((checkpoint, index) => {
			if (!inBounds(checkpoint.position)) {
				issues.push({
					documentPath: path,
					dataPath: `$.checkpoints.${index}.position`,
					code: "bounds",
					message: `Checkpoint '${checkpoint.id}' is outside map bounds.`,
				});
			} else if (isCollision(checkpoint.position)) {
				issues.push({
					documentPath: path,
					dataPath: `$.checkpoints.${index}.position`,
					code: "placement",
					message: `Checkpoint '${checkpoint.id}' is placed on collision geometry.`,
				});
			}
		});
		map.collisionRegions.forEach((region, index) => {
			if (
				region.x + region.width > map.width ||
				region.y + region.height > map.height
			) {
				issues.push({
					documentPath: path,
					dataPath: `$.collisionRegions.${index}`,
					code: "bounds",
					message: `Collision region '${region.id}' exceeds map bounds.`,
				});
			}
		});
		map.triggers.forEach((trigger, index) => {
			if (!inBounds(trigger.position)) {
				issues.push({
					documentPath: path,
					dataPath: `$.triggers.${index}.position`,
					code: "bounds",
					message: `Trigger '${trigger.id}' is outside map bounds.`,
				});
			} else if (isCollision(trigger.position)) {
				issues.push({
					documentPath: path,
					dataPath: `$.triggers.${index}.position`,
					code: "placement",
					message: `Trigger '${trigger.id}' is placed on collision geometry and cannot be reached.`,
				});
			}
			validateConditionDepth(
				trigger.condition,
				path,
				`$.triggers.${index}.condition`,
				issues,
			);
			if (
				trigger.kind === "event" &&
				!eventIndex.has(trigger.targetId) &&
				(!options.allowPartial || !knownEventIds.has(trigger.targetId))
			) {
				issues.push({
					documentPath: path,
					dataPath: `$.triggers.${index}.targetId`,
					code: "reference",
					message: `Trigger '${trigger.id}' references missing event '${trigger.targetId}'.`,
				});
			}
			if (trigger.kind === "map") {
				const targetMap = mapIndex.get(trigger.targetId)?.data;
				if (
					!targetMap &&
					(!options.allowPartial || !knownMapIds.has(trigger.targetId))
				) {
					issues.push({
						documentPath: path,
						dataPath: `$.triggers.${index}.targetId`,
						code: "reference",
						message: `Trigger '${trigger.id}' references missing map '${trigger.targetId}'.`,
					});
				} else if (
					targetMap &&
					!targetMap.entrances.some(
						(entrance) => entrance.id === trigger.targetEntranceId,
					)
				) {
					issues.push({
						documentPath: path,
						dataPath: `$.triggers.${index}.targetEntranceId`,
						code: "reference",
						message: `Trigger '${trigger.id}' references missing entrance '${trigger.targetEntranceId}'.`,
					});
				}
			}
			if (
				trigger.kind === "checkpoint" &&
				!map.checkpoints.some(({ id }) => id === trigger.targetId)
			) {
				issues.push({
					documentPath: path,
					dataPath: `$.triggers.${index}.targetId`,
					code: "reference",
					message: `Trigger '${trigger.id}' references missing checkpoint '${trigger.targetId}'.`,
				});
			}
		});
		if (
			map.randomEncounter &&
			!encounterIds.has(map.randomEncounter.encounterId)
		) {
			issues.push({
				documentPath: path,
				dataPath: "$.randomEncounter.encounterId",
				code: "reference",
				message: `Map '${map.id}' references missing random encounter '${map.randomEncounter.encounterId}'.`,
			});
		}
		for (const [field, assetId] of [
			["backgroundAssetId", map.backgroundAssetId],
			["battleBackgroundAssetId", map.battleBackgroundAssetId],
		] as const) {
			if (!assetIds.has(assetId)) {
				issues.push({
					documentPath: path,
					dataPath: `$.${field}`,
					code: "reference",
					message: `Map '${map.id}' references missing asset '${assetId}'.`,
				});
			}
		}
	}

	for (const { path, data: event } of events) {
		addDuplicateIssues(event.nodes, path, "$.nodes", issues);
		addDuplicateIssues(
			event.presentation.actors.map(({ actorId }) => ({ id: actorId })),
			path,
			"$.presentation.actors",
			issues,
		);
		if (!assetIds.has(event.presentation.backgroundAssetId)) {
			issues.push({
				documentPath: path,
				dataPath: "$.presentation.backgroundAssetId",
				code: "reference",
				message: `Event '${event.id}' references missing asset '${event.presentation.backgroundAssetId}'.`,
			});
		}
		event.presentation.actors.forEach((actor, index) => {
			if (!actorIds.has(actor.actorId)) {
				issues.push({
					documentPath: path,
					dataPath: `$.presentation.actors.${index}.actorId`,
					code: "reference",
					message: `Event '${event.id}' references missing actor '${actor.actorId}'.`,
				});
			}
		});
		const presentationActorIds = new Set(
			event.presentation.actors.map((actor) => actor.actorId),
		);
		const nodeIndex = new Map(event.nodes.map((node) => [node.id, node]));
		if (!nodeIndex.has(event.entryNodeId)) {
			issues.push({
				documentPath: path,
				dataPath: "$.entryNodeId",
				code: "graph",
				message: `Entry node '${event.entryNodeId}' does not exist.`,
			});
		}
		event.nodes.forEach((node, index) => {
			validateConditionDepth(
				node.condition,
				path,
				`$.nodes.${index}.condition`,
				issues,
			);
			if (
				node.condition &&
				(node.type === "choice" ||
					node.type === "map.enter" ||
					node.type === "end")
			) {
				issues.push({
					documentPath: path,
					dataPath: `$.nodes.${index}.condition`,
					code: "graph",
					message: `Node '${node.id}' cannot be conditional because it has no fallback transition.`,
				});
			}
			for (const target of nodeTargets(node)) {
				if (!nodeIndex.has(target)) {
					issues.push({
						documentPath: path,
						dataPath: `$.nodes.${index}`,
						code: "graph",
						message: `Node '${node.id}' references missing node '${target}'.`,
					});
				}
			}
			if (node.type === "choice") {
				addDuplicateIssues(
					node.choices,
					path,
					`$.nodes.${index}.choices`,
					issues,
				);
				if (!node.choices.some((choice) => !choice.condition)) {
					issues.push({
						documentPath: path,
						dataPath: `$.nodes.${index}.choices`,
						code: "graph",
						message: `Choice node '${node.id}' requires an unconditional fallback choice.`,
					});
				}
				node.choices.forEach((choice, choiceIndex) => {
					validateConditionDepth(
						choice.condition,
						path,
						`$.nodes.${index}.choices.${choiceIndex}.condition`,
						issues,
					);
				});
			}
			if (node.type === "line" && !actorIds.has(node.speakerId)) {
				issues.push({
					documentPath: path,
					dataPath: `$.nodes.${index}.speakerId`,
					code: "reference",
					message: `Node '${node.id}' references missing actor '${node.speakerId}'.`,
				});
			}
			if (
				(node.type === "actor.move" || node.type === "actor.expression") &&
				!actorIds.has(node.actorId)
			) {
				issues.push({
					documentPath: path,
					dataPath: `$.nodes.${index}.actorId`,
					code: "reference",
					message: `Node '${node.id}' references missing actor '${node.actorId}'.`,
				});
			}
			if (
				(node.type === "actor.move" || node.type === "actor.expression") &&
				actorIds.has(node.actorId) &&
				!presentationActorIds.has(node.actorId)
			) {
				issues.push({
					documentPath: path,
					dataPath: `$.nodes.${index}.actorId`,
					code: "reference",
					message: `Node '${node.id}' controls actor '${node.actorId}', but that actor is not present in the event presentation.`,
				});
			}
			if (node.type === "battle.start" && !encounterIds.has(node.encounterId)) {
				issues.push({
					documentPath: path,
					dataPath: `$.nodes.${index}.encounterId`,
					code: "reference",
					message: `Node '${node.id}' references missing encounter '${node.encounterId}'.`,
				});
			}
			if (node.type === "map.enter") {
				const targetMap = mapIndex.get(node.mapId)?.data;
				if (
					(targetMap &&
						!targetMap.entrances.some(
							(entrance) => entrance.id === node.entranceId,
						)) ||
					(!targetMap &&
						(!options.allowPartial || !knownMapIds.has(node.mapId)))
				) {
					issues.push({
						documentPath: path,
						dataPath: `$.nodes.${index}.mapId`,
						code: "reference",
						message: `Node '${node.id}' references missing map entrance '${node.mapId}:${node.entranceId}'.`,
					});
				}
			}
			if (node.type === "checkpoint.reach") {
				const targetMap = mapIndex.get(node.mapId)?.data;
				if (
					(targetMap &&
						!targetMap.checkpoints.some(
							(checkpoint) => checkpoint.id === node.checkpointId,
						)) ||
					(!targetMap &&
						(!options.allowPartial || !knownMapIds.has(node.mapId)))
				) {
					issues.push({
						documentPath: path,
						dataPath: `$.nodes.${index}.checkpointId`,
						code: "reference",
						message: `Node '${node.id}' references missing map checkpoint '${node.mapId}:${node.checkpointId}'.`,
					});
				}
			}
		});

		const reachable = new Set<string>();
		const visit = (nodeId: string): void => {
			if (reachable.has(nodeId)) return;
			const node = nodeIndex.get(nodeId);
			if (!node) return;
			reachable.add(nodeId);
			for (const target of nodeTargets(node)) visit(target);
		};
		visit(event.entryNodeId);
		event.nodes.forEach((node, index) => {
			if (!reachable.has(node.id)) {
				issues.push({
					documentPath: path,
					dataPath: `$.nodes.${index}.id`,
					code: "graph",
					message: `Node '${node.id}' is unreachable from the entry node.`,
				});
			}
		});
	}

	if (raw.assetExists) {
		manifest.assets.forEach((asset, index) => {
			if (!raw.assetExists?.(asset.url)) {
				issues.push({
					documentPath: manifestPath,
					dataPath: `$.assets.${index}.url`,
					code: "asset",
					message: `Asset '${asset.id}' does not exist at '${asset.url}'.`,
				});
			}
		});
	}

	if (issues.length > 0) throw new ContentValidationError(issues);
	return new GameContentRegistry({
		manifest,
		maps: maps.map(({ data }) => data),
		events: events.map(({ data }) => data),
	});
}
