import { describe, expect, it } from "vitest";
import { createDashboardModule } from "..";
import { nativeTransformations, nativeV2Fixture, nativeVisualization } from "./test-fixtures";
import { getVariableOptionsV2 } from "./variable-options-executor";

describe("v2 variable options", () => {
	it("projects dependencies and returns sorted options", async () => {
		const module = createDashboardModule({ nativeDashboards: [nativeV2Fixture()], visualizations: [nativeVisualization], transformations: nativeTransformations });
		const response = await getVariableOptionsV2({ module, registry: module.v2Registry, requestId: module.requestIdFactory(), requestTime: module.clock.now(), auth: { userId: "u", email: "u@example.com", role: "member" }, dashboardId: "native-v2", variableId: "region", request: { schemaVersion: 2, range: { kind: "relative", value: "1h" }, timezone: "UTC", filters: { service: ["api"] } }, signal: new AbortController().signal });
		expect(response.options[0]?.value).toBe("global");
	});
	it("handles static, duplicate, and cancelled option boundaries", async () => {
		const module = createDashboardModule({ nativeDashboards: [nativeV2Fixture()], visualizations: [nativeVisualization], transformations: nativeTransformations });
		const common = { module, registry: module.v2Registry, requestId: module.requestIdFactory(), requestTime: module.clock.now(), auth: { userId: "u", email: "u@example.com", role: "member" }, dashboardId: "native-v2" } as const;
		const staticOptions = await getVariableOptionsV2({ ...common, variableId: "service", request: { schemaVersion: 2, range: { kind: "relative", value: "1h" }, timezone: "UTC", filters: {} }, signal: new AbortController().signal });
		expect(staticOptions.options).toHaveLength(1);
		const duplicateFixture = nativeV2Fixture();
		duplicateFixture.variables[1]!.options = async () => [{ value: "x", label: "X", disabled: false }, { value: "x", label: "X2", disabled: false }];
		const duplicateModule = createDashboardModule({ nativeDashboards: [duplicateFixture], visualizations: [nativeVisualization], transformations: nativeTransformations });
		await expect(getVariableOptionsV2({ ...common, module: duplicateModule, registry: duplicateModule.v2Registry, variableId: "region", request: { schemaVersion: 2, range: { kind: "relative", value: "1h" }, timezone: "UTC", filters: { service: ["api"] } }, signal: new AbortController().signal })).rejects.toMatchObject({ code: "INVALID_HANDLER_RESULT" });
		const controller = new AbortController(); controller.abort();
		await expect(getVariableOptionsV2({ ...common, variableId: "service", request: { schemaVersion: 2, range: { kind: "relative", value: "1h" }, timezone: "UTC", filters: {} }, signal: controller.signal })).rejects.toMatchObject({ code: "REQUEST_CANCELLED" });
	});

	it("propagates timeout cancellation and releases sync failures", async () => {
		let timeoutObserved = false;
		const timeoutFixture = nativeV2Fixture();
		timeoutFixture.variables[1]!.options = ({ signal }) =>
			new Promise((_, reject) =>
				signal.addEventListener("abort", () => {
					timeoutObserved = true;
					reject(new Error("aborted"));
				}, { once: true }),
			);
		const timeoutModule = createDashboardModule({ nativeDashboards: [timeoutFixture], visualizations: [nativeVisualization], transformations: nativeTransformations, limits: { handlerTimeoutMs: 5 } });
		await expect(getVariableOptionsV2({ module: timeoutModule, registry: timeoutModule.v2Registry, requestId: timeoutModule.requestIdFactory(), requestTime: timeoutModule.clock.now(), auth: { userId: "u", email: "u@example.com", role: "member" }, dashboardId: "native-v2", variableId: "region", request: { schemaVersion: 2, range: { kind: "relative", value: "1h" }, timezone: "UTC", filters: { service: ["api"] } }, signal: new AbortController().signal })).rejects.toMatchObject({ code: "HANDLER_TIMEOUT" });
		expect(timeoutObserved).toBe(true);

		const syncFixture = nativeV2Fixture();
		syncFixture.variables[1]!.options = () => {
			throw new Error("secret option failure");
		};
		const syncModule = createDashboardModule({ nativeDashboards: [syncFixture], visualizations: [nativeVisualization], transformations: nativeTransformations, limits: { maxConcurrent: 1 } });
		await expect(getVariableOptionsV2({ module: syncModule, registry: syncModule.v2Registry, requestId: syncModule.requestIdFactory(), requestTime: syncModule.clock.now(), auth: { userId: "u", email: "u@example.com", role: "member" }, dashboardId: "native-v2", variableId: "region", request: { schemaVersion: 2, range: { kind: "relative", value: "1h" }, timezone: "UTC", filters: { service: ["api"] } }, signal: new AbortController().signal })).rejects.toMatchObject({ code: "QUERY_FAILED", message: "Dashboard request failed" });
		expect(syncModule.limiter.activeCount).toBe(0);
	});
});
