import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { ResolvedAnnotationLayer } from "../runtime/visualization-types";
import { PlotOverlay } from "./plot-overlay";
import { AnnotationLayer } from "../visualizations/annotations/annotation-layer";

vi.mock("../visualizations/annotations/lazy-components", () => {
	return {
		DeferredAnnotationLayer: ({ layers, viewport }: any) => {
			return <AnnotationLayer layers={layers} viewport={viewport} />;
		},
	};
});

const frame: DashboardDataFrameV2 = {
	schemaVersion: 2,
	refId: "B",
	source: { kind: "query", refId: "B" },
	name: "Events",
	fields: [
		{
			key: "time",
			label: "Time",
			type: "time",
			values: [50],
			roles: ["time"],
			labels: {},
		},
		{
			key: "message",
			label: "Message",
			type: "string",
			values: ["Deploy"],
			roles: ["message"],
			labels: {},
		},
	],
	meta: { shapeHint: "annotation" },
};
const layers: ResolvedAnnotationLayer[] = [
	{
		spec: {
			id: "deploys",
			frameRef: "B",
			mode: "line",
			enabled: true,
			name: "Deploys",
			severityFilter: [],
			showLabel: "always",
		},
		frame,
	},
];

describe("PlotOverlay", () => {
	it("does not mount an overlay without enabled layers", () => {
		const { container } = render(
			<PlotOverlay
				layers={[]}
				viewport={{
					xDomain: [0, 100],
					plotRect: { x: 10, y: 5, width: 80, height: 70 },
				}}
			/>,
		);
		expect(container).toBeEmptyDOMElement();
	});

	it("loads annotation rendering only when layers are present", async () => {
		render(
			<PlotOverlay
				layers={layers}
				viewport={{
					xDomain: [0, 100],
					plotRect: { x: 10, y: 5, width: 80, height: 70 },
					canvasSize: { width: 100, height: 80 },
				}}
			/>,
		);
		expect(
			screen.getByRole("region", { name: "Plot annotations" }),
		).toBeVisible();
		expect(
			await screen.findByRole("img", { name: "Annotations" }),
		).toBeVisible();
	});
});
