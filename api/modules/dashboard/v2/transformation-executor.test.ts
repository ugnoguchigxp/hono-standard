import { describe, expect, it } from "vitest";
import { createDashboardModule } from "..";
import { nativeTransformations, nativeV2Fixture, nativeVisualization } from "./test-fixtures";
import { executeServerTransformations } from "./transformation-executor";
import { DashboardTransformationRegistry } from "./transformation-registry";
import { dataFrame, numberField, stringField } from "./frame-builders";
import { z } from "zod";

describe("v2 transformation executor", () => {
	it("runs server transformations and skips browser transformations", async () => {
		const module = createDashboardModule({ nativeDashboards: [nativeV2Fixture()], visualizations: [nativeVisualization], transformations: nativeTransformations });
		const panel = module.v2Registry.getPanel("native-v2", "overview");
		const response = await module.service.queryPanel({ requestId: module.requestIdFactory(), requestTime: module.clock.now(), auth: { userId: "u", email: "u@example.com", role: "member" }, dashboardId: "native-v2", panelId: "overview", transportVersion: 2, request: { schemaVersion: 2, range: { kind: "relative", value: "1h" }, timezone: "UTC", filters: { service: ["api"] }, maxDataPoints: 10, maxRows: 10 }, signal: new AbortController().signal });
		if (!("frames" in response)) throw new Error("expected v2 response");
		const frame = response.frames[0];
		expect(panel).toBeDefined();
		expect(frame?.source.kind).toBe("query");
	});
	it("passes cloned inputs and collects notices and truncation", async () => {
		const module = createDashboardModule({ nativeDashboards: [nativeV2Fixture()], visualizations: [nativeVisualization], transformations: nativeTransformations });
		const base = dataFrame({ refId: "B", name: "B", shapeHint: "category", fields: [stringField("category", ["a"], { roles: ["category"] }), numberField("value", [1], { roles: ["value"] })] });
		const initial = { ...base, schemaVersion: 2 as const, source: { kind: "query" as const, refId: "B" } };
		const registry = new DashboardTransformationRegistry([{ descriptor: { ...nativeTransformations[1]!.descriptor, type: "test.notice" }, configSchema: z.object({}).strict(), execute: ({ inputFrames }) => ({ frame: { ...inputFrames[0]!, refId: "E" }, notices: [{ severity: "info" as const, code: "NOTICE", message: "done" }], truncated: true }) }]);
		const panel = { ...nativeV2Fixture().manifest.panels[0]!, transformations: [{ id: "notice", type: "test.notice", execution: "server" as const, inputFrameRefs: ["B"], outputFrameRefId: "E", options: {}, disabled: false }] };
		const result = await executeServerTransformations({ panel, initialFrames: [initial], registry, requestId: "00000000-0000-4000-8000-000000000001", requestTime: new Date("2026-01-01T00:00:00Z"), signal: new AbortController().signal, clock: module.clock, budgetMs: 1000, maxServerTransformations: 2 });
		expect(result.frames.map((frame) => frame.refId)).toEqual(["B", "E"]);
		expect(result.notices[0]?.code).toBe("NOTICE");
		expect(result.truncated).toBe(true);
	});

	it("propagates the transformation budget deadline through AbortSignal", async () => {
		let aborted = false;
		const events: Array<{ event: string }> = [];
		const module = createDashboardModule();
		const base = dataFrame({ refId: "B", name: "B", shapeHint: "category", fields: [stringField("category", ["a"], { roles: ["category"] }), numberField("value", [1], { roles: ["value"] })] });
		const initial = { ...base, schemaVersion: 2 as const, source: { kind: "query" as const, refId: "B" } };
		const registry = new DashboardTransformationRegistry([{ descriptor: { ...nativeTransformations[1]!.descriptor, type: "test.timeout" }, configSchema: z.object({}).strict(), execute: ({ signal }) => new Promise((_, reject) => {
			const onAbort = () => { aborted = true; reject(new Error("aborted")); };
			if (signal.aborted) onAbort();
			else signal.addEventListener("abort", onAbort, { once: true });
		}) }]);
		const panel = { ...nativeV2Fixture().manifest.panels[0]!, transformations: [{ id: "timeout", type: "test.timeout", execution: "server" as const, inputFrameRefs: ["B"], outputFrameRefId: "E", options: {}, disabled: false }] };
		const collect = (event: { event: string }) => events.push(event);
		await expect(executeServerTransformations({ panel, initialFrames: [initial], registry, requestId: "00000000-0000-4000-8000-000000000001", requestTime: new Date("2026-01-01T00:00:00Z"), signal: new AbortController().signal, clock: module.clock, logger: { info: collect, warn: collect, error: collect }, budgetMs: 50, maxServerTransformations: 2 })).rejects.toMatchObject({ code: "TRANSFORMATION_FAILED", status: 504 });
		expect(aborted).toBe(true);
		expect(events).toContainEqual(expect.objectContaining({ event: "late-settlement-rejected" }));
	});

	it("rejects output shapes that violate the transformation descriptor", async () => {
		const module = createDashboardModule();
		const base = dataFrame({ refId: "B", name: "B", shapeHint: "category", fields: [stringField("category", ["a"], { roles: ["category"] }), numberField("value", [1], { roles: ["value"] })] });
		const initial = { ...base, schemaVersion: 2 as const, source: { kind: "query" as const, refId: "B" } };
		const registry = new DashboardTransformationRegistry([{ descriptor: { ...nativeTransformations[1]!.descriptor, type: "test.wrong-shape" }, configSchema: z.object({}).strict(), execute: ({ inputFrames }) => ({ frame: { ...inputFrames[0]!, meta: { shapeHint: "table" as const } } }) }]);
		const panel = { ...nativeV2Fixture().manifest.panels[0]!, transformations: [{ id: "wrong-shape", type: "test.wrong-shape", execution: "server" as const, inputFrameRefs: ["B"], outputFrameRefId: "E", options: {}, disabled: false }] };
		await expect(executeServerTransformations({ panel, initialFrames: [initial], registry, requestId: "00000000-0000-4000-8000-000000000001", requestTime: new Date("2026-01-01T00:00:00Z"), signal: new AbortController().signal, clock: module.clock, budgetMs: 100, maxServerTransformations: 2 })).rejects.toMatchObject({ code: "TRANSFORMATION_FAILED", status: 422 });
	});

	it("rejects runtime inputs that violate a deferred shape contract", async () => {
		const module = createDashboardModule();
		const base = dataFrame({ refId: "B", name: "B", shapeHint: "category", fields: [stringField("category", ["a"], { roles: ["category"] }), numberField("value", [1], { roles: ["value"] })] });
		const initial = { ...base, schemaVersion: 2 as const, source: { kind: "query" as const, refId: "B" } };
		let executed = false;
		const registry = new DashboardTransformationRegistry([{ descriptor: { ...nativeTransformations[1]!.descriptor, type: "test.timeseries-only", inputShapes: ["timeseries"] }, configSchema: z.object({}).strict(), execute: ({ inputFrames }) => { executed = true; return { frame: inputFrames[0]! }; } }]);
		const panel = { ...nativeV2Fixture().manifest.panels[0]!, transformations: [{ id: "timeseries-only", type: "test.timeseries-only", execution: "server" as const, inputFrameRefs: ["B"], outputFrameRefId: "E", options: {}, disabled: false }] };
		await expect(executeServerTransformations({ panel, initialFrames: [initial], registry, requestId: "00000000-0000-4000-8000-000000000001", requestTime: new Date("2026-01-01T00:00:00Z"), signal: new AbortController().signal, clock: module.clock, budgetMs: 100, maxServerTransformations: 2 })).rejects.toMatchObject({ code: "TRANSFORMATION_FAILED", status: 422 });
		expect(executed).toBe(false);
	});
});
