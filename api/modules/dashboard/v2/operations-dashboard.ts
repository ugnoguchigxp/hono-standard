import { standardFieldConfigV2Schema } from "../../../../shared/schemas/dashboard.schema";
import { defineDashboardQueryV2, defineDashboardV2 } from "./define-dashboard";
import {
	dataFrame,
	numberField,
	queryResult,
	stringField,
	timeField,
} from "./frame-builders";
import type { DashboardDefinitionV2 } from "./types";

export const OPERATIONS_DASHBOARD_ID = "operations";

const emptyFieldConfig = standardFieldConfigV2Schema.parse({
	unit: { kind: "none" },
	decimals: "auto",
	noValueText: "N/A",
	textAlign: "auto",
	valueMappings: [],
	links: [],
});

const percentConfig = standardFieldConfigV2Schema.parse({
	unit: { kind: "percent", scale: "hundred" },
	decimals: 1,
	min: 0,
	max: 100,
	noValueText: "N/A",
	textAlign: "auto",
	valueMappings: [],
	links: [],
});

const availabilityConfig = standardFieldConfigV2Schema.parse({
	...percentConfig,
	decimals: 2,
	min: 99,
	max: 100,
	thresholds: {
		mode: "absolute",
		steps: [
			{ value: null, colorToken: "--color-chart-danger", label: "critical" },
			{ value: 99.5, colorToken: "--color-chart-warning", label: "warning" },
			{ value: 99.9, colorToken: "--color-chart-success", label: "healthy" },
		],
	},
});

const capacityConfig = standardFieldConfigV2Schema.parse({
	...percentConfig,
	thresholds: {
		mode: "absolute",
		steps: [
			{ value: null, colorToken: "--color-chart-success", label: "healthy" },
			{ value: 75, colorToken: "--color-chart-warning", label: "warning" },
			{ value: 90, colorToken: "--color-chart-danger", label: "critical" },
		],
	},
});

const panel = (
	id: string,
	title: string,
	description: string,
	type: string,
	preset: string,
	layout: { x: number; y: number; w: number; h: number },
	fieldConfig = emptyFieldConfig,
) => ({
	id,
	title,
	description,
	layout: { ...layout, minW: 2, minH: 2 },
	queries: [
		{
			refId: "A",
			queryId: id,
			outputFrameRefs: ["A"],
			hidden: false,
		},
	],
	transformations: [],
	visualization: {
		type,
		preset,
		frameRefs: ["A"],
		options: {},
		fieldConfig,
		overrides: [],
		tableFallback: { enabled: true, defaultView: "visualization" as const },
	},
	accessibleLabel: `${title} visualization`,
	links: [],
});

const baseTime = Date.parse("2026-01-01T00:00:00.000Z");

const queries = [
	defineDashboardQueryV2({
		id: "request-rate",
		filterKeys: ["service", "region"],
		outputShapes: ["timeseries"],
		handler: async ({ filters }) => {
			const factor = filters.service[0] === "worker" ? 0.62 : 1;
			return queryResult({
				frames: [
					dataFrame({
						refId: "A",
						name: "Request rate",
						shapeHint: "timeseries",
						fields: [
							timeField(
								"time",
								Array.from(
									{ length: 24 },
									(_, index) => baseTime + index * 150_000,
								),
							),
							numberField(
								"requests",
								Array.from(
									{ length: 24 },
									(_, index) => (52 + Math.sin(index / 3) * 7) * factor,
								),
								{ label: "Requests", roles: ["value"] },
							),
						],
					}),
				],
			});
		},
	}),
	defineDashboardQueryV2({
		id: "error-ratio",
		filterKeys: ["service", "region"],
		outputShapes: ["timeseries"],
		handler: async () =>
			queryResult({
				frames: [
					dataFrame({
						refId: "A",
						name: "Error ratio",
						shapeHint: "timeseries",
						fields: [
							timeField("time", [
								baseTime,
								baseTime + 300_000,
								baseTime + 600_000,
							]),
							numberField("errors", [1.8, 2.1, 2.4], {
								label: "Error ratio",
								roles: ["value"],
								config: percentConfig,
							}),
						],
					}),
				],
			}),
	}),
	defineDashboardQueryV2({
		id: "availability",
		filterKeys: ["service", "region"],
		outputShapes: ["scalar"],
		handler: async () =>
			queryResult({
				frames: [
					dataFrame({
						refId: "A",
						name: "Availability",
						shapeHint: "scalar",
						fields: [
							numberField("availability", [99.93], {
								label: "Availability",
								roles: ["value"],
								config: availabilityConfig,
							}),
						],
					}),
				],
			}),
	}),
	defineDashboardQueryV2({
		id: "capacity",
		filterKeys: ["service", "region"],
		outputShapes: ["category"],
		handler: async () =>
			queryResult({
				frames: [
					dataFrame({
						refId: "A",
						name: "Capacity",
						shapeHint: "category",
						fields: [
							stringField("resource", ["CPU", "Memory", "Queue"], {
								roles: ["category"],
							}),
							numberField("usage", [68, 74, 43], {
								label: "Usage",
								roles: ["value"],
								config: capacityConfig,
							}),
						],
					}),
				],
			}),
	}),
	defineDashboardQueryV2({
		id: "latency-objectives",
		filterKeys: ["service", "region"],
		outputShapes: ["category"],
		handler: async () =>
			queryResult({
				frames: [
					dataFrame({
						refId: "A",
						name: "Latency objectives",
						shapeHint: "category",
						fields: [
							stringField("region", ["Tokyo", "Frankfurt", "Virginia"], {
								roles: ["category"],
							}),
							numberField("latency", [118, 164, 142], {
								label: "p95 latency",
								roles: ["value"],
								config: standardFieldConfigV2Schema.parse({
									unit: { kind: "duration", unit: "ms" },
									min: 0,
									max: 250,
								}),
							}),
							numberField("goal", [150, 180, 160], { roles: ["goal"] }),
						],
					}),
				],
			}),
	}),
	defineDashboardQueryV2({
		id: "deployment-progress",
		filterKeys: ["service"],
		outputShapes: ["category"],
		handler: async () =>
			queryResult({
				frames: [
					dataFrame({
						refId: "A",
						name: "Deployment progress",
						shapeHint: "category",
						fields: [
							stringField("step", ["Build", "Test", "Deploy", "Verify"], {
								roles: ["category"],
							}),
							stringField(
								"state",
								["completed", "completed", "current", "pending"],
								{
									roles: ["state"],
								},
							),
							numberField("completion", [100, 100, 60, 0], {
								label: "Completion",
								roles: ["value"],
								config: percentConfig,
							}),
						],
					}),
				],
			}),
	}),
	defineDashboardQueryV2({
		id: "service-health",
		filterKeys: ["service", "region"],
		outputShapes: ["category"],
		handler: async () =>
			queryResult({
				frames: [
					dataFrame({
						refId: "A",
						name: "Service health",
						shapeHint: "category",
						fields: [
							stringField("component", ["API", "Worker", "Database", "Cache"], {
								roles: ["category"],
							}),
							numberField("saturation", [28, 67, 91, 48], {
								label: "Saturation",
								roles: ["value"],
								config: capacityConfig,
							}),
						],
					}),
				],
			}),
	}),
	defineDashboardQueryV2({
		id: "summary",
		filterKeys: ["service", "region"],
		outputShapes: ["table"],
		handler: async () =>
			queryResult({
				frames: [
					dataFrame({
						refId: "A",
						name: "Operations summary",
						shapeHint: "table",
						fields: [
							stringField("metric", [
								"Request rate",
								"Error ratio",
								"Availability",
							]),
							stringField("value", ["52.4 req/s", "2.4%", "99.93%"]),
							stringField("status", ["Healthy", "Warning", "Healthy"]),
						],
					}),
				],
			}),
	}),
];

export const operationsDashboardV2: DashboardDefinitionV2 = defineDashboardV2({
	manifest: {
		schemaVersion: 2,
		revision: 3,
		id: OPERATIONS_DASHBOARD_ID,
		title: "Operations overview",
		description:
			"Live service objectives, capacity, deployment, and health at a glance.",
		layoutVersion: 3,
		defaultRange: { kind: "relative", value: "1h" },
		defaultTimezone: "UTC",
		defaultRefreshSeconds: 30,
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
					options: [
						{ value: "api", label: "API", disabled: false },
						{ value: "worker", label: "Worker", disabled: false },
					],
				},
			},
			{
				id: "region",
				label: "Region",
				selection: "multiple",
				required: false,
				defaultValues: ["global"],
				dependsOn: [],
				source: {
					kind: "static",
					options: [
						{ value: "global", label: "Global", disabled: false },
						{ value: "ap-northeast", label: "AP Northeast", disabled: false },
						{ value: "eu-west", label: "EU West", disabled: false },
					],
				},
			},
		],
		panels: [
			panel(
				"request-rate",
				"Request rate",
				"Requests per second for the selected service.",
				"core.timeseries",
				"line",
				{ x: 0, y: 0, w: 8, h: 4 },
			),
			panel(
				"error-ratio",
				"Error ratio",
				"Current errors with trend and delta.",
				"core.stat",
				"value-delta-sparkline",
				{ x: 8, y: 0, w: 4, h: 4 },
				percentConfig,
			),
			panel(
				"availability",
				"Availability",
				"Current SLO availability.",
				"core.gauge",
				"needle",
				{ x: 0, y: 4, w: 4, h: 4 },
				availabilityConfig,
			),
			panel(
				"capacity",
				"Capacity",
				"Resource saturation by component.",
				"core.bar-gauge",
				"segmented",
				{ x: 4, y: 4, w: 4, h: 4 },
				capacityConfig,
			),
			panel(
				"latency-objectives",
				"Latency objectives",
				"p95 latency compared with regional objectives.",
				"core.bullet",
				"comparative",
				{ x: 8, y: 4, w: 4, h: 4 },
			),
			panel(
				"deployment-progress",
				"Deployment progress",
				"Current release pipeline stage.",
				"core.progress",
				"steps",
				{ x: 0, y: 8, w: 6, h: 3 },
			),
			panel(
				"service-health",
				"Service health",
				"Component saturation status.",
				"core.traffic-light",
				"matrix",
				{ x: 6, y: 8, w: 6, h: 3 },
				capacityConfig,
			),
			panel(
				"summary",
				"Summary table",
				"Key operations metrics as a table.",
				"core.table",
				"table",
				{ x: 0, y: 11, w: 12, h: 4 },
			),
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
					options: [
						{ value: "api", label: "API", disabled: false },
						{ value: "worker", label: "Worker", disabled: false },
					],
				},
			},
		},
		{
			manifest: {
				id: "region",
				label: "Region",
				selection: "multiple",
				required: false,
				defaultValues: ["global"],
				dependsOn: [],
				source: {
					kind: "static",
					options: [
						{ value: "global", label: "Global", disabled: false },
						{ value: "ap-northeast", label: "AP Northeast", disabled: false },
						{ value: "eu-west", label: "EU West", disabled: false },
					],
				},
			},
		},
	],
	queries,
});
