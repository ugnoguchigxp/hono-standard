import { describe, expect, it } from "vitest";
import { resolveEffectiveFieldConfig } from "./field-config-resolution";
import { standardFieldConfigV2Schema } from "./field-config.schema";

describe("effective field config resolution", () => {
	it("applies defaults, field patch, then ordered overrides", () => {
		const result = resolveEffectiveFieldConfig(standardFieldConfigV2Schema.parse({ decimals: 1 }), { decimals: 2 }, [{ id: "type", matcher: { kind: "field-type", fieldType: "number" }, properties: { decimals: 3 } }], { frameRefId: "A", source: { kind: "query", refId: "A" }, fieldKey: "value", fieldType: "number", fieldRoles: ["value"] });
		expect(result.decimals).toBe(3);
	});
});
