import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createDashboardModule } from "..";
import { nativeTransformations, nativeV2Fixture, nativeVisualization } from "./test-fixtures";

describe("v2 dashboard registry", () => {
	it("validates the graph and sanitizes public manifests", () => {
		const module = createDashboardModule({ nativeDashboards: [nativeV2Fixture()], visualizations: [nativeVisualization], transformations: nativeTransformations });
		const manifest = module.v2Registry.getPublicManifest("native-v2");
		expect(manifest?.variables.find((variable) => variable.id === "service")?.source).toEqual({ kind: "static" });
		expect(module.v2Registry.validatePanelFilters("native-v2", { service: ["api"], region: ["global"] })).toEqual({ service: ["api"], region: ["global"] });
		expect(() => module.v2Registry.validatePanelFilters("native-v2", { unknown: ["x"] })).toThrow();
		expect(() => module.v2Registry.validateVariableDependencyFilters("native-v2", "region", {})).toThrow(expect.objectContaining({ code: "VARIABLE_DEPENDENCY_INVALID" }));
		const clone = module.v2Registry.getPublicManifest("native-v2");
		if (!clone) throw new Error("missing manifest");
		clone.title = "mutated";
		expect(module.v2Registry.getPublicManifest("native-v2")?.title).toBe("Native v2 fixture");
	});
	it("rejects duplicate registrations and invalid static values", () => {
		const dashboard = nativeV2Fixture();
		expect(() => createDashboardModule({ nativeDashboards: [dashboard, dashboard], visualizations: [nativeVisualization], transformations: nativeTransformations })).toThrow();
		const invalid = nativeV2Fixture();
		invalid.variables[0]!.options = async () => [];
		expect(() => createDashboardModule({ nativeDashboards: [invalid], visualizations: [nativeVisualization], transformations: nativeTransformations })).toThrow();
		const duplicateFilter = nativeV2Fixture();
		duplicateFilter.queries[0]!.filterKeys = ["service", "service"];
		expect(() => createDashboardModule({ nativeDashboards: [duplicateFilter], visualizations: [nativeVisualization], transformations: nativeTransformations })).toThrow(/Duplicate query filter/);
		const mismatchedVariable = nativeV2Fixture();
		mismatchedVariable.variables[0]!.manifest = { ...mismatchedVariable.variables[0]!.manifest, label: "Mismatch" };
		expect(() => createDashboardModule({ nativeDashboards: [mismatchedVariable], visualizations: [nativeVisualization], transformations: nativeTransformations })).toThrow(/Variable manifest mismatch/);
		const mismatchedPreserve = nativeV2Fixture();
		mismatchedPreserve.manifest.panels[0]!.transformations[1]!.inputFrameRefs = ["A", "B"];
		expect(() => createDashboardModule({ nativeDashboards: [mismatchedPreserve], visualizations: [nativeVisualization], transformations: nativeTransformations })).toThrow(/same shape/);
	});

	it("validates variable query references and enabled defaults", () => {
		const unknownQuery = nativeV2Fixture();
		const querySource = { kind: "query" as const, queryId: "missing-query" };
		unknownQuery.manifest.variables[1]!.source = querySource;
		unknownQuery.variables[1]!.manifest.source = querySource;
		expect(() => createDashboardModule({ nativeDashboards: [unknownQuery], visualizations: [nativeVisualization], transformations: nativeTransformations })).toThrow(/Unknown variable query/);

		const disabledDefault = nativeV2Fixture();
		const staticSource = { kind: "static" as const, options: [{ value: "api", label: "API", disabled: true }] };
		disabledDefault.manifest.variables[0]!.source = staticSource;
		disabledDefault.variables[0]!.manifest.source = staticSource;
		expect(() => createDashboardModule({ nativeDashboards: [disabledDefault], visualizations: [nativeVisualization], transformations: nativeTransformations })).toThrow(/default is disabled/);
	});

	it("validates visualization minimum layout dimensions", () => {
		const tooSmall = nativeV2Fixture();
		tooSmall.manifest.panels[0]!.layout = { x: 0, y: 0, w: 1, h: 1, minW: 1, minH: 1 };
		const visualization = { ...nativeVisualization, descriptor: { ...nativeVisualization.descriptor, minimumSize: { w: 2, h: 1 } } };
		expect(() => createDashboardModule({ nativeDashboards: [tooSmall], visualizations: [visualization], transformations: nativeTransformations })).toThrow(/smaller than visualization minimum/);
	});

	it("defers dynamic transformation shape compatibility to runtime", () => {
		const dashboard = nativeV2Fixture();
		const panel = dashboard.manifest.panels[0]!;
		panel.transformations = [
			{ id: "dynamic", type: "test.dynamic", execution: "server", inputFrameRefs: ["B"], outputFrameRefId: "C", options: {}, disabled: false },
			{ id: "category", type: "test.category", execution: "server", inputFrameRefs: ["C"], outputFrameRefId: "D", options: {}, disabled: false },
		];
		const module = createDashboardModule({
			nativeDashboards: [dashboard],
			visualizations: [nativeVisualization],
			transformations: [
				{ descriptor: { type: "test.dynamic", displayName: "Dynamic", description: "Dynamic", configSchemaVersion: 1, inputShapes: ["any"], outputShape: "dynamic", serverCapable: true, browserCapable: false }, configSchema: z.object({}).strict(), execute: ({ inputFrames }) => ({ frame: inputFrames[0]! }) },
				{ descriptor: { type: "test.category", displayName: "Category", description: "Category", configSchemaVersion: 1, inputShapes: ["category"], outputShape: "preserve", serverCapable: true, browserCapable: false }, configSchema: z.object({}).strict(), execute: ({ inputFrames }) => ({ frame: inputFrames[0]! }) },
			],
		});
		expect(module.v2Registry.get("native-v2")).toBeDefined();
	});
});
