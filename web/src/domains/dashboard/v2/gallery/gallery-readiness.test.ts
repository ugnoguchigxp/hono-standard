import { describe, expect, it } from "vitest";
import { isGalleryReady } from "./gallery-readiness";

describe("gallery readiness", () => {
	it("requires every panel to be ready without errors", () => {
		expect(isGalleryReady({ manifest: true, panels: 5, readyPanels: 5, errorPanels: 0 })).toBe(true);
		expect(isGalleryReady({ manifest: true, panels: 5, readyPanels: 4, errorPanels: 0 })).toBe(false);
		expect(isGalleryReady({ manifest: true, panels: 5, readyPanels: 5, errorPanels: 1 })).toBe(false);
	});
});
