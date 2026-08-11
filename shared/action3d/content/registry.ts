import {
	type Action3dAsset,
	type Action3dAttackDefinition,
	type Action3dEnemyArchetype,
	type Action3dManifest,
	type Action3dPlayerTuning,
	type Action3dWorld,
	action3dManifestSchema,
	action3dWorldSchema,
} from "./schema";

export type Action3dContentIssue = {
	documentPath: string;
	dataPath: string;
	code: "schema" | "duplicate" | "reference" | "bounds" | "asset";
	message: string;
};
export class Action3dContentError extends Error {
	readonly issues: readonly Action3dContentIssue[];
	constructor(issues: readonly Action3dContentIssue[]) {
		super(
			`Action3D content validation failed with ${issues.length} issue${issues.length === 1 ? "" : "s"}.`,
		);
		this.name = "Action3dContentError";
		this.issues = Object.freeze(
			issues.map((issue) => Object.freeze({ ...issue })),
		);
	}
}
export type RawAction3dDocument = { path: string; data: unknown };
export type RawAction3dBundle = {
	manifestPath?: string;
	manifest: unknown;
	worlds: RawAction3dDocument[];
	assetExists?: (url: string) => boolean;
	assetSize?: (url: string) => number | undefined;
	assetHash?: (url: string) => string | undefined;
	allowPartialWorlds?: boolean;
};
const deepFreeze = <T>(value: T): T => {
	if (value && typeof value === "object" && !Object.isFrozen(value)) {
		Object.freeze(value);
		for (const child of Object.values(value as Record<string, unknown>))
			deepFreeze(child);
	}
	return value;
};
const zodIssues = (
	documentPath: string,
	error: { issues: Array<{ path: PropertyKey[]; message: string }> },
): Action3dContentIssue[] =>
	error.issues.map((issue) => ({
		documentPath,
		dataPath: issue.path.length ? `$.${issue.path.map(String).join(".")}` : "$",
		code: "schema",
		message: issue.message,
	}));
const duplicates = <T extends { id: string }>(
	values: readonly T[],
	documentPath: string,
	dataPath: string,
	issues: Action3dContentIssue[],
) => {
	const seen = new Set<string>();
	values.forEach((value, index) => {
		if (seen.has(value.id))
			issues.push({
				documentPath,
				dataPath: `${dataPath}.${index}.id`,
				code: "duplicate",
				message: `Duplicate ID '${value.id}'.`,
			});
		seen.add(value.id);
	});
};

export class Action3dContentRegistry {
	readonly contentVersion: string;
	readonly entryPoint: Readonly<Action3dManifest["entryPoint"]>;
	readonly playerTuning: Readonly<Action3dPlayerTuning>;
	readonly attacksById: Readonly<Record<string, Action3dAttackDefinition>>;
	readonly enemyArchetypesById: Readonly<
		Record<string, Action3dEnemyArchetype>
	>;
	readonly assetsById: Readonly<Record<string, Action3dAsset>>;
	readonly worldDocumentPaths: Readonly<Record<string, string>>;
	private readonly worldStore: Record<string, Action3dWorld>;
	constructor(manifest: Action3dManifest, worlds: readonly Action3dWorld[]) {
		const frozenManifest = deepFreeze(structuredClone(manifest));
		this.contentVersion = frozenManifest.contentVersion;
		this.entryPoint = frozenManifest.entryPoint;
		this.playerTuning = frozenManifest.playerTuning;
		this.attacksById = deepFreeze(
			Object.fromEntries(frozenManifest.attacks.map((attack) => [attack.id, attack])),
		);
		this.enemyArchetypesById = deepFreeze(
			Object.fromEntries(
				frozenManifest.enemyArchetypes.map((archetype) => [
					archetype.id,
					archetype,
				]),
			),
		);
		this.worldDocumentPaths = deepFreeze(
			Object.fromEntries(
				frozenManifest.documents.worlds.map((document) => [
					document.id,
					document.path,
				]),
			),
		);
		this.worldStore = Object.fromEntries(
			worlds.map((world) => [world.id, deepFreeze(structuredClone(world))]),
		);
		this.assetsById = deepFreeze(
			Object.fromEntries(
				frozenManifest.assets.map((asset) => [asset.id, asset]),
			),
		);
	}
	get worldsById(): Readonly<Record<string, Action3dWorld>> {
		return this.worldStore;
	}
	hasWorld(id: string): boolean {
		return Boolean(this.worldStore[id]);
	}
	registerWorld(world: Action3dWorld): void {
		if (!this.worldDocumentPaths[world.id])
			throw new Error(`Unknown Action3D world document '${world.id}'.`);
		this.worldStore[world.id] = deepFreeze(structuredClone(world));
	}
	getWorld(id: string): Action3dWorld {
		const world = this.worldsById[id];
		if (!world) throw new Error(`Unknown Action3D world '${id}'.`);
		return world;
	}
	getAsset(id: string): Action3dAsset {
		const asset = this.assetsById[id];
		if (!asset) throw new Error(`Unknown Action3D asset '${id}'.`);
		return asset;
	}
	getAttack(id: string): Action3dAttackDefinition {
		const attack = this.attacksById[id];
		if (!attack) throw new Error(`Unknown Action3D attack '${id}'.`);
		return attack;
	}
	getEnemyArchetype(id: string): Action3dEnemyArchetype {
		const archetype = this.enemyArchetypesById[id];
		if (!archetype)
			throw new Error(`Unknown Action3D enemy archetype '${id}'.`);
		return archetype;
	}
	getWorldDocumentPath(id: string): string {
		const documentPath = this.worldDocumentPaths[id];
		if (!documentPath)
			throw new Error(`Unknown Action3D world document '${id}'.`);
		return documentPath;
	}
	getModelClip(assetId: string, clipId: string) {
		const asset = this.getAsset(assetId);
		if (asset.type !== "model")
			throw new Error(`Action3D asset '${assetId}' is not a model.`);
		const clip = asset.model.clips.find((candidate) => candidate.id === clipId);
		if (!clip)
			throw new Error(
				`Unknown clip '${clipId}' for Action3D model '${assetId}'.`,
			);
		return clip;
	}
	getModelSocket(assetId: string, socketId: string) {
		const asset = this.getAsset(assetId);
		if (asset.type !== "model")
			throw new Error(`Action3D asset '${assetId}' is not a model.`);
		const socket = asset.model.sockets.find(
			(candidate) => candidate.id === socketId,
		);
		if (!socket)
			throw new Error(
				`Unknown socket '${socketId}' for Action3D model '${assetId}'.`,
			);
		return socket;
	}
}

export const parseAction3dManifest = (
	raw: unknown,
	path = "manifest.json",
): Action3dManifest => {
	const result = action3dManifestSchema.safeParse(raw);
	if (!result.success)
		throw new Action3dContentError(zodIssues(path, result.error));
	return result.data;
};

export function parseAction3dBundle(
	raw: RawAction3dBundle,
): Action3dContentRegistry {
	const manifestPath = raw.manifestPath ?? "manifest.json";
	const manifest = parseAction3dManifest(raw.manifest, manifestPath);
	const issues: Action3dContentIssue[] = [];
	const loaded = new Map(
		raw.worlds.map((document) => [document.path, document]),
	);
	const worlds: Action3dWorld[] = [];
	for (const descriptor of manifest.documents.worlds) {
		const path = descriptor.path;
		const document = loaded.get(path);
		if (!document) {
			if (!raw.allowPartialWorlds)
				issues.push({
					documentPath: manifestPath,
					dataPath: "$.documents.worlds",
					code: "reference",
					message: `Referenced world '${path}' was not loaded.`,
				});
			continue;
		}
		const result = action3dWorldSchema.safeParse(document.data);
		if (!result.success) issues.push(...zodIssues(path, result.error));
		else if (result.data.id !== descriptor.id)
			issues.push({
				documentPath: path,
				dataPath: "$.id",
				code: "reference",
				message: `World document declares '${result.data.id}' but manifest expects '${descriptor.id}'.`,
			});
		else worlds.push(result.data);
	}
	duplicates(manifest.assets, manifestPath, "$.assets", issues);
	duplicates(manifest.attacks, manifestPath, "$.attacks", issues);
	duplicates(
		manifest.enemyArchetypes,
		manifestPath,
		"$.enemyArchetypes",
		issues,
	);
	duplicates(
		manifest.documents.worlds,
		manifestPath,
		"$.documents.worlds",
		issues,
	);
	duplicates(worlds, manifestPath, "$.documents.worlds", issues);
	const attackIds = new Set(manifest.attacks.map((attack) => attack.id));
	for (const attack of manifest.attacks)
		if (attack.nextAttackId && !attackIds.has(attack.nextAttackId))
			issues.push({
				documentPath: manifestPath,
				dataPath: `$.attacks.${attack.id}.nextAttackId`,
				code: "reference",
				message: `Unknown next attack '${attack.nextAttackId}'.`,
			});
	for (const asset of manifest.assets) {
		if (raw.assetExists && !raw.assetExists(asset.url))
			issues.push({
				documentPath: manifestPath,
				dataPath: `$.assets.${asset.id}.url`,
				code: "asset",
				message: `Asset '${asset.url}' does not exist.`,
			});
		const size = raw.assetSize?.(asset.url);
		if (size !== undefined && size !== asset.bytes)
			issues.push({
				documentPath: manifestPath,
				dataPath: `$.assets.${asset.id}.bytes`,
				code: "asset",
				message: `Declared ${asset.bytes} bytes but found ${size}.`,
			});
		const hash = raw.assetHash?.(asset.url);
		if (hash !== undefined && hash !== asset.sha256)
			issues.push({
				documentPath: manifestPath,
				dataPath: `$.assets.${asset.id}.sha256`,
				code: "asset",
				message: `Declared ${asset.sha256} but found ${hash}.`,
			});
		if (asset.type === "model") {
			duplicates(
				asset.model.clips,
				manifestPath,
				`$.assets.${asset.id}.model.clips`,
				issues,
			);
			duplicates(
				asset.model.sockets,
				manifestPath,
				`$.assets.${asset.id}.model.sockets`,
				issues,
			);
			duplicates(
				asset.model.materials,
				manifestPath,
				`$.assets.${asset.id}.model.materials`,
				issues,
			);
			if (asset.model.maturity !== "diagnostic" && !asset.model.skeletonRoot)
				issues.push({
					documentPath: manifestPath,
					dataPath: `$.assets.${asset.id}.model.skeletonRoot`,
					code: "asset",
					message: "Blockout and production models require a skeleton root.",
				});
			if (
				asset.model.role === "player" &&
				asset.model.maturity !== "diagnostic"
			) {
				for (const requiredClip of [
					"idle",
					"walk",
					"run",
					"jump-start",
					"jump-loop",
					"land",
					"dodge",
					"hit",
					"defeat",
					"attack-1",
					"attack-2",
					"attack-3",
				] as const)
					if (!asset.model.clips.some((clip) => clip.id === requiredClip))
						issues.push({
							documentPath: manifestPath,
							dataPath: `$.assets.${asset.id}.model.clips`,
							code: "asset",
							message: `Player model is missing '${requiredClip}'.`,
						});
				for (const requiredSocket of [
					"socket.weapon.right",
					"socket.hit.center",
					"socket.vfx.feet",
				] as const)
					if (
						!asset.model.sockets.some((socket) => socket.id === requiredSocket)
					)
						issues.push({
							documentPath: manifestPath,
							dataPath: `$.assets.${asset.id}.model.sockets`,
							code: "asset",
							message: `Player model is missing '${requiredSocket}'.`,
						});
				for (const requiredMaterial of [
					"body",
					"skin",
					"hair",
					"cloth",
					"metal",
					"weapon",
				] as const)
					if (
						!asset.model.materials.some(
							(material) => material.id === requiredMaterial,
						)
					)
						issues.push({
							documentPath: manifestPath,
							dataPath: `$.assets.${asset.id}.model.materials`,
							code: "asset",
							message: `Player model is missing '${requiredMaterial}'.`,
						});
			}
			if (
				asset.model.role === "enemy" &&
				asset.model.maturity !== "diagnostic"
			) {
				for (const requiredClip of [
					"idle",
					"chase",
					"windup",
					"attack",
					"recover",
					"stagger",
					"defeated",
				] as const)
					if (!asset.model.clips.some((clip) => clip.id === requiredClip))
						issues.push({
							documentPath: manifestPath,
							dataPath: `$.assets.${asset.id}.model.clips`,
							code: "asset",
							message: `Enemy model is missing '${requiredClip}'.`,
						});
				for (const requiredSocket of [
					"socket.hit.center",
					"socket.core",
					"socket.lock.target",
				] as const)
					if (
						!asset.model.sockets.some((socket) => socket.id === requiredSocket)
					)
						issues.push({
							documentPath: manifestPath,
							dataPath: `$.assets.${asset.id}.model.sockets`,
							code: "asset",
							message: `Enemy model is missing '${requiredSocket}'.`,
						});
			}
		}
	}
	for (const archetype of manifest.enemyArchetypes)
		if (
			!manifest.assets.some(
				(asset) =>
					asset.id === archetype.modelAssetId && asset.type === "model",
			)
		)
			issues.push({
				documentPath: manifestPath,
				dataPath: `$.enemyArchetypes.${archetype.id}.modelAssetId`,
				code: "reference",
				message: `Unknown model asset '${archetype.modelAssetId}'.`,
			});
	const worldIds = new Set(worlds.map((world) => world.id));
	const declaredWorldIds = new Set(
		manifest.documents.worlds.map((document) => document.id),
	);
	if (!declaredWorldIds.has(manifest.entryPoint.worldId))
		issues.push({
			documentPath: manifestPath,
			dataPath: "$.entryPoint.worldId",
			code: "reference",
			message: `Unknown entry world '${manifest.entryPoint.worldId}'.`,
		});
	for (const world of worlds) {
		const spawnIds = new Set<string>();
		const checkpointIds = new Set<string>();
		duplicates(world.spawnPoints, `${world.id}.json`, "$.spawnPoints", issues);
		duplicates(world.checkpoints, `${world.id}.json`, "$.checkpoints", issues);
		duplicates(world.colliders, `${world.id}.json`, "$.colliders", issues);
		duplicates(world.surfaces, `${world.id}.json`, "$.surfaces", issues);
		duplicates(world.enemies, `${world.id}.json`, "$.enemies", issues);
		duplicates(world.landmarks, `${world.id}.json`, "$.landmarks", issues);
		duplicates(world.exits, `${world.id}.json`, "$.exits", issues);
		world.spawnPoints.forEach((spawn) => {
			spawnIds.add(spawn.id);
		});
		world.checkpoints.forEach((checkpoint) => {
			checkpointIds.add(checkpoint.id);
		});
		if (
			world.id === manifest.entryPoint.worldId &&
			!spawnIds.has(manifest.entryPoint.spawnId)
		)
			issues.push({
				documentPath: `${world.id}.json`,
				dataPath: "$.spawnPoints",
				code: "reference",
				message: `Unknown entry spawn '${manifest.entryPoint.spawnId}'.`,
			});
		for (const spawn of world.spawnPoints)
			if (!checkpointIds.has(spawn.checkpointId))
				issues.push({
					documentPath: `${world.id}.json`,
					dataPath: `$.spawnPoints.${spawn.id}.checkpointId`,
					code: "reference",
					message: `Unknown checkpoint '${spawn.checkpointId}'.`,
				});
		if (!checkpointIds.has(world.victoryCheckpointId))
			issues.push({
				documentPath: `${world.id}.json`,
				dataPath: "$.victoryCheckpointId",
				code: "reference",
				message: `Unknown checkpoint '${world.victoryCheckpointId}'.`,
			});
		if (
			!manifest.assets.some(
				(asset) =>
					asset.id === world.playerModelAssetId && asset.type === "model",
			)
		)
			issues.push({
				documentPath: `${world.id}.json`,
				dataPath: "$.playerModelAssetId",
				code: "reference",
				message: `Unknown model asset '${world.playerModelAssetId}'.`,
			});
		for (const enemy of world.enemies)
			if (
				!manifest.enemyArchetypes.some(
					(archetype) => archetype.id === enemy.archetypeId,
				)
			)
				issues.push({
					documentPath: `${world.id}.json`,
					dataPath: `$.enemies.${enemy.id}.archetypeId`,
					code: "reference",
					message: `Unknown enemy archetype '${enemy.archetypeId}'.`,
				});
		const inside = (x: number, z: number) =>
			x >= world.bounds.minX &&
			x <= world.bounds.maxX &&
			z >= world.bounds.minZ &&
			z <= world.bounds.maxZ;
		for (const point of [
			...world.spawnPoints,
			...world.checkpoints,
			...world.enemies,
			...world.landmarks,
		])
			if (!inside(point.position.x, point.position.z))
				issues.push({
					documentPath: `${world.id}.json`,
					dataPath: `$.${point.id}.position`,
					code: "bounds",
					message: `'${point.id}' is outside world bounds.`,
				});
		for (const collider of world.colliders)
			if (
				collider.bounds.minX >= collider.bounds.maxX ||
				collider.bounds.minZ >= collider.bounds.maxZ ||
				!inside(collider.bounds.minX, collider.bounds.minZ) ||
				!inside(collider.bounds.maxX, collider.bounds.maxZ)
			)
				issues.push({
					documentPath: `${world.id}.json`,
					dataPath: `$.colliders.${collider.id}.bounds`,
					code: "bounds",
					message: `Collider '${collider.id}' has invalid bounds.`,
				});
		for (const surface of world.surfaces)
			if (
				surface.bounds.minX >= surface.bounds.maxX ||
				surface.bounds.minZ >= surface.bounds.maxZ ||
				!inside(surface.bounds.minX, surface.bounds.minZ) ||
				!inside(surface.bounds.maxX, surface.bounds.maxZ)
			)
				issues.push({
					documentPath: `${world.id}.json`,
					dataPath: `$.surfaces.${surface.id}.bounds`,
					code: "bounds",
					message: `Surface '${surface.id}' has invalid bounds.`,
				});
		for (const exit of world.exits) {
			if (!declaredWorldIds.has(exit.destinationWorldId))
				issues.push({
					documentPath: `${world.id}.json`,
					dataPath: `$.exits.${exit.id}.destinationWorldId`,
					code: "reference",
					message: `Unknown destination world '${exit.destinationWorldId}'.`,
				});
			const destination = worlds.find(
				(candidate) => candidate.id === exit.destinationWorldId,
			);
			if (
				destination &&
				!destination.spawnPoints.some(
					(spawn) => spawn.id === exit.destinationSpawnId,
				)
			)
				issues.push({
					documentPath: `${world.id}.json`,
					dataPath: `$.exits.${exit.id}.destinationSpawnId`,
					code: "reference",
					message: `Unknown destination spawn '${exit.destinationSpawnId}'.`,
				});
			if (
				exit.bounds.minX >= exit.bounds.maxX ||
				exit.bounds.minZ >= exit.bounds.maxZ ||
				!inside(exit.bounds.minX, exit.bounds.minZ) ||
				!inside(exit.bounds.maxX, exit.bounds.maxZ)
			)
				issues.push({
					documentPath: `${world.id}.json`,
					dataPath: `$.exits.${exit.id}.bounds`,
					code: "bounds",
					message: `Exit '${exit.id}' has invalid bounds.`,
				});
		}
	}
	if (issues.length) throw new Action3dContentError(issues);
	return new Action3dContentRegistry(manifest, worlds);
}
