import { histogramConfigV1Schema } from "@shared/schemas/dashboard/distribution-visualizations.schema";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createDashboardTheme } from "../../runtime/theme";
import { tablePanel } from "../../test/fixtures";
import { buildAccessibleSummary, Renderer } from "./renderer.lazy";

const frame = {
	schemaVersion: 2 as const,
	refId: "A",
	source: { kind: "query" as const, refId: "A" },
	name: "Values",
	meta: { shapeHint: "distribution" as const },
	fields: [
		{
			key: "bin-start",
			label: "Bin start",
			type: "number" as const,
			roles: ["bin-start" as const],
			labels: {},
			values: [0, 5],
		},
		{
			key: "bin-end",
			label: "Bin end",
			type: "number" as const,
			roles: ["bin-end" as const],
			labels: {},
			values: [5, 10],
		},
		{
			key: "count",
			label: "Count",
			type: "number" as const,
			roles: ["count" as const],
			labels: {},
			values: [3, 2],
		},
	],
};
const context = {
	dashboardId: "d",
	panel: tablePanel(),
	frames: [frame],
	annotationLayers: [],
	preset: "count",
	config: histogramConfigV1Schema.parse({}),
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
describe("histogram renderer", () => {
	it("renders the histogram visualization", () => {
		render(<Renderer {...context} />);
		expect(screen.getByRole("figure")).toBeVisible();
		expect(buildAccessibleSummary(context)).toContain("Histogram");
	});
	it("renders cumulative semantics and an operable series legend", () => {
		const seriesFrame = {
			...frame,
			fields: [
				{
					...frame.fields[0],
					values: [0, 5, 0, 5],
				},
				{
					...frame.fields[1],
					values: [5, 10, 5, 10],
				},
				{
					...frame.fields[2],
					values: [3, 2, 1, 4],
				},
				{
					key: "series",
					label: "Series",
					type: "string" as const,
					roles: ["series" as const],
					labels: {},
					values: ["api", "api", "web", "web"],
				},
			],
		};
		const { rerender } = render(
			<Renderer {...context} frames={[seriesFrame]} preset="stacked" />,
		);
		const api = screen.getByRole("button", { name: "api" });
		expect(api).toHaveAttribute("aria-pressed", "true");
		fireEvent.click(api);
		expect(api).toHaveAttribute("aria-pressed", "false");
		rerender(
			<Renderer
				{...context}
				frames={[seriesFrame]}
				preset="cumulative"
				config={histogramConfigV1Schema.parse({
					cumulativeMode: "probability",
				})}
			/>,
		);
		expect(screen.getByText(/cumulative probability/)).toBeVisible();
	});
});
