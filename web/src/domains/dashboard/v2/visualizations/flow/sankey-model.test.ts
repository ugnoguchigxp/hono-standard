import { describe, expect, it } from "vitest";
import { buildSankeyModel } from "./sankey-model";
import { dataFrame, numberField, stringField } from "../../../../../../../api/modules/dashboard/v2/frame-builders";

const frames = () => [
	dataFrame({ refId: "A", name: "Nodes", shapeHint: "graph-nodes", fields: [stringField("id", ["a", "b", "c"], { roles: ["id"] })] }),
	dataFrame({ refId: "B", name: "Edges", shapeHint: "graph-edges", fields: [stringField("source", ["a", "b"], { roles: ["source"] }), stringField("target", ["b", "c"], { roles: ["target"] }), numberField("value", [2, 1], { roles: ["value"] })] }),
];
describe("Sankey model", () => {
	it("indexes a DAG in input order and calculates source flow", () => {
		const [nodes, edges] = frames();
		const model = buildSankeyModel(nodes as never, edges as never, []);
		expect(model.links.map((link) => [link.source, link.target])).toEqual([[0, 1], [1, 2]]);
		expect(model.totalFlow).toBe(2);
	});
	it("rejects cycles and duplicate edges", () => {
		const [nodes, edges] = frames();
		const cyclic = structuredClone(edges);
		(cyclic.fields[1] as { values: Array<string | null> }).values = ["b", "a"];
		expect(() => buildSankeyModel(nodes as never, cyclic as never, [])).toThrow("SANKEY_CYCLE");
	});
});
