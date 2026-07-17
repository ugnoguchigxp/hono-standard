import { describe, expect, it } from "vitest";
import { coreBarGaugeDefinition } from "./core-bar-gauge/definition";
import { coreBarDefinition } from "./core-bar/definition";
import { coreBoxPlotDefinition } from "./core-box-plot/definition";
import { coreBulletDefinition } from "./core-bullet/definition";
import { coreCalendarHeatmapDefinition } from "./core-calendar-heatmap/definition";
import { coreComposedDefinition } from "./core-composed/definition";
import { coreFunnelDefinition } from "./core-funnel/definition";
import { coreGaugeDefinition } from "./core-gauge/definition";
import { coreHeatmapDefinition } from "./core-heatmap/definition";
import { coreHistogramDefinition } from "./core-histogram/definition";
import { coreNodeGraphDefinition } from "./core-node-graph/definition";
import { corePieDefinition } from "./core-pie/definition";
import { coreProgressDefinition } from "./core-progress/definition";
import { coreRadarDefinition } from "./core-radar/definition";
import { coreRadialBarDefinition } from "./core-radial-bar/definition";
import { coreSankeyDefinition } from "./core-sankey/definition";
import { coreScatterDefinition } from "./core-scatter/definition";
import { coreStatDefinition } from "./core-stat/definition";
import { coreStateTimelineDefinition } from "./core-state-timeline/definition";
import { coreStatusHistoryDefinition } from "./core-status-history/definition";
import { coreSunburstDefinition } from "./core-sunburst/definition";
import { coreTableDefinition } from "./core-table/definition";
import { coreTimeseriesDefinition } from "./core-timeseries/definition";
import { coreTrafficLightDefinition } from "./core-traffic-light/definition";
import { coreTreemapDefinition } from "./core-treemap/definition";
import { coreUptimeGridDefinition } from "./core-uptime-grid/definition";
import { observabilityLogsDefinition } from "./observability-logs/definition";
import { observabilityTraceWaterfallDefinition } from "./observability-trace-waterfall/definition";
import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";

describe("core visualizations definitions", () => {
	const emptyFrames: DashboardDataFrameV2[] = [];

	const cartesianConfig = {
		valueAxis: { scale: "linear", min: "auto", max: "auto" },
		waterfall: {},
		series: [],
	} as any;

	const composedConfig = {
		leftAxis: { scale: "linear", min: "auto", max: "auto" },
		rightAxis: { scale: "linear", min: "auto", max: "auto" },
		series: [],
	} as any;

	const timeseriesFrame = {
		schemaVersion: 2,
		refId: "A",
		source: { kind: "query", refId: "A" },
		name: "Time Series",
		fields: [
			{ key: "time", type: "time", values: [1000, 2000], roles: ["time"], labels: {} },
			{ key: "value", type: "number", values: [10, 20], roles: ["value"], labels: {} },
		],
	} as any as DashboardDataFrameV2;

	const categoryFrame = {
		schemaVersion: 2,
		refId: "A",
		source: { kind: "query", refId: "A" },
		name: "Category Chart",
		fields: [
			{ key: "cat", type: "string", values: ["A", "B"], roles: ["category"], labels: {} },
			{ key: "value", type: "number", values: [10, 20], roles: ["value"], labels: {} },
		],
	} as any as DashboardDataFrameV2;

	const multiValueFrame = {
		schemaVersion: 2,
		refId: "A",
		source: { kind: "query", refId: "A" },
		name: "Multi Value Category Chart",
		fields: [
			{ key: "cat", type: "string", values: ["A", "B"], roles: ["category"], labels: {} },
			{ key: "value1", type: "number", values: [10, 20], roles: ["value"], labels: {} },
			{ key: "value2", type: "number", values: [15, 25], roles: ["value"], labels: {} },
		],
	} as any as DashboardDataFrameV2;

	const scatterFrame = {
		schemaVersion: 2,
		refId: "A",
		source: { kind: "query", refId: "A" },
		name: "Scatter Chart",
		fields: [
			{ key: "xVal", type: "number", values: [1, 2], roles: ["x"], labels: {} },
			{ key: "yVal", type: "number", values: [10, 20], roles: ["y"], labels: {} },
		],
	} as any as DashboardDataFrameV2;

	const hierarchyFrame = {
		schemaVersion: 2,
		refId: "A",
		source: { kind: "query", refId: "A" },
		name: "Hierarchy",
		fields: [
			{ key: "id", type: "string", values: ["root", "child"], roles: ["id"], labels: {} },
			{ key: "parent", type: "string", values: [null, "root"], roles: ["parent-id"], labels: {} },
			{ key: "label", type: "string", values: ["Root", "Child"], roles: ["label"], labels: {} },
			{ key: "value", type: "number", values: [10, 5], roles: ["value"], labels: {} },
		],
	} as any as DashboardDataFrameV2;

	const stateIntervalFrame = {
		schemaVersion: 2,
		refId: "A",
		source: { kind: "query", refId: "A" },
		name: "States",
		fields: [
			{ key: "time", type: "time", values: [0, 10], roles: ["start-time"], labels: {} },
			{ key: "state", type: "string", values: ["healthy", "warning"], roles: ["state"], labels: {} },
		],
	} as any as DashboardDataFrameV2;

	it("should execute validateFrames on empty or invalid frames", () => {
		const definitions = [
			coreBarGaugeDefinition,
			coreBarDefinition,
			coreBoxPlotDefinition,
			coreBulletDefinition,
			coreCalendarHeatmapDefinition,
			coreComposedDefinition,
			coreFunnelDefinition,
			coreGaugeDefinition,
			coreHeatmapDefinition,
			coreHistogramDefinition,
			coreNodeGraphDefinition,
			corePieDefinition,
			coreProgressDefinition,
			coreRadarDefinition,
			coreRadialBarDefinition,
			coreSankeyDefinition,
			coreScatterDefinition,
			coreStatDefinition,
			coreStateTimelineDefinition,
			coreStatusHistoryDefinition,
			coreTableDefinition,
			coreTimeseriesDefinition,
			coreTrafficLightDefinition,
			coreTreemapDefinition,
			coreUptimeGridDefinition,
			observabilityLogsDefinition,
		];

		for (const def of definitions) {
			if (def.validateFrames) {
				const res = def.validateFrames(emptyFrames, cartesianConfig, "default");
				expect(res === undefined || typeof res === "string").toBe(true);
			}
		}

		if (coreSunburstDefinition.validateFrames) {
			expect((coreSunburstDefinition.validateFrames as any)(emptyFrames)).toBeDefined();
		}
		if (observabilityTraceWaterfallDefinition.validateFrames) {
			expect((observabilityTraceWaterfallDefinition.validateFrames as any)(emptyFrames)).toBeDefined();
		}

		const multipleFrames = Array(2).fill(timeseriesFrame);
		if (coreGaugeDefinition.validateFrames) {
			expect(coreGaugeDefinition.validateFrames(multipleFrames, {} as any, "default")).toBeDefined();
		}
	});

	it("should validateFrames and return undefined on valid frames", () => {
		expect(coreBarDefinition.validateFrames!([categoryFrame], cartesianConfig, "default")).toBeUndefined();
		expect(coreComposedDefinition.validateFrames!([multiValueFrame], composedConfig, "default")).toBeUndefined();
		expect(coreStatDefinition.validateFrames!([timeseriesFrame], cartesianConfig, "default")).toBeUndefined();
		if (coreTableDefinition.validateFrames) {
			expect((coreTableDefinition as any).validateFrames([timeseriesFrame], cartesianConfig, "default")).toBeUndefined();
		}
		expect(coreTimeseriesDefinition.validateFrames!([timeseriesFrame], cartesianConfig, "default")).toBeUndefined();
		expect(coreScatterDefinition.validateFrames!([scatterFrame], cartesianConfig, "default")).toBeUndefined();

		if (coreSunburstDefinition.validateFrames) {
			const res = (coreSunburstDefinition.validateFrames as any)([hierarchyFrame]);
			expect(res === undefined || typeof res === "string").toBe(true);
		}
		if (coreTreemapDefinition.validateFrames) {
			const res = coreTreemapDefinition.validateFrames([hierarchyFrame], {} as any, "default");
			expect(res === undefined || typeof res === "string").toBe(true);
		}

		if (coreStateTimelineDefinition.validateFrames) {
			const res = coreStateTimelineDefinition.validateFrames([stateIntervalFrame], {} as any, "default");
			expect(res === undefined || typeof res === "string").toBe(true);
		}
		if (coreStatusHistoryDefinition.validateFrames) {
			const res = coreStatusHistoryDefinition.validateFrames([stateIntervalFrame], {} as any, "default");
			expect(res === undefined || typeof res === "string").toBe(true);
		}
	});

	it("should have correct loadPolicy", () => {
		const validPolicies = ["viewport", "immediate"];
		expect(validPolicies).toContain(coreBarGaugeDefinition.loadPolicy);
		expect(validPolicies).toContain(coreBarDefinition.loadPolicy);
		expect(validPolicies).toContain(coreBoxPlotDefinition.loadPolicy);
		expect(validPolicies).toContain(coreBulletDefinition.loadPolicy);
		expect(validPolicies).toContain(coreCalendarHeatmapDefinition.loadPolicy);
		expect(validPolicies).toContain(coreComposedDefinition.loadPolicy);
		expect(validPolicies).toContain(coreFunnelDefinition.loadPolicy);
		expect(validPolicies).toContain(coreGaugeDefinition.loadPolicy);
		expect(validPolicies).toContain(coreHeatmapDefinition.loadPolicy);
		expect(validPolicies).toContain(coreHistogramDefinition.loadPolicy);
		expect(validPolicies).toContain(coreNodeGraphDefinition.loadPolicy);
		expect(validPolicies).toContain(corePieDefinition.loadPolicy);
		expect(validPolicies).toContain(coreProgressDefinition.loadPolicy);
		expect(validPolicies).toContain(coreRadarDefinition.loadPolicy);
		expect(validPolicies).toContain(coreRadialBarDefinition.loadPolicy);
		expect(validPolicies).toContain(coreSankeyDefinition.loadPolicy);
		expect(validPolicies).toContain(coreScatterDefinition.loadPolicy);
		expect(validPolicies).toContain(coreStatDefinition.loadPolicy);
		expect(validPolicies).toContain(coreStateTimelineDefinition.loadPolicy);
		expect(validPolicies).toContain(coreStatusHistoryDefinition.loadPolicy);
		expect(validPolicies).toContain(coreSunburstDefinition.loadPolicy);
		expect(validPolicies).toContain(coreTableDefinition.loadPolicy);
		expect(validPolicies).toContain(coreTimeseriesDefinition.loadPolicy);
		expect(validPolicies).toContain(coreTrafficLightDefinition.loadPolicy);
		expect(validPolicies).toContain(coreTreemapDefinition.loadPolicy);
		expect(validPolicies).toContain(coreUptimeGridDefinition.loadPolicy);
		expect(validPolicies).toContain(observabilityLogsDefinition.loadPolicy);
		expect(validPolicies).toContain(observabilityTraceWaterfallDefinition.loadPolicy);
	});
});
