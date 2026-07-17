import { describe, expect, it } from "vitest";
import { z } from "zod";
import { defineFrontendVisualization } from "./visualization-types";
import { FrontendVisualizationRegistry } from "./visualization-registry";

const definition = () => defineFrontendVisualization({ descriptor: { type: "test.table", displayName: "Test", description: "", category: "data", configSchemaVersion: 1, presets: [{ id: "default", displayName: "Default", description: "" }], defaultPreset: "default", supportedShapes: ["table"], minimumSize: { w: 1, h: 1 }, recommendedSize: { w: 2, h: 2 }, capabilities: { legend: false, tooltip: false, sharedCrosshair: false, zoom: false, rangeSelection: false, annotations: false, fieldOverrides: true, tableFallback: true, exportImage: false, exportData: true, mobileSummary: true } }, configSchema: z.object({}).strict(), defaultOptionsByPreset: { default: {} }, load: async () => ({ Renderer: () => null, buildAccessibleSummary: () => "" }), loadPolicy: "immediate" });
const frame = { schemaVersion: 2 as const, refId: "A", source: { kind: "query" as const, refId: "A" }, name: "T", fields: [{ key: "value", label: "Value", type: "number" as const, values: [1], roles: ["value" as const], labels: {}, config: undefined }], meta: { shapeHint: "table" as const } };
const spec = () => ({ type: "test.table", frameRefs: ["A"] as string[], options: {}, fieldConfig: { unit: { kind: "none" as const }, decimals: "auto" as const, noValueText: "—", textAlign: "auto" as const, valueMappings: [], links: [] }, overrides: [], tableFallback: { enabled: true, defaultView: "visualization" as const } });

describe("FrontendVisualizationRegistry", () => {
	it("isolates unknown and invalid config", async () => { const registry = new FrontendVisualizationRegistry([definition()]); expect(registry.resolve({ spec: { ...spec(), type: "missing" }, frames: [frame] }).status).toBe("unknown-type"); expect(registry.resolve({ spec: { ...spec(), options: { bad: true } }, frames: [frame] }).status).toBe("invalid-config"); expect(registry.resolve({ spec: { ...spec(), frameRefs: ["missing"] }, frames: [frame] }).status).toBe("missing-frame"); expect(registry.resolve({ spec: spec(), frames: [{ ...frame, meta: { shapeHint: "category" as const } }] }).status).toBe("incompatible-shape"); expect(registry.resolve({ spec: spec(), frames: [frame] }).status).toBe("ready"); const first = registry.load("test.table"); expect(await registry.load("test.table")).toBe(await first); await expect(registry.load("missing")).rejects.toThrow("unknown visualization"); });
	it("rejects malformed definitions and retries failed loads", async () => { expect(() => new FrontendVisualizationRegistry([{ ...definition(), descriptor: { ...definition().descriptor, presets: [{ id: "default", displayName: "Default", description: "" }, { id: "default", displayName: "Duplicate", description: "" }] } }])).toThrow(/preset/); const failing = { ...definition(), descriptor: { ...definition().descriptor, type: "test.fail" }, load: async () => { throw new Error("load failed"); } }; const registry = new FrontendVisualizationRegistry([failing]); await expect(registry.load("test.fail")).rejects.toThrow("load failed"); expect(registry.hasFailedLoad("test.fail")).toBe(true); registry.clearFailedLoad("test.fail"); expect(registry.hasFailedLoad("test.fail")).toBe(false); });
	it("rejects duplicate types", () => expect(() => new FrontendVisualizationRegistry([definition(), definition()])).toThrow(/duplicate/));
	it("runs validation that depends on the resolved visualization spec", () => {
		const resolvedDefinition = defineFrontendVisualization({
			...definition(),
			validateResolvedFrames: (_frames, _config, _preset, resolvedSpec) =>
				resolvedSpec.fieldConfig.unit.kind === "none"
					? "resolved config rejected"
					: undefined,
		});
		const resolution = new FrontendVisualizationRegistry([
			resolvedDefinition,
		]).resolve({ spec: spec(), frames: [frame] });
		expect(resolution.status).toBe("incompatible-shape");
		if (resolution.status !== "incompatible-shape") return;
		expect(resolution.message).toMatch(/resolved config/);
	});
	it("isolates invalid annotation layers and enforces the cumulative limit", () => {
		const annotatedDefinition = defineFrontendVisualization({
			...definition(),
			descriptor: {
				...definition().descriptor,
				capabilities: { ...definition().descriptor.capabilities, annotations: true },
			},
		});
		const registry = new FrontendVisualizationRegistry([annotatedDefinition]);
		const layer = (id: string, frameRef: string) => ({ id, frameRef, mode: "point" as const, enabled: true, name: id, severityFilter: [], showLabel: "always" as const });
		const annotationFrame = (refId: string, count: number, message = "event") => ({
			schemaVersion: 2 as const,
			refId,
			source: { kind: "query" as const, refId },
			name: "Annotations",
			fields: [
				{ key: "time", label: "Time", type: "time" as const, values: Array.from({ length: count }, (_, index) => index), roles: ["time" as const], labels: {} },
				{ key: "message", label: "Message", type: "string" as const, values: Array.from({ length: count }, () => message), roles: ["message" as const], labels: {} },
			],
			meta: { shapeHint: "annotation" as const },
		});
		const invalid = registry.resolve({
			spec: { ...spec(), annotationLayers: [layer("bad", "B")] },
			frames: [frame, annotationFrame("B", 1, " ")],
		});
		expect(invalid.status).toBe("ready");
		expect(invalid.annotationLayers).toHaveLength(0);
		expect(invalid.annotationNotices[0]?.code).toBe("ANNOTATION_FRAME_INVALID");

		const limited = registry.resolve({
			spec: { ...spec(), annotationLayers: [layer("one", "B"), layer("two", "C")] },
			frames: [frame, annotationFrame("B", 300), annotationFrame("C", 300)],
		});
		expect(limited.status).toBe("incompatible-shape");
		if (limited.status === "incompatible-shape")
			expect(limited.message).toMatch(/limit/i);
	});
});
