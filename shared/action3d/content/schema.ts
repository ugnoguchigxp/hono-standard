import { z } from "zod";

export const ACTION3D_MANIFEST_VERSION = 1 as const;
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
	})
	.strict();
export const action3dAssetSchema = z
	.object({
		id: action3dStableIdSchema,
		type: z.enum(["model", "texture", "audio"]),
		url: z
			.string()
			.refine(
				(value) =>
					value.startsWith("/assets/action3d/") &&
					!value.includes("..") &&
					!/%2e/i.test(value) &&
					!value.includes(":") &&
					!value.includes("\\"),
				"Assets must use same-origin /assets/action3d/ URLs without traversal.",
			),
		bytes: z.number().int().positive().max(10_000_000),
		license: z.string().min(1).max(80),
		source: sourceSchema,
	})
	.strict();

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
		enemies: z.array(enemySchema).min(1).max(32),
		landmarks: z.array(landmarkSchema).max(128),
		victoryCheckpointId: action3dStableIdSchema,
		playerModelAssetId: action3dStableIdSchema,
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
