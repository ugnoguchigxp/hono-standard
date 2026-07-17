import { describe, expect, it } from "vitest";
import { tableFrame } from "../../test/fixtures";
import { categorySeries, toCategoryRows } from "./model";

describe("bar model compatibility adapter", () => {
	it("aligns category rows and preserves series metadata", () => {
		const frame = tableFrame([{ name: "api", value: 1 }, { name: "web", value: 2 }]);
		expect(categorySeries([frame])).toHaveLength(1);
		expect(toCategoryRows([frame]).map((row) => row.category)).toEqual(["api", "web"]);
	});
});
