import { describe, expect, it } from "vitest";
import {
	colorScaleLegend,
	colorScaleToken,
	resolveColorScale,
} from "./color-scale";

describe("distribution color scale", () => {
	it("resolves sequential, empty, and status tokens", () => {
		const scale = resolveColorScale({ mode: "sequential", domain: "auto", steps: 5, emptyColorToken: "--color-muted" }, [0, 10, null]);
		expect(colorScaleToken(scale, null)).toBe("--color-muted");
		expect(colorScaleToken(scale, 10)).toBe(scale.tokens.at(-1));
		expect(colorScaleToken(scale, 2, "healthy")).not.toBe(
			"--color-chart-success",
		);
		const status = resolveColorScale(
			{
				mode: "status",
				domain: "auto",
				steps: 4,
				emptyColorToken: "--color-muted",
			},
			[2],
		);
		expect(colorScaleToken(status, 2, "healthy")).toBe(
			"--color-chart-success",
		);
	});
	it("uses a center for diverging values", () => {
		const scale = resolveColorScale({ mode: "diverging", domain: { min: -10, max: 10, center: 2 }, steps: 4, emptyColorToken: "--color-muted" }, [-10, 2, 10]);
		expect(colorScaleToken(scale, 2)).toBe("--color-muted");
		expect(colorScaleLegend(scale).some((item) => item.value === 2)).toBe(true);
	});
	it("uses the finite data extent for automatic domains", () => {
		const scale = resolveColorScale(
			{
				mode: "sequential",
				domain: "auto",
				steps: 5,
				emptyColorToken: "--color-muted",
			},
			[10, 20],
		);
		expect({ min: scale.min, max: scale.max }).toEqual({ min: 10, max: 20 });
	});
});
