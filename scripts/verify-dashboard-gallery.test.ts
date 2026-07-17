import { describe, expect, it } from "vitest";
import { galleryCases, galleryVisualizations } from "../api/modules/dashboard/v2/gallery-dashboard";

describe("dashboard gallery gate", () => {
	it("covers every visualization preset exactly once", () => {
		const expected = galleryVisualizations.flatMap((definition) =>
			definition.descriptor.presets.map((preset) => `${definition.descriptor.type}/${preset.id}`),
		);
		const actual = galleryCases.map((item) => `${item.visualizationType}/${item.preset}`);
		expect(new Set(actual)).toEqual(new Set(expected));
		expect(new Set(galleryCases.map((item) => item.id)).size).toBe(galleryCases.length);
	});
});
