import { describe, expect, it } from "vitest";
import { tableFrame } from "../../test/fixtures";
import { buildScatterModel } from "./scatter-model";

describe("scatter model", () => {
	it("skips null points and keeps stable series groups", () => {
		const frame = tableFrame([{ name: "a", value: 1 }, { name: "b", value: 2 }]);
		frame.meta = { shapeHint: "distribution" };
		frame.fields = [
			{ key: "x", label: "X", type: "number", values: [1, null], roles: ["x"], labels: {} },
			{ key: "y", label: "Y", type: "number", values: [2, 3], roles: ["y"], labels: {} },
			{ key: "series", label: "Series", type: "string", values: ["api", "web"], roles: ["series"], labels: {} },
		];
		const model = buildScatterModel(frame, { palette: ["--color-brand"] });
		expect(model.points).toHaveLength(1);
		expect(model.skipped).toBe(1);
	});

	it("resolves size by role and skips zero-size bubbles", () => {
		const frame = tableFrame([
			{ name: "a", value: 1 },
			{ name: "b", value: 2 },
		]);
		frame.meta = { shapeHint: "distribution" };
		frame.fields = [
			{ key: "x", label: "X", type: "number", values: [1, 2], roles: ["x"], labels: {} },
			{ key: "y", label: "Y", type: "number", values: [2, 3], roles: ["y"], labels: {} },
			{ key: "size", label: "Size", type: "number", values: [0, 9], roles: ["size"], labels: {} },
		];
		const model = buildScatterModel(frame, { palette: ["--color-brand"] });
		expect(model.hasSize).toBe(true);
		expect(model.points).toHaveLength(1);
		expect(model.points[0]?.size).toBe(9);
		expect(model.skipped).toBe(1);
	});
});
