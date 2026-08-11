import { z } from "zod";

export const ACTION3D_MANIFEST_VERSION = 2 as const;
export const action3dStableIdSchema = z
	.string()
	.min(1)
	.max(80)
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "IDs must be stable kebab-case values.");

const finite = z.number().finite();
export const action3dVectorSchema = z
	.object({ x: finite, y: finite, z: finite })
	.strict();
const boundsSchema = z
	.object({ minX: finite, maxX: finite, minZ: finite, maxZ: finite })
	.strict();
const sourceSchema = z
	.object({
		label: z.string().min(1).max(120),
		url: z.string().url().optional(),
		revision: z.string().min(1).max(120),
	})
	.strict();
const assetUrlSchema = z
	.string()
	.refine(
		(value) =>
			value.startsWith("/assets/action3d/") &&
			!value.includes("..") &&
			!/%2e/i.test(value) &&
			!value.includes(":") &&
			!value.includes("\\"),
		"Assets must use same-origin /assets/action3d/ URLs without traversal.",
	);
const assetHashSchema = z
	.string()
	.regex(
		/^sha256:[a-f0-9]{64}$/,
		"Asset hash must be a lowercase SHA-256 value.",
	);
const assetBase = {
	id: action3dStableIdSchema,
	url: assetUrlSchema,
	bytes: z.number().int().positive().max(10_000_000),
	sha256: assetHashSchema,
	license: z.string().min(1).max(80),
	source: sourceSchema,
};
const modelClipSchema = z
	.object({
		id: action3dStableIdSchema,
		name: z.string().min(1).max(120),
		loop: z.boolean(),
		durationMs: z
			.object({
				min: z.number().int().nonnegative().max(60_000),
				max: z.number().int().positive().max(60_000),
			})
			.strict(),
	})
	.strict()
	.refine((value) => value.durationMs.min <= value.durationMs.max, {
		message: "Clip duration minimum cannot exceed its maximum.",
		path: ["durationMs"],
	});
const modelSocketSchema = z
	.object({
		id: z.enum([
			"socket.weapon.right",
			"socket.hit.center",
			"socket.vfx.feet",
			"socket.blade.root",
			"socket.blade.tip",
			"socket.core",
			"socket.lock.target",
		]),
		node: z.string().min(1).max(120),
	})
	.strict();
const modelMaterialSchema = z
	.object({
		id: action3dStableIdSchema,
		name: z.string().min(1).max(120),
	})
	.strict();
const modelBudgetSchema = z
	.object({
		maxTransferBytes: z.number().int().positive().max(10_000_000),
		maxTriangles: z.number().int().positive().max(1_000_000),
		maxPrimitives: z.number().int().positive().max(10_000),
		maxMaterials: z.number().int().positive().max(256),
		maxTextures: z.number().int().nonnegative().max(256),
		maxTextureSize: z.number().int().positive().max(8_192),
		maxBones: z.number().int().nonnegative().max(512),
		maxBoneInfluences: z.number().int().nonnegative().max(8),
	})
	.strict();
const modelTransformSchema = z
	.object({
		upAxis: z.literal("Y"),
		forwardAxis: z.enum(["Z", "-Z"]),
		unitMeters: finite.positive().max(100),
		groundOffset: finite.min(-10).max(10),
		boundsMeters: z
			.object({
				width: finite.positive().max(100),
				height: finite.positive().max(100),
				depth: finite.positive().max(100),
			})
			.strict(),
	})
	.strict();
export const action3dModelContractSchema = z
	.object({
		role: z.enum(["player", "enemy", "environment", "diagnostic"]),
		maturity: z.enum(["diagnostic", "blockout", "production"]),
		rootNode: z.string().min(1).max(120),
		skeletonRoot: z.string().min(1).max(120).nullable(),
		meshNodes: z.array(z.string().min(1).max(120)).min(1).max(256),
		clips: z.array(modelClipSchema).max(64),
		sockets: z.array(modelSocketSchema).max(16),
		materials: z.array(modelMaterialSchema).min(1).max(64),
		transform: modelTransformSchema,
		budget: modelBudgetSchema,
	})
	.strict();
const exportedBySchema = z
	.object({
		tool: z.string().min(1).max(80),
		version: z.string().min(1).max(80),
	})
	.strict();
const modelAssetSchema = z
	.object({
		...assetBase,
		type: z.literal("model"),
		exportedBy: exportedBySchema,
		model: action3dModelContractSchema,
	})
	.strict();
const mediaAssetSchema = z
	.object({
		...assetBase,
		type: z.enum(["texture", "audio"]),
		exportedBy: exportedBySchema.optional(),
	})
	.strict();
export const action3dAssetSchema = z.discriminatedUnion("type", [
	modelAssetSchema,
	mediaAssetSchema,
]);

const spawnSchema = z
	.object({
		id: action3dStableIdSchema,
		position: action3dVectorSchema,
		yaw: finite,
		checkpointId: action3dStableIdSchema,
	})
	.strict();
const checkpointSchema = z
	.object({
		id: action3dStableIdSchema,
		position: action3dVectorSchema,
		yaw: finite,
	})
	.strict();
const colliderSchema = z
	.object({ id: action3dStableIdSchema, bounds: boundsSchema })
	.strict();
const surfaceSchema = z
	.object({
		id: action3dStableIdSchema,
		bounds: boundsSchema,
		axis: z.enum(["x", "z"]),
		fromHeight: finite.nonnegative().max(10),
		toHeight: finite.nonnegative().max(10),
	})
	.strict();
const enemySchema = z
	.object({
		id: action3dStableIdSchema,
		position: action3dVectorSchema,
		maxHp: z.number().int().positive().max(10_000),
		moveSpeed: finite.positive().max(20),
		attackRange: finite.positive().max(10),
		damage: z.number().int().positive().max(1_000),
	})
	.strict();
const landmarkSchema = z
	.object({
		id: action3dStableIdSchema,
		kind: z.enum(["pillar", "crystal", "arch", "tree"]),
		position: action3dVectorSchema,
		scale: finite.positive().max(20),
	})
	.strict();

export const action3dWorldSchema = z
	.object({
		id: action3dStableIdSchema,
		displayName: z.string().min(1).max(80),
		objective: z.string().min(1).max(180),
		bounds: boundsSchema,
		spawnPoints: z.array(spawnSchema).min(1).max(32),
		checkpoints: z.array(checkpointSchema).min(1).max(32),
		colliders: z.array(colliderSchema).max(128),
		surfaces: z.array(surfaceSchema).max(128).default([]),
		enemies: z.array(enemySchema).min(1).max(32),
		landmarks: z.array(landmarkSchema).max(128),
		victoryCheckpointId: action3dStableIdSchema,
		playerModelAssetId: action3dStableIdSchema,
		enemyModelAssetId: action3dStableIdSchema,
	})
	.strict();

export const action3dManifestSchema = z
	.object({
		manifestVersion: z.literal(ACTION3D_MANIFEST_VERSION),
		contentVersion: action3dStableIdSchema,
		entryPoint: z
			.object({
				worldId: action3dStableIdSchema,
				spawnId: action3dStableIdSchema,
			})
			.strict(),
		documents: z
			.object({ worlds: z.array(z.string().min(1)).min(1).max(32) })
			.strict(),
		assets: z.array(action3dAssetSchema).min(1).max(128),
	})
	.strict();

export type Action3dManifest = z.infer<typeof action3dManifestSchema>;
export type Action3dWorld = z.infer<typeof action3dWorldSchema>;
export type Action3dAsset = z.infer<typeof action3dAssetSchema>;
