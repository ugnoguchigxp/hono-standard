import { describe, expect, it } from "vitest";
import type { Action3dAsset } from "../shared/action3d";
import { validateAction3dModel } from "./validate-action3d-models";

const chunk = (type: number, bytes: Uint8Array) => {
	const padding = (4 - (bytes.byteLength % 4)) % 4;
	const output = new Uint8Array(8 + bytes.byteLength + padding);
	new DataView(output.buffer).setUint32(0, bytes.byteLength + padding, true);
	new DataView(output.buffer).setUint32(4, type, true);
	output.set(bytes, 8);
	output.fill(0x20, 8 + bytes.byteLength);
	return output;
};
const glb = (document: unknown) => {
	const json = chunk(0x4e4f_534a, new TextEncoder().encode(JSON.stringify(document)));
	const output = new Uint8Array(12 + json.byteLength);
	const view = new DataView(output.buffer);
	view.setUint32(0, 0x4654_6c67, true);
	view.setUint32(4, 2, true);
	view.setUint32(8, output.byteLength, true);
	output.set(json, 12);
	return output;
};

const fixture = glb({
	asset: { version: "2.0" },
	scene: 0,
	scenes: [{ nodes: [0] }],
	nodes: [
		{ name: "RunnerRoot", children: [1, 2] },
		{ name: "Body", mesh: 0 },
		{ name: "socket.weapon.right" },
	],
	meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
	accessors: [
		{ count: 4, min: [-0.5, 0, -0.25], max: [0.5, 2, 0.25] },
		{ count: 6 },
		{ count: 2, min: [0], max: [1] },
	],
	materials: [{ name: "Runner.Body" }],
	animations: [{ name: "Idle", samplers: [{ input: 2 }] }],
});
const sparseSkinnedFixture = glb({
	asset: { version: "2.0" },
	scene: 0,
	scenes: [{ nodes: [0] }],
	nodes: [
		{ name: "RunnerRoot", children: [1, 2] },
		{ name: "Body", mesh: 0 },
		{ name: "socket.weapon.right" },
	],
	meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
	accessors: [
		{ count: 4, min: [-0.5, 0, -0.25], max: [0.5, 2, 0.25] },
		{ count: 6 },
		{ count: 2, min: [0], max: [1] },
	],
	materials: [{ name: "Runner.Body" }],
	animations: [
		{
			name: "Idle",
			samplers: [{ input: 2 }],
			channels: [
				{ target: { node: 0, path: "rotation" } },
				{ target: { node: 0, path: "translation" } },
			],
		},
	],
	skins: [{ name: "RunnerRig", joints: [0, 2] }],
});
const model = {
	id: "runner",
	type: "model",
	url: "/assets/action3d/runner.glb",
	bytes: fixture.byteLength,
	sha256: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
	license: "MIT",
	source: { label: "Fixture", revision: "test" },
	exportedBy: { tool: "Fixture", version: "1" },
	model: {
		role: "diagnostic",
		maturity: "diagnostic",
		rootNode: "RunnerRoot",
		skeletonRoot: null,
		meshNodes: ["Body"],
		clips: [{ id: "idle", name: "Idle", loop: true, durationMs: { min: 900, max: 1_100 } }],
		sockets: [{ id: "socket.weapon.right", node: "socket.weapon.right" }],
		materials: [{ id: "body", name: "Runner.Body" }],
		transform: { upAxis: "Y", forwardAxis: "Z", unitMeters: 1, groundOffset: 0, boundsMeters: { width: 1, height: 2, depth: 0.5 } },
		budget: { maxTransferBytes: 10_000, maxTriangles: 10, maxPrimitives: 2, maxMaterials: 2, maxTextures: 0, maxTextureSize: 2_048, maxBones: 0, maxBoneInfluences: 0 },
	},
} satisfies Extract<Action3dAsset, { type: "model" }>;

describe("validateAction3dModel", () => {
	it("accepts a GLB that satisfies its semantic contract", () => {
		expect(validateAction3dModel(model, fixture, "fixture", false).issues).toEqual([]);
	});

	it("reports missing semantic members and budget violations", () => {
		const invalid = {
			...model,
			model: {
				...model.model,
				rootNode: "Missing",
				clips: [{ ...model.model.clips[0], name: "Run" }],
				budget: { ...model.model.budget, maxTriangles: 1 },
			},
		};
		const issues = validateAction3dModel(invalid, fixture, "fixture", false).issues;
		expect(issues).toEqual(
			expect.arrayContaining([
				expect.stringContaining("root node 'Missing'"),
				expect.stringContaining("clip 'Run'"),
				expect.stringContaining("triangles 2 exceeds"),
			]),
		);
	});

	it("rejects clips that leave part of a skeleton in the previous pose", () => {
		const skinnedModel = {
			...model,
			bytes: sparseSkinnedFixture.byteLength,
			model: {
				...model.model,
				skeletonRoot: "RunnerRoot",
				budget: { ...model.model.budget, maxBones: 2 },
			},
		};
		const issues = validateAction3dModel(
			skinnedModel,
			sparseSkinnedFixture,
			"fixture",
			false,
		).issues;
		expect(issues).toContainEqual(
			expect.stringContaining("every clip must own the complete pose"),
		);
	});
});
