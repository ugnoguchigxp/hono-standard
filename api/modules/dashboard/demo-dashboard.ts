import { defineDashboard } from "./define-dashboard";
import type { DashboardDefinition } from "./types";

const lineVisualization = {
	type: "line" as const,
	unit: "req/s",
	decimalPlaces: 1,
	showLegend: true,
	thresholds: [],
	valueMappings: [],
	referenceLines: [],
	fill: "null" as const,
	connectNulls: false,
	yAxisScale: "linear" as const,
	yAxisMin: "auto" as const,
	yAxisMax: "auto" as const,
	links: [],
};

const at = (from: Date, index: number, intervalMs: number) =>
	from.getTime() + index * intervalMs;

export const demoDashboard = defineDashboard({
	manifest: {
		id: "operations",
		title: "Operations overview",
		description:
			"A small, deterministic dashboard used by the overlay starter.",
		layoutVersion: 2,
		defaultRange: { kind: "relative", value: "1h" },
		defaultTimezone: "UTC",
		defaultRefreshSeconds: 30,
		inspectorEnabled: true,
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
						{ value: "api", label: "API" },
						{ value: "worker", label: "Worker" },
					],
				},
			},
			{
				id: "region",
				label: "Region",
				selection: "multiple",
				required: false,
				defaultValues: ["ap-northeast", "eu-west", "global"],
				dependsOn: ["service"],
				source: { kind: "query", queryId: "region-options" },
			},
		],
		panels: [
			{
				id: "request-rate",
				title: "Request rate",
				description: "Requests per second by service.",
				layout: { x: 0, y: 0, w: 8, h: 4 },
				queryId: "request-rate",
				accessibleLabel: "Request rate timeseries chart",
				visualization: lineVisualization,
			},
			{
				id: "error-ratio",
				title: "Error ratio",
				description: "Percentage of requests returning an error.",
				layout: { x: 8, y: 0, w: 4, h: 4 },
				queryId: "error-ratio",
				accessibleLabel: "Error ratio statistic",
				visualization: {
					type: "stat",
					unit: "%",
					decimalPlaces: 2,
					showLegend: false,
					thresholds: [
						{ value: 1, colorToken: "--color-brand" },
						{ value: 5, colorToken: "--color-danger" },
					],
					valueMappings: [{ type: "null", label: "No errors" }],
					referenceLines: [],
					fill: "null",
					connectNulls: false,
					yAxisScale: "linear",
					yAxisMin: "auto",
					yAxisMax: "auto",
					links: [
						{
							targetId: "request-rate",
							to: "/protected",
							search: {},
							includeRange: true,
							includeFilters: true,
						},
					],
				},
			},
			{
				id: "latency-by-region",
				title: "Latency by region",
				description: "p95 latency in milliseconds.",
				layout: { x: 0, y: 4, w: 6, h: 4 },
				queryId: "latency-by-region",
				accessibleLabel: "Latency by region bar chart",
				visualization: {
					...lineVisualization,
					type: "bar",
					unit: "ms",
					decimalPlaces: 0,
				},
			},
			{
				id: "summary",
				title: "Summary table",
				description: "The same response is available as a table.",
				layout: { x: 6, y: 4, w: 6, h: 4 },
				queryId: "summary",
				accessibleLabel: "Operations summary table",
				visualization: {
					...lineVisualization,
					type: "table",
					unit: "",
				},
			},
		],
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
						{ value: "api", label: "API" },
						{ value: "worker", label: "Worker" },
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
				defaultValues: ["ap-northeast", "eu-west", "global"],
				dependsOn: ["service"],
				source: { kind: "query", queryId: "region-options" },
			},
			options: async ({ dependsOn }) => {
				const service = dependsOn.service?.[0] ?? "api";
				return service === "worker"
					? [
							{ value: "global", label: "Global" },
							{ value: "us-east", label: "US East" },
						]
					: [
							{ value: "global", label: "Global" },
							{ value: "ap-northeast", label: "AP Northeast" },
							{ value: "eu-west", label: "EU West" },
						];
			},
		},
	],
	panels: [
		{
			manifest: {
				id: "request-rate",
				title: "Request rate",
				description: "Requests per second by service.",
				layout: { x: 0, y: 0, w: 8, h: 4 },
				queryId: "request-rate",
				accessibleLabel: "Request rate timeseries chart",
				visualization: lineVisualization,
			},
			handler: async ({
				resolvedRange,
				intervalMs,
				maxDataPoints,
				filters,
			}) => {
				const count = Math.min(
					maxDataPoints,
					Math.max(
						1,
						Math.floor(
							(resolvedRange.to.getTime() - resolvedRange.from.getTime()) /
								intervalMs,
						),
					),
				);
				const serviceFactor = filters.service?.includes("worker") ? 0.55 : 1;
				const data = {
					kind: "timeseries" as const,
					series: [
						{
							key: "requests",
							label: "Requests",
							unit: "req/s",
							decimalPlaces: 1,
							colorToken: "--color-brand",
						},
					],
					rows: Array.from({ length: count }, (_, index) => ({
						time: at(resolvedRange.from, index, intervalMs),
						values: {
							requests:
								(48 +
									Math.sin(index / 4.5) * 4.5 +
									Math.cos(index / 10) * 1.8) *
								serviceFactor,
						},
					})),
				};
				return {
					data,
					state: {
						dataThrough: new Date(
							resolvedRange.to.getTime() - intervalMs,
						).toISOString(),
						staleAfterMs: Math.max(120_000, intervalMs * 2),
						partial: false,
						warnings: [],
					},
				};
			},
		},
		{
			manifest: {
				id: "error-ratio",
				title: "Error ratio",
				description: "Percentage of requests returning an error.",
				layout: { x: 8, y: 0, w: 4, h: 4 },
				queryId: "error-ratio",
				accessibleLabel: "Error ratio statistic",
				visualization: {
					...lineVisualization,
					type: "stat",
					unit: "%",
					showLegend: false,
					thresholds: [
						{ value: 1, colorToken: "--color-brand" },
						{ value: 5, colorToken: "--color-danger" },
					],
					valueMappings: [{ type: "null", label: "No errors" }],
					links: [
						{
							targetId: "request-rate",
							to: "/protected",
							search: {},
							includeRange: true,
							includeFilters: true,
						},
					],
				},
			},
			handler: async ({ filters }) => ({
				kind: "stat",
				value: filters.service?.includes("worker") ? 1.8 : 2.4,
				series: {
					key: "errorRatio",
					label: "Error ratio",
					unit: "%",
					decimalPlaces: 2,
					colorToken: "--color-brand",
				},
			}),
		},
		{
			manifest: {
				id: "latency-by-region",
				title: "Latency by region",
				description: "p95 latency in milliseconds.",
				layout: { x: 0, y: 4, w: 6, h: 4 },
				queryId: "latency-by-region",
				accessibleLabel: "Latency by region bar chart",
				visualization: {
					...lineVisualization,
					type: "bar",
					unit: "ms",
					decimalPlaces: 0,
				},
			},
			handler: async ({ filters }) => {
				const regions = filters.region?.length
					? filters.region
					: ["global", "ap-northeast", "eu-west"];
				return {
					kind: "category",
					series: [
						{
							key: "p95",
							label: "p95 latency",
							unit: "ms",
							decimalPlaces: 0,
							colorToken: "--color-brand",
						},
					],
					rows: regions.map((category, index) => ({
						category,
						values: { p95: 120 + index * 35 },
					})),
				};
			},
		},
		{
			manifest: {
				id: "summary",
				title: "Summary table",
				description: "The same response is available as a table.",
				layout: { x: 6, y: 4, w: 6, h: 4 },
				queryId: "summary",
				accessibleLabel: "Operations summary table",
				visualization: { ...lineVisualization, type: "table", unit: "" },
			},
			handler: async ({ filters }) => ({
				kind: "table",
				columns: [
					{
						key: "metric",
						label: "Metric",
						align: "left",
						unit: "",
						decimalPlaces: 2,
					},
					{
						key: "value",
						label: "Value",
						align: "right",
						unit: "",
						decimalPlaces: 2,
					},
				],
				rows: [
					{ metric: "service", value: filters.service?.[0] ?? "api" },
					{ metric: "status", value: "healthy" },
					{ metric: "request rate", value: "48.3 req/s" },
					{ metric: "error ratio", value: "2.4%" },
					{
						metric: "regions",
						value: (filters.region ?? ["global"]).join(", "),
					},
				],
			}),
		},
	],
});

export const demoDashboards: DashboardDefinition[] = [demoDashboard];
