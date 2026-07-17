import { heatmapConfigV1Schema } from "@shared/schemas/dashboard/distribution-visualizations.schema";
import { describe, expect, it } from "vitest";
import { buildMatrixModel } from "./matrix";

const makeFrame = (xs: Array<string | null>, ys: string[], values: Array<number | null>) => ({ schemaVersion: 2 as const, refId: "A", source: { kind: "query" as const, refId: "A" }, name: "Matrix", meta: { shapeHint: "matrix" as const }, fields: [{ key: "x", label: "X", type: "string" as const, roles: ["x" as const], labels: {}, values: xs }, { key: "y", label: "Y", type: "string" as const, roles: ["y" as const], labels: {}, values: ys }, { key: "value", label: "Value", type: "number" as const, roles: ["value" as const], labels: {}, values }] });
describe("matrix model", () => {
	it("keeps null and zero distinct", () => { const model = buildMatrixModel(makeFrame(["a", "b"], ["x", "x"], [0, null]), heatmapConfigV1Schema.parse({})); expect(model.values).toEqual([0]); expect(model.cells[1]?.explicitNull).toBe(true); });
	it("rejects duplicate coordinates", () => { expect(() => buildMatrixModel(makeFrame(["a", "a"], ["x", "x"], [1, 2]), heatmapConfigV1Schema.parse({}))).toThrow("DUPLICATE"); });
});
