import { describe, expect, it } from "vitest";
import { createDashboardModule } from ".";
import type { DashboardRuntimeLogEvent } from "./runtime-logger";
import { nativeTransformations, nativeV2Fixture, nativeVisualization } from "./v2/test-fixtures";

describe("dashboard service", () => {
	it("dispatches legacy dashboards to v1 and v2 compatibility responses", async () => {
		const module = createDashboardModule();
		const auth = { userId: "u", email: "u@example.com", role: "member" } as const;
		const v1 = await module.service.getManifest({ requestId: module.requestIdFactory(), requestTime: module.clock.now(), auth, dashboardId: "operations", transportVersion: 1, signal: new AbortController().signal });
		const v2 = await module.service.getManifest({ requestId: module.requestIdFactory(), requestTime: module.clock.now(), auth, dashboardId: "operations", transportVersion: 2, signal: new AbortController().signal });
		expect(v1).not.toHaveProperty("schemaVersion");
		expect(v2).toHaveProperty("schemaVersion", 2);
		const request = { range: { kind: "relative" as const, value: "1h" as const }, timezone: "UTC", filters: { service: ["api"] } };
		const optionsV1 = await module.service.getVariableOptions({ requestId: module.requestIdFactory(), requestTime: module.clock.now(), auth, dashboardId: "operations", variableId: "region", transportVersion: 1, request, signal: new AbortController().signal });
		const optionsV2 = await module.service.getVariableOptions({ requestId: module.requestIdFactory(), requestTime: module.clock.now(), auth, dashboardId: "operations", variableId: "region", transportVersion: 2, request: { schemaVersion: 2, ...request }, signal: new AbortController().signal });
		expect(optionsV1.options).toHaveLength(3);
		expect(optionsV2).toHaveProperty("schemaVersion", 2);
		const panelV1 = await module.service.queryPanel({ requestId: module.requestIdFactory(), requestTime: module.clock.now(), auth, dashboardId: "operations", panelId: "error-ratio", transportVersion: 1, request: { ...request, maxDataPoints: 10 }, signal: new AbortController().signal });
		const panelV2 = await module.service.queryPanel({ requestId: module.requestIdFactory(), requestTime: module.clock.now(), auth, dashboardId: "operations", panelId: "error-ratio", transportVersion: 2, request: { schemaVersion: 2, ...request, maxDataPoints: 10, maxRows: 10 }, signal: new AbortController().signal });
		expect(panelV1).not.toHaveProperty("schemaVersion");
		expect(panelV2).toHaveProperty("schemaVersion", 2);
	});
	it("rejects v1 transport for native dashboards", async () => {
		const module = createDashboardModule({ nativeDashboards: [nativeV2Fixture()], visualizations: [nativeVisualization], transformations: nativeTransformations });
		await expect(module.service.getManifest({ requestId: module.requestIdFactory(), requestTime: module.clock.now(), auth: { userId: "u", email: "u@example.com", role: "member" }, dashboardId: "native-v2", transportVersion: 1, signal: new AbortController().signal })).rejects.toMatchObject({ code: "SCHEMA_VERSION_UNSUPPORTED" });
	});

	it("emits safe lifecycle logs without allowing logger failures to affect requests", async () => {
		const events: DashboardRuntimeLogEvent[] = [];
		const collect = (event: DashboardRuntimeLogEvent) => events.push(event);
		const module = createDashboardModule({ logger: { info: collect, warn: collect, error: collect } });
		const common = { requestId: module.requestIdFactory(), requestTime: module.clock.now(), auth: { userId: "u", email: "u@example.com", role: "member" as const }, transportVersion: 1 as const, signal: new AbortController().signal };
		await module.service.getManifest({ ...common, dashboardId: "operations" });
		await expect(module.service.getManifest({ ...common, dashboardId: "missing" })).rejects.toMatchObject({ code: "DASHBOARD_NOT_FOUND" });
		expect(events.map((event) => event.event)).toEqual(["start", "success", "start", "failure"]);
		expect(events.at(-1)).toMatchObject({ errorCode: "DASHBOARD_NOT_FOUND" });
		expect(events.some((event) => "email" in event)).toBe(false);

		const fail = () => { throw new Error("logger failed"); };
		const throwingLogger = createDashboardModule({ logger: { info: fail, warn: fail, error: fail } });
		await expect(throwingLogger.service.getManifest({ ...common, requestId: throwingLogger.requestIdFactory(), dashboardId: "operations" })).resolves.toMatchObject({ id: "operations" });
	});
});
