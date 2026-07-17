import { z } from "zod";
import {
	dataFrame,
	numberField,
	queryResult,
	stringField,
	timeField,
} from "./frame-builders";
import { defineDashboardV2, defineDashboardQueryV2 } from "./define-dashboard";
import type { DashboardDefinitionV2 } from "./types";
import type { AnyTransformationRuntimeDefinition } from "./transformation-registry";
import type { VisualizationDefinition } from "../../../../shared/schemas/dashboard.schema";

export const nativeVisualization: VisualizationDefinition<
	Record<string, never>
> = {
	descriptor: {
		type: "test.timeseries",
		displayName: "Test timeseries",
		description: "Deterministic test visualization",
		category: "time",
		configSchemaVersion: 1,
		presets: [{ id: "line", displayName: "Line", description: "Line" }],
		defaultPreset: "line",
		supportedShapes: ["timeseries", "category", "table"],
		minimumSize: { w: 1, h: 1 },
		recommendedSize: { w: 6, h: 4 },
		capabilities: {
			legend: true,
			tooltip: true,
			sharedCrosshair: true,
			zoom: true,
			rangeSelection: true,
			annotations: false,
			fieldOverrides: true,
			tableFallback: true,
			exportImage: false,
			exportData: true,
			mobileSummary: true,
		},
	},
	configSchema: z.object({}).strict(),
	defaultOptionsByPreset: { line: {} },
};

export const nativeTransformations: AnyTransformationRuntimeDefinition<
	Record<string, never>
>[] = [
	{
		descriptor: {
			type: "test.browser",
			displayName: "Browser transform",
			description: "Browser only",
			configSchemaVersion: 1,
			inputShapes: ["any"],
			outputShape: "preserve",
			serverCapable: false,
			browserCapable: true,
		},
		configSchema: z.object({}).strict(),
	},
	{
		descriptor: {
			type: "test.server",
			displayName: "Server transform",
			description: "Server only",
			configSchemaVersion: 1,
			inputShapes: ["any"],
			outputShape: "preserve",
			serverCapable: true,
			browserCapable: false,
		},
		configSchema: z.object({}).strict(),
		execute: ({ inputFrames }) => ({
			frame: { ...inputFrames[0], refId: "D", name: "Transformed" },
		}),
	},
];

export function nativeV2Fixture(): DashboardDefinitionV2 {
	return defineDashboardV2({
		manifest: {
			schemaVersion: 2,
			revision: 1,
			id: "native-v2",
			title: "Native v2 fixture",
			description: "Deterministic native dashboard fixture",
			layoutVersion: 1,
			defaultRange: { kind: "relative", value: "1h" },
			defaultTimezone: "UTC",
			defaultRefreshSeconds: 0,
			variables: [
				{
					id: "service",
					label: "Service",
					selection: "single",
					required: true,
					defaultValues: ["api"],
					dependsOn: [],
					source: {
						kind: "static",
						options: [{ value: "api", label: "API", disabled: false }],
					},
				},
				{
					id: "region",
					label: "Region",
					selection: "multiple",
					required: false,
					defaultValues: [],
					dependsOn: ["service"],
					source: { kind: "query", queryId: "region-options" },
				},
			],
			panels: [
				{
					id: "overview",
					title: "Overview",
					description: "",
					layout: { x: 0, y: 0, w: 12, h: 6, minW: 1, minH: 1 },
					queries: [
						{
							refId: "A",
							queryId: "requests",
							outputFrameRefs: ["A"],
							hidden: false,
						},
						{
							refId: "B",
							queryId: "regions",
							outputFrameRefs: ["B"],
							hidden: true,
						},
					],
					transformations: [
						{
							id: "browser-preview",
							type: "test.browser",
							execution: "browser",
							inputFrameRefs: ["A"],
							outputFrameRefId: "C",
							options: {},
							disabled: false,
						},
						{
							id: "server-copy",
							type: "test.server",
							execution: "server",
							inputFrameRefs: ["B"],
							outputFrameRefId: "D",
							options: {},
							disabled: false,
						},
					],
					visualization: {
						type: "test.timeseries",
						preset: "line",
						frameRefs: ["A", "D"],
						options: {},
						fieldConfig: {
							unit: { kind: "none" },
							decimals: "auto",
							noValueText: "—",
							textAlign: "auto",
							valueMappings: [],
							links: [],
						},
						overrides: [],
						tableFallback: { enabled: true, defaultView: "visualization" },
					},
					accessibleLabel: "Native fixture overview",
					links: [],
				},
			],
			inspectorEnabled: true,
		},
		variables: [
			{
				manifest: {
					id: "service",
					label: "Service",
					selection: "single",
					required: true,
					defaultValues: ["api"],
					dependsOn: [],
					source: {
						kind: "static",
						options: [{ value: "api", label: "API", disabled: false }],
					},
				},
			},
			{
				manifest: {
					id: "region",
					label: "Region",
					selection: "multiple",
					required: false,
					defaultValues: [],
					dependsOn: ["service"],
					source: { kind: "query", queryId: "region-options" },
				},
				options: async () => [
					{ value: "global", label: "Global", disabled: false },
				],
			},
		],
		queries: [
			defineDashboardQueryV2({
				id: "region-options",
				filterKeys: ["service"],
				outputShapes: ["table"],
				handler: async () =>
					queryResult({
						frames: [
							dataFrame({
								refId: "R",
								name: "Options",
								shapeHint: "table",
								fields: [
									stringField("value", ["global"], { roles: ["category"] }),
								],
							}),
						],
					}),
			}),
			defineDashboardQueryV2({
				id: "requests",
				filterKeys: ["service", "region"],
				outputShapes: ["timeseries"],
				handler: async ({ resolvedRange, intervalMs }) => {
					const step = intervalMs ?? 60_000;
					const time = resolvedRange.from.getTime();
					return queryResult({
						frames: [
							dataFrame({
								refId: "A",
								name: "Requests",
								shapeHint: "timeseries",
								fields: [
									timeField("time", [time, time + step], { roles: ["time"] }),
									numberField("requests", [1, 2], { roles: ["value"] }),
								],
							}),
						],
					});
				},
			}),
			defineDashboardQueryV2({
				id: "regions",
				filterKeys: ["region"],
				interval: "none",
				outputShapes: ["category"],
				handler: async () =>
					queryResult({
						frames: [
							dataFrame({
								refId: "B",
								name: "Regions",
								shapeHint: "category",
								fields: [
									stringField("category", ["global"], { roles: ["category"] }),
									numberField("count", [1], { roles: ["value"] }),
								],
							}),
						],
					}),
			}),
		],
	});
}
