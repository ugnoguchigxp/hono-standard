import { describe, expect, it } from "vitest";
import { defineDashboardQueryV2 } from "./define-dashboard";

describe("v2 definition helpers", () => {
	it("applies interval defaults and copies output declarations", () => {
		const shapes: ("table")[] = ["table"];
		const value = defineDashboardQueryV2({ id: "query", filterKeys: ["service"], outputShapes: shapes, handler: () => ({ frames: [] }) });
		shapes[0] = "table";
		expect(value.interval).toBe("auto");
		expect(value.outputShapes).toEqual(["table"]);
		expect(() => defineDashboardQueryV2({ id: "query", filterKeys: ["service", "service"], outputShapes: ["table"], handler: () => ({ frames: [] }) })).toThrow();
	});
});
