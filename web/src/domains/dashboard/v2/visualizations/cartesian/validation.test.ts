import { describe, expect, it } from "vitest";
import { tableFrame, tablePanel } from "../../test/fixtures";
import {
	validateCartesianDomains,
	validateCartesianUnitAxes,
} from "./validation";

describe("Cartesian semantic validation", () => {
	it("requires exactly one unique domain field per frame", () => {
		const frame = tableFrame([{ name: "api", value: 1 }]);
		expect(validateCartesianDomains([frame], "category")).toBeUndefined();
		frame.fields.push({
			key: "region",
			label: "Region",
			type: "string",
			roles: ["category"],
			labels: {},
			values: ["east"],
		});
		expect(validateCartesianDomains([frame], "category")).toMatch(
			/exactly one/,
		);
	});

	it("compares effective unit families after field config and overrides", () => {
		const frame = tableFrame([{ name: "api", value: 1 }]);
		frame.fields.push({
			key: "latency",
			label: "Latency",
			type: "number",
			roles: ["value"],
			labels: {},
			values: [2],
		});
		const fields = frame.fields
			.filter((field) => field.type === "number")
			.map((field) => ({ frame, field }));
		const spec = tablePanel().visualization;
		spec.overrides = [
			{
				id: "latency-unit",
				matcher: { kind: "field-name", fieldKey: "latency" },
				properties: { unit: { kind: "duration", unit: "ms" } },
			},
		];
		expect(
			validateCartesianUnitAxes(spec, [{ label: "value", fields }]),
		).toMatch(/consistent units/);

		spec.fieldConfig.unit = { kind: "duration", unit: "s" };
		expect(
			validateCartesianUnitAxes(spec, [{ label: "value", fields }]),
		).toBeUndefined();
	});
});
