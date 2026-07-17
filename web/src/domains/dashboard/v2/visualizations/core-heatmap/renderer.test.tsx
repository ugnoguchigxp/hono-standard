import { heatmapConfigV1Schema } from "@shared/schemas/dashboard/distribution-visualizations.schema";
import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createDashboardTheme } from "../../runtime/theme";
import { tablePanel } from "../../test/fixtures";
import { buildAccessibleSummary, Renderer } from "./renderer.lazy";

const frame = {
	schemaVersion: 2 as const,
	refId: "A",
	source: { kind: "query" as const, refId: "A" },
	name: "Matrix",
	meta: { shapeHint: "matrix" as const },
	fields: [
		{
			key: "x",
			label: "X",
			type: "string" as const,
			roles: ["x" as const],
			labels: {},
			values: ["a", "b"],
		},
		{
			key: "y",
			label: "Y",
			type: "string" as const,
			roles: ["y" as const],
			labels: {},
			values: ["one", "one"],
		},
		{
			key: "value",
			label: "Value",
			type: "number" as const,
			roles: ["value" as const],
			labels: {},
			values: [0, 2],
		},
	],
};
const context = {
	dashboardId: "d",
	panel: tablePanel(),
	frames: [frame],
	annotationLayers: [],
	preset: "matrix",
	config: heatmapConfigV1Schema.parse({}),
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
describe("heatmap renderer", () => {
	it("renders the heatmap visualization", () => {
		render(<Renderer {...context} />);
		expect(screen.getByRole("figure")).toBeVisible();
		expect(buildAccessibleSummary(context)).toContain("Heatmap");
	});
	it("honors cell gaps and leaves generated missing cells empty", () => {
		const matrixFrame: DashboardDataFrameV2 = {
			...frame,
			fields: [
				{
					key: "x",
					label: "X",
					type: "string",
					roles: ["x"],
					labels: {},
					values: ["a", "b"],
				},
				{
					key: "y",
					label: "Y",
					type: "string",
					roles: ["y"],
					labels: {},
					values: ["one", "two"],
				},
				{
					key: "value",
					label: "Value",
					type: "number",
					roles: ["value"],
					labels: {},
					values: [0, 2],
				},
			],
		};
		const { container } = render(
			<Renderer
				{...context}
				frames={[matrixFrame]}
				config={heatmapConfigV1Schema.parse({ cellGap: 16, missing: "gap" })}
			/>,
		);
		const cells = [...container.querySelectorAll("rect")];
		expect(cells[0]).toHaveAttribute("width", "56");
		expect(cells[0]).toHaveAttribute("height", "20");
		expect(
			cells.filter((cell) => cell.getAttribute("opacity") === "0"),
		).toHaveLength(2);
	});
});
