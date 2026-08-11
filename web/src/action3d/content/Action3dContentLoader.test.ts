import { describe, expect, it, vi } from "vitest";
import { Action3dContentLoadError, Action3dContentLoader } from "./Action3dContentLoader";

const manifest = { manifestVersion: 3, contentVersion: "loader-world-1", entryPoint: { worldId: "world", spawnId: "entry" }, documents: { worlds: [{ id: "world", path: "worlds/world.json" }] }, playerTuning: { maxHp: 100, maxStamina: 100, walkSpeed: 4.2, runSpeed: 7, dodgeSpeed: 10, jumpSpeed: 8.5, gravity: 24, acceleration: 42, deceleration: 55, staminaSprintPerSecond: 24, staminaRecoveryPerSecond: 18, dodgeStaminaCost: 20, dodgeDurationMs: 400, dodgeCooldownMs: 800, dodgeInvulnerableMs: 260, playerRadius: 0.42, maxStepHeight: 0.45, maxSlopeDegrees: 45 }, attacks: [{ id: "light-1", kind: "light", animationId: "attack-1", damage: 40, range: 2.35, arcRadians: 2.7, startupMs: 150, activeMs: 160, recoveryMs: 210, queueOpensMs: 220, staminaCost: 0, nextAttackId: "light-2" }, { id: "light-2", kind: "light", animationId: "attack-2", damage: 45, range: 2.35, arcRadians: 2.7, startupMs: 150, activeMs: 160, recoveryMs: 210, queueOpensMs: 220, staminaCost: 0, nextAttackId: "light-3" }, { id: "light-3", kind: "light", animationId: "attack-3", damage: 50, range: 2.35, arcRadians: 2.7, startupMs: 150, activeMs: 160, recoveryMs: 210, queueOpensMs: 220, staminaCost: 0, nextAttackId: null }, { id: "heavy-slash", kind: "heavy", animationId: "attack-3", damage: 80, range: 2.8, arcRadians: 2.2, startupMs: 360, activeMs: 180, recoveryMs: 460, queueOpensMs: 1000, staminaCost: 35, nextAttackId: null }], enemyArchetypes: [{ id: "sentinel-melee", behavior: "melee", modelAssetId: "runner", maxHp: 40, moveSpeed: 1, perceptionRange: 15, preferredRange: 0.8, staggerMs: 280, attack: { damage: 1, range: 1, windupMs: 440, recoveryMs: 600, cooldownMs: 650 } }], assets: [{ id: "runner", type: "model", url: "/assets/action3d/runner.glb", bytes: 1, sha256: "sha256:0000000000000000000000000000000000000000000000000000000000000000", license: "MIT", source: { label: "Fixture", revision: "test" }, exportedBy: { tool: "Fixture", version: "1" }, model: { role: "diagnostic", maturity: "diagnostic", rootNode: "Root", skeletonRoot: null, meshNodes: ["Body"], clips: [], sockets: [], materials: [{ id: "body", name: "Body" }], transform: { upAxis: "Y", forwardAxis: "Z", unitMeters: 1, groundOffset: 0, boundsMeters: { width: 1, height: 2, depth: 1 } }, budget: { maxTransferBytes: 10, maxTriangles: 10, maxPrimitives: 2, maxMaterials: 2, maxTextures: 0, maxTextureSize: 2048, maxBones: 0, maxBoneInfluences: 0 } } }] };
const world = { id: "world", displayName: "World", objective: "Win.", bounds: { minX: -2, maxX: 2, minZ: -2, maxZ: 2 }, spawnPoints: [{ id: "entry", position: { x: 0, y: 0, z: -1 }, yaw: 0, checkpointId: "start" }], checkpoints: [{ id: "start", position: { x: 0, y: 0, z: -1 }, yaw: 0 }], colliders: [], surfaces: [], enemies: [{ id: "enemy", archetypeId: "sentinel-melee", position: { x: 0, y: 0, z: 1 } }], landmarks: [], exits: [], finalWorld: true, victoryCheckpointId: "start", playerModelAssetId: "runner" };
const response = (data: unknown, init?: ResponseInit) => new Response(typeof data === "string" ? data : JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" }, ...init });

describe("Action3dContentLoader", () => {
	it("loads a manifest and worlds once until reset", async () => {
		const fetcher = vi.fn(async (url: string | URL | Request) => String(url).endsWith("manifest.json") ? response(manifest) : response(world));
		const loader = new Action3dContentLoader(fetcher);
		const progress: number[] = [];
		const [first, second] = await Promise.all([
			loader.load(undefined, (value) => progress.push(value.loaded)),
			loader.load(),
		]);
		expect(first).toBe(second);
		expect(first.getWorld("world").id).toBe("world");
		expect(fetcher).toHaveBeenCalledTimes(2);
		expect(progress).toEqual([0, 1, 2]);
		loader.reset();
		await loader.load();
		expect(fetcher).toHaveBeenCalledTimes(4);
	});

	it("classifies HTTP, JSON, schema, network, and abort failures", async () => {
		const http = new Action3dContentLoader(vi.fn(async () => response({}, { status: 503 })));
		await expect(http.load()).rejects.toMatchObject({ kind: "network" });
		const json = new Action3dContentLoader(vi.fn(async () => response("{")));
		await expect(json.load()).rejects.toMatchObject({ kind: "invalid" });
		const schema = new Action3dContentLoader(vi.fn(async () => response({ nope: true })));
		await expect(schema.load()).rejects.toEqual(new Action3dContentLoadError("invalid", "The Action3D world data failed validation."));
		const network = new Action3dContentLoader(vi.fn(async () => { throw new Error("offline"); }));
		await expect(network.load()).rejects.toMatchObject({ kind: "network" });
		const aborted = new Action3dContentLoader(vi.fn(async () => response(manifest)));
		const controller = new AbortController();
		controller.abort();
		await expect(aborted.load(controller.signal)).rejects.toMatchObject({ name: "AbortError" });
	});

	it("reports an invalid world document", async () => {
		const fetcher = vi.fn(async (url: string | URL | Request) => String(url).endsWith("manifest.json") ? response(manifest) : response({ ...world, objective: "" }));
		await expect(new Action3dContentLoader(fetcher).load()).rejects.toMatchObject({ kind: "invalid" });
	});

	it("loads non-entry worlds on demand and deduplicates concurrent requests", async () => {
		const multiManifest = {
			...manifest,
			documents: { worlds: [
				{ id: "world", path: "worlds/world.json" },
				{ id: "causeway", path: "worlds/causeway.json" },
			] },
		};
		const causeway = {
			...world,
			id: "causeway",
			displayName: "Causeway",
			spawnPoints: [{ id: "entry", position: { x: 0, y: 0, z: -1 }, yaw: 0, checkpointId: "start" }],
		};
		const fetcher = vi.fn(async (url: string | URL | Request) => {
			const path = String(url);
			if (path.endsWith("manifest.json")) return response(multiManifest);
			return response(path.endsWith("causeway.json") ? causeway : world);
		});
		const loader = new Action3dContentLoader(fetcher);
		const content = await loader.load();
		expect(content.hasWorld("causeway")).toBe(false);
		expect(fetcher).toHaveBeenCalledTimes(2);
		await Promise.all([
			loader.loadWorld(content, "causeway"),
			loader.loadWorld(content, "causeway"),
		]);
		expect(content.getWorld("causeway").displayName).toBe("Causeway");
		expect(fetcher).toHaveBeenCalledTimes(3);
	});
});
