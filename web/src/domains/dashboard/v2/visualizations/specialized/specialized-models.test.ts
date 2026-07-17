import { describe, expect, it } from "vitest";
import { buildLayeredLayout } from "../graph/layered-layout";
import { buildGraphModel } from "../graph/graph-model";
import { buildOhlcModel } from "../financial/ohlc-model";
import { buildLogModel } from "../logs/log-model";
import { buildTraceModel } from "../trace/trace-model";
import { buildProfileModel } from "../profile/profile-model";
import { buildFlameLayout } from "../profile/flame-layout";
import { buildGeoModel } from "../geo/geo-model";
import {
	projectEquirectangular,
	projectGreatCircleRoute,
	splitAntimeridian,
} from "../geo/projection";
import { visibleRange, windowed } from "./viewport";
import { createNumericScale } from "./scale";
import { dataFrame, numberField, stringField, timeField } from "../../../../../../../api/modules/dashboard/v2/frame-builders";

const frame = (shapeHint: "graph-nodes" | "graph-edges" | "ohlc" | "logs" | "traces" | "profile", fields: Parameters<typeof dataFrame>[0]["fields"]) => dataFrame({ refId: "A", name: shapeHint, shapeHint, fields });

describe("specialized pure models", () => {
	it("builds deterministic graph layout and critical path", () => {
		const nodes = frame("graph-nodes", [stringField("id", ["z", "a", "b"], { roles: ["id"] }), stringField("label", ["Z", "A", "B"], { roles: ["label"] })]);
		const edges = frame("graph-edges", [stringField("source", ["z", "a"], { roles: ["source"] }), stringField("target", ["a", "b"], { roles: ["target"] }), numberField("value", [2, 3], { roles: ["value"] })]);
		const model = buildGraphModel(nodes as never, edges as never, "critical-path");
		expect(model.criticalPath).toEqual(["z", "a", "b"]);
		const layout = buildLayeredLayout(model.nodes, model.edges);
		expect(layout.find((item) => item.id === "z")?.rank).toBe(0);
		expect(layout.find((item) => item.id === "b")?.rank).toBe(2);
		expect(layout).toEqual(buildLayeredLayout(model.nodes, model.edges));
	});

	it("aggregates OHLC without breaking invariants and sanitizes log text", () => {
		const ohlc = frame("ohlc", [timeField("time", [1, 2, 3], { roles: ["time"] }), numberField("open", [1, 2, 3], { roles: ["open"] }), numberField("high", [3, 4, 5], { roles: ["high"] }), numberField("low", [0, 1, 2], { roles: ["low"] }), numberField("close", [2, 3, 4], { roles: ["close"] })]);
		const candle = buildOhlcModel(ohlc as never, { yDomain: "auto", candleGapRatio: 0.2, showWicks: true }, 2);
		expect(candle.rows).toHaveLength(2);
		const logs = frame("logs", [timeField("time", [1], { roles: ["time"] }), stringField("message", ["hello\u0000world"], { roles: ["message"] })]);
		expect(buildLogModel(logs as never, { order: "ascending", wrap: true, showTimestamp: true, showAttributes: false, attributeFields: [], maxMessageCharacters: 2000 }).rows[0]?.message).toContain("�");
	});

	it("rejects trace cycles and checks projection seams", () => {
		const trace = frame("traces", [stringField("trace-id", ["t", "t"], { roles: ["trace-id"] }), stringField("span-id", ["a", "b"], { roles: ["span-id"] }), stringField("parent-span-id", ["b", "a"], { roles: ["parent-span-id"] }), stringField("operation", ["a", "b"], { roles: ["operation"] }), stringField("service", ["api", "api"], { roles: ["service"] }), timeField("start", [1, 2], { roles: ["start-time"] }), numberField("duration", [1, 1], { roles: ["duration"] })]);
		expect(() => buildTraceModel(trace as never, { order: "tree", showService: true, showIdle: false, minDurationPercent: 0, attributeFields: [] })).toThrow(/cycle|orphan/);
		const projected = projectEquirectangular(0, 180, 720, 360);
		expect(projected.x).toBe(720);
		expect(splitAntimeridian({ x: 1, y: 10 }, { x: 719, y: 20 }, 720)).toHaveLength(2);
		expect(
			projectGreatCircleRoute(
				{ latitude: 35, longitude: 170 },
				{ latitude: 35, longitude: -170 },
				720,
				360,
			),
		).toHaveLength(33);
		expect(() =>
			projectGreatCircleRoute(
				{ latitude: 0, longitude: 0 },
				{ latitude: 0, longitude: 180 },
				720,
				360,
			),
		).toThrow(/antipodal/);
		const validTrace = frame("traces", [stringField("trace-id", ["t", "t"], { roles: ["trace-id"] }), stringField("span-id", ["root", "child"], { roles: ["span-id"] }), stringField("parent-span-id", [null, "root"], { roles: ["parent-span-id"] }), stringField("operation", ["root", "child"], { roles: ["operation"] }), stringField("service", ["api", "db"], { roles: ["service"] }), timeField("start", [1, 2], { roles: ["start-time"] }), numberField("duration", [3, 1], { roles: ["duration"] }), stringField("state", ["ok", "error"], { roles: ["state"] })]);
		const validModel = buildTraceModel(validTrace as never, { order: "duration", showService: true, showIdle: false, minDurationPercent: 0, attributeFields: [] }, "errors-only");
		expect(validModel.spans.length).toBeGreaterThan(0);
	});

	it("keeps only error spans and their complete ancestor chain", () => {
		const trace = frame("traces", [
			stringField("trace-id", ["t", "t", "t", "t"], { roles: ["trace-id"] }),
			stringField("span-id", ["root", "slow", "parent", "error"], { roles: ["span-id"] }),
			stringField("parent-span-id", [null, "root", "root", "parent"], { roles: ["parent-span-id"] }),
			stringField("operation", ["root", "slow", "parent", "error"], { roles: ["operation"] }),
			stringField("service", ["api", "worker", "api", "db"], { roles: ["service"] }),
			timeField("start", [0, 1, 20, 21], { roles: ["start-time"] }),
			numberField("duration", [100, 80, 30, 5], { roles: ["duration"] }),
			stringField("state", ["ok", "ok", "ok", "error"], { roles: ["state"] }),
		]);
		const model = buildTraceModel(
			trace as never,
			{ order: "tree", showService: true, showIdle: false, minDurationPercent: 0, attributeFields: [] },
			"errors-only",
		);
		expect(model.spans.map((item) => item.spanId)).toEqual([
			"root",
			"parent",
			"error",
		]);
		expect(model.criticalPathSpanIds).toEqual(["root", "slow"]);
	});

	it("constructs profile roots", () => {
		const profile = frame("profile", [stringField("id", ["root", "child"], { roles: ["id"] }), stringField("parent", [null, "root"], { roles: ["parent-id"] }), stringField("label", ["root", "child"], { roles: ["label"] }), numberField("total", [10, 4], { roles: ["total"] }), numberField("self", [6, 4], { roles: ["self"] })]);
		const model = buildProfileModel(profile as never);
		expect(model.nodes).toHaveLength(2);
		const root = model.roots[0];
		if (!root) return;
		const flame = buildFlameLayout(model.nodes, root, 100);
		expect(flame).toHaveLength(2);
		expect(flame.find((item) => item.id === "root")?.width).toBe(100);
		expect(flame.find((item) => item.id === "child")?.width).toBe(40);
		expect(flame.find((item) => item.id === "root")?.y).toBeGreaterThan(
			flame.find((item) => item.id === "child")?.y ?? 0,
		);
	});

	it("aggregates subpixel profile children into an Other rectangle", () => {
		const root = {
			id: "root",
			label: "root",
			total: 100,
			depth: 0,
			children: ["large", "tiny-a", "tiny-b"],
		};
		const nodes = [
			root,
			{ id: "large", parentId: "root", label: "large", total: 98, depth: 1, children: [] },
			{ id: "tiny-a", parentId: "root", label: "tiny a", total: 1, depth: 1, children: [] },
			{ id: "tiny-b", parentId: "root", label: "tiny b", total: 1, depth: 1, children: [] },
		];
		const flame = buildFlameLayout(nodes, root, 100, 22, "icicle", 2);
		const other = flame.find((item) => item.label === "Other");
		expect(other?.total).toBe(2);
		expect(other?.width).toBe(2);
		expect(flame.some((item) => item.id === "tiny-a")).toBe(false);
	});

	it("projects geo points, routes, regions, and clusters", () => {
		const points = frame("geo" as never, [numberField("lat", [0, 0], { roles: ["latitude"] }), numberField("lon", [0, 10], { roles: ["longitude"] }), stringField("label", ["A", "B"], { roles: ["label"] }), numberField("value", [4, 9], { roles: ["value"] })]);
		expect(buildGeoModel(points as never, "clusters", 720, 360, 32).clusters).toHaveLength(1);
		expect(buildGeoModel(points as never, "clusters", 720, 360, 16).clusters).toHaveLength(2);
		const routes = frame("geo" as never, [numberField("slat", [35], { roles: ["source-latitude"] }), numberField("slon", [139], { roles: ["source-longitude"] }), numberField("tlat", [51], { roles: ["target-latitude"] }), numberField("tlon", [0], { roles: ["target-longitude"] })]);
		expect(buildGeoModel(routes as never, "routes", 720, 360).routes).toHaveLength(1);
		const regions = frame("geo" as never, [stringField("region", ["JP"], { roles: ["region-id"] }), numberField("value", [1], { roles: ["value"] })]);
		expect(buildGeoModel(regions as never, "regions", 720, 360).regions).toHaveLength(1);
		expect(createNumericScale([1, 1]).valueToRatio(1)).toBeCloseTo(0.5);
		expect(windowed([1, 2, 3], visibleRange(3, 0, 60, 20))).toEqual([1, 2, 3]);
	});
});
