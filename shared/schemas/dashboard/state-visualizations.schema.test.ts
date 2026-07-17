import { describe, expect, it } from "vitest";
import { coreStateTimelineVisualizationContract, coreStatusHistoryVisualizationContract, coreUptimeGridVisualizationContract, stateTimelineConfigV1Schema, statusHistoryConfigV1Schema, uptimeGridConfigV1Schema } from "./state-visualizations.schema";

describe("state visualization contracts", () => {
	it("declares the three families and six presets each", () => {
		expect(coreStateTimelineVisualizationContract.descriptor.presets).toHaveLength(6);
		expect(coreStatusHistoryVisualizationContract.descriptor.presets).toHaveLength(6);
		expect(coreUptimeGridVisualizationContract.descriptor.presets).toHaveLength(6);
		expect(coreStateTimelineVisualizationContract.descriptor.capabilities.annotations).toBe(true);
	});
	it("keeps defaults inside the documented limits", () => {
		expect(stateTimelineConfigV1Schema.parse({}).rowHeight).toBe(32);
		expect(statusHistoryConfigV1Schema.parse({}).cadenceTolerancePercent).toBe(10);
		expect(uptimeGridConfigV1Schema.parse({ range: { rollingDays: 90 } }).range).toEqual({ rollingDays: 90 });
		expect(uptimeGridConfigV1Schema.safeParse({ range: { rollingDays: 366 } }).success).toBe(false);
	});
});
