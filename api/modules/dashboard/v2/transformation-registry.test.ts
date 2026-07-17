import { describe, expect, it } from "vitest";
import { z } from "zod";
import { nativeTransformations } from "./test-fixtures";
import { DashboardTransformationRegistry } from "./transformation-registry";

describe("v2 transformation registry", () => {
	it("enforces capability declarations", () => {
		const registry = new DashboardTransformationRegistry(nativeTransformations);
		expect(registry.parseSpec({ id: "t", type: "test.browser", execution: "browser", inputFrameRefs: ["A"], outputFrameRefId: "B", options: {}, disabled: false }).descriptor.browserCapable).toBe(true);
		expect(() => new DashboardTransformationRegistry([{ ...nativeTransformations[0], descriptor: { ...nativeTransformations[0].descriptor, type: "test.bad", serverCapable: true } }])).toThrow();
	});
	it("rejects unsupported execution and invalid options", () => {
		const registry = new DashboardTransformationRegistry(nativeTransformations);
		expect(() => registry.parseSpec({ id: "t", type: "test.browser", execution: "server", inputFrameRefs: ["A"], outputFrameRefId: "B", options: {}, disabled: false })).toThrow();
		expect(() => registry.parseSpec({ id: "t", type: "test.server", execution: "server", inputFrameRefs: ["A"], outputFrameRefId: "B", options: { extra: true }, disabled: false })).toThrow();
		expect(() => registry.validateShape(registry.parseSpec({ id: "t", type: "test.server", execution: "server", inputFrameRefs: ["A"], outputFrameRefId: "B", options: {}, disabled: false }).descriptor, ["timeseries"], "category")).not.toThrow();
	});

	it("revalidates defaults applied by the config schema against the JSON budget", () => {
		const registry = new DashboardTransformationRegistry([
			{
				descriptor: { type: "test.default-budget", displayName: "Default budget", description: "Default budget", configSchemaVersion: 1, inputShapes: ["any"], outputShape: "preserve", serverCapable: false, browserCapable: true },
				configSchema: z.object({ payload: z.string().default("x".repeat(100_000)) }).strict(),
			},
		]);
		expect(() => registry.parseSpec({ id: "t", type: "test.default-budget", execution: "browser", inputFrameRefs: ["A"], outputFrameRefId: "B", options: {}, disabled: false })).toThrow(expect.objectContaining({ code: "TRANSFORMATION_CONFIG_INVALID" }));
	});
});
