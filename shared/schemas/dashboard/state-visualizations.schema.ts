import { z } from "zod";
import { dashboardFieldKeySchema } from "./common.schema";
import type { DashboardJsonObject } from "./json-value.schema";
import type { VisualizationDefinition } from "./visualization.schema";

const capabilities = {
	legend: true,
	tooltip: true,
	sharedCrosshair: false,
	zoom: false,
	rangeSelection: false,
	annotations: true,
	fieldOverrides: true,
	tableFallback: true,
	exportImage: false,
	exportData: true,
	mobileSummary: true,
} as const;
const presets = (ids: readonly string[]) =>
	ids.map((id) => ({ id, displayName: id, description: id }));
const seconds = (value: number) => value * 1_000;

const laneField = dashboardFieldKeySchema.optional();
const cadence = z
	.number()
	.int()
	.min(seconds(1))
	.max(7 * 24 * 60 * 60 * 1_000)
	.optional();

export const stateTimelineConfigV1Schema = z
	.object({
		laneFieldKey: laneField,
		stateFieldKey: dashboardFieldKeySchema.optional(),
		mergeAdjacent: z.boolean().default(false),
		mergeBy: z.enum(["raw", "semantic"]).default("raw"),
		showValues: z.enum(["auto", "always", "never"]).default("auto"),
		showDuration: z.boolean().default(true),
		gapMode: z.enum(["blank", "unknown-token"]).default("blank"),
		rowHeight: z.number().int().min(20).max(64).default(32),
		expectedCadenceMs: cadence,
	})
	.strict();
export type StateTimelineConfigV1 = z.infer<typeof stateTimelineConfigV1Schema>;

export const statusHistoryConfigV1Schema = z
	.object({
		laneFieldKey: laneField,
		expectedCadenceMs: cadence,
		cadenceTolerancePercent: z.number().min(0).max(50).default(10),
		cellWidth: z.number().int().min(12).max(80).default(28),
		rowHeight: z.number().int().min(20).max(64).default(28),
		missing: z.enum(["gap", "unknown-token"]).default("gap"),
		emphasizeChanges: z.boolean().default(false),
		latestColumn: z.boolean().default(false),
	})
	.strict();
export type StatusHistoryConfigV1 = z.infer<typeof statusHistoryConfigV1Schema>;

export const uptimeGridConfigV1Schema = z
	.object({
		bucket: z.enum(["hour", "day"]).default("day"),
		range: z
			.union([
				z.literal("query"),
				z.object({ rollingDays: z.number().int().min(1).max(365) }).strict(),
			])
			.default("query"),
		minimumCoveragePercent: z.number().min(0).max(100).default(80),
		showPercentage: z.boolean().default(true),
		showIncidentCount: z.boolean().default(false),
		weekStartsOn: z.enum(["monday", "sunday"]).default("monday"),
		missing: z.enum(["gap", "unknown-token"]).default("gap"),
	})
	.strict();
export type UptimeGridConfigV1 = z.infer<typeof uptimeGridConfigV1Schema>;

const defaults = (extra: DashboardJsonObject = {}) => ({ ...extra });
const stateTimelinePresets = [
	"single-lane",
	"multi-lane",
	"merged-adjacent",
	"duration-emphasis",
	"compact",
	"threshold-derived",
] as const;
const historyPresets = [
	"grid",
	"bands",
	"multi-series",
	"changes-only",
	"latest-column",
	"compact",
] as const;
const uptimePresets = [
	"hourly",
	"daily",
	"rolling-30d",
	"rolling-90d",
	"service-matrix",
	"incident-overlay",
] as const;

export const coreStateTimelineVisualizationContract: VisualizationDefinition<StateTimelineConfigV1> =
	{
		descriptor: {
			type: "core.state-timeline",
			displayName: "State Timeline",
			description: "State intervals over time",
			category: "status",
			configSchemaVersion: 1,
			presets: presets(stateTimelinePresets),
			defaultPreset: "single-lane",
			supportedShapes: ["state-interval", "state-sample"],
			minimumSize: { w: 3, h: 3 },
			recommendedSize: { w: 8, h: 5 },
			capabilities,
		},
		configSchema: stateTimelineConfigV1Schema,
		defaultOptionsByPreset: {
			"single-lane": defaults({ rowHeight: 32 }),
			"multi-lane": defaults({ rowHeight: 28 }),
			"merged-adjacent": defaults({ mergeAdjacent: true }),
			"duration-emphasis": defaults({ showDuration: true }),
			compact: defaults({ rowHeight: 20, showValues: "never" }),
			"threshold-derived": defaults({ expectedCadenceMs: 60_000 }),
		},
	};

export const coreStatusHistoryVisualizationContract: VisualizationDefinition<StatusHistoryConfigV1> =
	{
		descriptor: {
			type: "core.status-history",
			displayName: "Status History",
			description: "Scheduled state observations",
			category: "status",
			configSchemaVersion: 1,
			presets: presets(historyPresets),
			defaultPreset: "grid",
			supportedShapes: ["state-sample"],
			minimumSize: { w: 3, h: 3 },
			recommendedSize: { w: 8, h: 5 },
			capabilities,
		},
		configSchema: statusHistoryConfigV1Schema,
		defaultOptionsByPreset: {
			grid: defaults(),
			bands: defaults({ emphasizeChanges: false }),
			"multi-series": defaults(),
			"changes-only": defaults({ emphasizeChanges: true }),
			"latest-column": defaults({ latestColumn: true }),
			compact: defaults({ cellWidth: 20, rowHeight: 20 }),
		},
	};

export const coreUptimeGridVisualizationContract: VisualizationDefinition<UptimeGridConfigV1> =
	{
		descriptor: {
			type: "core.uptime-grid",
			displayName: "Uptime Grid",
			description: "Bucketed uptime and coverage",
			category: "status",
			configSchemaVersion: 1,
			presets: presets(uptimePresets),
			defaultPreset: "daily",
			supportedShapes: ["state-sample", "state-interval"],
			minimumSize: { w: 3, h: 3 },
			recommendedSize: { w: 8, h: 5 },
			capabilities,
		},
		configSchema: uptimeGridConfigV1Schema,
		defaultOptionsByPreset: {
			hourly: defaults({ bucket: "hour" }),
			daily: defaults({ bucket: "day" }),
			"rolling-30d": defaults({ range: { rollingDays: 30 } }),
			"rolling-90d": defaults({ range: { rollingDays: 90 } }),
			"service-matrix": defaults(),
			"incident-overlay": defaults({ showIncidentCount: true }),
		},
	};
