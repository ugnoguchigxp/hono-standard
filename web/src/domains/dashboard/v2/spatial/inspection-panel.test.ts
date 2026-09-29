import { describe, expect, it } from "vitest";
import { inspectionPlacement, inspectionTypeScale } from "./inspection-panel";

describe("inspection panel placement", () => {
	it("centers a short panel on the right edge", () => {
		const place = inspectionPlacement({
			viewWidth: 1200,
			viewHeight: 680,
			panelWidth: 320,
			panelHeight: 240,
		});
		expect(place.right).toBe(16);
		expect(place.width).toBe(320);
		expect(place.height).toBe(240);
		expect(place.top).toBeCloseTo((680 - 240) / 2);
		expect(place.top).toBeGreaterThan(56);
	});

	it("scales the panel and type with the view height", () => {
		expect(inspectionTypeScale(680)).toBe(1);
		expect(inspectionTypeScale(1360)).toBe(2);
		const compact = inspectionPlacement({
			viewWidth: 1200,
			viewHeight: 680,
			panelWidth: 320 * inspectionTypeScale(680),
			panelHeight: 240 * inspectionTypeScale(680),
		});
		const large = inspectionPlacement({
			viewWidth: 2400,
			viewHeight: 1360,
			panelWidth: 320 * inspectionTypeScale(1360),
			panelHeight: 240 * inspectionTypeScale(1360),
		});
		expect(large.width).toBe(compact.width * 2);
		expect(large.height).toBe(compact.height * 2);
		expect(large.width / 2400).toBeCloseTo(compact.width / 1200);
	});

	it("drops a tall panel below the fullscreen button", () => {
		const place = inspectionPlacement({
			viewWidth: 1200,
			viewHeight: 680,
			panelWidth: 320,
			panelHeight: 1400,
		});
		expect(place.top).toBe(56);
		expect(place.top + place.height).toBeLessThanOrEqual(680 - 16);
		expect(place.width).toBeLessThan(320);
	});
});
