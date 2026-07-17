import { describe, expect, it } from "vitest";
import { createDashboardModule } from "..";
import { dataFrame, numberField, stringField, timeField } from "./frame-builders";
import { nativeTransformations, nativeV2Fixture, nativeVisualization } from "./test-fixtures";

describe("v2 query coordinator", () => {
	it("executes hidden and visible queries in declaration order", async () => {
		const module = createDashboardModule({ nativeDashboards: [nativeV2Fixture()], visualizations: [nativeVisualization], transformations: nativeTransformations });
		const response = await module.service.queryPanel({ requestId: module.requestIdFactory(), requestTime: module.clock.now(), auth: { userId: "u", email: "u@example.com", role: "member" }, dashboardId: "native-v2", panelId: "overview", transportVersion: 2, request: { schemaVersion: 2, range: { kind: "relative", value: "1h" }, timezone: "UTC", filters: { service: ["api"] }, maxDataPoints: 10, maxRows: 10 }, signal: new AbortController().signal });
		if (!("frames" in response)) throw new Error("expected v2 response");
		expect(response.frames.map((frame) => frame.refId)).toEqual(["A", "B", "D"]);
		expect(response.frames.find((frame) => frame.refId === "B")?.source).toEqual({ kind: "query", refId: "B" });
	});
	it("rejects missing required filters", async () => {
		const module = createDashboardModule({ nativeDashboards: [nativeV2Fixture()], visualizations: [nativeVisualization], transformations: nativeTransformations });
		await expect(module.service.queryPanel({ requestId: module.requestIdFactory(), requestTime: module.clock.now(), auth: { userId: "u", email: "u@example.com", role: "member" }, dashboardId: "native-v2", panelId: "overview", transportVersion: 2, request: { schemaVersion: 2, range: { kind: "relative", value: "1h" }, timezone: "UTC", filters: {}, maxDataPoints: 10, maxRows: 10 }, signal: new AbortController().signal })).rejects.toMatchObject({ code: "INVALID_REQUEST" });
	});
	it("maps invalid handler output, handler timeout, and panel timeout", async () => {
		const invalidFixture = nativeV2Fixture();
		invalidFixture.queries[1]!.handler = async () => ({ frames: [] });
		const invalidModule = createDashboardModule({ nativeDashboards: [invalidFixture], visualizations: [nativeVisualization], transformations: nativeTransformations });
		await expect(invalidModule.service.queryPanel({ requestId: invalidModule.requestIdFactory(), requestTime: invalidModule.clock.now(), auth: { userId: "u", email: "u@example.com", role: "member" }, dashboardId: "native-v2", panelId: "overview", transportVersion: 2, request: { schemaVersion: 2, range: { kind: "relative", value: "1h" }, timezone: "UTC", filters: { service: ["api"] }, maxDataPoints: 10, maxRows: 10 }, signal: new AbortController().signal })).rejects.toMatchObject({ code: "INVALID_HANDLER_RESULT" });
		const timeoutFixture = nativeV2Fixture();
		timeoutFixture.queries[1]!.handler = () => new Promise(() => undefined);
		const timeoutModule = createDashboardModule({ nativeDashboards: [timeoutFixture], visualizations: [nativeVisualization], transformations: nativeTransformations, limits: { handlerTimeoutMs: 1, panelTimeoutMs: 100, serverTransformationBudgetMs: 10 } });
		await expect(timeoutModule.service.queryPanel({ requestId: timeoutModule.requestIdFactory(), requestTime: timeoutModule.clock.now(), auth: { userId: "u", email: "u@example.com", role: "member" }, dashboardId: "native-v2", panelId: "overview", transportVersion: 2, request: { schemaVersion: 2, range: { kind: "relative", value: "1h" }, timezone: "UTC", filters: { service: ["api"] }, maxDataPoints: 10, maxRows: 10 }, signal: new AbortController().signal })).rejects.toMatchObject({ code: "HANDLER_TIMEOUT" });
		const panelFixture = nativeV2Fixture();
		panelFixture.queries[1]!.handler = () => new Promise(() => undefined);
		const panelModule = createDashboardModule({ nativeDashboards: [panelFixture], visualizations: [nativeVisualization], transformations: nativeTransformations, limits: { handlerTimeoutMs: 50, panelTimeoutMs: 50, serverTransformationBudgetMs: 1 } });
		await expect(panelModule.service.queryPanel({ requestId: panelModule.requestIdFactory(), requestTime: panelModule.clock.now(), auth: { userId: "u", email: "u@example.com", role: "member" }, dashboardId: "native-v2", panelId: "overview", transportVersion: 2, request: { schemaVersion: 2, range: { kind: "relative", value: "1h" }, timezone: "UTC", filters: { service: ["api"] }, maxDataPoints: 10, maxRows: 10 }, signal: new AbortController().signal })).rejects.toMatchObject({ code: "PANEL_TIMEOUT" });
	});

	it("releases a limiter slot when a query handler throws synchronously", async () => {
		const fixture = nativeV2Fixture();
		fixture.queries[1]!.handler = () => {
			throw new Error("secret query failure");
		};
		const module = createDashboardModule({ nativeDashboards: [fixture], visualizations: [nativeVisualization], transformations: nativeTransformations, limits: { maxConcurrent: 1 } });
		await expect(module.service.queryPanel({ requestId: module.requestIdFactory(), requestTime: module.clock.now(), auth: { userId: "u", email: "u@example.com", role: "member" }, dashboardId: "native-v2", panelId: "overview", transportVersion: 2, request: { schemaVersion: 2, range: { kind: "relative", value: "1h" }, timezone: "UTC", filters: { service: ["api"] }, maxDataPoints: 10, maxRows: 10 }, signal: new AbortController().signal })).rejects.toMatchObject({ code: "QUERY_FAILED", message: "Dashboard request failed" });
		expect(module.limiter.activeCount).toBe(0);
	});

	it("enforces the response-wide cell budget after transformations", async () => {
		const fixture = nativeV2Fixture();
		const values = Array.from({ length: 2_000 }, (_, index) => index);
		fixture.queries.find((query) => query.id === "requests")!.handler = async () => ({ frames: [dataFrame({ refId: "A", name: "Large timeseries", shapeHint: "timeseries", fields: [timeField("time", values, { roles: ["time"] }), ...Array.from({ length: 49 }, (_, index) => numberField(`value_${index}`, values, { roles: ["value"] }))] })] });
		fixture.queries.find((query) => query.id === "regions")!.handler = async () => ({ frames: [dataFrame({ refId: "B", name: "Large categories", shapeHint: "category", fields: [stringField("category", values.map(String), { roles: ["category"] }), ...Array.from({ length: 49 }, (_, index) => numberField(`count_${index}`, values, { roles: ["value"] }))] })] });
		const module = createDashboardModule({ nativeDashboards: [fixture], visualizations: [nativeVisualization], transformations: nativeTransformations, limits: { serverTransformationBudgetMs: 5_000 } });
		await expect(module.service.queryPanel({ requestId: module.requestIdFactory(), requestTime: module.clock.now(), auth: { userId: "u", email: "u@example.com", role: "member" }, dashboardId: "native-v2", panelId: "overview", transportVersion: 2, request: { schemaVersion: 2, range: { kind: "relative", value: "1h" }, timezone: "UTC", filters: { service: ["api"] }, maxDataPoints: 10, maxRows: 2_000 }, signal: new AbortController().signal })).rejects.toMatchObject({ code: "CELL_LIMIT_EXCEEDED", status: 422 });
	});

	it("isolates mutable filter and range inputs between parallel handlers", async () => {
		const fixture = nativeV2Fixture();
		const requests = fixture.queries.find((query) => query.id === "requests")!;
		const regions = fixture.queries.find((query) => query.id === "regions")!;
		const requestsHandler = requests.handler;
		const regionsHandler = regions.handler;
		let observedRegion: string[] | undefined;
		requests.handler = async (context) => {
			context.filters.region?.push("mutated");
			context.resolvedRange.from.setUTCFullYear(2000);
			return requestsHandler(context);
		};
		regions.handler = async (context) => {
			observedRegion = [...(context.filters.region ?? [])];
			expect(context.resolvedRange.from.getUTCFullYear()).toBe(2026);
			return regionsHandler(context);
		};
		const module = createDashboardModule({ nativeDashboards: [fixture], visualizations: [nativeVisualization], transformations: nativeTransformations, now: () => new Date("2026-07-17T00:00:00.000Z") });
		await module.service.queryPanel({ requestId: module.requestIdFactory(), requestTime: module.clock.now(), auth: { userId: "u", email: "u@example.com", role: "member" }, dashboardId: "native-v2", panelId: "overview", transportVersion: 2, request: { schemaVersion: 2, range: { kind: "relative", value: "1h" }, timezone: "UTC", filters: { service: ["api"], region: ["global"] }, maxDataPoints: 10, maxRows: 10 }, signal: new AbortController().signal });
		expect(observedRegion).toEqual(["global"]);
	});
});
