import {
	stateTimelineConfigV1Schema,
	statusHistoryConfigV1Schema,
	uptimeGridConfigV1Schema,
} from "@shared/schemas/dashboard/state-visualizations.schema";
import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createDashboardTheme } from "../../runtime/theme";
import { tablePanel } from "../../test/fixtures";
import {
	Renderer as TimelineRenderer,
	buildAccessibleSummary as timelineAccessibleSummary,
} from "../core-state-timeline/renderer.lazy";
import {
	Renderer as HistoryRenderer,
	buildAccessibleSummary as historyAccessibleSummary,
} from "../core-status-history/renderer.lazy";
import {
	Renderer as UptimeRenderer,
	buildAccessibleSummary as uptimeAccessibleSummary,
} from "../core-uptime-grid/renderer.lazy";

const stateFrame = (
	shape: "state-interval" | "state-sample",
): DashboardDataFrameV2 => ({
	schemaVersion: 2,
	refId: "A",
	source: { kind: "query", refId: "A" },
	name: "States",
	fields: [
		{
			key: "time",
			label: "Time",
			type: "time",
			values: [0, 10, 20],
			roles: [shape === "state-interval" ? "start-time" : "time"],
			labels: {},
		},
		{
			key: "state",
			label: "State",
			type: "string",
			values: ["healthy", "critical", "healthy"],
			roles: ["state"],
			labels: {},
		},
		{
			key: "lane",
			label: "Lane",
			type: "string",
			values: ["api", "api", "api"],
			roles: ["category"],
			labels: {},
		},
	],
	meta: { shapeHint: shape },
});

const baseContext = {
	dashboardId: "dashboard",
	panel: tablePanel(),
	annotationLayers: [],
	resolvedRange: { from: 0, to: 30 },
	intervalMs: 10,
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

describe("state renderers", () => {
	it("renders the timeline and keeps legend state local", () => {
		const context = {
			...baseContext,
			frames: [stateFrame("state-interval")],
			preset: "single-lane",
			config: stateTimelineConfigV1Schema.parse({ showValues: "always" }),
		};
		const { container } = render(<TimelineRenderer {...context} />);
		expect(screen.getByRole("img", { name: "State timeline" })).toBeVisible();
		expect(container.querySelectorAll("rect")).toHaveLength(3);
		const healthy = screen.getByRole("button", { name: /Healthy/ });
		fireEvent.click(healthy);
		expect(healthy).toHaveAttribute("aria-pressed", "false");
		expect(timelineAccessibleSummary(context)).toContain(
			"critical duration 10ms",
		);
	});

	it("renders history changes and the latest-column preset", () => {
		const context = {
			...baseContext,
			frames: [stateFrame("state-sample")],
			preset: "latest-column",
			config: statusHistoryConfigV1Schema.parse({
				latestColumn: true,
				emphasizeChanges: true,
			}),
		};
		const { container } = render(<HistoryRenderer {...context} />);
		expect(screen.getByRole("img", { name: "Status history" })).toBeVisible();
		expect(container.querySelectorAll("rect")).toHaveLength(1);
		expect(historyAccessibleSummary(context)).toContain("latest healthy");
	});

	it("renders uptime percentages using the query cadence", () => {
		const context = {
			...baseContext,
			frames: [stateFrame("state-sample")],
			preset: "hourly",
			config: uptimeGridConfigV1Schema.parse({
				bucket: "hour",
				minimumCoveragePercent: 0,
				showPercentage: true,
			}),
		};
		const { container } = render(<UptimeRenderer {...context} />);
		expect(screen.getByRole("img", { name: "Uptime grid" })).toBeVisible();
		expect(container.querySelector("rect title")?.textContent).toContain(
			"uptime 66.666",
		);
		expect(uptimeAccessibleSummary(context)).toContain("Uptime 66.67%");
	});

	it("returns an accessible alert and summary when data is absent", () => {
		const context = {
			...baseContext,
			frames: [],
			preset: "single-lane",
			config: stateTimelineConfigV1Schema.parse({}),
		};
		render(<TimelineRenderer {...context} />);
		expect(screen.getByRole("alert")).toHaveTextContent("unavailable");
		expect(timelineAccessibleSummary(context)).toContain("unavailable");
	});
});
