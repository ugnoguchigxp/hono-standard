import { describe, expect, it } from "vitest";
import { fieldOverrideV2Schema, standardFieldConfigV2Schema, thresholdConfigV2Schema } from "./field-config.schema";
import { resolveEffectiveFieldConfig } from "./field-config-resolution";

describe("field configuration", () => {
	it("validates thresholds, units, and safe links", () => {
		expect(standardFieldConfigV2Schema.parse({ unit: { kind: "percent", scale: "unit" }, decimals: 8 }).decimals).toBe(8);
		expect(thresholdConfigV2Schema.safeParse({ mode: "absolute", steps: [{ value: null, colorToken: "--color-muted" }, { value: 10, colorToken: "--color-danger" }] }).success).toBe(true);
		expect(thresholdConfigV2Schema.safeParse({ mode: "absolute", steps: [{ value: 1, colorToken: "--color-danger" }] }).success).toBe(false);
		expect(fieldOverrideV2Schema.safeParse({ id: "bad", matcher: { kind: "field-regex", pattern: "(?<=x)", flags: "" }, properties: { decimals: 2 } }).success).toBe(false);
	});
	it("resolves later patches and overrides without concatenating arrays", () => {
		const config = standardFieldConfigV2Schema.parse({ valueMappings: [{ kind: "null", text: "none" }] });
		const result = resolveEffectiveFieldConfig(config, { valueMappings: [] }, [{ id: "important", matcher: { kind: "field-name", fieldKey: "value" }, properties: { decimals: 2 } }], { frameRefId: "A", source: { kind: "query", refId: "A" }, fieldKey: "value", fieldType: "number", fieldRoles: ["value"] });
		expect(result.valueMappings).toEqual([]);
		expect(result.decimals).toBe(2);
	});
});
