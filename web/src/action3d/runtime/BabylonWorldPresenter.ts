import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import type { Action3dState, Action3dWorld } from "@shared/action3d";

export const createAction3dMaterial = (
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

export type BabylonWorldPresentation = {
	playerRoot: TransformNode;
	attackEffect: Mesh;
	camera: FreeCamera;
	enemyRoots: Map<string, TransformNode>;
	enemyFallbackMeshes: Map<string, Mesh[]>;
};

export const buildBabylonWorld = (
	scene: Scene,
	state: Action3dState,
	world: Action3dWorld,
): BabylonWorldPresentation => {
	const groundMaterial = createAction3dMaterial(
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
	const ruinMaterial = createAction3dMaterial(
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
	const edgeMaterial = createAction3dMaterial(
		scene,
		"FieldEdge",
		new Color3(0.04, 0.12, 0.14),
		new Color3(0.01, 0.08, 0.08),
	);
	const centerX = (world.bounds.minX + world.bounds.maxX) / 2;
	const centerZ = (world.bounds.minZ + world.bounds.maxZ) / 2;
	const worldWidth = world.bounds.maxX - world.bounds.minX;
	const worldDepth = world.bounds.maxZ - world.bounds.minZ;
	for (const [name, x, z, width, depth] of [
		["NorthEdge", centerX, world.bounds.maxZ, worldWidth, 0.35],
		["SouthEdge", centerX, world.bounds.minZ, worldWidth, 0.35],
		["WestEdge", world.bounds.minX, centerZ, 0.35, worldDepth],
		["EastEdge", world.bounds.maxX, centerZ, 0.35, worldDepth],
	] as const) {
		const edge = MeshBuilder.CreateBox(
			name,
			{ width, height: 1.2, depth },
			scene,
		);
		edge.position.set(x, 0.6, z);
		edge.material = edgeMaterial;
	}
	const crystalMaterial = createAction3dMaterial(
		scene,
		"BeaconCrystal",
		new Color3(0.12, 0.72, 0.7),
		new Color3(0.04, 0.35, 0.34),
	);
	const woodMaterial = createAction3dMaterial(
		scene,
		"TreeTrunk",
		new Color3(0.23, 0.15, 0.09),
	);
	const leafMaterial = createAction3dMaterial(
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

	const enemyRoots = new Map<string, TransformNode>();
	const enemyFallbackMeshes = new Map<string, Mesh[]>();
	const enemyMaterial = createAction3dMaterial(
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
		enemyFallbackMeshes.set(enemy.id, [body, eye]);
		enemyRoots.set(enemy.id, root);
	}
	const playerRoot = new TransformNode("PlayerVisualRoot", scene);
	const attackMaterial = createAction3dMaterial(
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
	const attackEffect = MeshBuilder.CreateTube(
		"PlayerAttackArc",
		{ path: attackPath, radius: 0.045, tessellation: 7 },
		scene,
	);
	attackEffect.parent = playerRoot;
	attackEffect.position.y = 0.72;
	attackEffect.material = attackMaterial;
	attackEffect.setEnabled(false);
	const camera = new FreeCamera(
		"ThirdPersonCamera",
		new Vector3(0, 4, -8),
		scene,
	);
	camera.minZ = 0.1;
	camera.fov = 0.9;
	scene.activeCamera = camera;
	new HemisphericLight("SkyLight", new Vector3(0.2, 1, 0.1), scene).intensity =
		0.9;
	const sun = new DirectionalLight(
		"SunLight",
		new Vector3(-0.5, -1, 0.45),
		scene,
	);
	sun.position = new Vector3(8, 14, -8);
	sun.intensity = 1.1;
	return {
		playerRoot,
		attackEffect,
		camera,
		enemyRoots,
		enemyFallbackMeshes,
	};
};
