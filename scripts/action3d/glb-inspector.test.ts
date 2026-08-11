import { describe, expect, it } from "vitest";
import { parseAction3dGlb } from "./glb-inspector";

const chunk = (type: number, bytes: Uint8Array) => {
	const padding = (4 - (bytes.byteLength % 4)) % 4;
	const output = new Uint8Array(8 + bytes.byteLength + padding);
	const view = new DataView(output.buffer);
	view.setUint32(0, bytes.byteLength + padding, true);
	view.setUint32(4, type, true);
	output.set(bytes, 8);
	output.fill(type === 0x4e4f_534a ? 0x20 : 0, 8 + bytes.byteLength);
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
	return output.buffer;
};

describe("parseAction3dGlb", () => {
	it("reports names, budgets, animation duration, skin, and transformed bounds", () => {
		const report = parseAction3dGlb(
			glb({
				asset: { version: "2.0", generator: "fixture" },
				scene: 0,
				scenes: [{ nodes: [0] }],
				nodes: [
					{ name: "Root", translation: [1, 2, 3], children: [1] },
					{ name: "Body", mesh: 0 },
				],
				meshes: [
					{ primitives: [{ attributes: { POSITION: 0, JOINTS_0: 1 }, indices: 2 }] },
				],
				accessors: [
					{ count: 4, min: [-1, 0, -0.5], max: [1, 2, 0.5] },
					{ count: 4 },
					{ count: 6 },
					{ count: 2, min: [0], max: [1.25] },
				],
				materials: [{ name: "BodyMaterial" }],
				animations: [{ name: "Idle", samplers: [{ input: 3 }] }],
				skins: [{ name: "Rig", joints: [0, 1] }],
			}),
		);
		expect(report).toMatchObject({
			generator: "fixture",
			nodes: ["Root", "Body"],
			meshNodes: ["Body"],
			materials: ["BodyMaterial"],
			clips: [{ name: "Idle", durationMs: 1_250 }],
			skeletons: [{ name: "Rig", bones: 2 }],
			triangles: 2,
			primitives: 1,
			maxBoneInfluences: 4,
		});
		expect(report.bounds).toMatchObject({ width: 2, height: 2, depth: 1 });
		expect(report.bounds?.min).toEqual([0, 2, 2.5]);
	});

	it("rejects non-GLB and inconsistent headers", () => {
		expect(() => parseAction3dGlb(new ArrayBuffer(12))).toThrow("binary glTF");
		const value = glb({ asset: { version: "2.0" } });
		new DataView(value).setUint32(8, 12, true);
		expect(() => parseAction3dGlb(value)).toThrow("header length");
	});
});
