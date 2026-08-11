import {
	action3dManifestSchema,
	action3dWorldSchema,
	type Action3dAsset,
	type Action3dManifest,
	type Action3dWorld,
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
	readonly worldsById: Readonly<Record<string, Action3dWorld>>;
	readonly assetsById: Readonly<Record<string, Action3dAsset>>;
	constructor(manifest: Action3dManifest, worlds: readonly Action3dWorld[]) {
		const frozenManifest = deepFreeze(structuredClone(manifest));
		this.contentVersion = frozenManifest.contentVersion;
		this.entryPoint = frozenManifest.entryPoint;
		this.worldsById = deepFreeze(
			Object.fromEntries(
				worlds.map((world) => [world.id, structuredClone(world)]),
			),
		);
		this.assetsById = deepFreeze(
			Object.fromEntries(
				frozenManifest.assets.map((asset) => [asset.id, asset]),
			),
		);
		Object.freeze(this);
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
	for (const path of manifest.documents.worlds) {
		const document = loaded.get(path);
		if (!document) {
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
		else worlds.push(result.data);
	}
	duplicates(manifest.assets, manifestPath, "$.assets", issues);
	duplicates(worlds, manifestPath, "$.documents.worlds", issues);
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
	}
	const worldIds = new Set(worlds.map((world) => world.id));
	if (!worldIds.has(manifest.entryPoint.worldId))
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
		duplicates(world.enemies, `${world.id}.json`, "$.enemies", issues);
		duplicates(world.landmarks, `${world.id}.json`, "$.landmarks", issues);
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
	}
	if (issues.length) throw new Action3dContentError(issues);
	return new Action3dContentRegistry(manifest, worlds);
}
