import { z } from "zod";
import { describe, expect, it } from "vitest";
import { transformationSpecV2Schema, validateTransformationDefinition } from "./transformation.schema";

describe("transformation contract", () => {
	it("validates generic specs and execution capability", () => {
		const spec = transformationSpecV2Schema.parse({ id: "reduce", type: "core.reduce", inputFrameRefs: ["A"], outputFrameRefId: "B" });
		expect(spec.disabled).toBe(false);
		expect(validateTransformationDefinition(spec, { descriptor: { type: "core.reduce", displayName: "Reduce", description: "", configSchemaVersion: 1, inputShapes: ["any"], outputShape: "dynamic", serverCapable: false, browserCapable: true }, configSchema: z.object({}).strict() }).valid).toBe(true);
		expect(validateTransformationDefinition({ ...spec, execution: "server" }, { descriptor: { type: "core.reduce", displayName: "Reduce", description: "", configSchemaVersion: 1, inputShapes: ["any"], outputShape: "dynamic", serverCapable: false, browserCapable: true }, configSchema: z.object({}).strict() }).valid).toBe(false);
	});
});
