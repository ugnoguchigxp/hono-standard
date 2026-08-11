import "@babylonjs/loaders/glTF";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { ImportMeshAsync } from "@babylonjs/core/Loading/sceneLoader";
import { Scene } from "@babylonjs/core/scene";
import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import {
	createAction3dCheckpointState,
	type Action3dState,
} from "@shared/action3d";
import type {
	BrowserGameRuntime,
	BrowserGameViewport,
} from "../../game-platform";
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

export class Action3dGame implements BrowserGameRuntime {
	private engine: Engine | null = null;
	private scene: Scene | null = null;
	private canvas: HTMLCanvasElement | null = null;
	private input: Action3dInputController | null = null;
	private playerRoot: TransformNode | null = null;
	private camera: FreeCamera | null = null;
	private readonly enemyRoots = new Map<string, TransformNode>();
	private animationGroups: AnimationGroup[] = [];
	private activeAnimation = "";
	private lastSnapshotAt = 0;
	private lastPhase = "";
	private pointerLocked = false;
	private victorySaved = false;
	private disposed = false;
	private hiddenPaused = false;
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
			this.scene = new Scene(this.engine);
			this.scene.clearColor = new Color4(0.025, 0.06, 0.1, 1);
			this.scene.fogMode = Scene.FOGMODE_EXP2;
			this.scene.fogDensity = 0.012;
			this.scene.fogColor = new Color3(0.06, 0.15, 0.18);
			this.input = new Action3dInputController(canvas, (locked) => {
				this.pointerLocked = locked;
			});
			this.buildWorld(this.scene);
			await this.buildPlayer(this.scene);
			if (signal.aborted || this.disposed) return;
			this.engine.runRenderLoop(this.renderFrame);
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
			this.enemyRoots.set(enemy.id, root);
		}
		this.playerRoot = new TransformNode("PlayerVisualRoot", scene);
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

	private async buildPlayer(scene: Scene): Promise<void> {
		if (!this.playerRoot) return;
		const state = this.options.session.getState();
		const world = this.options.session.content.getWorld(state.location.worldId);
		const asset = this.options.session.content.getAsset(
			world.playerModelAssetId,
		);
		try {
			const result = await ImportMeshAsync(asset.url, scene);
			for (const mesh of result.meshes)
				if (!mesh.parent) mesh.parent = this.playerRoot;
			this.animationGroups = result.animationGroups;
			this.playerRoot.scaling.setAll(0.78);
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
		const result = this.options.session.advance(
			Math.min(100, this.engine.getDeltaTime()),
			input,
		);
		for (const event of result.events) this.options.onEvent(event);
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
		this.syncVisuals(result.state, input.cameraYaw, this.input.cameraPitch);
		this.scene.render();
		const now = performance.now();
		if (
			now - this.lastSnapshotAt >= 120 ||
			result.state.phase !== this.lastPhase
		) {
			this.lastSnapshotAt = now;
			this.lastPhase = result.state.phase;
			this.options.onSnapshot({
				state: result.state,
				pointerLocked: this.pointerLocked,
				stats: {
					fps: Math.round(this.engine.getFps()),
					activeMeshes: this.scene.getActiveMeshes().length,
					drawCalls: this.engine._drawCalls.current,
				},
			});
		}
	};

	private syncVisuals(
		state: Action3dState,
		cameraYaw: number,
		cameraPitch: number,
	) {
		if (!this.playerRoot || !this.camera) return;
		this.playerRoot.position.set(
			state.player.position.x,
			state.player.position.y,
			state.player.position.z,
		);
		this.playerRoot.rotation.y = state.player.yaw;
		for (const enemy of state.enemies) {
			const root = this.enemyRoots.get(enemy.id);
			if (!root) continue;
			root.position.set(enemy.position.x, enemy.position.y, enemy.position.z);
			root.rotation.y = enemy.yaw;
			root.setEnabled(enemy.state !== "defeated");
			root.scaling.y = enemy.state === "windup" ? 1.22 : 1;
		}
		const animationName =
			state.player.locomotion === "run"
				? "Run"
				: state.player.locomotion === "walk"
					? "Walk"
					: state.player.locomotion === "jump" ||
							state.player.locomotion === "fall"
						? "Jump"
						: state.player.locomotion === "dodge"
							? "Dodge"
							: state.player.locomotion === "attack"
								? "Attack"
								: "Idle";
		if (this.activeAnimation !== animationName) {
			for (const group of this.animationGroups) group.stop();
			this.animationGroups
				.find((group) => group.name === animationName)
				?.play(
					animationName === "Idle" ||
						animationName === "Walk" ||
						animationName === "Run",
				);
			this.activeAnimation = animationName;
		}
		const target = new Vector3(
			state.player.position.x,
			state.player.position.y + 1.25,
			state.player.position.z,
		);
		const horizontal = Math.cos(cameraPitch) * 6.5;
		const desired = new Vector3(
			target.x - Math.sin(cameraYaw) * horizontal,
			target.y + 2.2 - Math.sin(cameraPitch) * 4,
			target.z - Math.cos(cameraYaw) * horizontal,
		);
		this.camera.position = Vector3.Lerp(this.camera.position, desired, 0.16);
		this.camera.setTarget(target);
	}

	private onResize = () => this.engine?.resize();
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
		window.removeEventListener("resize", this.onResize);
		document.removeEventListener("visibilitychange", this.onVisibilityChange);
		this.canvas?.removeEventListener("webglcontextlost", this.onContextLost);
		this.canvas?.removeEventListener(
			"webglcontextrestored",
			this.onContextRestored,
		);
		this.input?.dispose();
		this.engine?.stopRenderLoop(this.renderFrame);
		this.scene?.dispose();
		this.engine?.dispose();
		this.canvas?.remove();
		this.enemyRoots.clear();
		this.animationGroups = [];
		this.input = null;
		this.scene = null;
		this.engine = null;
		this.canvas = null;
	}
}
