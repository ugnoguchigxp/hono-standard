import { describe, expect, it } from "vitest";
import { createInitialAction3dState, parseAction3dBundle } from "@shared/action3d";
import { action3dSaveStorageKey, LocalAction3dSaveRepository } from "./LocalAction3dSaveRepository";

const state = () => createInitialAction3dState(parseAction3dBundle({
	manifest: { manifestVersion: 1, contentVersion: "save-world-1", entryPoint: { worldId: "world", spawnId: "entry" }, documents: { worlds: ["world.json"] }, assets: [{ id: "runner", type: "model", url: "/assets/action3d/runner.glb", bytes: 1, license: "MIT", source: { label: "Fixture" } }] },
	worlds: [{ path: "world.json", data: { id: "world", displayName: "World", objective: "Win.", bounds: { minX: -2, maxX: 2, minZ: -2, maxZ: 2 }, spawnPoints: [{ id: "entry", position: { x: 0, y: 0, z: -1 }, yaw: 0, checkpointId: "start" }], checkpoints: [{ id: "start", position: { x: 0, y: 0, z: -1 }, yaw: 0 }], colliders: [], enemies: [{ id: "enemy", position: { x: 0, y: 0, z: 1 }, maxHp: 40, moveSpeed: 1, attackRange: 1, damage: 1 }], landmarks: [], victoryCheckpointId: "start", playerModelAssetId: "runner" } }],
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
