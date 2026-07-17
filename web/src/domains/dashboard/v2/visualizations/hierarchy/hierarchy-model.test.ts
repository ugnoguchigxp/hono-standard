import { describe, expect, it } from "vitest";
import { tableFrame } from "../../test/fixtures";
import { buildHierarchyModel } from "./hierarchy-model";

const hierarchyFrame = () => {
	const frame = tableFrame([{ name: "root", value: 3 }, { name: "child", value: 3 }]);
	frame.meta = { shapeHint: "hierarchy" };
	frame.fields = [
		{ key: "id", label: "ID", type: "string", values: ["root", "child"], roles: ["id"], labels: {} },
		{ key: "parent", label: "Parent", type: "string", values: [null, "root"], roles: ["parent-id"], labels: {} },
		{ key: "value", label: "Value", type: "number", values: [3, 3], roles: ["value"], labels: {} },
	];
	return frame;
};
describe("hierarchy model", () => {
	it("builds a synthetic root and preserves paths", () => {
		const model = buildHierarchyModel(hierarchyFrame(), [], "Title");
		expect(model.syntheticRoot.id).toBe("__dashboard_root__");
		expect(model.leafCount).toBe(1);
		expect(model.roots[0]?.children[0]?.path).toEqual(["root", "child"]);
	});
	it("rejects orphan and cycle inputs", () => {
		const orphan = hierarchyFrame();
		(orphan.fields[1] as { values: Array<string | null> }).values = [null, "missing"];
		expect(() => buildHierarchyModel(orphan, [])).toThrow("HIERARCHY_ORPHAN");
		const cycle = hierarchyFrame();
		(cycle.fields[1] as { values: Array<string | null> }).values = ["child", "root"];
		expect(() => buildHierarchyModel(cycle, [])).toThrow("HIERARCHY_CYCLE");
	});
});
