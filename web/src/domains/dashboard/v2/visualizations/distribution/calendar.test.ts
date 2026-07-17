import { calendarHeatmapConfigV1Schema } from "@shared/schemas/dashboard/distribution-visualizations.schema";
import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { describe, expect, it } from "vitest";
import {
	addDateKey,
	buildCalendarModel,
	dateKeyForInstant,
	startUtcForDateKey,
} from "./calendar";

const frame = (times: number[], values: number[]): DashboardDataFrameV2 => ({
	schemaVersion: 2,
	refId: "A",
	source: { kind: "query", refId: "A" },
	name: "Calendar",
	meta: { shapeHint: "timeseries" },
	fields: [
		{
			key: "time",
			label: "Time",
			type: "time",
			roles: ["time"],
			labels: {},
			values: times,
		},
		{
			key: "value",
			label: "Value",
			type: "number",
			roles: ["value"],
			labels: {},
			values,
		},
	],
});

describe("calendar model", () => {
	it("uses timezone-local date keys and leap days", () => {
		expect(dateKeyForInstant(Date.UTC(2026, 0, 1, 23), "Asia/Tokyo")).toBe(
			"2026-01-02",
		);
		expect(addDateKey("2024-02-28", 1)).toBe("2024-02-29");
		expect(startUtcForDateKey("2026-01-02", "Asia/Tokyo")).toBe(
			Date.UTC(2026, 0, 1, 15),
		);
	});

	it("does not merge duplicate local dates", () => {
		expect(() =>
			buildCalendarModel(
				frame([Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 1, 12)], [1, 2]),
				calendarHeatmapConfigV1Schema.parse({}),
				"UTC",
			),
		).toThrow("DUPLICATE");
	});

	it("anchors rolling ranges to the latest input and hides future dates", () => {
		const input = frame([Date.UTC(2026, 0, 10)], [1]);
		const rolling = buildCalendarModel(
			input,
			calendarHeatmapConfigV1Schema.parse({
				range: { mode: "rolling-weeks", weeks: 4 },
			}),
			"UTC",
		);
		expect(rolling.at(-1)?.dateKey).toBe("2026-01-10");
		const tokyoRolling = buildCalendarModel(
			frame([Date.UTC(2026, 0, 10, 23)], [1]),
			calendarHeatmapConfigV1Schema.parse({
				range: { mode: "rolling-weeks", weeks: 4 },
			}),
			"Asia/Tokyo",
		);
		expect(tokyoRolling.at(-1)?.dateKey).toBe("2026-01-11");
		const year = buildCalendarModel(
			input,
			calendarHeatmapConfigV1Schema.parse({
				range: { mode: "year", year: 2026 },
				future: "hide",
			}),
			"UTC",
		);
		expect(year).toHaveLength(10);
	});
});
