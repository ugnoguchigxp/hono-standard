import { z } from "zod";
import {
	coreBarVisualizationContract,
	coreComposedVisualizationContract,
	coreTimeseriesVisualizationContract,
} from "../../../../shared/schemas/dashboard/cartesian-visualizations.schema";
import {
	coreFunnelVisualizationContract,
	corePieVisualizationContract,
	coreRadarVisualizationContract,
	coreRadialBarVisualizationContract,
} from "../../../../shared/schemas/dashboard/composition-visualizations.schema";
import {
	coreBoxPlotVisualizationContract,
	coreCalendarHeatmapVisualizationContract,
	coreHeatmapVisualizationContract,
	coreHistogramVisualizationContract,
} from "../../../../shared/schemas/dashboard/distribution-visualizations.schema";
import {
	coreSankeyVisualizationContract,
	coreSunburstVisualizationContract,
	coreTreemapVisualizationContract,
} from "../../../../shared/schemas/dashboard/hierarchy-flow-visualizations.schema";
import {
	barGaugeConfigSchema,
	bulletConfigSchema,
	gaugeConfigSchema,
	progressConfigSchema,
	trafficLightConfigSchema,
} from "../../../../shared/schemas/dashboard/kpi-visualizations.schema";
import { coreScatterVisualizationContract } from "../../../../shared/schemas/dashboard/relationship-visualizations.schema";
import {
	coreCandlestickVisualizationContract,
	coreNodeGraphVisualizationContract,
	geoMapVisualizationContract,
	observabilityFlameVisualizationContract,
	observabilityLogsVisualizationContract,
	observabilityTraceVisualizationContract,
} from "../../../../shared/schemas/dashboard/specialized-visualizations.schema";
import {
	coreStateTimelineVisualizationContract,
	coreStatusHistoryVisualizationContract,
	coreUptimeGridVisualizationContract,
} from "../../../../shared/schemas/dashboard/state-visualizations.schema";
import {
	type DashboardDataShape,
	standardFieldConfigV2Schema,
	type VisualizationDefinition,
} from "../../../../shared/schemas/dashboard.schema";
import { defineDashboardQueryV2, defineDashboardV2 } from "./define-dashboard";
import {
	booleanField,
	dataFrame,
	numberField,
	queryResult,
	stringField,
	timeField,
} from "./frame-builders";
import type { AnyTransformationRuntimeDefinition } from "./transformation-registry";
import type { DashboardDefinitionV2 } from "./types";

export const GALLERY_DASHBOARD_ID = "visualization-gallery";

export type GalleryCase = {
	id: string;
	visualizationType: string;
	preset: string;
	fixture: string;
	purpose: "success" | "state" | "limit" | "field-config";
	title?: string;
	description?: string;
};

export const galleryCases: readonly GalleryCase[] = [
	{
		id: "timeseries-line",
		visualizationType: "core.timeseries",
		preset: "line",
		fixture: "two-series",
		purpose: "success",
	},
	{
		id: "timeseries-area",
		visualizationType: "core.timeseries",
		preset: "area",
		fixture: "gap-and-override",
		purpose: "field-config",
	},
	...[
		["timeseries-smooth-line", "smooth-line", "curved-trend"],
		["timeseries-step-line", "step-line", "state-steps"],
		["timeseries-stacked-area", "stacked-area", "stacked-positive-negative"],
		[
			"timeseries-percent-stacked-area",
			"percent-stacked-area",
			"percent-non-negative",
		],
		["timeseries-range-band", "range-band", "lower-upper"],
		["timeseries-sparkline", "sparkline", "single-compact"],
	].map(([id, preset, fixture]) => ({
		id,
		visualizationType: "core.timeseries",
		preset,
		fixture,
		purpose: "success" as const,
	})),
	{
		id: "bar-vertical",
		visualizationType: "core.bar",
		preset: "vertical",
		fixture: "positive-zero-negative",
		purpose: "success",
	},
	...[
		["bar-horizontal", "horizontal", "long-labels"],
		["bar-grouped", "grouped", "three-series"],
		["bar-stacked", "stacked", "stacked-positive-negative"],
		["bar-percent-stacked", "percent-stacked", "percent-non-negative"],
		["bar-time", "time-bars", "regular-buckets"],
		["bar-time-stacked", "stacked-time-bars", "three-time-series"],
		["bar-lollipop", "lollipop", "ranking"],
		["bar-waterfall", "waterfall", "waterfall-deltas"],
	].map(([id, preset, fixture]) => ({
		id,
		visualizationType: "core.bar",
		preset,
		fixture,
		purpose: "success" as const,
	})),
	{
		id: "composed-dual-axis",
		visualizationType: "core.composed",
		preset: "dual-axis",
		fixture: "count-latency",
		purpose: "success",
	},
	{
		id: "stat-value",
		visualizationType: "core.stat",
		preset: "value",
		fixture: "scalar-mapping",
		purpose: "field-config",
	},
	...[
		["stat-delta", "value-delta"],
		["stat-sparkline", "value-sparkline"],
		["stat-combined", "value-delta-sparkline"],
		["stat-list", "value-list"],
	].map(([id, preset]) => ({
		id,
		visualizationType: "core.stat",
		preset,
		fixture: "kpi-summary",
		purpose: "success" as const,
	})),
	...[
		["gauge-semi", "core.gauge", "semi-circle"],
		["gauge-full", "core.gauge", "full-circle"],
		["gauge-needle", "core.gauge", "needle"],
		["bar-gauge-horizontal", "core.bar-gauge", "horizontal"],
		["bar-gauge-vertical", "core.bar-gauge", "vertical"],
		["bar-gauge-segmented", "core.bar-gauge", "segmented"],
		["bar-gauge-retro", "core.bar-gauge", "retro-lcd"],
		["bullet-horizontal", "core.bullet", "horizontal"],
		["bullet-vertical", "core.bullet", "vertical"],
		["bullet-comparative", "core.bullet", "comparative"],
		["progress-linear", "core.progress", "linear"],
		["progress-segmented", "core.progress", "segmented"],
		["progress-steps", "core.progress", "steps"],
		["traffic-single", "core.traffic-light", "single"],
		["traffic-list", "core.traffic-light", "list"],
		["traffic-matrix", "core.traffic-light", "matrix"],
	].map(([id, visualizationType, preset]) => ({
		id,
		visualizationType,
		preset,
		fixture: "kpi-summary",
		purpose: "success" as const,
	})),
	{
		id: "table-default",
		visualizationType: "core.table",
		preset: "table",
		fixture: "mixed-fields",
		purpose: "success",
		title: "Mixed field table",
		description: "Dates, numbers, booleans, and missing values in one result",
	},
	{
		id: "state-empty",
		visualizationType: "core.table",
		preset: "table",
		fixture: "empty",
		purpose: "state",
		title: "Empty result",
		description: "A successful query with no rows for the selected period",
	},
	{
		id: "state-partial",
		visualizationType: "core.timeseries",
		preset: "line",
		fixture: "partial",
		purpose: "state",
		title: "Partial time series",
		description:
			"Recent samples are delayed, while available data stays visible",
	},
	{
		id: "state-stale",
		visualizationType: "core.timeseries",
		preset: "line",
		fixture: "stale",
		purpose: "state",
		title: "Stale time series",
		description: "The latest sample is older than the freshness threshold",
	},
	{
		id: "state-truncated",
		visualizationType: "core.table",
		preset: "table",
		fixture: "truncated",
		purpose: "limit",
		title: "Limited table result",
		description: "A complete table layout with a server-side result limit",
	},
	{
		id: "state-multiframe",
		visualizationType: "core.table",
		preset: "table",
		fixture: "multi-frame",
		purpose: "state",
		title: "Multi-frame table",
		description: "Primary and secondary result frames grouped side by side",
	},
	{
		id: "state-no-value",
		visualizationType: "core.stat",
		preset: "value",
		fixture: "no-value",
		purpose: "state",
		title: "Unavailable current value",
		description: "The latest sample exists but contains no usable reading",
	},
	...[
		["pie-basic", "core.pie", "pie", "composition"],
		["pie-donut", "core.pie", "donut", "composition"],
		["pie-semi-donut", "core.pie", "semi-donut", "composition"],
		["pie-rose", "core.pie", "rose", "composition"],
		["radar-line", "core.radar", "line", "radar"],
		["radar-filled", "core.radar", "filled", "radar"],
		["radar-multi", "core.radar", "multi", "radar"],
		["radial-ranking", "core.radial-bar", "ranking", "radial"],
		["radial-progress", "core.radial-bar", "progress", "radial"],
		["scatter-basic", "core.scatter", "scatter", "scatter"],
		["scatter-bubble", "core.scatter", "bubble", "scatter"],
		["scatter-quadrant", "core.scatter", "quadrant", "scatter"],
		["funnel-basic", "core.funnel", "funnel", "funnel"],
		["funnel-pyramid", "core.funnel", "pyramid", "funnel"],
		["treemap-flat", "core.treemap", "flat", "treemap-flat"],
		["treemap-nested", "core.treemap", "nested", "treemap-nested"],
		["sunburst-basic", "core.sunburst", "sunburst", "sunburst"],
		["sankey-basic", "core.sankey", "sankey", "sankey"],
	].map(([id, visualizationType, preset, fixture]) => ({
		id,
		visualizationType,
		preset,
		fixture,
		purpose: "success" as const,
	})),
	...[
		["hist-count", "core.histogram", "count", "histogram-values"],
		["hist-density", "core.histogram", "density", "histogram-values"],
		["hist-cumulative", "core.histogram", "cumulative", "histogram-values"],
		["hist-stacked", "core.histogram", "stacked", "histogram-series"],
		["hist-horizontal", "core.histogram", "horizontal", "histogram-values"],
		["heatmap-matrix", "core.heatmap", "matrix", "matrix-values"],
		["heatmap-time", "core.heatmap", "time-bucket", "matrix-values"],
		["heatmap-density", "core.heatmap", "density", "matrix-values"],
		["heatmap-diverging", "core.heatmap", "diverging", "matrix-values"],
		["heatmap-annotated", "core.heatmap", "annotated", "matrix-values"],
		["box-vertical", "core.box-plot", "vertical", "box-summary"],
		["box-horizontal", "core.box-plot", "horizontal", "box-summary"],
		["box-grouped", "core.box-plot", "grouped", "box-summary-series"],
		["box-points", "core.box-plot", "box-and-points", "box-raw"],
		["box-range", "core.box-plot", "range-summary", "box-summary"],
		["calendar-year", "core.calendar-heatmap", "year", "calendar-values"],
		["calendar-month", "core.calendar-heatmap", "month", "calendar-values"],
		[
			"calendar-rolling",
			"core.calendar-heatmap",
			"rolling-weeks",
			"calendar-values",
		],
		[
			"calendar-weekday",
			"core.calendar-heatmap",
			"weekday-profile",
			"calendar-values",
		],
		[
			"calendar-status",
			"core.calendar-heatmap",
			"status-calendar",
			"calendar-status",
		],
	].map(([id, visualizationType, preset, fixture]) => ({
		id,
		visualizationType,
		preset,
		fixture,
		purpose: "success" as const,
	})),
	...[
		[
			"timeline-single",
			"core.state-timeline",
			"single-lane",
			"state-interval-open",
		],
		[
			"timeline-multi",
			"core.state-timeline",
			"multi-lane",
			"state-interval-lanes",
		],
		[
			"timeline-merged",
			"core.state-timeline",
			"merged-adjacent",
			"state-interval-merged",
		],
		[
			"timeline-duration",
			"core.state-timeline",
			"duration-emphasis",
			"state-interval-duration",
		],
		[
			"timeline-compact",
			"core.state-timeline",
			"compact",
			"state-interval-compact",
		],
		[
			"timeline-threshold",
			"core.state-timeline",
			"threshold-derived",
			"state-sample-cadence",
		],
		["history-grid", "core.status-history", "grid", "state-sample-grid"],
		["history-bands", "core.status-history", "bands", "state-sample-bands"],
		[
			"history-multi",
			"core.status-history",
			"multi-series",
			"state-sample-series",
		],
		[
			"history-changes",
			"core.status-history",
			"changes-only",
			"state-sample-changes",
		],
		[
			"history-latest",
			"core.status-history",
			"latest-column",
			"state-sample-latest",
		],
		[
			"history-compact",
			"core.status-history",
			"compact",
			"state-sample-compact",
		],
		["uptime-hourly", "core.uptime-grid", "hourly", "state-sample-hourly"],
		["uptime-daily", "core.uptime-grid", "daily", "state-sample-daily"],
		["uptime-30d", "core.uptime-grid", "rolling-30d", "state-sample-30d"],
		["uptime-90d", "core.uptime-grid", "rolling-90d", "state-sample-90d"],
		[
			"uptime-services",
			"core.uptime-grid",
			"service-matrix",
			"state-sample-services",
		],
		[
			"uptime-incidents",
			"core.uptime-grid",
			"incident-overlay",
			"state-sample-incidents",
		],
	].map(([id, visualizationType, preset, fixture]) => ({
		id,
		visualizationType,
		preset,
		fixture,
		purpose: "success" as const,
	})),
	...[
		["node-service-map", "core.node-graph", "service-map", "graph"],
		["node-dependency", "core.node-graph", "dependency", "graph"],
		["node-directed", "core.node-graph", "directed", "graph"],
		["node-grouped", "core.node-graph", "grouped", "graph"],
		["node-critical-path", "core.node-graph", "critical-path", "graph"],
		["candle-candles", "core.candlestick", "candles", "ohlc"],
		["candle-hollow", "core.candlestick", "hollow", "ohlc"],
		["candle-volume", "core.candlestick", "volume", "ohlc"],
		["candle-range-bars", "core.candlestick", "range-bars", "ohlc"],
		["candle-baseline", "core.candlestick", "baseline-comparison", "ohlc"],
		["logs-stream", "observability.logs", "stream", "logs"],
		["logs-compact", "observability.logs", "compact", "logs"],
		["logs-severity", "observability.logs", "severity", "logs"],
		["logs-structured", "observability.logs", "structured", "logs"],
		["logs-context", "observability.logs", "context", "logs"],
		["trace-waterfall", "observability.trace-waterfall", "waterfall", "traces"],
		[
			"trace-service-colored",
			"observability.trace-waterfall",
			"service-colored",
			"traces",
		],
		[
			"trace-critical-path",
			"observability.trace-waterfall",
			"critical-path",
			"traces",
		],
		[
			"trace-errors-only",
			"observability.trace-waterfall",
			"errors-only",
			"traces",
		],
		["trace-compact", "observability.trace-waterfall", "compact", "traces"],
		["flame-flame", "observability.flame-graph", "flame", "profile"],
		["flame-icicle", "observability.flame-graph", "icicle", "profile"],
		[
			"flame-differential",
			"observability.flame-graph",
			"differential",
			"profile",
		],
		[
			"flame-category",
			"observability.flame-graph",
			"category-colored",
			"profile",
		],
		["flame-compact", "observability.flame-graph", "compact", "profile"],
		["geo-points", "geo.map", "points", "geo"],
		["geo-proportional", "geo.map", "proportional-symbol", "geo"],
		["geo-routes", "geo.map", "routes", "geo-routes"],
		["geo-regions", "geo.map", "regions", "geo-regions"],
		["geo-clusters", "geo.map", "clusters", "geo"],
	].map(([id, visualizationType, preset, fixture]) => ({
		id,
		visualizationType,
		preset,
		fixture,
		purpose: "success" as const,
	})),
] as const;

const emptyFieldConfig = standardFieldConfigV2Schema.parse({
	unit: { kind: "none" },
	decimals: "auto",
	noValueText: "—",
	textAlign: "auto",
	valueMappings: [],
	links: [],
});

const kpiPercentFieldConfig = standardFieldConfigV2Schema.parse({
	unit: { kind: "percent", scale: "hundred" },
	decimals: 0,
	min: 0,
	max: 100,
	thresholds: {
		mode: "absolute",
		steps: [
			{
				value: null,
				colorToken: "--color-chart-success",
				label: "healthy",
			},
			{
				value: 60,
				colorToken: "--color-chart-warning",
				label: "warning",
			},
			{
				value: 85,
				colorToken: "--color-chart-danger",
				label: "critical",
			},
		],
	},
});

const capabilities = {
	legend: true,
	tooltip: true,
	sharedCrosshair: false,
	zoom: false,
	rangeSelection: false,
	annotations: false,
	fieldOverrides: true,
	tableFallback: true,
	exportImage: false,
	exportData: true,
	mobileSummary: true,
} as const;

function galleryVisualization(
	type: string,
	displayName: string,
	category: "time" | "category" | "kpi" | "data",
	presets: string[],
	supportedShapes: Array<"scalar" | "timeseries" | "category" | "table">,
): VisualizationDefinition<Record<string, unknown>> {
	return {
		descriptor: {
			type,
			displayName,
			description: `${displayName} gallery renderer`,
			category,
			configSchemaVersion: 1,
			presets: presets.map((id) => ({ id, displayName: id, description: id })),
			defaultPreset: presets[0],
			supportedShapes,
			minimumSize: { w: 2, h: 2 },
			recommendedSize: { w: 6, h: 4 },
			capabilities,
		},
		configSchema: z.record(z.string(), z.unknown()),
		defaultOptionsByPreset: Object.fromEntries(presets.map((id) => [id, {}])),
	};
}

export const galleryVisualizations = [
	coreTimeseriesVisualizationContract,
	coreBarVisualizationContract,
	coreComposedVisualizationContract,
	corePieVisualizationContract,
	coreRadarVisualizationContract,
	coreRadialBarVisualizationContract,
	coreScatterVisualizationContract,
	coreFunnelVisualizationContract,
	coreTreemapVisualizationContract,
	coreSunburstVisualizationContract,
	coreSankeyVisualizationContract,
	coreHistogramVisualizationContract,
	coreHeatmapVisualizationContract,
	coreBoxPlotVisualizationContract,
	coreCalendarHeatmapVisualizationContract,
	coreStateTimelineVisualizationContract,
	coreStatusHistoryVisualizationContract,
	coreUptimeGridVisualizationContract,
	coreNodeGraphVisualizationContract,
	coreCandlestickVisualizationContract,
	observabilityLogsVisualizationContract,
	observabilityTraceVisualizationContract,
	observabilityFlameVisualizationContract,
	geoMapVisualizationContract,
	galleryVisualization(
		"core.stat",
		"Stat",
		"kpi",
		[
			"value",
			"value-delta",
			"value-sparkline",
			"value-delta-sparkline",
			"value-list",
		],
		["scalar", "timeseries", "category", "table"],
	),
	kpiGalleryVisualization(
		"core.gauge",
		"Gauge",
		["semi-circle", "full-circle", "needle"],
		gaugeConfigSchema,
		["scalar", "category", "table"],
	),
	kpiGalleryVisualization(
		"core.bar-gauge",
		"Bar Gauge",
		["horizontal", "vertical", "segmented", "retro-lcd"],
		barGaugeConfigSchema,
		["scalar", "category", "table"],
	),
	kpiGalleryVisualization(
		"core.bullet",
		"Bullet",
		["horizontal", "vertical", "comparative"],
		bulletConfigSchema,
		["scalar", "category", "table"],
	),
	kpiGalleryVisualization(
		"core.progress",
		"Progress",
		["linear", "segmented", "steps"],
		progressConfigSchema,
		["scalar", "category", "table"],
	),
	kpiGalleryVisualization(
		"core.traffic-light",
		"Traffic Light",
		["single", "list", "matrix"],
		trafficLightConfigSchema,
		["scalar", "category", "table", "matrix"],
	),
	galleryVisualization(
		"core.table",
		"Table",
		"data",
		["table"],
		["table", "timeseries", "category", "scalar"],
	),
] satisfies VisualizationDefinition<unknown>[];

const galleryMinimumSize = (visualizationType: string) =>
	galleryVisualizations.find(
		(visualization) => visualization.descriptor.type === visualizationType,
	)?.descriptor.minimumSize ?? { w: 2, h: 2 };

function kpiGalleryVisualization<T>(
	type: string,
	displayName: string,
	presets: string[],
	configSchema: z.ZodType<T>,
	supportedShapes: Array<
		"scalar" | "timeseries" | "category" | "table" | "matrix"
	>,
): VisualizationDefinition<T> {
	return {
		descriptor: {
			type,
			displayName,
			description: `${displayName} gallery renderer`,
			category: type === "core.traffic-light" ? "status" : "kpi",
			configSchemaVersion: 1,
			presets: presets.map((id) => ({ id, displayName: id, description: id })),
			defaultPreset: presets[0] ?? "value",
			supportedShapes,
			minimumSize: { w: 2, h: 2 },
			recommendedSize: { w: 6, h: 4 },
			capabilities,
		},
		configSchema,
		defaultOptionsByPreset: Object.fromEntries(presets.map((id) => [id, {}])),
	};
}

const baseTime = Date.UTC(2026, 0, 1, 0, 0, 0);

const galleryAnnotationModes = {
	"timeseries-line": "point",
	"bar-time": "line",
	"timeline-duration": "region",
	"uptime-incidents": "badge",
} as const;

function annotationModeForCase(item: GalleryCase) {
	return galleryAnnotationModes[item.id as keyof typeof galleryAnnotationModes];
}

function withGalleryAnnotations(
	item: GalleryCase,
	frames: ReturnType<typeof framesForCase>,
) {
	const mode = annotationModeForCase(item);
	if (!mode) return frames;
	const annotationFrame = dataFrame({
		refId: "B",
		name: `${mode} annotations`,
		shapeHint: "annotation",
		fields:
			mode === "region"
				? [
						timeField("start", [baseTime + 60_000], {
							roles: ["start-time"],
						}),
						timeField("end", [baseTime + 150_000], {
							roles: ["end-time"],
						}),
						stringField("message", ["Incident window"], {
							roles: ["message"],
						}),
						stringField("severity", ["critical"], {
							roles: ["severity"],
						}),
					]
				: [
						timeField("time", [baseTime + 90_000], { roles: ["time"] }),
						stringField("message", ["Production deploy"], {
							roles: ["message"],
						}),
						stringField("severity", [mode === "badge" ? "critical" : "info"], {
							roles: ["severity"],
						}),
						stringField("url", ["/protected"], { roles: ["url"] }),
					],
	});
	return [...frames, annotationFrame];
}

function framesForCase(item: GalleryCase) {
	const time = [
		baseTime,
		baseTime + 60_000,
		baseTime + 120_000,
		baseTime + 180_000,
	];
	if (item.visualizationType === "core.node-graph") {
		return [
			dataFrame({
				refId: "A",
				name: "Services",
				shapeHint: "graph-nodes",
				fields: [
					stringField("id", ["api", "worker", "db"], { roles: ["id"] }),
					stringField("label", ["API", "Worker", "Database"], {
						roles: ["label"],
					}),
					stringField("category", ["edge", "compute", "data"], {
						roles: ["category"],
					}),
					stringField("state", ["healthy", "warning", "healthy"], {
						roles: ["state"],
					}),
					numberField("value", [2, 4, 1], { roles: ["value"] }),
				],
			}),
			dataFrame({
				refId: "B",
				name: "Dependencies",
				shapeHint: "graph-edges",
				fields: [
					stringField("source", ["api", "api", "worker"], {
						roles: ["source"],
					}),
					stringField("target", ["worker", "db", "db"], { roles: ["target"] }),
					stringField("label", ["calls", "reads", "writes"], {
						roles: ["label"],
					}),
					numberField("value", [2, 4, 1], { roles: ["value"] }),
				],
			}),
		];
	}
	if (item.visualizationType === "core.candlestick") {
		return [
			dataFrame({
				refId: "A",
				name: "Latency buckets",
				shapeHint: "ohlc",
				fields: [
					timeField("time", time, { roles: ["time"] }),
					numberField("open", [10, 12, 11, 15], { roles: ["open"] }),
					numberField("high", [14, 16, 15, 19], { roles: ["high"] }),
					numberField("low", [8, 10, 9, 13], { roles: ["low"] }),
					numberField("close", [12, 11, 14, 17], { roles: ["close"] }),
					numberField("volume", [4, 6, 5, 8], { roles: ["volume"] }),
					numberField("baseline", [11, 11, 11, 11], { roles: ["baseline"] }),
				],
			}),
		];
	}
	if (item.visualizationType === "observability.logs") {
		return [
			dataFrame({
				refId: "A",
				name: "Logs",
				shapeHint: "logs",
				fields: [
					timeField("time", time, { roles: ["time"] }),
					stringField(
						"message",
						[
							"request started",
							"cache miss",
							"request completed",
							"slow response",
						],
						{ roles: ["message"] },
					),
					stringField("severity", ["info", "warning", "info", "error"], {
						roles: ["severity"],
					}),
					stringField("service", ["api", "api", "worker", "api"], {
						roles: ["service"],
					}),
					stringField("trace-id", ["t1", "t1", "t1", "t2"], {
						roles: ["trace-id"],
					}),
					stringField("context", ["before", "focal", "after", "after"], {
						roles: ["state"],
					}),
				],
			}),
		];
	}
	if (item.visualizationType === "observability.trace-waterfall") {
		return [
			dataFrame({
				refId: "A",
				name: "Trace",
				shapeHint: "traces",
				fields: [
					stringField("trace-id", ["t1", "t1", "t1", "t1"], {
						roles: ["trace-id"],
					}),
					stringField("span-id", ["root", "db", "cache", "error"], {
						roles: ["span-id"],
					}),
					stringField("parent-span-id", [null, "root", "root", "db"], {
						roles: ["parent-span-id"],
					}),
					stringField(
						"operation",
						["GET /", "SELECT", "GET cache", "timeout"],
						{ roles: ["operation"] },
					),
					stringField("service", ["api", "db", "cache", "db"], {
						roles: ["service"],
					}),
					timeField("start-time", time, { roles: ["start-time"] }),
					numberField("duration", [180, 80, 40, 60], {
						roles: ["duration"],
						config: { unit: { kind: "duration", unit: "ms" } },
					}),
					stringField("state", ["ok", "ok", "ok", "error"], {
						roles: ["state"],
					}),
				],
			}),
		];
	}
	if (item.visualizationType === "observability.flame-graph") {
		return [
			dataFrame({
				refId: "A",
				name: "Profile",
				shapeHint: "profile",
				fields: [
					stringField("frame-id", ["root", "http", "db", "serialize"], {
						roles: ["id"],
					}),
					stringField("parent-frame-id", [null, "root", "http", "http"], {
						roles: ["parent-id"],
					}),
					stringField("label", ["app", "http", "database", "serialize"], {
						roles: ["label"],
					}),
					numberField("total", [100, 70, 40, 20], { roles: ["total"] }),
					numberField("self", [30, 20, 20, 20], { roles: ["self"] }),
					numberField("delta", [0, 8, -4, 2], { roles: ["delta"] }),
					stringField("category", ["app", "network", "database", "network"], {
						roles: ["category"],
					}),
				],
			}),
		];
	}
	if (item.visualizationType === "geo.map") {
		if (item.preset === "routes")
			return [
				dataFrame({
					refId: "A",
					name: "Routes",
					shapeHint: "geo",
					fields: [
						numberField("source-latitude", [35, 51, -33], {
							roles: ["source-latitude"],
						}),
						numberField("source-longitude", [139, 0, 151], {
							roles: ["source-longitude"],
						}),
						numberField("target-latitude", [37, 48, 1], {
							roles: ["target-latitude"],
						}),
						numberField("target-longitude", [-122, 2, 103], {
							roles: ["target-longitude"],
						}),
						numberField("value", [10, 4, 7], { roles: ["value"] }),
					],
				}),
			];
		if (item.preset === "regions")
			return [
				dataFrame({
					refId: "A",
					name: "Regions",
					shapeHint: "geo",
					fields: [
						stringField("region-id", ["JP", "US", "GB"], {
							roles: ["region-id"],
						}),
						numberField("value", [80, 60, 40], { roles: ["value"] }),
						stringField("label", ["Japan", "United States", "United Kingdom"], {
							roles: ["label"],
						}),
					],
				}),
			];
		return [
			dataFrame({
				refId: "A",
				name: "Locations",
				shapeHint: "geo",
				fields: [
					numberField("latitude", [35.68, 51.5, -33.86, 40.7], {
						roles: ["latitude"],
					}),
					numberField("longitude", [139.76, -0.12, 151.2, -74], {
						roles: ["longitude"],
					}),
					stringField("label", ["Tokyo", "London", "Sydney", "New York"], {
						roles: ["label"],
					}),
					numberField("value", [12, 8, 5, 10], { roles: ["value"] }),
				],
			}),
		];
	}
	if (
		["core.state-timeline", "core.status-history", "core.uptime-grid"].includes(
			item.visualizationType,
		)
	) {
		const stateTimes = [
			baseTime,
			baseTime + 60_000,
			baseTime + 120_000,
			baseTime + 180_000,
			baseTime + 240_000,
		];
		const lanes =
			item.fixture === "state-interval-lanes" ||
			item.fixture === "state-sample-services"
				? ["api", "worker"]
				: ["api"];
		const rows = lanes.flatMap((lane) =>
			stateTimes.map((stamp, index) => ({
				lane,
				stamp,
				state: index === 2 ? "warning" : index === 3 ? "critical" : "healthy",
			})),
		);
		const stateFrame = dataFrame({
			refId: "A",
			name: "Service states",
			shapeHint:
				item.visualizationType === "core.state-timeline" &&
				item.fixture !== "state-sample-cadence"
					? "state-interval"
					: "state-sample",
			fields: [
				timeField(
					"time",
					rows.map((row) => row.stamp),
					{
						roles:
							item.visualizationType === "core.state-timeline" &&
							item.fixture !== "state-sample-cadence"
								? ["start-time"]
								: ["time"],
					},
				),
				stringField(
					"state",
					rows.map((row) => row.state),
					{ roles: ["state"] },
				),
				stringField(
					"service",
					rows.map((row) => row.lane),
					{ roles: ["category"] },
				),
			],
		});
		return [stateFrame];
	}
	if (item.visualizationType === "core.histogram") {
		const values =
			item.fixture === "histogram-series"
				? [4, 8, 12, 15, 18, 22, 25, 28]
				: [1, 2, 2, 3, 4, 5, 5, 8, 13, 21];
		const starts = values.map(
			(_, index) =>
				(item.fixture === "histogram-series" ? index % 4 : index) * 10,
		);
		return [
			dataFrame({
				refId: "A",
				name: "Distribution",
				shapeHint: "distribution",
				fields: [
					numberField("bin-start", starts, { roles: ["bin-start"] }),
					numberField(
						"bin-end",
						starts.map((start) => start + 10),
						{ roles: ["bin-end"] },
					),
					numberField("count", values, { roles: ["count"] }),
					...(item.fixture === "histogram-series"
						? [
								stringField(
									"series",
									["api", "api", "api", "api", "web", "web", "web", "web"],
									{ roles: ["series"] },
								),
							]
						: []),
				],
			}),
		];
	}
	if (item.visualizationType === "core.heatmap") {
		const x = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
		const y = ["API", "Web", "Worker"];
		const rows = y.flatMap((row, yIndex) =>
			x.map((column, xIndex) => ({
				x: column,
				y: row,
				value:
					(xIndex + 1) * (yIndex + 1) - (item.preset === "diverging" ? 8 : 0),
			})),
		);
		return [
			dataFrame({
				refId: "A",
				name: "Matrix",
				shapeHint: "matrix",
				fields: [
					stringField(
						"x",
						rows.map((row) => row.x),
						{ roles: ["x"] },
					),
					stringField(
						"y",
						rows.map((row) => row.y),
						{ roles: ["y"] },
					),
					numberField(
						"value",
						rows.map((row) => row.value),
						{ roles: ["value"] },
					),
				],
			}),
		];
	}
	if (item.visualizationType === "core.box-plot") {
		if (item.fixture === "box-raw")
			return [
				dataFrame({
					refId: "A",
					name: "Raw samples",
					shapeHint: "distribution",
					fields: [
						stringField(
							"category",
							["API", "API", "API", "Web", "Web", "Web", "Web"],
							{ roles: ["category"] },
						),
						numberField("value", [10, 12, 11, 20, 22, 21, 60], {
							roles: ["value"],
						}),
					],
				}),
			];
		const categories =
			item.fixture === "box-summary-series"
				? ["API", "API", "Web", "Web"]
				: ["API", "Web", "Worker"];
		const series =
			item.fixture === "box-summary-series"
				? ["blue", "green", "blue", "green"]
				: undefined;
		return [
			dataFrame({
				refId: "A",
				name: "Five number summary",
				shapeHint: "category",
				fields: [
					stringField("category", categories, { roles: ["category"] }),
					...(series
						? [stringField("series", series, { roles: ["series"] })]
						: []),
					numberField(
						"min",
						[8, 15, 4, ...(series ? [9] : [])].slice(0, categories.length),
						{ roles: ["min"] },
					),
					numberField(
						"q1",
						[10, 18, 6, ...(series ? [11] : [])].slice(0, categories.length),
						{ roles: ["q1"] },
					),
					numberField(
						"median",
						[12, 20, 8, ...(series ? [13] : [])].slice(0, categories.length),
						{ roles: ["median"] },
					),
					numberField(
						"q3",
						[14, 23, 10, ...(series ? [15] : [])].slice(0, categories.length),
						{ roles: ["q3"] },
					),
					numberField(
						"max",
						[18, 28, 14, ...(series ? [18] : [])].slice(0, categories.length),
						{ roles: ["max"] },
					),
				],
			}),
		];
	}
	if (item.visualizationType === "core.calendar-heatmap") {
		const dates = [
			Date.UTC(2026, 0, 1),
			Date.UTC(2026, 0, 2),
			Date.UTC(2026, 0, 5),
			Date.UTC(2026, 1, 28),
			Date.UTC(2026, 2, 1),
		];
		if (item.fixture === "calendar-status")
			return [
				dataFrame({
					refId: "A",
					name: "Status calendar",
					shapeHint: "table",
					fields: [
						timeField("time", dates, { roles: ["time"] }),
						stringField(
							"state",
							["healthy", "warning", "critical", "unknown", "healthy"],
							{ roles: ["state"] },
						),
					],
				}),
			];
		return [
			dataFrame({
				refId: "A",
				name: "Activity calendar",
				shapeHint: "timeseries",
				fields: [
					timeField("time", dates, { roles: ["time"] }),
					numberField("value", [4, 7, 2, 9, 5], { roles: ["value"] }),
				],
			}),
		];
	}
	if (item.fixture === "kpi-summary") {
		if (
			item.visualizationType === "core.stat" &&
			item.preset.includes("sparkline")
		)
			return [
				dataFrame({
					refId: "A",
					name: "KPI trend",
					shapeHint: "timeseries",
					fields: [
						timeField("time", time, { roles: ["time"] }),
						numberField("value", [42, 48, 55, 72], { roles: ["value"] }),
						numberField("previous", [40, 40, 48, 55], { roles: ["previous"] }),
						numberField("delta", [2, 8, 7, 17], { roles: ["delta"] }),
						numberField("goal", [80, 80, 80, 80], { roles: ["goal"] }),
					],
				}),
			];
		if (
			(item.visualizationType === "core.stat" &&
				item.preset === "value-list") ||
			(item.visualizationType === "core.progress" && item.preset === "steps")
		)
			return [
				dataFrame({
					refId: "A",
					name: item.preset === "steps" ? "Deployment steps" : "KPI scorecard",
					shapeHint: "category",
					fields: [
						stringField(
							item.preset === "steps" ? "step" : "service",
							item.preset === "steps"
								? ["Build", "Test", "Deploy", "Verify", "Complete"]
								: ["api", "web", "batch", "worker"],
							{ roles: ["category"] },
						),
						numberField(
							"value",
							item.preset === "steps" ? [100, 100, 60, 0, 0] : [72, 45, 88, 60],
							{ roles: ["value"], config: kpiPercentFieldConfig },
						),
						...(item.preset === "steps"
							? [
									stringField(
										"state",
										["completed", "completed", "current", "pending", "pending"],
										{ roles: ["state"] },
									),
								]
							: []),
					],
				}),
			];
		if (
			["core.bar-gauge", "core.bullet", "core.traffic-light"].includes(
				item.visualizationType,
			)
		)
			return [
				dataFrame({
					refId: "A",
					name: "KPI categories",
					shapeHint: "category",
					fields: [
						stringField("service", ["api", "web", "batch", "worker"], {
							roles: ["category"],
						}),
						numberField("value", [72, 45, 88, 60], {
							roles: ["value"],
							config: kpiPercentFieldConfig,
						}),
						numberField("goal", [80, 70, 85, 75], { roles: ["goal"] }),
					],
				}),
			];
		return [
			dataFrame({
				refId: "A",
				name: "KPI summary",
				shapeHint: "scalar",
				fields: [
					numberField("value", [72], {
						roles: ["value"],
						config: kpiPercentFieldConfig,
					}),
					numberField("previous", [64], { roles: ["previous"] }),
					numberField("delta", [8], { roles: ["delta"] }),
					numberField("goal", [80], { roles: ["goal"] }),
				],
			}),
		];
	}
	if (
		item.visualizationType === "core.pie" ||
		item.visualizationType === "core.radial-bar" ||
		item.visualizationType === "core.funnel" ||
		(item.visualizationType === "core.treemap" && item.preset === "flat")
	) {
		const radialProgress =
			item.visualizationType === "core.radial-bar" &&
			item.preset === "progress";
		return [
			dataFrame({
				refId: "A",
				name: item.fixture,
				shapeHint: "category",
				fields: [
					stringField(
						"category",
						radialProgress
							? ["API", "Web", "Worker", "Database"]
							: [
									"Acquisition",
									"Activation",
									"Retention",
									"Revenue",
									"Referral",
									"Other",
								],
						{ roles: ["category"] },
					),
					numberField(
						"value",
						item.visualizationType === "core.funnel"
							? [100, 74, 51, 28, 12, 5]
							: radialProgress
								? [72, 45, 88, 64]
								: [42, 28, 18, 9, 7, 4],
						{ roles: ["value"] },
					),
				],
			}),
		];
	}
	if (item.visualizationType === "core.radar")
		return [
			dataFrame({
				refId: "A",
				name: item.fixture,
				shapeHint: "category",
				fields: [
					stringField(
						"metric",
						[
							"Latency",
							"Reliability",
							"Throughput",
							"Cost",
							"Adoption",
							"Quality",
						],
						{ roles: ["category"] },
					),
					numberField("service-a", [78, 92, 64, 55, 80, 88], {
						roles: ["value"],
					}),
					...(item.preset === "multi"
						? [
								numberField("service-b", [65, 84, 76, 62, 71, 79], {
									roles: ["value"],
								}),
								numberField("service-c", [88, 72, 70, 48, 90, 68], {
									roles: ["value"],
								}),
							]
						: []),
				],
			}),
		];
	if (item.visualizationType === "core.scatter")
		return [
			dataFrame({
				refId: "A",
				name: item.fixture,
				shapeHint: "distribution",
				fields: [
					numberField("x", [1, 2, 3, 4, 5, 6], { roles: ["x"] }),
					numberField("y", [12, 18, 16, 31, 28, 42], { roles: ["y"] }),
					...(item.preset === "bubble"
						? [numberField("size", [4, 8, 12, 16, 10, 20], { roles: ["size"] })]
						: []),
					stringField(
						"series",
						["api", "api", "web", "web", "worker", "worker"],
						{ roles: ["series"] },
					),
				],
			}),
		];
	if (
		item.visualizationType === "core.treemap" ||
		item.visualizationType === "core.sunburst"
	)
		return [
			dataFrame({
				refId: "A",
				name: item.fixture,
				shapeHint: "hierarchy",
				fields: [
					stringField("id", ["all", "platform", "web", "api", "data"], {
						roles: ["id"],
					}),
					stringField("parent", [null, "all", "platform", "platform", "all"], {
						roles: ["parent-id"],
					}),
					stringField("label", ["All", "Platform", "Web", "API", "Data"], {
						roles: ["category"],
					}),
					numberField("value", [100, 60, 35, 25, 40], { roles: ["value"] }),
				],
			}),
		];
	if (item.visualizationType === "core.sankey")
		return [
			dataFrame({
				refId: "A",
				name: "Nodes",
				shapeHint: "graph-nodes",
				fields: [
					stringField("id", ["entry", "web", "api", "db"], { roles: ["id"] }),
					stringField("label", ["Entry", "Web", "API", "DB"], {
						roles: ["category"],
					}),
					stringField("group", ["source", "app", "app", "store"], {
						roles: ["series"],
					}),
				],
			}),
			dataFrame({
				refId: "B",
				name: "Edges",
				shapeHint: "graph-edges",
				fields: [
					stringField("source", ["entry", "entry", "web", "api"], {
						roles: ["source"],
					}),
					stringField("target", ["web", "api", "api", "db"], {
						roles: ["target"],
					}),
					numberField("value", [70, 30, 50, 80], { roles: ["value"] }),
				],
			}),
		];
	if (item.fixture === "empty")
		return [
			dataFrame({
				refId: "A",
				name: "Empty",
				shapeHint: "table",
				fields: [stringField("label", [], { roles: ["category"] })],
			}),
		];
	if (item.fixture === "scalar-mapping")
		return [
			dataFrame({
				refId: "A",
				name: "Current value",
				shapeHint: "scalar",
				fields: [
					numberField("value", [42], { roles: ["value"], label: "Current" }),
				],
			}),
		];
	if (item.fixture === "no-value")
		return [
			dataFrame({
				refId: "A",
				name: "No value",
				shapeHint: "scalar",
				fields: [
					numberField("value", [null], { roles: ["value"], label: "Current" }),
				],
			}),
		];
	if (["mixed-fields", "truncated"].includes(item.fixture))
		return [
			dataFrame({
				refId: "A",
				name: "Mixed fields",
				shapeHint: "table",
				fields: [
					timeField("time", time, { roles: ["time"] }),
					stringField("service", ["api", "web", null, "worker"], {
						roles: ["category"],
					}),
					numberField("requests", [12, 0, -4, 18], { roles: ["value"] }),
					booleanField("healthy", [true, true, false, null], {
						roles: ["state"],
					}),
				],
			}),
		];
	if (item.fixture === "positive-zero-negative")
		return [
			dataFrame({
				refId: "A",
				name: "Categories",
				shapeHint: "category",
				fields: [
					stringField("service", ["api", "web", "batch", "worker"], {
						roles: ["category"],
					}),
					numberField("requests", [12, 0, -4, 18], { roles: ["value"] }),
				],
			}),
		];
	if (item.visualizationType === "core.composed")
		return [
			dataFrame({
				refId: "A",
				name: "Count and latency",
				shapeHint: "timeseries",
				fields: [
					timeField("time", time, { roles: ["time"] }),
					numberField("count", [10, 12, 18, 15], { roles: ["value"] }),
					numberField("latency", [120, 150, 110, 180], { roles: ["value"] }),
				],
			}),
		];
	if (item.visualizationType === "core.bar" && item.preset.includes("time"))
		return [
			dataFrame({
				refId: "A",
				name: item.fixture,
				shapeHint: "timeseries",
				fields: [
					timeField("time", time, { roles: ["time"] }),
					numberField("requests", [12, 18, 15, 21], { roles: ["value"] }),
					numberField("errors", [1, 2, 1, 3], { roles: ["value"] }),
				],
			}),
		];
	if (item.visualizationType === "core.bar")
		return [
			dataFrame({
				refId: "A",
				name: item.fixture,
				shapeHint: "category",
				fields: [
					stringField("service", ["api", "web", "batch", "worker"], {
						roles: ["category"],
					}),
					numberField(
						"requests",
						item.preset === "waterfall" ? [100, -40, -10, 20] : [12, 0, 18, 8],
						{ roles: ["value"] },
					),
					...(item.preset === "grouped" || item.preset.includes("stacked")
						? [numberField("errors", [2, 4, 1, 3], { roles: ["value"] })]
						: []),
				],
			}),
		];
	if (item.preset === "range-band")
		return [
			dataFrame({
				refId: "A",
				name: "Range band",
				shapeHint: "timeseries",
				fields: [
					timeField("time", time, { roles: ["time"] }),
					numberField("lower", [10, 12, 11, 13], { roles: ["value"] }),
					numberField("upper", [14, 16, 15, 19], { roles: ["value"] }),
				],
			}),
		];
	if (item.fixture === "multi-frame")
		return [
			dataFrame({
				refId: "A",
				name: "Primary",
				shapeHint: "table",
				fields: [stringField("value", ["primary"], { roles: ["category"] })],
			}),
			dataFrame({
				refId: "B",
				name: "Secondary",
				shapeHint: "table",
				fields: [stringField("value", ["secondary"], { roles: ["category"] })],
			}),
		];
	return [
		dataFrame({
			refId: "A",
			name: item.fixture,
			shapeHint: "timeseries",
			fields: [
				timeField("time", time, { roles: ["time"] }),
				numberField(
					"requests",
					item.fixture === "gap-and-override" ? [2, null, 4, 5] : [1, 3, 2, 6],
					{ roles: ["value"] },
				),
				...(item.preset === "sparkline"
					? []
					: [numberField("errors", [0, 1, 0, 2], { roles: ["value"] })]),
			],
		}),
	];
}

function stateForCase(item: GalleryCase) {
	if (item.fixture === "empty")
		return {
			emptyReason: "no-records" as const,
			partial: false,
			truncated: false,
			notices: [],
		};
	if (item.fixture === "partial")
		return {
			partial: true,
			truncated: false,
			notices: [
				{
					code: "PARTIAL_DATA",
					severity: "warning" as const,
					message: "Some points are delayed",
				},
			],
		};
	if (item.fixture === "stale")
		return {
			partial: false,
			truncated: false,
			dataThrough: new Date(baseTime).toISOString(),
			staleAfterMs: 60_000,
			notices: [],
		};
	if (item.fixture === "truncated")
		return {
			partial: false,
			truncated: true,
			notices: [
				{
					code: "DATA_TRUNCATED",
					severity: "warning" as const,
					message: "Rows were limited",
				},
			],
		};
	return undefined;
}

const queries = galleryCases.map((item) =>
	defineDashboardQueryV2({
		id: `gallery-${item.id}`,
		filterKeys: [],
		outputShapes: [
			...(item.visualizationType === "core.node-graph"
				? (["graph-nodes", "graph-edges"] as DashboardDataShape[])
				: item.visualizationType === "core.candlestick"
					? (["ohlc"] as DashboardDataShape[])
					: item.visualizationType === "observability.logs"
						? (["logs"] as DashboardDataShape[])
						: item.visualizationType === "observability.trace-waterfall"
							? (["traces"] as DashboardDataShape[])
							: item.visualizationType === "observability.flame-graph"
								? (["profile"] as DashboardDataShape[])
								: item.visualizationType === "geo.map"
									? (["geo"] as DashboardDataShape[])
									: (([
											"core.state-timeline",
											"core.status-history",
											"core.uptime-grid",
										].includes(item.visualizationType)
											? [
													item.visualizationType === "core.state-timeline" &&
													item.fixture !== "state-sample-cadence"
														? "state-interval"
														: "state-sample",
												]
											: item.visualizationType === "core.histogram"
												? ["distribution"]
												: item.visualizationType === "core.box-plot"
													? [
															item.fixture === "box-raw"
																? "distribution"
																: "category",
														]
													: item.visualizationType === "core.heatmap"
														? ["matrix"]
														: item.visualizationType === "core.calendar-heatmap"
															? [
																	item.fixture === "calendar-status"
																		? "table"
																		: "timeseries",
																]
															: item.visualizationType === "core.sankey"
																? ["graph-nodes", "graph-edges"]
																: item.fixture === "multi-frame"
																	? ["table", "table"]
																	: [
																				"mixed-fields",
																				"empty",
																				"truncated",
																			].includes(item.fixture)
																		? ["table"]
																		: item.visualizationType === "core.stat" &&
																				item.preset.includes("sparkline")
																			? ["timeseries"]
																			: (item.visualizationType ===
																						"core.stat" &&
																						item.preset === "value-list") ||
																					(item.visualizationType ===
																						"core.progress" &&
																						item.preset === "steps")
																				? ["category"]
																				: item.visualizationType ===
																							"core.timeseries" ||
																						item.visualizationType ===
																							"core.composed" ||
																						item.preset.includes("time")
																					? ["timeseries"]
																					: item.fixture === "kpi-summary" &&
																							[
																								"core.bar-gauge",
																								"core.bullet",
																								"core.traffic-light",
																							].includes(item.visualizationType)
																						? ["category"]
																						: item.visualizationType ===
																									"core.stat" ||
																								[
																									"core.gauge",
																									"core.progress",
																									"core.traffic-light",
																								].includes(
																									item.visualizationType,
																								)
																							? ["scalar"]
																							: item.visualizationType ===
																									"core.scatter"
																								? ["distribution"]
																								: (item.visualizationType ===
																											"core.treemap" &&
																											item.preset ===
																												"nested") ||
																										item.visualizationType ===
																											"core.sunburst"
																									? ["hierarchy"]
																									: [
																											"category",
																										]) as DashboardDataShape[])),
			...(annotationModeForCase(item)
				? (["annotation"] as DashboardDataShape[])
				: []),
		],
		handler: async () =>
			queryResult({
				frames: withGalleryAnnotations(item, framesForCase(item)),
				state: stateForCase(item),
			}),
	}),
);

export const galleryDashboardV2: DashboardDefinitionV2 = defineDashboardV2({
	manifest: {
		schemaVersion: 2,
		revision: 3,
		id: GALLERY_DASHBOARD_ID,
		title: "Visualization Gallery",
		description:
			"Deterministic renderer and state fixtures for Dashboard quality gates.",
		layoutVersion: 2,
		defaultRange: { kind: "relative", value: "1h" },
		defaultTimezone: "UTC",
		defaultRefreshSeconds: 0,
		variables: [],
		panels: galleryCases.map((item, index) => ({
			id: item.id,
			title: item.title ?? `${item.visualizationType} / ${item.preset}`,
			description: item.description ?? `${item.fixture} fixture`,
			layout: {
				x:
					item.visualizationType === "core.sankey" ||
					item.visualizationType === "core.treemap" ||
					item.visualizationType === "core.sunburst" ||
					[
						"core.node-graph",
						"core.candlestick",
						"observability.logs",
						"observability.trace-waterfall",
						"observability.flame-graph",
						"geo.map",
					].includes(item.visualizationType)
						? 0
						: (index % 2) * 6,
				y: Math.floor(index / 2) * 5,
				w:
					item.visualizationType === "core.sankey"
						? 12
						: [
									"core.node-graph",
									"core.candlestick",
									"observability.logs",
									"observability.trace-waterfall",
									"observability.flame-graph",
									"geo.map",
								].includes(item.visualizationType)
							? 10
							: item.visualizationType === "core.treemap" ||
									item.visualizationType === "core.sunburst"
								? 8
								: item.preset === "sparkline"
									? 4
									: 6,
				h:
					item.visualizationType === "core.sankey"
						? 6
						: [
									"core.node-graph",
									"core.candlestick",
									"observability.logs",
									"observability.trace-waterfall",
									"observability.flame-graph",
									"geo.map",
								].includes(item.visualizationType)
							? 6
							: item.visualizationType === "core.treemap" ||
									item.visualizationType === "core.sunburst"
								? 6
								: item.preset === "sparkline"
									? 2
									: 4,
				minW: galleryMinimumSize(item.visualizationType).w,
				minH: galleryMinimumSize(item.visualizationType).h,
			},
			queries: [
				{
					refId: "A",
					queryId: `gallery-${item.id}`,
					outputFrameRefs:
						item.fixture === "multi-frame" ||
						item.visualizationType === "core.sankey" ||
						item.visualizationType === "core.node-graph"
							? ["A", "B"]
							: annotationModeForCase(item)
								? ["A", "B"]
								: ["A"],
					hidden: false,
				},
			],
			transformations: [],
			visualization: {
				type: item.visualizationType,
				preset: item.preset,
				frameRefs:
					item.fixture === "multi-frame" ||
					item.visualizationType === "core.sankey" ||
					item.visualizationType === "core.node-graph"
						? ["A", "B"]
						: ["A"],
				options: {},
				fieldConfig: emptyFieldConfig,
				overrides: [],
				annotationLayers: annotationModeForCase(item)
					? [
							{
								id: `${annotationModeForCase(item)}-annotations`,
								frameRef: "B",
								mode: annotationModeForCase(item),
								enabled: true,
								name: `${annotationModeForCase(item)} annotations`,
								severityFilter: [],
								showLabel: "always",
							},
						]
					: [],
				tableFallback: { enabled: true, defaultView: "visualization" },
			},
			accessibleLabel: `${item.visualizationType} ${item.preset} ${item.fixture}`,
			links: [],
		})),
		inspectorEnabled: true,
	},
	variables: [],
	queries,
});

export const galleryTransformations: AnyTransformationRuntimeDefinition<never>[] =
	[];
