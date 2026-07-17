import { dashboardDataFrameV2Schema } from "@shared/schemas/dashboard.schema";
import { describe, expect, it } from "vitest";
import { coreBarGaugeDefinition } from "../core-bar-gauge/definition";
import { coreBulletDefinition } from "../core-bullet/definition";
import { coreGaugeDefinition } from "../core-gauge/definition";
import { coreProgressDefinition } from "../core-progress/definition";
import { coreStatDefinition } from "../core-stat/definition";
import { coreTrafficLightDefinition } from "../core-traffic-light/definition";

function frame(rows = 3, goal = true) {
	return dashboardDataFrameV2Schema.parse({
		schemaVersion: 2,
		refId: "A",
		source: { kind: "query", refId: "A" },
		name: "KPI",
		fields: [
			{ key: "category", label: "Category", type: "string", values: Array.from({ length: rows }, (_, index) => `item-${index}`), roles: ["category"], labels: {} },
			{ key: "value", label: "Value", type: "number", values: Array.from({ length: rows }, (_, index) => index + 1), roles: ["value"], labels: {} },
			...(goal ? [{ key: "goal", label: "Goal", type: "number" as const, values: Array.from({ length: rows }, () => 10), roles: ["goal" as const], labels: {} }] : []),
		],
		meta: { shapeHint: "category" },
	});
}

describe("KPI definitions", () => {
	it("exposes the six lazy definitions and exact preset counts", async () => {
		const definitions = [coreStatDefinition, coreGaugeDefinition, coreBarGaugeDefinition, coreBulletDefinition, coreProgressDefinition, coreTrafficLightDefinition];
		expect(definitions.map((definition) => definition.descriptor.presets.length)).toEqual([5, 3, 4, 3, 3, 3]);
		for (const definition of definitions) expect((await definition.load()).Renderer).toBeTypeOf("function");
		expect(coreGaugeDefinition.defaultOptionsByPreset["full-circle"]).toMatchObject({ startAngle: -225, endAngle: 45 });
		expect(coreGaugeDefinition.defaultOptionsByPreset.needle).toMatchObject({ startAngle: -225, endAngle: 45 });
	});
	it("enforces family limits and required goal semantics", () => {
		const statConfig = coreStatDefinition.configSchema.parse({});
		expect(coreStatDefinition.validateFrames?.([frame(101)], statConfig, "value-sparkline")).toMatch(/at most/);
		expect(coreGaugeDefinition.validateFrames?.([frame(7)], coreGaugeDefinition.configSchema.parse({}), "semi-circle")).toMatch(/at most/);
		expect(coreBarGaugeDefinition.validateFrames?.([frame(21)], coreBarGaugeDefinition.configSchema.parse({}), "horizontal")).toMatch(/at most/);
		expect(coreBulletDefinition.validateFrames?.([frame(3, false)], coreBulletDefinition.configSchema.parse({}), "horizontal")).toMatch(/goal/);
		expect(coreBulletDefinition.validateFrames?.([frame(21)], coreBulletDefinition.configSchema.parse({}), "comparative")).toMatch(/at most/);
		expect(coreProgressDefinition.validateFrames?.([frame(21)], coreProgressDefinition.configSchema.parse({}), "steps")).toMatch(/2 to 20/);
		expect(coreTrafficLightDefinition.validateFrames?.([frame(31)], coreTrafficLightDefinition.configSchema.parse({}), "list")).toMatch(/at most/);
	});
});
