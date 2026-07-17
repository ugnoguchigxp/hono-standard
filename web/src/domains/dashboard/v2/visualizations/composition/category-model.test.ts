import { describe, expect, it } from "vitest";
import { tableFrame } from "../../test/fixtures";
import { buildCategoryCompositionModel, paletteIndex, visibleCategorySlices } from "./category-model";

describe("category composition model", () => {
	it("builds percentages and stable tokens without mutating input", () => {
		const frame = tableFrame([{ name: "api", value: 3 }, { name: "web", value: 1 }]);
		const before = structuredClone(frame);
		const model = buildCategoryCompositionModel(frame, ["--color-brand", "--color-cyan"]);
		expect(model.total).toBe(4);
		expect(model.slices.map((slice) => slice.percent)).toEqual([75, 25]);
		expect(frame).toEqual(before);
		expect(paletteIndex("api", 2)).toBe(paletteIndex("api", 2));
	});
	it("rejects duplicate, negative, and all-zero composition", () => {
		expect(() => buildCategoryCompositionModel(tableFrame([{ name: "api", value: 1 }, { name: "api", value: 2 }]), [])).toThrow("CATEGORY_DUPLICATE");
		expect(() => buildCategoryCompositionModel(tableFrame([{ name: "api", value: -1 }]), [])).toThrow("CATEGORY_VALUE_NEGATIVE");
		expect(() => buildCategoryCompositionModel(tableFrame([{ name: "api", value: 0 }]), [])).toThrow("CATEGORY_TOTAL_MUST_BE_POSITIVE");
	});
	it("recomputes visible denominator", () => {
		const model = buildCategoryCompositionModel(tableFrame([{ name: "api", value: 3 }, { name: "web", value: 1 }]), []);
		const visible = visibleCategorySlices(model, new Set(["web"]));
		expect(visible.slices[0]?.percent).toBe(100);
	});
});
