import { describe, expect, it } from "vitest";
import { dataFrame, numberField, stringField, timeField } from "../../../../../../../api/modules/dashboard/v2/frame-builders";
import { coreNodeGraphDefinition } from "../core-node-graph/definition";
import { coreCandlestickDefinition } from "../core-candlestick/definition";
import { observabilityLogsDefinition } from "../observability-logs/definition";
import { observabilityTraceWaterfallDefinition } from "../observability-trace-waterfall/definition";
import { observabilityFlameGraphDefinition } from "../observability-flame-graph/definition";
import { geoMapDefinition } from "../geo-map/definition";

describe("specialized frontend definitions", () => {
	it("validate the six deterministic family fixtures", () => {
		const nodes = dataFrame({ refId: "A", name: "nodes", shapeHint: "graph-nodes", fields: [stringField("id", ["a"], { roles: ["id"] })] });
		const edges = dataFrame({ refId: "B", name: "edges", shapeHint: "graph-edges", fields: [stringField("source", ["a"], { roles: ["source"] }), stringField("target", ["a"], { roles: ["target"] })] });
		expect(coreNodeGraphDefinition.validateFrames?.([nodes, edges] as never, coreNodeGraphDefinition.configSchema.parse({}), "directed")).toBeUndefined();
		const candle = dataFrame({ refId: "A", name: "ohlc", shapeHint: "ohlc", fields: [timeField("time", [1], { roles: ["time"] }), numberField("open", [1], { roles: ["open"] }), numberField("high", [2], { roles: ["high"] }), numberField("low", [0], { roles: ["low"] }), numberField("close", [1.5], { roles: ["close"] }), numberField("volume", [1], { roles: ["volume"] })] });
		expect(coreCandlestickDefinition.validateFrames?.([candle] as never, coreCandlestickDefinition.configSchema.parse({}), "volume")).toBeUndefined();
		const logs = dataFrame({ refId: "A", name: "logs", shapeHint: "logs", fields: [timeField("time", [1], { roles: ["time"] }), stringField("message", ["ok"], { roles: ["message"] })] });
		expect(observabilityLogsDefinition.validateFrames?.([logs] as never, observabilityLogsDefinition.configSchema.parse({}), "stream")).toBeUndefined();
		const trace = dataFrame({ refId: "A", name: "trace", shapeHint: "traces", fields: [stringField("trace", ["t"], { roles: ["trace-id"] }), stringField("span", ["s"], { roles: ["span-id"] }), stringField("operation", ["GET /"], { roles: ["operation"] }), stringField("service", ["api"], { roles: ["service"] }), timeField("start", [1], { roles: ["start-time"] }), numberField("duration", [1], { roles: ["duration"], config: { unit: { kind: "duration", unit: "ms" } } })] });
		expect(observabilityTraceWaterfallDefinition.validateFrames?.([trace] as never, observabilityTraceWaterfallDefinition.configSchema.parse({}), "waterfall")).toBeUndefined();
		const profile = dataFrame({ refId: "A", name: "profile", shapeHint: "profile", fields: [stringField("id", ["root"], { roles: ["id"] }), stringField("label", ["root"], { roles: ["label"] }), numberField("total", [1], { roles: ["total"] })] });
		expect(observabilityFlameGraphDefinition.validateFrames?.([profile] as never, observabilityFlameGraphDefinition.configSchema.parse({}), "flame")).toBeUndefined();
		const geo = dataFrame({ refId: "A", name: "geo", shapeHint: "geo", fields: [numberField("lat", [0], { roles: ["latitude"] }), numberField("lon", [0], { roles: ["longitude"] })] });
		expect(geoMapDefinition.validateFrames?.([geo] as never, geoMapDefinition.configSchema.parse({}), "points")).toBeUndefined();
	});
});
