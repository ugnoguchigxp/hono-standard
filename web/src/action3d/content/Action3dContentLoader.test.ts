import { describe, expect, it, vi } from "vitest";
import { Action3dContentLoadError, Action3dContentLoader } from "./Action3dContentLoader";

const manifest = { manifestVersion: 1, contentVersion: "loader-world-1", entryPoint: { worldId: "world", spawnId: "entry" }, documents: { worlds: ["worlds/world.json"] }, assets: [{ id: "runner", type: "model", url: "/assets/action3d/runner.glb", bytes: 1, license: "MIT", source: { label: "Fixture" } }] };
const world = { id: "world", displayName: "World", objective: "Win.", bounds: { minX: -2, maxX: 2, minZ: -2, maxZ: 2 }, spawnPoints: [{ id: "entry", position: { x: 0, y: 0, z: -1 }, yaw: 0, checkpointId: "start" }], checkpoints: [{ id: "start", position: { x: 0, y: 0, z: -1 }, yaw: 0 }], colliders: [], enemies: [{ id: "enemy", position: { x: 0, y: 0, z: 1 }, maxHp: 40, moveSpeed: 1, attackRange: 1, damage: 1 }], landmarks: [], victoryCheckpointId: "start", playerModelAssetId: "runner" };
const response = (data: unknown, init?: ResponseInit) => new Response(typeof data === "string" ? data : JSON.stringify(data), { status: 200, headers: { "content-type": "application/json" }, ...init });

describe("Action3dContentLoader", () => {
	it("loads a manifest and worlds once until reset", async () => {
		const fetcher = vi.fn(async (url: string | URL | Request) => String(url).endsWith("manifest.json") ? response(manifest) : response(world));
		const loader = new Action3dContentLoader(fetcher as typeof fetch);
		const [first, second] = await Promise.all([loader.load(), loader.load()]);
		expect(first).toBe(second);
		expect(first.getWorld("world").id).toBe("world");
		expect(fetcher).toHaveBeenCalledTimes(2);
		loader.reset();
		await loader.load();
		expect(fetcher).toHaveBeenCalledTimes(4);
	});

	it("classifies HTTP, JSON, schema, network, and abort failures", async () => {
		const http = new Action3dContentLoader(vi.fn(async () => response({}, { status: 503 })) as typeof fetch);
		await expect(http.load()).rejects.toMatchObject({ kind: "network" });
		const json = new Action3dContentLoader(vi.fn(async () => response("{")) as typeof fetch);
		await expect(json.load()).rejects.toMatchObject({ kind: "invalid" });
		const schema = new Action3dContentLoader(vi.fn(async () => response({ nope: true })) as typeof fetch);
		await expect(schema.load()).rejects.toEqual(new Action3dContentLoadError("invalid", "The Action3D world data failed validation."));
		const network = new Action3dContentLoader(vi.fn(async () => { throw new Error("offline"); }) as typeof fetch);
		await expect(network.load()).rejects.toMatchObject({ kind: "network" });
		const aborted = new Action3dContentLoader(vi.fn(async () => { throw new DOMException("Aborted", "AbortError"); }) as typeof fetch);
		await expect(aborted.load()).rejects.toMatchObject({ name: "AbortError" });
	});

	it("reports an invalid world document", async () => {
		const fetcher = vi.fn(async (url: string | URL | Request) => String(url).endsWith("manifest.json") ? response(manifest) : response({ ...world, objective: "" }));
		await expect(new Action3dContentLoader(fetcher as typeof fetch).load()).rejects.toMatchObject({ kind: "invalid" });
	});
});
