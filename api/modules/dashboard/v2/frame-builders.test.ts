import { describe, expect, it } from "vitest";
import { booleanField, dataFrame, numberField, queryResult, stringField, timeField } from "./frame-builders";

describe("v2 frame builders", () => {
	it("builds typed fields and keeps nulls and input arrays isolated", () => {
		const values: Array<number | null> = [1, null];
		const frame = dataFrame({ refId: "A", name: "Requests", shapeHint: "timeseries", fields: [timeField("time", [1, 2]), numberField("value", values, { roles: ["value"] })] });
		values[0] = 99;
		expect(frame.fields[1]?.values[0]).toBe(1);
		expect(frame).not.toHaveProperty("schemaVersion");
		expect(queryResult({ frames: [frame] }).frames).toHaveLength(1);
		expect(stringField("name", ["a", null]).type).toBe("string");
		expect(booleanField("ok", [true, null]).type).toBe("boolean");
	});
});
