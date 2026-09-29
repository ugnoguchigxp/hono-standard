import { describe, expect, it } from "vitest";
import { focusShiftX, focusZoomFor, overviewZoomFor } from "./scene-canvas";

describe("scene framing", () => {
	it("uses a closer overview than a full-scene fit and shifts focus left", () => {
		const overview = overviewZoomFor(1200, 640);
		const focus = focusZoomFor(1200, 640);
		expect(overview).toBeGreaterThan(640 / (2 * 6));
		expect(focus).toBeGreaterThan(overview);
		expect(focusShiftX(1200, focus)).toBeLessThan(0);
	});
});