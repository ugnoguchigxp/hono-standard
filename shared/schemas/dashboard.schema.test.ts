import { describe, expect, it } from "vitest";
import {
	dashboardErrorResponseSchema,
	dashboardManifestSchema,
	dashboardRangeSchema,
	chartColorTokenSchema,
	panelDataSchema,
	panelLinkSchema,
	panelQueryRequestSchema,
} from "./dashboard.schema";

describe("dashboard shared contracts", () => {
	it("accepts a representative manifest", () => {
		const result = dashboardManifestSchema.safeParse({
			id: "operations",
			title: "Operations",
			description: "Service health",
			layoutVersion: 1,
			defaultRange: { kind: "relative", value: "1h" },
			defaultTimezone: "UTC",
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
						options: [{ value: "api", label: "API" }],
					},
				},
			],
			panels: [
				{
					id: "request-rate",
					title: "Request rate",
					description: "Requests per minute",
					layout: { x: 0, y: 0, w: 8, h: 4 },
					queryId: "request-rate",
					accessibleLabel: "Request rate over time",
					visualization: {
						type: "line",
						unit: "req/s",
						decimalPlaces: 1,
						showLegend: true,
						thresholds: [],
						valueMappings: [],
						referenceLines: [],
						fill: "null",
						connectNulls: false,
						yAxisScale: "linear",
						yAxisMin: "auto",
						yAxisMax: "auto",
						links: [],
					},
				},
			],
		});

		expect(result.success).toBe(true);
	});

	it("rejects reversed absolute ranges and unsafe links", () => {
		expect(
			dashboardRangeSchema.safeParse({
			kind: "absolute",
			from: "2026-07-16T02:00:00.000Z",
			to: "2026-07-16T01:00:00.000Z",
		}).success,
		).toBe(false);
		expect(
			panelLinkSchema.safeParse({
				targetId: "details",
				to: "//external.example",
			}).success,
		).toBe(false);
	});

	it("normalizes omitted filter and point defaults", () => {
		const result = panelQueryRequestSchema.parse({
			range: { kind: "relative", value: "15m" },
			timezone: "Asia/Tokyo",
		});

		expect(result.filters).toEqual({});
		expect(result.maxDataPoints).toBe(800);
	});

	it("accepts timeseries and table data through the same union", () => {
		expect(
			panelDataSchema.safeParse({
				kind: "timeseries",
				series: [{ key: "requests", label: "Requests" }],
				rows: [
					{
						time: 1_000,
						values: { requests: 42 },
					},
				],
			}).success,
		).toBe(true);
		expect(
			panelDataSchema.safeParse({
				kind: "table",
				columns: [{ key: "service", label: "Service" }],
				rows: [{ service: "api" }],
			}).success,
		).toBe(true);
	});

	it("requires retryability and request identity for API errors", () => {
		expect(
			dashboardErrorResponseSchema.safeParse({
				error: {
					code: "HANDLER_TIMEOUT",
					message: "Query timed out",
					requestId: "00000000-0000-4000-8000-000000000001",
					retryable: true,
				},
			}).success,
		).toBe(true);
	});

	it("validates ordered thresholds and mapping labels", () => {
		const manifest = dashboardManifestSchema.safeParse({
			id: "operations",
			title: "Operations",
			layoutVersion: 1,
			defaultRange: { kind: "relative", value: "1h" },
			defaultTimezone: "UTC",
			panels: [{ id: "panel", title: "Panel", layout: { x: 0, y: 0, w: 1, h: 1 }, queryId: "panel", accessibleLabel: "Panel", visualization: { type: "stat", thresholds: [{ value: 5, colorToken: "--color-danger" }, { value: 1, colorToken: "--color-brand" }], valueMappings: [{ type: "null", label: "No data" }] } }],
		});
		expect(manifest.success).toBe(false);
	});

	it("keeps the v1 wire characterization stable", () => {
		expect(dashboardManifestSchema.safeParse({
			id: "ops", title: "Ops", layoutVersion: 1,
			defaultRange: { kind: "relative", value: "15m" }, defaultTimezone: "UTC",
			panels: [{ id: "p", title: "P", layout: { x: 0, y: 0, w: 1, h: 1 }, queryId: "q", accessibleLabel: "P", visualization: { type: "line" } }],
		}).success).toBe(true);
		expect(dashboardManifestSchema.safeParse({
			id: "ops", title: "Ops", layoutVersion: 1, schemaVersion: 2,
			defaultRange: { kind: "relative", value: "15m" }, defaultTimezone: "UTC",
			panels: [{ id: "p", title: "P", layout: { x: 0, y: 0, w: 1, h: 1 }, queryId: "q", accessibleLabel: "P", visualization: { type: "unknown" } }],
		}).success).toBe(false);
		expect(panelDataSchema.safeParse({ kind: "unknown" }).success).toBe(false);
		expect(chartColorTokenSchema.safeParse("#fff").success).toBe(false);
		expect(dashboardRangeSchema.safeParse({ kind: "absolute", from: "2026-07-16T00:00:00", to: "2026-07-16T01:00:00" }).success).toBe(false);
		expect(panelDataSchema.safeParse({ kind: "table", columns: [{ key: "value", label: "Value" }], rows: [{ value: true }, { value: 1 }, { value: null }] }).success).toBe(true);
	});
});
