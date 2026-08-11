import { describe, expect, it } from "vitest";
import {
	ACTION3D_FIXED_STEP_MS,
	ACTION3D_STATE_SCHEMA_VERSION,
	Action3dContentError,
	Action3dSession,
	createAction3dCheckpointState,
	createAction3dSave,
	createInitialAction3dState,
	decodeAction3dSave,
	EMPTY_ACTION3D_INPUT,
	parseAction3dBundle,
	parseAction3dManifest,
	stepAction3dState,
	type Action3dContentRegistry,
	type Action3dInput,
	type Action3dState,
} from ".";

const manifest = {
	manifestVersion: 1 as const,
	contentVersion: "test-field-1",
	entryPoint: { worldId: "test-world", spawnId: "entry" },
	documents: { worlds: ["worlds/test.json"] },
	assets: [{ id: "runner", type: "model" as const, url: "/assets/action3d/runner.glb", bytes: 10, license: "MIT", source: { label: "Test fixture" } }],
};
const world = {
	id: "test-world",
	displayName: "Test World",
	objective: "Defeat the sentinel.",
	bounds: { minX: -10, maxX: 10, minZ: -10, maxZ: 10 },
	spawnPoints: [{ id: "entry", position: { x: 0, y: 0, z: -4 }, yaw: 0, checkpointId: "south" }],
	checkpoints: [{ id: "south", position: { x: 0, y: 0, z: -4 }, yaw: 0 }, { id: "north", position: { x: 0, y: 0, z: 8 }, yaw: Math.PI }],
	colliders: [{ id: "block", bounds: { minX: 2, maxX: 3, minZ: -5, maxZ: -3 } }],
	enemies: [{ id: "sentinel", position: { x: 0, y: 0, z: 2 }, maxHp: 80, moveSpeed: 2, attackRange: 1.7, damage: 15 }],
	landmarks: [{ id: "beacon", kind: "crystal" as const, position: { x: 0, y: 0, z: 8 }, scale: 1 }],
	victoryCheckpointId: "north",
	playerModelAssetId: "runner",
};
const registry = (): Action3dContentRegistry => parseAction3dBundle({ manifest, worlds: [{ path: "worlds/test.json", data: world }], assetExists: () => true, assetSize: () => 10 });
const input = (values: Partial<Action3dInput> = {}): Action3dInput => ({ ...EMPTY_ACTION3D_INPUT, ...values });

describe("Action3D content registry", () => {
	it("parses, indexes, freezes, and resolves a valid content bundle", () => {
		const content = registry();
		expect(content.contentVersion).toBe("test-field-1");
		expect(content.getWorld("test-world").objective).toContain("sentinel");
		expect(content.getAsset("runner").bytes).toBe(10);
		expect(Object.isFrozen(content.worldsById)).toBe(true);
		expect(() => content.getWorld("missing")).toThrow("Unknown Action3D world");
		expect(() => content.getAsset("missing")).toThrow("Unknown Action3D asset");
		expect(parseAction3dManifest(manifest).entryPoint.spawnId).toBe("entry");
	});

	it("reports schema, loaded-document, duplicate, reference, asset, and bounds failures", () => {
		expect(() => parseAction3dManifest({ ...manifest, manifestVersion: 2 })).toThrow(Action3dContentError);
		expect(() => parseAction3dBundle({ manifest, worlds: [] })).toThrow(/validation failed/);
		const invalidManifest = { ...manifest, entryPoint: { worldId: "missing", spawnId: "missing" }, assets: [...manifest.assets, manifest.assets[0]] };
		const invalidWorld = {
			...world,
			spawnPoints: [world.spawnPoints[0], world.spawnPoints[0]],
			checkpoints: [world.checkpoints[0]],
			colliders: [{ id: "bad", bounds: { minX: 11, maxX: 10, minZ: 0, maxZ: 1 } }],
			enemies: [{ ...world.enemies[0], position: { x: 40, y: 0, z: 0 } }],
			landmarks: [world.landmarks[0], world.landmarks[0]],
			victoryCheckpointId: "missing",
			playerModelAssetId: "missing",
		};
		try {
			parseAction3dBundle({ manifest: invalidManifest, worlds: [{ path: "worlds/test.json", data: invalidWorld }], assetExists: () => false, assetSize: () => 11 });
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(Action3dContentError);
			const codes = (error as Action3dContentError).issues.map((issue) => issue.code);
			expect(codes).toEqual(expect.arrayContaining(["duplicate", "reference", "asset", "bounds"]));
		}
	});

	it("rejects malformed world schemas and same-origin traversal", () => {
		expect(() => parseAction3dBundle({ manifest, worlds: [{ path: "worlds/test.json", data: { ...world, objective: "" } }] })).toThrow(Action3dContentError);
		expect(() => parseAction3dManifest({ ...manifest, assets: [{ ...manifest.assets[0], url: "/assets/action3d/../secret" }] })).toThrow(Action3dContentError);
	});
});

describe("Action3D simulation", () => {
	it("creates the entry state, moves camera-relative, sprints, collides, and jumps", () => {
		const content = registry();
		let state = createInitialAction3dState(content);
		expect(state.schemaVersion).toBe(ACTION3D_STATE_SCHEMA_VERSION);
		expect(state.player.position).toEqual({ x: 0, y: 0, z: -4 });
		state = stepAction3dState(state, content, input({ moveZ: 1, sprint: true, cameraYaw: Math.PI / 2 }), 100).state;
		expect(state.player.position.x).toBeGreaterThan(0.6);
		expect(state.player.locomotion).toBe("run");
		expect(state.player.stamina).toBeLessThan(100);
		for (let index = 0; index < 20; index += 1) state = stepAction3dState(state, content, input({ moveX: 1 }), 50).state;
		expect(state.player.position.x).toBeLessThan(1.6);
		state = stepAction3dState(state, content, input({ jump: true }), 16).state;
		expect(state.player.grounded).toBe(false);
		expect(state.player.locomotion).toBe("jump");
		for (let index = 0; index < 80; index += 1) state = stepAction3dState(state, content, input(), 16).state;
		expect(state.player.position.y).toBe(0);
		expect(state.player.grounded).toBe(true);
	});

	it("dodges with invulnerability, toggles lock-on, and spends then restores stamina", () => {
		const content = registry();
		let state = createInitialAction3dState(content);
		state.enemies[0].position = { x: 0, y: 0, z: -2.5 };
		state = stepAction3dState(state, content, input({ lockOn: true, dodge: true, moveZ: 1 }), 50).state;
		expect(state.player.lockOnEnemyId).toBe("sentinel");
		expect(state.player.locomotion).toBe("dodge");
		expect(state.player.invulnerableMs).toBeGreaterThan(0);
		expect(state.player.stamina).toBeLessThan(100);
		state = stepAction3dState(state, content, input({ lockOn: true }), 500).state;
		expect(state.player.lockOnEnemyId).toBeNull();
		expect(state.player.dodgeElapsedMs).toBeNull();
		expect(state.player.stamina).toBeGreaterThanOrEqual(80);
	});

	it("runs an attack hit window through enemy defeat and victory", () => {
		const content = registry();
		let state = createInitialAction3dState(content);
		state.player.position = { x: 0, y: 0, z: 0 };
		state.player.yaw = 0;
		state.enemies[0].position = { x: 0, y: 0, z: 1.5 };
		state.enemies[0].hp = 40;
		const result = stepAction3dState(state, content, input({ attack: true }), 180);
		expect(result.events).toEqual(expect.arrayContaining([{ type: "enemy-hit", enemyId: "sentinel", damage: 40 }, { type: "enemy-defeated", enemyId: "sentinel" }, { type: "victory", checkpointId: "north" }]));
		expect(result.state.phase).toBe("victory");
		expect(result.state.location.checkpointId).toBe("north");
		expect(stepAction3dState(result.state, content, input(), 16).state).toEqual(result.state);
	});

	it("applies enemy wind-up damage, dodge immunity, recovery, and defeat", () => {
		const content = registry();
		let state = createInitialAction3dState(content);
		state.player.position = { x: 0, y: 0, z: 0 };
		state.player.hp = 15;
		state.enemies[0].position = { x: 0, y: 0, z: 1 };
		state.enemies[0].state = "windup";
		state.enemies[0].stateElapsedMs = 430;
		let result = stepAction3dState(state, content, input(), 20);
		expect(result.events).toContainEqual({ type: "player-hit", enemyId: "sentinel", damage: 15 });
		expect(result.events).toContainEqual({ type: "defeat" });
		expect(result.state.phase).toBe("defeat");
		state = createInitialAction3dState(content);
		state.player.position = { x: 0, y: 0, z: 0 };
		state.player.invulnerableMs = 100;
		state.enemies[0] = { ...state.enemies[0], position: { x: 0, y: 0, z: 1 }, state: "windup", stateElapsedMs: 430 };
		result = stepAction3dState(state, content, input(), 20);
		expect(result.state.player.hp).toBe(100);
		expect(result.state.enemies[0].state).toBe("recover");
		result = stepAction3dState(result.state, content, input(), 700);
		expect(["chase", "windup"]).toContain(result.state.enemies[0].state);
	});

	it("normalizes transient state at a checkpoint and validates step duration", () => {
		const content = registry();
		const state = createInitialAction3dState(content);
		state.phase = "defeat";
		state.player.hp = 0;
		state.player.velocity.y = -4;
		state.player.attackElapsedMs = 20;
		state.player.dodgeElapsedMs = 20;
		state.player.lockOnEnemyId = "sentinel";
		const checkpoint = createAction3dCheckpointState(state, content);
		expect(checkpoint.phase).toBe("playing");
		expect(checkpoint.player).toMatchObject({ hp: 100, stamina: 100, grounded: true, attackElapsedMs: null, dodgeElapsedMs: null, lockOnEnemyId: null });
		expect(checkpoint.player.position).toEqual({ x: 0, y: 0, z: -4 });
		expect(() => stepAction3dState(state, content, input(), 0)).toThrow("positive finite");
		state.location.checkpointId = "missing";
		expect(() => createAction3dCheckpointState(state, content)).toThrow("Unknown Action3D checkpoint");
	});
});

describe("Action3D session and save", () => {
	it("uses bounded fixed steps, pause/resume, restore, and version guards", () => {
		const content = registry();
		const initial = createInitialAction3dState(content);
		const session = new Action3dSession(initial, content);
		expect(session.advance(ACTION3D_FIXED_STEP_MS / 2, input()).state.revision).toBe(0);
		expect(session.tickIdle(ACTION3D_FIXED_STEP_MS).state.revision).toBe(1);
		expect(session.advance(1000, input()).state.revision).toBeLessThanOrEqual(9);
		session.setPaused(true);
		expect(session.tickIdle(50).state.phase).toBe("paused");
		session.setPaused(false);
		expect(session.getState().phase).toBe("playing");
		session.restore(initial);
		expect(session.getState().revision).toBe(0);
		expect(() => session.advance(-1, input())).toThrow("non-negative finite");
		const wrong = { ...initial, contentVersion: "wrong" };
		expect(() => session.restore(wrong)).toThrow("versions do not match");
		expect(() => new Action3dSession(wrong, content)).toThrow("versions do not match");
	});

	it("encodes ready saves and distinguishes corrupt and unsupported data", () => {
		const state = createInitialAction3dState(registry());
		const save = createAction3dSave(state, "2026-08-11T00:00:00.000Z");
		expect(decodeAction3dSave(JSON.stringify(save))).toEqual({ status: "ready", save });
		expect(decodeAction3dSave("not-json")).toMatchObject({ status: "corrupt" });
		expect(decodeAction3dSave("null")).toMatchObject({ status: "corrupt" });
		expect(decodeAction3dSave(JSON.stringify({ ...save, formatVersion: 8 }))).toMatchObject({ status: "unsupported", formatVersion: 8 });
		expect(decodeAction3dSave(JSON.stringify({ ...save, state: { ...state, schemaVersion: 8 } }))).toMatchObject({ status: "unsupported", stateVersion: 8 });
		expect(decodeAction3dSave(JSON.stringify({ ...save, savedAt: "bad" }))).toMatchObject({ status: "corrupt" });
		expect(() => createAction3dSave(state, "bad")).toThrow();
	});
});
