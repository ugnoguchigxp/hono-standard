import { describe, expect, it } from "vitest";
import { dataFrame, numberField } from "./frame-builders";
import { normalizeQueryHandlerResultV2 } from "./frame-normalizer";

describe("v2 frame normalizer", () => {
	const query = { id: "query", filterKeys: [], outputShapes: ["table"] as ("table")[], handler: () => ({ frames: [] }) };
	it("orders declared frames and adds trusted source metadata", () => {
		const result = normalizeQueryHandlerResultV2({ binding: { refId: "A", outputFrameRefs: ["A", "B"] }, query: { ...query, outputShapes: ["table", "table"] }, result: { frames: [dataFrame({ refId: "B", name: "B", shapeHint: "table", fields: [numberField("value", [2])] }), dataFrame({ refId: "A", name: "A", shapeHint: "table", fields: [numberField("value", [1])] })] } });
		expect(result.frames.map((frame) => frame.refId)).toEqual(["A", "B"]);
		expect(result.frames[0]?.source).toEqual({ kind: "query", refId: "A" });
	});
	it("rejects source spoofing and missing declarations", () => {
		const frame = dataFrame({ refId: "A", name: "A", shapeHint: "table", fields: [numberField("value", [1])] });
		expect(() => normalizeQueryHandlerResultV2({ binding: { refId: "A", outputFrameRefs: ["A"] }, query, result: { frames: [{ ...frame, source: { kind: "query", refId: "Z" } }] } })).toThrow();
	});
});
