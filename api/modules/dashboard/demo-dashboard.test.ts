import { describe, expect, it } from "vitest";
import type { DashboardHandlerContext, DashboardHandlerResult } from "./types";
import { demoDashboard } from "./demo-dashboard";

const context = (
	filters: Record<string, string[]> = {
		service: ["api"],
		region: ["ap-northeast", "eu-west", "global"],
	},
): DashboardHandlerContext => ({
	dashboardId: "operations",
	panelId: "panel",
	queryId: "query",
	range: { kind: "relative", value: "1h" },
	resolvedRange: {
		from: new Date("2026-07-16T00:00:00.000Z"),
		to: new Date("2026-07-16T01:00:00.000Z"),
	},
	intervalMs: 5 * 60_000,
	timezone: "UTC",
	filters,
	maxDataPoints: 180,
	signal: new AbortController().signal,
	now: () => new Date("2026-07-16T01:00:00.000Z"),
});

const unwrap = (result: DashboardHandlerResult) =>
	typeof result === "object" && result !== null && "data" in result
		? result.data
		: result;

describe("demo dashboard", () => {
	it("generates continuous request-rate samples at the executor interval", async () => {
		const panel = demoDashboard.panels.find(
			(item) => item.manifest.id === "request-rate",
		);
		const result = await panel?.handler(context());
		expect(result).toBeDefined();
		expect(result && "state" in result ? result.state?.staleAfterMs : null).toBe(
			10 * 60_000,
		);
		const data = result ? unwrap(result) : null;
		expect(data?.kind).toBe("timeseries");
		if (data?.kind !== "timeseries") return;
		expect(data.rows).toHaveLength(12);
		expect(data.rows[1].time - data.rows[0].time).toBe(5 * 60_000);
		expect(data.rows[0].values.requests).not.toBe(
			data.rows[1].values.requests,
		);
	});

	it("returns the stat, regional bars, and summary rows used by the starter", async () => {
		const results = await Promise.all(
			["error-ratio", "latency-by-region", "summary"].map(async (panelId) => {
				const panel = demoDashboard.panels.find(
					(item) => item.manifest.id === panelId,
				);
				return panel ? unwrap(await panel.handler(context())) : null;
			}),
		);
		expect(results[0]).toMatchObject({ kind: "stat", value: 2.4 });
		expect(results[1]).toMatchObject({
			kind: "category",
			rows: [
				{ category: "ap-northeast" },
				{ category: "eu-west" },
				{ category: "global" },
			],
		});
		expect(results[2]).toMatchObject({
			kind: "table",
			rows: expect.arrayContaining([
				{ metric: "status", value: "healthy" },
				{ metric: "request rate", value: "48.3 req/s" },
			]),
		});
	});

	it("provides service-dependent region options", async () => {
		const variable = demoDashboard.variables.find(
			(item) => item.manifest.id === "region",
		);
		const base = {
			dashboardId: "operations",
			variableId: "region",
			range: context().resolvedRange,
			timezone: "UTC",
			filters: {},
			signal: new AbortController().signal,
			now: context().now,
		};
		await expect(
			variable?.options?.({
				...base,
				dependsOn: { service: ["worker"] },
			}),
		).resolves.toEqual([
			{ value: "global", label: "Global" },
			{ value: "us-east", label: "US East" },
		]);
	});
});
