import { describe, expect, it } from "vitest";
import { compatibilityPanelRequestV2ToV1, compatibilityFrameRefForLegacyPanel } from "./compatibility-runtime";

describe("v2 compatibility runtime", () => {
	it("keeps range, filters and data point limits when entering v1", () => {
		const value = compatibilityPanelRequestV2ToV1({ schemaVersion: 2, range: { kind: "relative", value: "1h" }, timezone: "UTC", filters: { service: ["api"] }, maxDataPoints: 10, maxRows: 20 });
		expect(value).toEqual({ range: { kind: "relative", value: "1h" }, timezone: "UTC", filters: { service: ["api"] }, maxDataPoints: 10 });
	});
	it("declares the legacy single output frame explicitly", () => {
		expect(compatibilityFrameRefForLegacyPanel()).toEqual({ refId: "A", outputFrameRefs: ["A"], hidden: false });
	});
});
