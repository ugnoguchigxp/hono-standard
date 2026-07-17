import { describe, expect, it } from "vitest";
import { tableFrame } from "../../test/fixtures";
import { buildRadialBarModel, resolveRadialBarMax } from "./model";

describe("radial bar model", () => {
	it("accepts zero progress values against an explicit max", () => {
		const frame = tableFrame([
			{ name: "api", value: 0 },
			{ name: "web", value: 75 },
		]);
		const model = buildRadialBarModel(frame, ["--color-brand"], {
			allowAllZero: true,
		});
		expect(resolveRadialBarMax(model, 100, "progress")).toBe(100);
		expect(model.slices.map((slice) => slice.value)).toEqual([0, 75]);
	});

	it("supports a scalar progress value and effective field max", () => {
		const frame = tableFrame([{ name: "ignored", value: 72 }]);
		frame.meta = { shapeHint: "scalar" };
		frame.fields = [
			{
				key: "value",
				label: "Completion",
				type: "number",
				values: [72],
				roles: ["value"],
				labels: {},
				config: { max: 80 },
			},
		];
		const model = buildRadialBarModel(frame, ["--color-brand"], {
			allowAllZero: true,
		});
		expect(model.slices[0]).toMatchObject({ label: "Completion", value: 72 });
		expect(resolveRadialBarMax(model, "auto", "progress")).toBe(80);
	});

	it("rejects an all-zero ranking and progress values above max", () => {
		const frame = tableFrame([{ name: "api", value: 0 }]);
		expect(() =>
			buildRadialBarModel(frame, ["--color-brand"], {
				allowAllZero: false,
			}),
		).toThrow("RADIAL_TOTAL_MUST_BE_POSITIVE");
		const progress = buildRadialBarModel(frame, ["--color-brand"], {
			allowAllZero: true,
		});
		expect(() => resolveRadialBarMax(progress, "auto", "progress")).toThrow(
			"RADIAL_PROGRESS_MAX_REQUIRED",
		);
	});
});
