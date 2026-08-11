import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { ImportMeshAsync } from "@babylonjs/core/Loading/sceneLoader";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import {
	type Action3dEvent,
	type Action3dState,
	createAction3dCheckpointState,
} from "@shared/action3d";
import type {
	BrowserGameRuntime,
	BrowserGameViewport,
} from "../../game-platform";
import {
	type Action3dAnimationController,
	createAction3dAnimationController,
} from "../presentation/animation/Action3dAnimationController";
import { createBabylonAnimationHandle } from "../presentation/animation/createBabylonAnimationHandle";
import { getEnemyDefeatPresentation } from "../presentation/combat/EnemyDefeatPresentation";
import { Action3dInputController } from "./Action3dInputController";
import type { Action3dRuntimeOptions } from "./types";

const createMaterial = (
	scene: Scene,
	name: string,
	color: Color3,
	emissive = Color3.Black(),
) => {
	const material = new StandardMaterial(name, scene);
	material.diffuseColor = color;
	material.emissiveColor = emissive;
	material.specularColor = new Color3(0.08, 0.12, 0.14);
	return material;
};

const cameraCollisionRatio = (
	from: { x: number; z: number },
	to: { x: number; z: number },
	bounds: { minX: number; maxX: number; minZ: number; maxZ: number },
) => {
	const padding = 0.35;
	const dx = to.x - from.x;
	const dz = to.z - from.z;
	let near = 0;
	let far = 1;
	for (const [origin, delta, min, max] of [
		[from.x, dx, bounds.minX - padding, bounds.maxX + padding],
		[from.z, dz, bounds.minZ - padding, bounds.maxZ + padding],
	] as const) {
		if (Math.abs(delta) < 0.000_01) {
			if (origin < min || origin > max) return null;
			continue;
		}
		const first = (min - origin) / delta;
		const second = (max - origin) / delta;
		near = Math.max(near, Math.min(first, second));
		far = Math.min(far, Math.max(first, second));
		if (near > far) return null;
	}
	return near >= 0 && near <= 1 ? near : null;
};

export class Action3dGame implements BrowserGameRuntime {
	private engine: Engine | null = null;
	private scene: Scene | null = null;
	private canvas: HTMLCanvasElement | null = null;
	private input: Action3dInputController | null = null;
	private playerRoot: TransformNode | null = null;
	private camera: FreeCamera | null = null;
	private attackEffect: Mesh | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private readonly enemyRoots = new Map<string, TransformNode>();
	private readonly enemyFallbackMeshes = new Map<string, Mesh[]>();
	private readonly enemyAnimationControllers = new Map<
		string,
		Action3dAnimationController
	>();
	private readonly enemyDefeatElapsedMs = new Map<string, number>();
	private animationController: Action3dAnimationController | null = null;
	private playerModelAssetId = "";
	private playerGroundOffset = 0;
	private lastSnapshotAt = 0;
	private lastPhase = "";
	private pointerLocked = false;
	private victorySaved = false;
	private disposed = false;
	private hiddenPaused = false;
	private cameraShakeMs = 0;
	private audioContext: AudioContext | null = null;
	private lowFpsSamples = 0;
	private qualityReduced = false;
	private lastDrawCallTotal = 0;
	private lastDrawSampleAt = 0;
	private readonly reduceMotion = window.matchMedia(
		"(prefers-reduced-motion: reduce)",
	).matches;
	constructor(private readonly options: Action3dRuntimeOptions) {}

	async start(host: HTMLElement, signal: AbortSignal): Promise<void> {
		if (!Engine.isSupported()) {
			this.options.onError({
				code: "webgl-unsupported",
				message: "This browser cannot create a WebGL field.",
				recoverable: false,
			});
			return;
		}
		const canvas = document.createElement("canvas");
		canvas.className = "action3d-canvas";
		canvas.dataset.runtimeGeneration = String(this.options.generation);
		canvas.tabIndex = 0;
		canvas.setAttribute(
			"aria-label",
			"Interactive third-person Action3D field",
		);
		host.append(canvas);
		this.canvas = canvas;
		canvas.addEventListener("webglcontextlost", this.onContextLost);
		canvas.addEventListener("webglcontextrestored", this.onContextRestored);
		window.addEventListener("resize", this.onResize);
		document.addEventListener("visibilitychange", this.onVisibilityChange);
		try {
			this.engine = new Engine(
				canvas,
				true,
				{
					preserveDrawingBuffer: false,
					stencil: true,
					disableWebGL2Support: false,
					powerPreference: "high-performance",
				},
				true,
			);
			if (this.engine.webGLVersion < 2)
				throw new Error("Action3D requires WebGL2.");
			// Reserve GPU time for four simultaneously skinned characters. The CSS
			// canvas remains full-size while browser compositing resolves the modest
			// internal render scale at the gameplay camera distance.
			this.engine.setHardwareScalingLevel(
				1.2 / Math.min(window.devicePixelRatio || 1, 1.5),
			);
			this.scene = new Scene(this.engine);
			this.scene.clearColor = new Color4(0.025, 0.06, 0.1, 1);
			this.scene.fogMode = Scene.FOGMODE_EXP2;
			this.scene.fogDensity = 0.012;
			this.scene.fogColor = new Color3(0.06, 0.15, 0.18);
			this.input = new Action3dInputController(canvas, (locked) => {
				this.pointerLocked = locked;
			});
			this.buildWorld(this.scene);
			await Promise.all([
				this.buildPlayer(this.scene),
				this.buildEnemies(this.scene),
			]);
			if (signal.aborted || this.disposed) return;
			this.engine.runRenderLoop(this.renderFrame);
			this.resizeObserver = new ResizeObserver(this.onResize);
			this.resizeObserver.observe(host);
			this.onResize();
		} catch (error) {
			if (!signal.aborted)
				this.options.onError({
					code:
						error instanceof Error && error.message.includes("WebGL2")
							? "webgl-unsupported"
							: "startup",
					message:
						error instanceof Error
							? error.message
							: "Action3D failed during startup.",
					recoverable: true,
				});
		}
	}

	private buildWorld(scene: Scene): void {
		const state = this.options.session.getState();
		const world = this.options.session.content.getWorld(state.location.worldId);
		const groundMaterial = createMaterial(
			scene,
			"CourtyardStone",
			new Color3(0.12, 0.23, 0.25),
		);
		const ground = MeshBuilder.CreateGround(
			"Courtyard",
			{
				width: world.bounds.maxX - world.bounds.minX,
				height: world.bounds.maxZ - world.bounds.minZ,
				subdivisions: 2,
			},
			scene,
		);
		ground.material = groundMaterial;
		for (const surface of world.surfaces) {
			const width = surface.bounds.maxX - surface.bounds.minX;
			const depth = surface.bounds.maxZ - surface.bounds.minZ;
			const mesh = MeshBuilder.CreateGround(
				`${surface.id}-surface`,
				{ width, height: depth, subdivisions: 1, updatable: true },
				scene,
			);
			const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
			if (positions) {
				for (let index = 0; index < positions.length; index += 3) {
					const local =
						surface.axis === "x" ? positions[index] : positions[index + 2];
					const span = surface.axis === "x" ? width : depth;
					const progress = Math.min(1, Math.max(0, local / span + 0.5));
					positions[index + 1] =
						surface.fromHeight +
						(surface.toHeight - surface.fromHeight) * progress +
						0.01;
				}
				mesh.updateVerticesData(VertexBuffer.PositionKind, positions);
			}
			mesh.position.set(
				(surface.bounds.minX + surface.bounds.maxX) / 2,
				0,
				(surface.bounds.minZ + surface.bounds.maxZ) / 2,
			);
			mesh.material = groundMaterial;
		}
		const ruinMaterial = createMaterial(
			scene,
			"Ruins",
			new Color3(0.18, 0.3, 0.31),
		);
		for (const collider of world.colliders) {
			const width = collider.bounds.maxX - collider.bounds.minX;
			const depth = collider.bounds.maxZ - collider.bounds.minZ;
			const ruin = MeshBuilder.CreateBox(
				collider.id,
				{ width, height: 2.5, depth },
				scene,
			);
			ruin.position.set(
				(collider.bounds.minX + collider.bounds.maxX) / 2,
				1.25,
				(collider.bounds.minZ + collider.bounds.maxZ) / 2,
			);
			ruin.material = ruinMaterial;
		}
		const edgeMaterial = createMaterial(
			scene,
			"FieldEdge",
			new Color3(0.04, 0.12, 0.14),
			new Color3(0.01, 0.08, 0.08),
		);
		for (const [name, x, z, width, depth] of [
			["NorthEdge", 0, world.bounds.maxZ, 36, 0.35],
			["SouthEdge", 0, world.bounds.minZ, 36, 0.35],
			["WestEdge", world.bounds.minX, 0, 0.35, 36],
			["EastEdge", world.bounds.maxX, 0, 0.35, 36],
		] as const) {
			const edge = MeshBuilder.CreateBox(
				name,
				{ width, height: 1.2, depth },
				scene,
			);
			edge.position.set(x, 0.6, z);
			edge.material = edgeMaterial;
		}
		const crystalMaterial = createMaterial(
			scene,
			"BeaconCrystal",
			new Color3(0.12, 0.72, 0.7),
			new Color3(0.04, 0.35, 0.34),
		);
		const woodMaterial = createMaterial(
			scene,
			"TreeTrunk",
			new Color3(0.23, 0.15, 0.09),
		);
		const leafMaterial = createMaterial(
			scene,
			"TreeCrown",
			new Color3(0.08, 0.34, 0.24),
		);
		for (const landmark of world.landmarks) {
			const root = new TransformNode(landmark.id, scene);
			root.position.set(
				landmark.position.x,
				landmark.position.y,
				landmark.position.z,
			);
			root.scaling.setAll(landmark.scale);
			if (landmark.kind === "crystal") {
				const mesh = MeshBuilder.CreatePolyhedron(
					`${landmark.id}-crystal`,
					{ type: 1, size: 0.8 },
					scene,
				);
				mesh.parent = root;
				mesh.position.y = 1.1;
				mesh.scaling.y = 1.8;
				mesh.material = crystalMaterial;
			} else if (landmark.kind === "tree") {
				const trunk = MeshBuilder.CreateCylinder(
					`${landmark.id}-trunk`,
					{ height: 2.5, diameter: 0.45, tessellation: 7 },
					scene,
				);
				trunk.parent = root;
				trunk.position.y = 1.25;
				trunk.material = woodMaterial;
				const crown = MeshBuilder.CreateSphere(
					`${landmark.id}-crown`,
					{ diameter: 2.1, segments: 7 },
					scene,
				);
				crown.parent = root;
				crown.position.y = 2.8;
				crown.scaling.y = 1.25;
				crown.material = leafMaterial;
			} else {
				const left = MeshBuilder.CreateBox(
					`${landmark.id}-left`,
					{ width: 0.55, height: 3.5, depth: 0.75 },
					scene,
				);
				left.parent = root;
				left.position.set(-1.3, 1.75, 0);
				left.material = ruinMaterial;
				const right = left.clone(`${landmark.id}-right`);
				right.parent = root;
				right.position.x = 1.3;
				const top = MeshBuilder.CreateBox(
					`${landmark.id}-top`,
					{ width: 3.2, height: 0.55, depth: 0.75 },
					scene,
				);
				top.parent = root;
				top.position.y = 3.25;
				top.material = ruinMaterial;
			}
		}
		const enemyMaterial = createMaterial(
			scene,
			"SentinelShell",
			new Color3(0.66, 0.24, 0.17),
			new Color3(0.11, 0.025, 0.01),
		);
		for (const enemy of state.enemies) {
			const root = new TransformNode(enemy.id, scene);
			const body = MeshBuilder.CreatePolyhedron(
				`${enemy.id}-body`,
				{ type: 2, size: 0.7 },
				scene,
			);
			body.parent = root;
			body.position.y = 1;
			body.scaling.y = 1.4;
			body.material = enemyMaterial;
			const eye = MeshBuilder.CreateSphere(
				`${enemy.id}-eye`,
				{ diameter: 0.22, segments: 6 },
				scene,
			);
			eye.parent = root;
			eye.position.set(0, 1.15, 0.65);
			eye.material = crystalMaterial;
			this.enemyFallbackMeshes.set(enemy.id, [body, eye]);
			this.enemyRoots.set(enemy.id, root);
		}
		this.playerRoot = new TransformNode("PlayerVisualRoot", scene);
		const attackMaterial = createMaterial(
			scene,
			"PlayerAttackTrail",
			new Color3(0.18, 0.9, 0.94),
			new Color3(0.08, 0.72, 0.78),
		);
		attackMaterial.alpha = 0.72;
		attackMaterial.disableLighting = true;
		attackMaterial.backFaceCulling = false;
		const attackPath = Array.from({ length: 15 }, (_, index) => {
			const progress = index / 14;
			const lift = Math.sin(progress * Math.PI);
			return new Vector3(
				(progress - 0.5) * 2.64,
				lift * 0.28,
				0.72 + lift * 0.12,
			);
		});
		this.attackEffect = MeshBuilder.CreateTube(
			"PlayerAttackArc",
			{ path: attackPath, radius: 0.045, tessellation: 7 },
			scene,
		);
		this.attackEffect.parent = this.playerRoot;
		this.attackEffect.position.y = 0.72;
		this.attackEffect.material = attackMaterial;
		this.attackEffect.setEnabled(false);
		this.camera = new FreeCamera(
			"ThirdPersonCamera",
			new Vector3(0, 4, -8),
			scene,
		);
		this.camera.minZ = 0.1;
		this.camera.fov = 0.9;
		scene.activeCamera = this.camera;
		new HemisphericLight(
			"SkyLight",
			new Vector3(0.2, 1, 0.1),
			scene,
		).intensity = 0.9;
		const sun = new DirectionalLight(
			"SunLight",
			new Vector3(-0.5, -1, 0.45),
			scene,
		);
		sun.position = new Vector3(8, 14, -8);
		sun.intensity = 1.1;
	}

	private async buildEnemies(scene: Scene): Promise<void> {
		const state = this.options.session.getState();
		const world = this.options.session.content.getWorld(state.location.worldId);
		const asset = this.options.session.content.getAsset(
			world.enemyModelAssetId,
		);
		if (asset.type !== "model")
			throw new Error(`Action3D asset '${asset.id}' is not a model.`);
		await Promise.all(
			state.enemies.map(async (enemy) => {
				const root = this.enemyRoots.get(enemy.id);
				if (!root) return;
				try {
					const result = await ImportMeshAsync(asset.url, scene);
					for (const mesh of result.meshes)
						if (!mesh.parent) mesh.parent = root;
					root.scaling.setAll(asset.model.transform.unitMeters);
					for (const fallback of this.enemyFallbackMeshes.get(enemy.id) ?? [])
						fallback.setEnabled(false);
					const controller = createAction3dAnimationController(
						asset,
						result.animationGroups.map(createBabylonAnimationHandle),
					);
					controller.select("idle");
					this.enemyAnimationControllers.set(enemy.id, controller);
				} catch {
					this.options.onWarning({
						code: "asset-load",
						message: `The ${enemy.id} model could not load; its diagnostic fallback is active.`,
						recoverable: true,
					});
				}
			}),
		);
	}

	private async buildPlayer(scene: Scene): Promise<void> {
		if (!this.playerRoot) return;
		const state = this.options.session.getState();
		const world = this.options.session.content.getWorld(state.location.worldId);
		const asset = this.options.session.content.getAsset(
			world.playerModelAssetId,
		);
		if (asset.type !== "model")
			throw new Error(`Action3D asset '${asset.id}' is not a model.`);
		try {
			const result = await ImportMeshAsync(asset.url, scene);
			for (const mesh of result.meshes)
				if (!mesh.parent) mesh.parent = this.playerRoot;
			this.animationController = createAction3dAnimationController(
				asset,
				result.animationGroups.map(createBabylonAnimationHandle),
			);
			this.playerModelAssetId = asset.id;
			this.playerGroundOffset = asset.model.transform.groundOffset;
			this.playerRoot.scaling.setAll(asset.model.transform.unitMeters);
		} catch {
			const material = createMaterial(
				scene,
				"FallbackPlayer",
				new Color3(0.08, 0.58, 0.58),
			);
			const fallback = MeshBuilder.CreateCapsule(
				"FallbackRunner",
				{ height: 2.2, radius: 0.42, tessellation: 8 },
				scene,
			);
			fallback.parent = this.playerRoot;
			fallback.position.y = 1.1;
			fallback.material = material;
			this.options.onWarning({
				code: "asset-load",
				message:
					"The avatar model could not load; a procedural fallback is active.",
				recoverable: true,
			});
		}
	}

	private renderFrame = () => {
		if (
			!this.engine ||
			!this.scene ||
			!this.input ||
			!this.playerRoot ||
			!this.camera
		)
			return;
		const input = this.input.read();
		const preStepState = this.options.session.getState();
		const lockTarget = preStepState.enemies.find(
			(enemy) => enemy.id === preStepState.player.lockOnEnemyId,
		);
		if (lockTarget) {
			const targetYaw = Math.atan2(
				lockTarget.position.x - preStepState.player.position.x,
				lockTarget.position.z - preStepState.player.position.z,
			);
			const delta = Math.atan2(
				Math.sin(targetYaw - this.input.cameraYaw),
				Math.cos(targetYaw - this.input.cameraYaw),
			);
			this.input.cameraYaw += delta * 0.08;
			input.cameraYaw = this.input.cameraYaw;
		}
		if (input.pause) {
			const paused = this.options.session.getState().phase === "paused";
			this.options.session.setPaused(!paused);
			if (!paused && document.pointerLockElement === this.canvas)
				void document.exitPointerLock();
		}
		const deltaMs = Math.min(100, this.engine.getDeltaTime());
		const result = this.options.session.advance(deltaMs, input);
		for (const event of result.events) {
			this.options.onEvent(event);
			this.playEventSound(event.type);
			if (event.type === "enemy-hit") this.cameraShakeMs = 130;
			if (event.type === "player-hit") this.cameraShakeMs = 220;
		}
		if (
			!this.victorySaved &&
			result.events.some((event) => event.type === "victory")
		) {
			this.victorySaved = true;
			this.options.onCheckpoint(
				createAction3dCheckpointState(
					result.state,
					this.options.session.content,
				),
			);
		}
		this.syncVisuals(
			result.state,
			input.cameraYaw,
			this.input.cameraPitch,
			deltaMs,
		);
		this.cameraShakeMs = Math.max(0, this.cameraShakeMs - deltaMs);
		this.scene.render();
		const now = performance.now();
		if (
			now - this.lastSnapshotAt >= 120 ||
			result.state.phase !== this.lastPhase
		) {
			this.lastSnapshotAt = now;
			this.lastPhase = result.state.phase;
			const fps = Math.round(this.engine.getFps());
			const drawCallTotal = this.engine._drawCalls.current;
			const estimatedFrames = Math.max(
				1,
				((now - this.lastDrawSampleAt) * Math.max(1, fps)) / 1000,
			);
			const drawCalls =
				this.lastDrawSampleAt === 0 || drawCallTotal < this.lastDrawCallTotal
					? this.scene.getActiveMeshes().length
					: Math.round(
							(drawCallTotal - this.lastDrawCallTotal) / estimatedFrames,
						);
			this.lastDrawCallTotal = drawCallTotal;
			this.lastDrawSampleAt = now;
			this.updateAdaptiveQuality(fps);
			this.options.onSnapshot({
				state: result.state,
				pointerLocked: this.pointerLocked,
				stats: {
					fps,
					frameTimeMs: Math.round(this.engine.getDeltaTime() * 10) / 10,
					activeMeshes: this.scene.getActiveMeshes().length,
					drawCalls,
				},
			});
		}
	};

	private syncVisuals(
		state: Action3dState,
		cameraYaw: number,
		cameraPitch: number,
		deltaMs: number,
	) {
		if (!this.playerRoot || !this.camera) return;
		this.playerRoot.position.set(
			state.player.position.x,
			state.player.position.y + this.playerGroundOffset,
			state.player.position.z,
		);
		this.playerRoot.rotation.y = state.player.yaw;
		let settledEnemyCount = 0;
		for (const [enemyIndex, enemy] of state.enemies.entries()) {
			const root = this.enemyRoots.get(enemy.id);
			if (!root) continue;
			root.position.set(enemy.position.x, enemy.position.y, enemy.position.z);
			if (enemy.state === "defeated") {
				const elapsedMs =
					(this.enemyDefeatElapsedMs.get(enemy.id) ?? 0) + deltaMs;
				this.enemyDefeatElapsedMs.set(enemy.id, elapsedMs);
				const defeat = getEnemyDefeatPresentation(elapsedMs, enemyIndex);
				root.rotation.set(0, enemy.yaw, defeat.rotationZ);
				if (defeat.settled) settledEnemyCount += 1;
			} else {
				this.enemyDefeatElapsedMs.delete(enemy.id);
				root.rotation.set(0, enemy.yaw, 0);
			}
			const controller = this.enemyAnimationControllers.get(enemy.id);
			if (controller) {
				const animationId =
					enemy.state === "windup" && enemy.stateElapsedMs >= 330
						? "attack"
						: enemy.state;
				controller.select(animationId);
				controller.update(deltaMs);
				root.setEnabled(true);
			} else {
				root.setEnabled(true);
				root.scaling.y = enemy.state === "windup" ? 1.22 : 1;
			}
		}
		this.canvas?.setAttribute(
			"data-action3d-defeated-settled",
			String(settledEnemyCount),
		);
		const animationId =
			state.phase === "defeat"
				? "defeat"
				: state.player.locomotion === "run"
					? "run"
					: state.player.locomotion === "walk"
						? "walk"
						: state.player.locomotion === "jump" ||
								state.player.locomotion === "fall"
							? "jump-loop"
							: state.player.locomotion === "dodge"
								? "dodge"
								: state.player.locomotion === "attack"
									? `attack-${state.player.attackComboIndex + 1}`
									: "idle";
		const clip = this.playerModelAssetId
			? this.options.session.content.getModelClip(
					this.playerModelAssetId,
					animationId,
				)
			: null;
		if (clip) this.animationController?.select(animationId);
		this.animationController?.update(deltaMs);
		if (this.attackEffect) {
			const attackActive =
				state.player.attackElapsedMs !== null &&
				state.player.attackElapsedMs >= 90 &&
				state.player.attackElapsedMs <= 330;
			this.attackEffect.setEnabled(attackActive);
			if (attackActive) {
				const progress = (state.player.attackElapsedMs ?? 0) / 330;
				const combo = state.player.attackComboIndex;
				const comboTilt = [-0.38, 0.4, Math.PI / 2][combo] ?? 0;
				this.attackEffect.scaling.set(
					0.82 + progress * 0.22,
					0.88 + progress * 0.16,
					1,
				);
				this.attackEffect.rotation.z =
					comboTilt + (progress - 0.5) * (combo === 2 ? 0.12 : 0.24);
			}
		}
		const target = new Vector3(
			state.player.position.x,
			state.player.position.y + 1.25,
			state.player.position.z,
		);
		const horizontal = Math.cos(cameraPitch) * 6.5;
		let desired = new Vector3(
			target.x - Math.sin(cameraYaw) * horizontal,
			target.y + 2.2 - Math.sin(cameraPitch) * 4,
			target.z - Math.cos(cameraYaw) * horizontal,
		);
		const world = this.options.session.content.getWorld(state.location.worldId);
		desired.x = Math.min(
			world.bounds.maxX - 0.2,
			Math.max(world.bounds.minX + 0.2, desired.x),
		);
		desired.z = Math.min(
			world.bounds.maxZ - 0.2,
			Math.max(world.bounds.minZ + 0.2, desired.z),
		);
		let collisionRatio = 1;
		for (const collider of world.colliders) {
			const ratio = cameraCollisionRatio(target, desired, collider.bounds);
			if (ratio !== null) collisionRatio = Math.min(collisionRatio, ratio);
		}
		if (collisionRatio < 1)
			desired = Vector3.Lerp(
				target,
				desired,
				Math.max(0.08, collisionRatio - 0.04),
			);
		if (this.cameraShakeMs > 0 && !this.reduceMotion) {
			const strength = (this.cameraShakeMs / 220) * 0.09;
			desired.x += (Math.random() - 0.5) * strength;
			desired.y += (Math.random() - 0.5) * strength;
		}
		this.camera.position = Vector3.Lerp(this.camera.position, desired, 0.16);
		this.camera.setTarget(target);
	}

	private onResize = () => this.engine?.resize();
	private updateAdaptiveQuality(fps: number) {
		if (this.qualityReduced) return;
		this.lowFpsSamples = fps > 0 && fps < 28 ? this.lowFpsSamples + 1 : 0;
		if (this.lowFpsSamples < 20 || !this.engine) return;
		this.qualityReduced = true;
		this.engine.setHardwareScalingLevel(
			Math.max(1, this.engine.getHardwareScalingLevel() * 1.35),
		);
		this.options.onWarning({
			code: "low-performance",
			message: "Rendering resolution was reduced to keep the field responsive.",
			recoverable: true,
		});
	}
	private playEventSound(type: Action3dEvent["type"]) {
		if (this.options.isMuted() || typeof AudioContext === "undefined") return;
		try {
			this.audioContext ??= new AudioContext();
			if (this.audioContext.state === "suspended")
				void this.audioContext.resume();
			const oscillator = this.audioContext.createOscillator();
			const gain = this.audioContext.createGain();
			const frequency =
				type === "enemy-hit"
					? 210
					: type === "player-hit"
						? 92
						: type === "enemy-defeated"
							? 340
							: type === "victory"
								? 520
								: 72;
			oscillator.type = type === "victory" ? "sine" : "triangle";
			oscillator.frequency.value = frequency;
			gain.gain.setValueAtTime(0.045, this.audioContext.currentTime);
			gain.gain.exponentialRampToValueAtTime(
				0.000_1,
				this.audioContext.currentTime + 0.12,
			);
			oscillator.connect(gain).connect(this.audioContext.destination);
			oscillator.start();
			oscillator.stop(this.audioContext.currentTime + 0.12);
		} catch {
			// Audio feedback is optional and never changes the simulation result.
		}
	}
	private onContextLost = (event: Event) => {
		event.preventDefault();
		this.engine?.stopRenderLoop(this.renderFrame);
		this.options.onError({
			code: "context-lost",
			message:
				"The WebGL context was lost. Retry the checkpoint to rebuild the field.",
			recoverable: true,
		});
	};
	private onContextRestored = () =>
		this.options.onWarning({
			code: "context-lost",
			message:
				"WebGL was restored; rebuild the field if rendering does not resume.",
			recoverable: true,
		});
	private onVisibilityChange = () => {
		if (document.hidden) {
			this.hiddenPaused = this.options.session.getState().phase === "playing";
			if (this.hiddenPaused) this.options.session.setPaused(true);
		} else if (this.hiddenPaused) {
			this.options.session.setPaused(false);
			this.hiddenPaused = false;
		}
	};
	resize(_viewport: BrowserGameViewport): void {
		this.onResize();
	}
	dispose(): void {
		if (this.disposed) return;
		this.disposed = true;
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		window.removeEventListener("resize", this.onResize);
		document.removeEventListener("visibilitychange", this.onVisibilityChange);
		this.canvas?.removeEventListener("webglcontextlost", this.onContextLost);
		this.canvas?.removeEventListener(
			"webglcontextrestored",
			this.onContextRestored,
		);
		this.input?.dispose();
		this.animationController?.dispose();
		this.animationController = null;
		for (const controller of this.enemyAnimationControllers.values())
			controller.dispose();
		this.enemyAnimationControllers.clear();
		this.enemyDefeatElapsedMs.clear();
		if (this.audioContext) void this.audioContext.close();
		this.audioContext = null;
		this.engine?.stopRenderLoop(this.renderFrame);
		this.scene?.dispose();
		this.engine?.dispose();
		this.canvas?.remove();
		this.enemyRoots.clear();
		this.enemyFallbackMeshes.clear();
		this.input = null;
		this.scene = null;
		this.engine = null;
		this.canvas = null;
	}
}
