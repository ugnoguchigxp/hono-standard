import { describe, expect, it } from "vitest";
import {
	ACTION3D_FIXED_STEP_MS,
	ACTION3D_GAME_ID,
	ACTION3D_STATE_SCHEMA_VERSION,
	Action3dContentError,
	type Action3dContentRegistry,
	type Action3dInput,
	Action3dSession,
	type Action3dState,
	createAction3dCheckpointState,
	createAction3dSave,
	createInitialAction3dState,
	decodeAction3dSave,
	EMPTY_ACTION3D_INPUT,
	parseAction3dBundle,
	parseAction3dManifest,
	stepAction3dState,
} from ".";

const runnerAsset = {
	id: "runner",
	type: "model" as const,
	url: "/assets/action3d/runner.glb",
	bytes: 10,
	sha256:
		"sha256:0000000000000000000000000000000000000000000000000000000000000000",
	license: "MIT",
	source: { label: "Test fixture", revision: "test" },
	exportedBy: { tool: "Fixture", version: "1" },
	model: {
		role: "diagnostic" as const,
		maturity: "diagnostic" as const,
		rootNode: "Root",
		skeletonRoot: null,
		meshNodes: ["Body"],
		clips: [],
		sockets: [],
		materials: [{ id: "body", name: "Body" }],
		transform: {
			upAxis: "Y" as const,
			forwardAxis: "Z" as const,
			unitMeters: 1,
			groundOffset: 0,
			boundsMeters: { width: 1, height: 2, depth: 1 },
		},
		budget: {
			maxTransferBytes: 100,
			maxTriangles: 100,
			maxPrimitives: 10,
			maxMaterials: 4,
			maxTextures: 0,
			maxTextureSize: 2048,
			maxBones: 0,
			maxBoneInfluences: 0,
		},
	},
};
const manifest = {
	manifestVersion: 2 as const,
	contentVersion: "test-field-1",
	entryPoint: { worldId: "test-world", spawnId: "entry" },
	documents: { worlds: ["worlds/test.json"] },
	assets: [runnerAsset],
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
	enemyModelAssetId: "runner",
};
const registry = (): Action3dContentRegistry => parseAction3dBundle({ manifest, worlds: [{ path: "worlds/test.json", data: world }], assetExists: () => true, assetSize: () => 10 });
const registryWithSurfaces = (
	surfaces: Array<{
		id: string;
		bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
		axis: "x" | "z";
		fromHeight: number;
		toHeight: number;
	}>,
) => parseAction3dBundle({ manifest, worlds: [{ path: "worlds/test.json", data: { ...world, colliders: [], surfaces } }] });
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
		expect(() => parseAction3dManifest({ ...manifest, manifestVersion: 3 })).toThrow(Action3dContentError);
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

	it("rejects a player blockout that omits required semantic members", () => {
		const blockoutManifest = {
			...manifest,
			assets: [
				{
					...runnerAsset,
					model: {
						...runnerAsset.model,
						role: "player" as const,
						maturity: "blockout" as const,
						skeletonRoot: "Root",
					},
				},
			],
		};
		try {
			parseAction3dBundle({
				manifest: blockoutManifest,
				worlds: [{ path: "worlds/test.json", data: world }],
			});
			expect.unreachable();
		} catch (error) {
			expect(error).toBeInstanceOf(Action3dContentError);
			const messages = (error as Action3dContentError).issues.map(
				(issue) => issue.message,
			);
			expect(messages).toEqual(
				expect.arrayContaining([
					"Player model is missing 'idle'.",
					"Player model is missing 'socket.weapon.right'.",
					"Player model is missing 'skin'.",
				]),
			);
		}
	});

	it("resolves model clips and sockets with explicit accessor errors", () => {
		const clip = {
			id: "idle",
			name: "Idle",
			loop: true,
			durationMs: { min: 100, max: 200 },
		};
		const socket = { id: "socket.hit.center" as const, node: "Chest" };
		const modelAsset = {
			...runnerAsset,
			model: {
				...runnerAsset.model,
				clips: [clip],
				sockets: [socket],
			},
		};
		const textureAsset = {
			id: "ground-texture",
			type: "texture" as const,
			url: "/assets/action3d/ground.png",
			bytes: 4,
			sha256:
				"sha256:1111111111111111111111111111111111111111111111111111111111111111",
			license: "MIT",
			source: { label: "Test fixture", revision: "test" },
		};
		const content = parseAction3dBundle({
			manifest: { ...manifest, assets: [modelAsset, textureAsset] },
			worlds: [{ path: "worlds/test.json", data: world }],
		});

		expect(content.getModelClip("runner", "idle")).toEqual(clip);
		expect(content.getModelSocket("runner", "socket.hit.center")).toEqual(
			socket,
		);
		expect(() => content.getModelClip("runner", "missing")).toThrow(
			"Unknown clip",
		);
		expect(() => content.getModelSocket("runner", "socket.core")).toThrow(
			"Unknown socket",
		);
		expect(() => content.getModelClip("ground-texture", "idle")).toThrow(
			"is not a model",
		);
		expect(() =>
			content.getModelSocket("ground-texture", "socket.core"),
		).toThrow("is not a model");
	});

	it("reports enemy model contract, model duplicates, and asset hash failures", () => {
		const clip = {
			id: "idle",
			name: "Idle",
			loop: true,
			durationMs: { min: 100, max: 200 },
		};
		const socket = { id: "socket.hit.center" as const, node: "Chest" };
		const material = { id: "body", name: "Body" };
		const enemyAsset = {
			...runnerAsset,
			model: {
				...runnerAsset.model,
				role: "enemy" as const,
				maturity: "blockout" as const,
				skeletonRoot: null,
				clips: [clip, clip],
				sockets: [socket, socket],
				materials: [material, material],
			},
		};

		try {
			parseAction3dBundle({
				manifest: { ...manifest, assets: [enemyAsset] },
				worlds: [{ path: "worlds/test.json", data: world }],
				assetHash: () => "sha256:ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
			});
			expect.unreachable();
		} catch (error) {
			const issues = (error as Action3dContentError).issues;
			expect(issues.map((issue) => issue.code)).toContain("duplicate");
			expect(issues.map((issue) => issue.message)).toEqual(
				expect.arrayContaining([
					"Blockout and production models require a skeleton root.",
					"Enemy model is missing 'chase'.",
					"Enemy model is missing 'socket.core'.",
				]),
			);
			expect(issues.some((issue) => issue.message.includes("found sha256"))).toBe(
				true,
			);
		}
	});

	it("aggregates every world reference, duplicate, and bounds class", () => {
		const duplicateSpawn = {
			...world.spawnPoints[0],
			checkpointId: "missing-checkpoint",
			position: { x: -20, y: 0, z: -4 },
		};
		const invalidWorld = {
			...world,
			spawnPoints: [duplicateSpawn, duplicateSpawn],
			checkpoints: [
				world.checkpoints[0],
				world.checkpoints[0],
				{ ...world.checkpoints[1], position: { x: 0, y: 0, z: 20 } },
			],
			colliders: [
				{ id: "flat", bounds: { minX: 0, maxX: 1, minZ: 1, maxZ: 1 } },
				{ id: "outside-min", bounds: { minX: -20, maxX: -19, minZ: 0, maxZ: 1 } },
				{ id: "outside-max", bounds: { minX: 9, maxX: 11, minZ: 0, maxZ: 1 } },
				{ id: "flat", bounds: { minX: 0, maxX: 1, minZ: 0, maxZ: 1 } },
			],
			surfaces: [
				{
					id: "bad-surface",
					bounds: { minX: 1, maxX: 1, minZ: 0, maxZ: 1 },
					axis: "x" as const,
					fromHeight: 0,
					toHeight: 1,
				},
				{
					id: "bad-surface",
					bounds: { minX: 9, maxX: 11, minZ: 0, maxZ: 1 },
					axis: "z" as const,
					fromHeight: 0,
					toHeight: 1,
				},
			],
			enemies: [world.enemies[0], world.enemies[0]],
			landmarks: [
				{ ...world.landmarks[0], position: { x: 20, y: 0, z: 8 } },
			],
			victoryCheckpointId: "missing-victory",
			enemyModelAssetId: "missing-enemy-model",
		};
		try {
			parseAction3dBundle({
				manifest: {
					...manifest,
					entryPoint: { worldId: "test-world", spawnId: "missing-entry" },
				},
				worlds: [{ path: "worlds/test.json", data: invalidWorld }],
			});
			expect.unreachable();
		} catch (error) {
			const issues = (error as Action3dContentError).issues;
			expect(issues.map((issue) => issue.code)).toEqual(
				expect.arrayContaining(["duplicate", "reference", "bounds"]),
			);
			expect(issues.map((issue) => issue.message)).toEqual(
				expect.arrayContaining([
					"Unknown entry spawn 'missing-entry'.",
					"Unknown checkpoint 'missing-checkpoint'.",
					"Unknown model asset 'missing-enemy-model'.",
				]),
			);
		}
		expect(() => parseAction3dManifest(null)).toThrow(Action3dContentError);
	});
});

describe("Action3D simulation", () => {
	it("creates the entry state, moves camera-relative, sprints, collides, and jumps", () => {
		const content = registry();
		let state = createInitialAction3dState(content);
		expect(state.schemaVersion).toBe(ACTION3D_STATE_SCHEMA_VERSION);
		expect(state.player.position).toEqual({ x: 0, y: 0, z: -4 });
		state = stepAction3dState(state, content, input({ moveZ: 1, sprint: true, cameraYaw: Math.PI / 2 }), 100).state;
		expect(state.player.position.x).toBeGreaterThan(0.35);
		expect(state.player.velocity.x).toBeGreaterThan(4);
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

	it("traverses a permitted step and rejects an over-limit slope", () => {
		const stepped = registryWithSurfaces([
			{
				id: "training-step",
				bounds: { minX: 0.5, maxX: 2, minZ: -5, maxZ: -3 },
				axis: "x",
				fromHeight: 0.3,
				toHeight: 0.3,
			},
		]);
		let state = createInitialAction3dState(stepped);
		state = stepAction3dState(state, stepped, input({ moveX: 1 }), 100).state;
		state = stepAction3dState(state, stepped, input({ moveX: 1 }), 100).state;
		expect(state.player.position.x).toBeGreaterThan(0.5);
		expect(state.player.position.y).toBe(0.3);

		const steep = registryWithSurfaces([
			{
				id: "steep-ramp",
				bounds: { minX: -1, maxX: 1, minZ: -3, maxZ: -1 },
				axis: "z",
				fromHeight: 0,
				toHeight: 3,
			},
		]);
		state = createInitialAction3dState(steep);
		for (let index = 0; index < 4; index += 1)
			state = stepAction3dState(state, steep, input({ moveZ: 1 }), 100).state;
		expect(state.player.position.z).toBeLessThan(-3);
		expect(state.player.position.y).toBe(0);
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

	it("never advances a defeated enemy while surviving enemies keep the field active", () => {
		const secondEnemy = {
			...world.enemies[0],
			id: "sentinel-2",
			position: { x: 8, y: 0, z: 8 },
		};
		const content = parseAction3dBundle({
			manifest,
			worlds: [
				{
					path: "worlds/test.json",
					data: { ...world, enemies: [...world.enemies, secondEnemy] },
				},
			],
			assetExists: () => true,
			assetSize: () => 10,
		});
		const state = createInitialAction3dState(content);
		Object.assign(state.enemies[0], {
			position: { x: 1.25, y: 0, z: 2.5 },
			yaw: 1.1,
			hp: 0,
			state: "defeated",
			stateElapsedMs: 123,
			attackCooldownMs: 456,
		});
		state.player.lockOnEnemyId = state.enemies[0].id;
		const defeatedBefore = structuredClone(state.enemies[0]);

		const result = stepAction3dState(state, content, input(), 1_000);

		expect(result.state.phase).toBe("playing");
		expect(result.state.enemies[0]).toEqual(defeatedBefore);
		expect(result.state.player.lockOnEnemyId).toBeNull();
	});

	it("queues a deterministic three-hit combo and blocks hits through ruins", () => {
		const content = registry();
		let state = createInitialAction3dState(content);
		state.player.position = { x: 0, y: 0, z: 0 };
		state.player.yaw = 0;
		state.enemies[0].position = { x: 0, y: 0, z: 1.5 };
		state.enemies[0].hp = 200;
		state.enemies[0].maxHp = 200;
		const damages: number[] = [];
		for (const [command, duration] of [
			[input({ attack: true }), 180],
			[input(), 60],
			[input({ attack: true }), 50],
			[input(), 230],
			[input(), 180],
			[input(), 60],
			[input({ attack: true }), 50],
			[input(), 230],
			[input(), 180],
		] as const) {
			const result = stepAction3dState(state, content, command, duration);
			state = result.state;
			damages.push(
				...result.events
					.filter((event) => event.type === "enemy-hit")
					.map((event) => event.damage),
			);
		}
		expect(damages).toEqual([40, 45, 50]);
		expect(state.player.attackComboIndex).toBe(2);

		state = createInitialAction3dState(content);
		state.player.position = { x: 1.3, y: 0, z: -4 };
		state.player.yaw = Math.PI / 2;
		state.enemies[0].position = { x: 3.6, y: 0, z: -4 };
		let blocked = stepAction3dState(
			state,
			content,
			input({ lockOn: true, attack: true }),
			180,
		);
		expect(blocked.state.player.lockOnEnemyId).toBeNull();
		expect(blocked.events).not.toContainEqual(
			expect.objectContaining({ type: "enemy-hit" }),
		);
		blocked.state.player.lockOnEnemyId = "sentinel";
		blocked = stepAction3dState(blocked.state, content, input(), 16);
		expect(blocked.state.player.lockOnEnemyId).toBeNull();
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

	it("covers normalized diagonal movement and non-terminal combat AI branches", () => {
		const content = registry();
		let state = createInitialAction3dState(content);
		state = stepAction3dState(state, content, input({ moveX: 1, moveZ: 1 }), 50).state;
		expect(Math.hypot(state.player.position.x, state.player.position.z + 4)).toBeLessThan(0.3);
		state.enemies[0].position = { x: 30, y: 0, z: 30 };
		state = stepAction3dState(state, content, input({ lockOn: true }), 16).state;
		expect(state.player.lockOnEnemyId).toBeNull();

		state.player.position = { x: 0, y: 0, z: 0 };
		state.player.yaw = Math.PI;
		state.enemies[0].position = { x: 0, y: 0, z: 1.5 };
		let result = stepAction3dState(state, content, input({ attack: true }), 180);
		expect(result.state.enemies[0].hp).toBe(80);
		state = result.state;
		state.player.attackElapsedMs = null;
		state.player.lockOnEnemyId = "sentinel";
		result = stepAction3dState(state, content, input({ attack: true }), 180);
		expect(result.state.enemies[0]).toMatchObject({ hp: 40, state: "stagger" });
		result = stepAction3dState(result.state, content, input(), 120);
		expect(result.state.enemies[0].state).toBe("chase");
		result.state.enemies[0].position = { x: 9, y: 0, z: 9 };
		result = stepAction3dState(result.state, content, input(), 300);
		expect(result.state.player.attackElapsedMs).toBeNull();
		result.state.enemies[0].state = "recover";
		result.state.enemies[0].stateElapsedMs = 0;
		result = stepAction3dState(result.state, content, input(), 100);
		expect(result.state.enemies[0].state).toBe("recover");
		result = stepAction3dState(result.state, content, input(), 600);
		expect(result.state.enemies[0].state).toBe("chase");
		result.state.enemies.push({ ...result.state.enemies[0], id: "unknown", state: "idle" });
		result = stepAction3dState(result.state, content, input(), 16);
		expect(result.state.enemies.find((enemy) => enemy.id === "unknown")?.state).toBe("idle");
		const stable = createAction3dCheckpointState(result.state, content);
		expect(stable.phase).toBe("playing");
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
		expect(save.gameId).toBe(ACTION3D_GAME_ID);
		expect(decodeAction3dSave(JSON.stringify(save))).toEqual({ status: "ready", save });
		expect(decodeAction3dSave("not-json")).toMatchObject({ status: "corrupt" });
		expect(decodeAction3dSave("null")).toMatchObject({ status: "corrupt" });
		expect(decodeAction3dSave(JSON.stringify({ ...save, formatVersion: 8 }))).toMatchObject({ status: "unsupported", formatVersion: 8 });
		expect(decodeAction3dSave(JSON.stringify({ ...save, formatVersion: "future" }))).toMatchObject({ status: "unsupported", formatVersion: undefined });
		expect(decodeAction3dSave(JSON.stringify({ ...save, state: { ...state, schemaVersion: 8 } }))).toMatchObject({ status: "unsupported", stateVersion: 8 });
		expect(decodeAction3dSave(JSON.stringify({ ...save, state: { ...state, schemaVersion: "future" } }))).toMatchObject({ status: "corrupt" });
		expect(decodeAction3dSave(JSON.stringify({ ...save, savedAt: "bad" }))).toMatchObject({ status: "corrupt" });
		expect(() => createAction3dSave(state, "bad")).toThrow();
	});
});
