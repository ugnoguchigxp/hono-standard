import { boxPlotConfigV1Schema } from "@shared/schemas/dashboard/distribution-visualizations.schema";
import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createDashboardTheme } from "../../runtime/theme";
import { tablePanel } from "../../test/fixtures";
import { buildAccessibleSummary, Renderer } from "./renderer.lazy";

const frame = {
	schemaVersion: 2 as const,
	refId: "A",
	source: { kind: "query" as const, refId: "A" },
	name: "Summary",
	meta: { shapeHint: "category" as const },
	fields: [
		{
			key: "category",
			label: "Category",
			type: "string" as const,
			roles: ["category" as const],
			labels: {},
			values: ["API"],
		},
		{
			key: "min",
			label: "Min",
			type: "number" as const,
			roles: ["min" as const],
			labels: {},
			values: [1],
		},
		{
			key: "q1",
			label: "Q1",
			type: "number" as const,
			roles: ["q1" as const],
			labels: {},
			values: [2],
		},
		{
			key: "median",
			label: "Median",
			type: "number" as const,
			roles: ["median" as const],
			labels: {},
			values: [3],
		},
		{
			key: "q3",
			label: "Q3",
			type: "number" as const,
			roles: ["q3" as const],
			labels: {},
			values: [4],
		},
		{
			key: "max",
			label: "Max",
			type: "number" as const,
			roles: ["max" as const],
			labels: {},
			values: [5],
		},
	],
};
const context = {
	dashboardId: "d",
	panel: tablePanel(),
	frames: [frame],
	annotationLayers: [],
	preset: "vertical",
	config: boxPlotConfigV1Schema.parse({}),
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
describe("box plot renderer", () => {
	it("renders the requested orientation", () => {
		const { container } = render(<Renderer {...context} />);
		expect(screen.getByRole("figure")).toBeVisible();
		expect(
			container.querySelector("[data-orientation='vertical']"),
		).toBeInTheDocument();
		expect(buildAccessibleSummary(context)).toContain("Box plot");
	});
	it("honors orientation from config for every preset", () => {
		const { container } = render(
			<Renderer
				{...context}
				preset="grouped"
				config={boxPlotConfigV1Schema.parse({ orientation: "horizontal" })}
			/>,
		);
		expect(
			container.querySelector("[data-orientation='horizontal']"),
		).toBeInTheDocument();
	});
	it("renders raw points and the mean when configured", () => {
		const rawFrame = {
			...frame,
			meta: { shapeHint: "distribution" as const },
			fields: [
				{
					key: "category",
					label: "Category",
					type: "string" as const,
					roles: ["category" as const],
					labels: {},
					values: ["API", "API", "API"],
				},
				{
					key: "value",
					label: "Value",
					type: "number" as const,
					roles: ["value" as const],
					labels: {},
					values: [1, 2, 3],
				},
			],
		};
		const { container } = render(
			<Renderer
				{...context}
				frames={[rawFrame]}
				preset="box-and-points"
				config={boxPlotConfigV1Schema.parse({
					inputMode: "raw",
					showAllPoints: true,
					showMean: true,
				})}
			/>,
		);
		expect(container.querySelectorAll("circle")).toHaveLength(4);
	});
	it("provides an operable legend for grouped series", () => {
		const groupedFrame: DashboardDataFrameV2 = {
			...frame,
			fields: [
				{
					key: "category",
					label: "Category",
					type: "string",
					roles: ["category"],
					labels: {},
					values: ["API", "API"],
				},
				{
					key: "series",
					label: "Series",
					type: "string",
					roles: ["series"],
					labels: {},
					values: ["api", "web"],
				},
				...(["min", "q1", "median", "q3", "max"] as const).map(
					(role, index) => ({
						key: role,
						label: role,
						type: "number" as const,
						roles: [role],
						labels: {},
						values: [index + 1, index + 1],
					}),
				),
			],
		};
		render(<Renderer {...context} frames={[groupedFrame]} preset="grouped" />);
		const api = screen.getByRole("button", { name: "api" });
		fireEvent.click(api);
		expect(api).toHaveAttribute("aria-pressed", "false");
	});
});
