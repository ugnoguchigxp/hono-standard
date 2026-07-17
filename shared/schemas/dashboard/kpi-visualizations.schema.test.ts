import { describe, expect, it } from "vitest";
import { dashboardDataFrameV2Schema } from "./data-frame.schema";
import { barGaugeConfigSchema, bulletConfigSchema, gaugeConfigSchema, kpiPresetDescriptors, progressConfigSchema, statConfigV2Schema, trafficLightConfigSchema } from "./kpi-visualizations.schema";

describe("KPI visualization contracts", () => {
	it("declares the exact P4 preset families and strict defaults", () => {
		expect(Object.fromEntries(Object.entries(kpiPresetDescriptors).map(([type, presets]) => [type, presets.length]))).toEqual({ "core.stat": 5, "core.gauge": 3, "core.bar-gauge": 4, "core.bullet": 3, "core.progress": 3, "core.traffic-light": 3 });
		expect(statConfigV2Schema.parse({}).sparkline.maxPoints).toBe(100);
		expect(gaugeConfigSchema.parse({}).tickCount).toBe(5);
		expect(barGaugeConfigSchema.parse({}).segmentCount).toBe(10);
		expect(bulletConfigSchema.parse({}).range.overflow).toBe("show-marker");
		expect(progressConfigSchema.parse({}).completedStateValues).toEqual(["completed"]);
		expect(trafficLightConfigSchema.parse({}).stateOrder).toContain("unknown");
		expect(statConfigV2Schema.safeParse({ unknown: true }).success).toBe(false);
	});
	it("keeps target string semantics separate from numeric KPI roles", () => {
		const frame = dashboardDataFrameV2Schema.safeParse({ schemaVersion: 2, refId: "A", source: { kind: "query", refId: "A" }, name: "target", fields: [{ key: "target", label: "Target", type: "string", values: ["service"], roles: ["target"], labels: {} }], meta: { shapeHint: "graph-edges" } });
		expect(frame.success).toBe(true);
	});
});
