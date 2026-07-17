import { z } from "zod";
import type { DashboardJsonObject } from "./json-value.schema";
import type { VisualizationDefinition } from "./visualization.schema";

const preset = (id: string, displayName: string, description: string) => ({
	id,
	displayName,
	description,
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

export const nodeGraphConfigSchema = z
	.object({
		orientation: z.enum(["left-right", "top-bottom"]).default("left-right"),
		nodeSize: z.enum(["compact", "normal"]).default("normal"),
		edgeScale: z.enum(["fixed", "value"]).default("fixed"),
		showEdgeLabels: z.boolean().default(false),
		maxLabelLength: z.number().int().min(8).max(256).default(48),
	})
	.strict();
export type NodeGraphConfig = z.infer<typeof nodeGraphConfigSchema>;

export const candlestickConfigSchema = z
	.object({
		yDomain: z.enum(["auto", "zero", "config"]).default("auto"),
		candleGapRatio: z.number().min(0).max(0.8).default(0.2),
		showWicks: z.boolean().default(true),
		baseline: z.number().finite().optional(),
	})
	.strict();
export type CandlestickConfig = z.infer<typeof candlestickConfigSchema>;

export const logsConfigSchema = z
	.object({
		order: z.enum(["ascending", "descending"]).default("ascending"),
		wrap: z.boolean().default(true),
		showTimestamp: z.boolean().default(true),
		showAttributes: z.boolean().default(false),
		attributeFields: z.array(z.string().min(1).max(80)).max(12).default([]),
		maxMessageCharacters: z.number().int().min(80).max(8192).default(2000),
	})
	.strict()
	.superRefine((value, context) => {
		if (new Set(value.attributeFields).size !== value.attributeFields.length)
			context.addIssue({
				code: "custom",
				path: ["attributeFields"],
				message: "attribute fields must be unique",
			});
	});
export type LogsConfig = z.infer<typeof logsConfigSchema>;

export const traceConfigSchema = z
	.object({
		order: z.enum(["tree", "start-time", "duration"]).default("tree"),
		showService: z.boolean().default(true),
		showIdle: z.boolean().default(false),
		minDurationPercent: z.number().min(0).max(100).default(0.05),
		attributeFields: z.array(z.string().min(1).max(80)).max(12).default([]),
	})
	.strict()
	.superRefine((value, context) => {
		if (new Set(value.attributeFields).size !== value.attributeFields.length)
			context.addIssue({
				code: "custom",
				path: ["attributeFields"],
				message: "attribute fields must be unique",
			});
	});
export type TraceConfig = z.infer<typeof traceConfigSchema>;

export const flameGraphConfigSchema = z
	.object({
		minVisibleWidthPx: z.number().int().min(1).max(20).default(2),
		maxDepth: z.number().int().min(1).max(128).default(64),
	})
	.strict();
export type FlameGraphConfig = z.infer<typeof flameGraphConfigSchema>;

export const geomapConfigSchema = z
	.object({
		clusterCellPx: z.number().int().min(16).max(96).default(32),
		showOutline: z.boolean().default(true),
	})
	.strict();
export type GeomapConfig = z.infer<typeof geomapConfigSchema>;

const defaults = (entries: Array<[string, DashboardJsonObject]>) =>
	Object.fromEntries(entries) as Record<string, DashboardJsonObject>;

const base = (
	type: string,
	displayName: string,
	category: "time" | "relationship" | "observability",
	supportedShapes: Array<
		| "graph-nodes"
		| "graph-edges"
		| "ohlc"
		| "logs"
		| "traces"
		| "profile"
		| "geo"
	>,
	defaultPreset: string,
	minimumSize: { w: number; h: number },
	recommendedSize: { w: number; h: number },
	presets: Array<{ id: string; displayName: string; description: string }>,
) => ({
	descriptor: {
		type,
		displayName,
		description: `${displayName} specialized visualization`,
		category,
		configSchemaVersion: 1,
		presets,
		defaultPreset,
		supportedShapes,
		minimumSize,
		recommendedSize,
		capabilities,
	},
});

const nodePresets = [
	"service-map",
	"dependency",
	"directed",
	"grouped",
	"critical-path",
].map((id) => preset(id, id, `Node graph ${id}`));
export const coreNodeGraphVisualizationContract = {
	...base(
		"core.node-graph",
		"Node Graph",
		"relationship",
		["graph-nodes", "graph-edges"],
		"service-map",
		{ w: 6, h: 5 },
		{ w: 10, h: 6 },
		nodePresets,
	),
	configSchema: nodeGraphConfigSchema,
	defaultOptionsByPreset: defaults([
		[
			"service-map",
			{
				orientation: "left-right",
				nodeSize: "normal",
				edgeScale: "value",
				showEdgeLabels: false,
				maxLabelLength: 48,
			},
		],
		[
			"dependency",
			{
				orientation: "left-right",
				nodeSize: "normal",
				edgeScale: "fixed",
				showEdgeLabels: false,
				maxLabelLength: 48,
			},
		],
		[
			"directed",
			{
				orientation: "left-right",
				nodeSize: "compact",
				edgeScale: "fixed",
				showEdgeLabels: true,
				maxLabelLength: 40,
			},
		],
		[
			"grouped",
			{
				orientation: "top-bottom",
				nodeSize: "normal",
				edgeScale: "value",
				showEdgeLabels: false,
				maxLabelLength: 44,
			},
		],
		[
			"critical-path",
			{
				orientation: "left-right",
				nodeSize: "normal",
				edgeScale: "value",
				showEdgeLabels: false,
				maxLabelLength: 48,
			},
		],
	]),
} satisfies VisualizationDefinition<NodeGraphConfig>;

const candlePresets = [
	"candles",
	"hollow",
	"volume",
	"range-bars",
	"baseline-comparison",
].map((id) => preset(id, id, `OHLC ${id}`));
export const coreCandlestickVisualizationContract = {
	...base(
		"core.candlestick",
		"Candlestick",
		"time",
		["ohlc"],
		"candles",
		{ w: 5, h: 4 },
		{ w: 8, h: 5 },
		candlePresets,
	),
	configSchema: candlestickConfigSchema,
	defaultOptionsByPreset: defaults(
		candlePresets.map((item) => [
			item.id,
			{
				yDomain: "auto",
				candleGapRatio:
					item.id === "range-bars" ? 0.35 : item.id === "hollow" ? 0.25 : 0.2,
				showWicks: true,
			},
		]),
	),
} satisfies VisualizationDefinition<CandlestickConfig>;

const logPresets = [
	"stream",
	"compact",
	"severity",
	"structured",
	"context",
].map((id) => preset(id, id, `Logs ${id}`));
export const observabilityLogsVisualizationContract = {
	...base(
		"observability.logs",
		"Logs",
		"observability",
		["logs"],
		"stream",
		{ w: 5, h: 4 },
		{ w: 8, h: 6 },
		logPresets,
	),
	configSchema: logsConfigSchema,
	defaultOptionsByPreset: defaults([
		[
			"stream",
			{
				order: "ascending",
				wrap: true,
				showTimestamp: true,
				showAttributes: false,
				attributeFields: [],
				maxMessageCharacters: 2000,
			},
		],
		[
			"compact",
			{
				order: "descending",
				wrap: false,
				showTimestamp: true,
				showAttributes: false,
				attributeFields: [],
				maxMessageCharacters: 240,
			},
		],
		[
			"severity",
			{
				order: "descending",
				wrap: false,
				showTimestamp: true,
				showAttributes: false,
				attributeFields: [],
				maxMessageCharacters: 1000,
			},
		],
		[
			"structured",
			{
				order: "descending",
				wrap: false,
				showTimestamp: true,
				showAttributes: true,
				attributeFields: [],
				maxMessageCharacters: 1000,
			},
		],
		[
			"context",
			{
				order: "ascending",
				wrap: true,
				showTimestamp: true,
				showAttributes: true,
				attributeFields: [],
				maxMessageCharacters: 2000,
			},
		],
	]),
} satisfies VisualizationDefinition<LogsConfig>;

const tracePresets = [
	"waterfall",
	"service-colored",
	"critical-path",
	"errors-only",
	"compact",
].map((id) => preset(id, id, `Trace ${id}`));
export const observabilityTraceVisualizationContract = {
	...base(
		"observability.trace-waterfall",
		"Trace Waterfall",
		"observability",
		["traces"],
		"waterfall",
		{ w: 7, h: 5 },
		{ w: 12, h: 6 },
		tracePresets,
	),
	configSchema: traceConfigSchema,
	defaultOptionsByPreset: defaults(
		tracePresets.map((item) => [
			item.id,
			{
				order: item.id === "compact" ? "duration" : "tree",
				showService: true,
				showIdle: false,
				minDurationPercent:
					item.id === "errors-only" ? 0 : item.id === "compact" ? 0.5 : 0.05,
				attributeFields: [],
			},
		]),
	),
} satisfies VisualizationDefinition<TraceConfig>;

const flamePresets = [
	"flame",
	"icicle",
	"differential",
	"category-colored",
	"compact",
].map((id) => preset(id, id, `Flame graph ${id}`));
export const observabilityFlameVisualizationContract = {
	...base(
		"observability.flame-graph",
		"Flame Graph",
		"observability",
		["profile"],
		"flame",
		{ w: 6, h: 5 },
		{ w: 10, h: 6 },
		flamePresets,
	),
	configSchema: flameGraphConfigSchema,
	defaultOptionsByPreset: defaults(
		flamePresets.map((item) => [
			item.id,
			{
				minVisibleWidthPx: item.id === "compact" ? 4 : 2,
				maxDepth: item.id === "compact" ? 16 : 64,
			},
		]),
	),
} satisfies VisualizationDefinition<FlameGraphConfig>;

const geoPresets = [
	"points",
	"proportional-symbol",
	"routes",
	"regions",
	"clusters",
].map((id) => preset(id, id, `Geomap ${id}`));
export const geoMapVisualizationContract = {
	...base(
		"geo.map",
		"Geomap",
		"relationship",
		["geo"],
		"points",
		{ w: 6, h: 5 },
		{ w: 10, h: 6 },
		geoPresets,
	),
	configSchema: geomapConfigSchema,
	defaultOptionsByPreset: defaults(
		geoPresets.map((item) => [
			item.id,
			{ clusterCellPx: item.id === "clusters" ? 40 : 32, showOutline: true },
		]),
	),
} satisfies VisualizationDefinition<GeomapConfig>;
