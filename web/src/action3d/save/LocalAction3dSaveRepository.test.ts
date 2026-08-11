import { createInitialAction3dState, parseAction3dBundle } from "@shared/action3d";
import { describe, expect, it } from "vitest";
import { action3dSaveStorageKey, LocalAction3dSaveRepository } from "./LocalAction3dSaveRepository";

const state = () => createInitialAction3dState(parseAction3dBundle({
	manifest: { manifestVersion: 3, contentVersion: "save-world-1", entryPoint: { worldId: "world", spawnId: "entry" }, documents: { worlds: [{ id: "world", path: "world.json" }] }, playerTuning: { maxHp: 100, maxStamina: 100, walkSpeed: 4, runSpeed: 7, dodgeSpeed: 10, jumpSpeed: 8, gravity: 24, acceleration: 42, deceleration: 55, staminaSprintPerSecond: 24, staminaRecoveryPerSecond: 18, dodgeStaminaCost: 20, dodgeDurationMs: 400, dodgeCooldownMs: 800, dodgeInvulnerableMs: 260, playerRadius: 0.42, maxStepHeight: 0.45, maxSlopeDegrees: 45 }, attacks: [{ id: "light-1", kind: "light", animationId: "attack-1", damage: 40, range: 2, arcRadians: 2, startupMs: 150, activeMs: 160, recoveryMs: 210, queueOpensMs: 220, staminaCost: 0, nextAttackId: null }], enemyArchetypes: [{ id: "sentinel-melee", behavior: "melee", modelAssetId: "runner", maxHp: 40, moveSpeed: 1, perceptionRange: 15, preferredRange: 1, staggerMs: 280, attack: { damage: 1, range: 1, windupMs: 440, recoveryMs: 600, cooldownMs: 650 } }], assets: [{ id: "runner", type: "model", url: "/assets/action3d/runner.glb", bytes: 1, sha256: "sha256:0000000000000000000000000000000000000000000000000000000000000000", license: "MIT", source: { label: "Fixture", revision: "test" }, exportedBy: { tool: "Fixture", version: "1" }, model: { role: "diagnostic", maturity: "diagnostic", rootNode: "Root", skeletonRoot: null, meshNodes: ["Body"], clips: [], sockets: [], materials: [{ id: "body", name: "Body" }], transform: { upAxis: "Y", forwardAxis: "Z", unitMeters: 1, groundOffset: 0, boundsMeters: { width: 1, height: 2, depth: 1 } }, budget: { maxTransferBytes: 10, maxTriangles: 10, maxPrimitives: 2, maxMaterials: 2, maxTextures: 0, maxTextureSize: 2048, maxBones: 0, maxBoneInfluences: 0 } } }] },
	worlds: [{ path: "world.json", data: { id: "world", displayName: "World", objective: "Win.", bounds: { minX: -2, maxX: 2, minZ: -2, maxZ: 2 }, spawnPoints: [{ id: "entry", position: { x: 0, y: 0, z: -1 }, yaw: 0, checkpointId: "start" }], checkpoints: [{ id: "start", position: { x: 0, y: 0, z: -1 }, yaw: 0 }], colliders: [], surfaces: [], enemies: [{ id: "enemy", archetypeId: "sentinel-melee", position: { x: 0, y: 0, z: 1 } }], landmarks: [], exits: [], finalWorld: true, victoryCheckpointId: "start", playerModelAssetId: "runner" } }],
}));
const memoryStorage = () => {
	const values = new Map<string, string>();
	return { values, storage: { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } } };
};

describe("LocalAction3dSaveRepository", () => {
	it("uses an account-scoped key separate from the 2D save", () => {
		expect(action3dSaveStorageKey(" Player@Example.COM ")).toBe("action-3d:checkpoint:player%40example.com");
		expect(() => action3dSaveStorageKey(" ")).toThrow("must not be empty");
	});
	it("saves, loads, and clears a checkpoint", () => {
		const { values, storage } = memoryStorage();
		const repository = new LocalAction3dSaveRepository(storage, "player@example.com");
		expect(repository.load()).toEqual({ status: "empty" });
		const written = repository.save(state(), "2026-08-11T00:00:00.000Z");
		expect(written.ok).toBe(true);
		expect(repository.load()).toMatchObject({ status: "ready" });
		expect(values.has("game:autosave:player%40example.com")).toBe(false);
		expect(repository.clear()).toBe(true);
		expect(repository.load()).toEqual({ status: "empty" });
	});
	it("contains unavailable storage errors", () => {
		const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } };
		const repository = new LocalAction3dSaveRepository(broken, "player@example.com");
		expect(repository.load()).toMatchObject({ status: "error" });
		expect(repository.save(state())).toEqual({ ok: false, message: "Could not write the Action3D checkpoint." });
		expect(repository.clear()).toBe(false);
	});
});
