import { calendarHeatmapConfigV1Schema } from "@shared/schemas/dashboard/distribution-visualizations.schema";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createDashboardTheme } from "../../runtime/theme";
import { tablePanel } from "../../test/fixtures";
import { buildAccessibleSummary, Renderer } from "./renderer.lazy";

const frame = {
	schemaVersion: 2 as const,
	refId: "A",
	source: { kind: "query" as const, refId: "A" },
	name: "Calendar",
	meta: { shapeHint: "timeseries" as const },
	fields: [
		{
			key: "time",
			label: "Time",
			type: "time" as const,
			roles: ["time" as const],
			labels: {},
			values: [Date.UTC(2026, 0, 1)],
		},
		{
			key: "value",
			label: "Value",
			type: "number" as const,
			roles: ["value" as const],
			labels: {},
			values: [3],
		},
	],
};
const context = {
	dashboardId: "d",
	panel: tablePanel(),
	frames: [frame],
	annotationLayers: [],
	preset: "year",
	config: calendarHeatmapConfigV1Schema.parse({}),
	timezone: "UTC",
	locale: "en-US",
	theme: createDashboardTheme(),
	interaction: {
		hiddenFieldKeys: new Set<string>(),
		toggleField: () => undefined,
		isolateField: () => undefined,
		resetFields: () => undefined,
		onDatumActivate: () => undefined,
	},
};
describe("calendar heatmap renderer", () => {
	it("renders the calendar heatmap visualization", () => {
		render(<Renderer {...context} />);
		expect(screen.getByRole("figure")).toBeVisible();
		expect(buildAccessibleSummary(context)).toContain("Calendar heatmap");
	});
	it("renders semantic status labels instead of a numeric legend", () => {
		const statusFrame = {
			...frame,
			fields: [
				frame.fields[0],
				{
					key: "state",
					label: "State",
					type: "string" as const,
					roles: ["state" as const],
					labels: {},
					values: ["healthy"],
				},
			],
		};
		render(
			<Renderer
				{...context}
				frames={[statusFrame]}
				config={calendarHeatmapConfigV1Schema.parse({
					colorScale: {
						mode: "status",
						domain: "auto",
						steps: 4,
						emptyColorToken: "--color-muted",
					},
				})}
			/>,
		);
		expect(screen.getByText("Healthy")).toBeVisible();
		expect(screen.getByText("Critical")).toBeVisible();
	});
});
