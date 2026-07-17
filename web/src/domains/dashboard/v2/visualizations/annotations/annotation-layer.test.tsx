import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type {
	AnnotationMode,
	DashboardDataFrameV2,
} from "@shared/schemas/dashboard.schema";
import type { ResolvedAnnotationLayer } from "../../runtime/visualization-types";
import { AnnotationLayer, AnnotationList } from "./annotation-layer";

const eventFrame: DashboardDataFrameV2 = {
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
const regionFrame: DashboardDataFrameV2 = {
	...eventFrame,
	refId: "C",
	source: { kind: "query", refId: "C" },
	fields: [
		{
			key: "start",
			label: "Start",
			type: "time",
			values: [25],
			roles: ["start-time"],
			labels: {},
		},
		{
			key: "end",
			label: "End",
			type: "time",
			values: [75],
			roles: ["end-time"],
			labels: {},
		},
		{
			key: "message",
			label: "Message",
			type: "string",
			values: ["Incident"],
			roles: ["message"],
			labels: {},
		},
	],
};
const layer = (
	id: string,
	mode: AnnotationMode,
	frame: DashboardDataFrameV2,
): ResolvedAnnotationLayer => ({
	spec: {
		id,
		frameRef: frame.refId,
		mode,
		enabled: true,
		name: id,
		severityFilter: [],
		showLabel: "always",
	},
	frame,
});

describe("AnnotationLayer", () => {
	it("renders every display mode inside the supplied plot rectangle", () => {
		const { container } = render(
			<AnnotationLayer
				layers={[
					layer("points", "point", eventFrame),
					layer("lines", "line", eventFrame),
					layer("badges", "badge", eventFrame),
					layer("regions", "region", regionFrame),
				]}
				viewport={{
					xDomain: [0, 100],
					plotRect: { x: 20, y: 10, width: 160, height: 70 },
					canvasSize: { width: 200, height: 100 },
				}}
			/>,
		);
		expect(container.querySelector("svg")?.getAttribute("viewBox")).toBe(
			"0 0 200 100",
		);
		expect(
			container.querySelector(".dashboard-annotation-point"),
		).not.toBeNull();
		expect(
			container.querySelector(".dashboard-annotation-line"),
		).not.toBeNull();
		expect(
			container.querySelector(".dashboard-annotation-badge"),
		).not.toBeNull();
		expect(
			container.querySelector(".dashboard-annotation-region"),
		).not.toBeNull();
		expect(
			container
				.querySelector(".dashboard-annotation-point line")
				?.getAttribute("x1"),
		).toBe("100");
	});
	it("keeps layer visibility as local keyboard-operable state", () => {
		render(
			<AnnotationList
				layers={[layer("deploys", "point", eventFrame)]}
				range={{ from: 0, to: 100 }}
			/>,
		);
		const toggle = screen.getByRole("button", { name: "deploys" });
		expect(toggle).toHaveAttribute("aria-pressed", "true");
		expect(screen.getByText("Deploy")).toBeVisible();
		fireEvent.click(toggle);
		expect(toggle).toHaveAttribute("aria-pressed", "false");
		expect(screen.queryByText("Deploy")).toBeNull();
	});
});
