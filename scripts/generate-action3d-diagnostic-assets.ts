import { mkdir } from "node:fs/promises";
import path from "node:path";
import { Animation } from "@babylonjs/core/Animations/animation";
import { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { GLTF2Export } from "@babylonjs/serializers/glTF/2.0/glTFSerializer";

const engine = new NullEngine({
	renderWidth: 256,
	renderHeight: 256,
	textureSize: 256,
	deterministicLockstep: true,
	lockstepMaxSteps: 4,
});
const scene = new Scene(engine);
const root = new TransformNode("Action3dDiagnosticAvatarRoot", scene);
const material = (name: string, color: Color3) => {
	const value = new StandardMaterial(name, scene);
	value.diffuseColor = color;
	value.specularColor = new Color3(0.08, 0.08, 0.08);
	return value;
};
const teal = material("FieldTeal", new Color3(0.08, 0.58, 0.58));
const dark = material("FieldDark", new Color3(0.04, 0.09, 0.14));
const skin = material("FieldSkin", new Color3(0.9, 0.67, 0.48));
const gold = material("FieldGold", new Color3(0.95, 0.72, 0.16));
const addPart = (
	mesh: ReturnType<typeof MeshBuilder.CreateBox>,
	position: Vector3,
	assigned: StandardMaterial,
) => {
	mesh.parent = root;
	mesh.position = position;
	mesh.material = assigned;
	return mesh;
};
addPart(
	MeshBuilder.CreateCapsule(
		"Body",
		{ height: 1.35, radius: 0.36, tessellation: 8 },
		scene,
	),
	new Vector3(0, 1.28, 0),
	teal,
);
addPart(
	MeshBuilder.CreateSphere("Head", { diameter: 0.62, segments: 8 }, scene),
	new Vector3(0, 2.16, 0),
	skin,
);
addPart(
	MeshBuilder.CreateBox(
		"Hair",
		{ width: 0.66, height: 0.23, depth: 0.62 },
		scene,
	),
	new Vector3(0, 2.42, -0.03),
	dark,
);
addPart(
	MeshBuilder.CreateBox(
		"Cape",
		{ width: 0.72, height: 1.12, depth: 0.12 },
		scene,
	),
	new Vector3(0, 1.35, -0.33),
	dark,
);
addPart(
	MeshBuilder.CreateCapsule(
		"LeftLeg",
		{ height: 0.95, radius: 0.13, tessellation: 6 },
		scene,
	),
	new Vector3(-0.18, 0.46, 0),
	dark,
);
addPart(
	MeshBuilder.CreateCapsule(
		"RightLeg",
		{ height: 0.95, radius: 0.13, tessellation: 6 },
		scene,
	),
	new Vector3(0.18, 0.46, 0),
	dark,
);
addPart(
	MeshBuilder.CreateCapsule(
		"Sword",
		{ height: 1.35, radius: 0.055, tessellation: 6 },
		scene,
	),
	new Vector3(0.48, 1.25, 0),
	gold,
).rotation.z = -0.35;

const addAnimation = (
	name: string,
	property: string,
	frames: Array<{ frame: number; value: number }>,
	loop = true,
) => {
	const animation = new Animation(
		`${name}Track`,
		property,
		30,
		Animation.ANIMATIONTYPE_FLOAT,
		loop
			? Animation.ANIMATIONLOOPMODE_CYCLE
			: Animation.ANIMATIONLOOPMODE_CONSTANT,
	);
	animation.setKeys(frames);
	const group = new AnimationGroup(name, scene);
	group.addTargetedAnimation(animation, root);
};
addAnimation("Idle", "position.y", [
	{ frame: 0, value: 0 },
	{ frame: 15, value: 0.035 },
	{ frame: 30, value: 0 },
]);
addAnimation("Walk", "rotation.y", [
	{ frame: 0, value: -0.06 },
	{ frame: 8, value: 0.06 },
	{ frame: 16, value: -0.06 },
]);
addAnimation("Run", "position.y", [
	{ frame: 0, value: 0 },
	{ frame: 5, value: 0.09 },
	{ frame: 10, value: 0 },
]);
addAnimation(
	"Jump",
	"position.y",
	[
		{ frame: 0, value: 0 },
		{ frame: 8, value: 0.22 },
		{ frame: 16, value: 0 },
	],
	false,
);
addAnimation(
	"Dodge",
	"rotation.y",
	[
		{ frame: 0, value: 0 },
		{ frame: 12, value: Math.PI * 2 },
	],
	false,
);
addAnimation(
	"Attack",
	"rotation.y",
	[
		{ frame: 0, value: 0 },
		{ frame: 5, value: -0.55 },
		{ frame: 11, value: 0.7 },
		{ frame: 18, value: 0 },
	],
	false,
);

const exported = await GLTF2Export.GLBAsync(
	scene,
	"action3d-diagnostic-avatar",
	{
		exportWithoutWaitingForScene: true,
	},
);
const blob = exported.files["action3d-diagnostic-avatar.glb"];
if (!(blob instanceof Blob))
	throw new Error("Babylon did not produce action3d-diagnostic-avatar.glb.");
const outputDirectory = path.join(
	process.cwd(),
	"web",
	"public",
	"assets",
	"action3d",
	"diagnostic",
);
await mkdir(outputDirectory, { recursive: true });
const outputPath = path.join(outputDirectory, "action3d-diagnostic-avatar.glb");
await Bun.write(outputPath, blob);
console.log(`OK generated ${outputPath} (${blob.size} bytes)`);
scene.dispose();
engine.dispose();
