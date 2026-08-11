import "@babylonjs/loaders/glTF/2.0/glTFLoader";
import type { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import {
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
import { Action3dAudioBus } from "./Action3dAudioBus";
import { Action3dInputController } from "./Action3dInputController";
import { BabylonAssetCache } from "./BabylonAssetCache";
import { syncBabylonCamera } from "./BabylonCameraRig";
import {
	buildBabylonWorld,
	createAction3dMaterial,
} from "./BabylonWorldPresenter";
import type { Action3dRuntimeOptions } from "./types";

export class Action3dGame implements BrowserGameRuntime {
	private engine: Engine | null = null;
	private scene: Scene | null = null;
	private canvas: HTMLCanvasElement | null = null;
	private input: Action3dInputController | null = null;
	private playerRoot: TransformNode | null = null;
	private camera: FreeCamera | null = null;
	private attackEffect: Mesh | null = null;
	private assetCache: BabylonAssetCache | null = null;
	private readonly projectileMeshes = new Map<string, Mesh>();
	private resizeObserver: ResizeObserver | null = null;
	private enemyRoots = new Map<string, TransformNode>();
	private enemyFallbackMeshes = new Map<string, Mesh[]>();
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
	private readonly audioBus = new Action3dAudioBus();
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
			this.assetCache = new BabylonAssetCache(this.scene);
			this.scene.clearColor = new Color4(0.025, 0.06, 0.1, 1);
			this.scene.fogMode = Scene.FOGMODE_EXP2;
			this.scene.fogDensity = 0.012;
			this.scene.fogColor = new Color3(0.06, 0.15, 0.18);
			this.input = new Action3dInputController(canvas, (locked) => {
				this.pointerLocked = locked;
			});
			this.buildWorld(this.scene);
			await Promise.all([this.buildPlayer(this.scene), this.buildEnemies()]);
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
		const presentation = buildBabylonWorld(scene, state, world);
		this.playerRoot = presentation.playerRoot;
		this.attackEffect = presentation.attackEffect;
		this.camera = presentation.camera;
		this.enemyRoots = presentation.enemyRoots;
		this.enemyFallbackMeshes = presentation.enemyFallbackMeshes;
	}

	private async buildEnemies(): Promise<void> {
		const state = this.options.session.getState();
		await Promise.all(
			state.enemies.map(async (enemy) => {
				const root = this.enemyRoots.get(enemy.id);
				if (!root) return;
				const archetype = this.options.session.content.getEnemyArchetype(
					enemy.archetypeId,
				);
				const asset = this.options.session.content.getAsset(
					archetype.modelAssetId,
				);
				if (asset.type !== "model")
					throw new Error(`Action3D asset '${asset.id}' is not a model.`);
				try {
					const result = await this.assetCache?.instantiate(
						asset.url,
						enemy.id,
					);
					if (!result) return;
					for (const node of result.rootNodes) node.parent = root;
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
			const result = await this.assetCache?.instantiate(asset.url, "player");
			if (!result) return;
			for (const node of result.rootNodes) node.parent = this.playerRoot;
			this.animationController = createAction3dAnimationController(
				asset,
				result.animationGroups.map(createBabylonAnimationHandle),
			);
			this.playerModelAssetId = asset.id;
			this.playerGroundOffset = asset.model.transform.groundOffset;
			this.playerRoot.scaling.setAll(asset.model.transform.unitMeters);
		} catch {
			const material = createAction3dMaterial(
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
		const preStepState = this.options.session.getFrameState();
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
			const paused = preStepState.phase === "paused";
			this.options.session.setPaused(!paused);
			if (!paused && document.pointerLockElement === this.canvas)
				void document.exitPointerLock();
		}
		const deltaMs = Math.min(100, this.engine.getDeltaTime());
		const result = this.options.session.advanceFrame(deltaMs, input);
		for (const event of result.events) {
			this.options.onEvent(event);
			this.audioBus.play(event.type, this.options.isMuted());
			if (event.type === "enemy-hit") this.cameraShakeMs = 130;
			if (event.type === "player-hit") this.cameraShakeMs = 220;
			if (event.type === "world-transition-requested")
				this.options.onWorldTransition(event.worldId, event.spawnId);
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
			now - this.lastSnapshotAt >= 200 ||
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
				state: this.options.session.getState(),
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
		state: Readonly<Action3dState>,
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
		const synchronizeProjectiles =
			state.projectiles.length > 0 || this.projectileMeshes.size > 0;
		const activeProjectileIds = synchronizeProjectiles
			? new Set(state.projectiles.map(({ id }) => id))
			: null;
		for (const projectile of state.projectiles) {
			let mesh = this.projectileMeshes.get(projectile.id);
			if (!mesh && this.scene) {
				mesh = MeshBuilder.CreatePolyhedron(
					projectile.id,
					{ type: 1, size: projectile.radius * 2.4 },
					this.scene,
				);
				mesh.material = createAction3dMaterial(
					this.scene,
					`${projectile.id}-material`,
					new Color3(0.95, 0.36, 0.1),
					new Color3(0.72, 0.08, 0.01),
				);
				this.projectileMeshes.set(projectile.id, mesh);
			}
			mesh?.position.set(
				projectile.position.x,
				projectile.position.y,
				projectile.position.z,
			);
		}
		for (const [id, mesh] of this.projectileMeshes)
			if (!activeProjectileIds?.has(id)) {
				mesh.dispose(false, true);
				this.projectileMeshes.delete(id);
			}
		this.canvas?.setAttribute(
			"data-action3d-defeated-settled",
			String(settledEnemyCount),
		);
		const attackAnimationId = state.player.activeAttackId
			? this.options.session.content.getAttack(state.player.activeAttackId)
					.animationId
			: null;
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
									? (attackAnimationId ?? "attack-1")
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
			const attack = state.player.activeAttackId
				? this.options.session.content.getAttack(state.player.activeAttackId)
				: null;
			const attackActive = Boolean(
				attack &&
					state.player.attackElapsedMs !== null &&
					state.player.attackElapsedMs >= attack.startupMs &&
					state.player.attackElapsedMs <= attack.startupMs + attack.activeMs,
			);
			this.attackEffect.setEnabled(attackActive);
			if (attackActive) {
				const progress = Math.min(
					1,
					(state.player.attackElapsedMs ?? 0) /
						Math.max(1, (attack?.startupMs ?? 0) + (attack?.activeMs ?? 1)),
				);
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
		const world = this.options.session.content.getWorld(state.location.worldId);
		syncBabylonCamera(
			this.camera,
			state,
			world,
			cameraYaw,
			cameraPitch,
			this.cameraShakeMs,
			this.reduceMotion,
		);
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
			this.hiddenPaused =
				this.options.session.getFrameState().phase === "playing";
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
		for (const mesh of this.projectileMeshes.values())
			mesh.dispose(false, true);
		this.projectileMeshes.clear();
		this.assetCache?.dispose();
		this.assetCache = null;
		this.audioBus.dispose();
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
