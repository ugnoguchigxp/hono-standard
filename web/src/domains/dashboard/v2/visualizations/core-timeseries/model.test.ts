import { describe, expect, it } from "vitest";
import { tableFrame } from "../../test/fixtures";
import { timeseriesSeries, toTimeseriesRows } from "./model";

describe("timeseries model compatibility adapter", () => {
	it("delegates to aligned Cartesian rows", () => {
		const frame = tableFrame([{ name: "one", value: 1 }, { name: "two", value: 2 }]);
		frame.fields[0] = { key: "time", label: "Time", type: "time", roles: ["time"], labels: {}, values: [2, 1] };
		expect(timeseriesSeries([frame])).toHaveLength(1);
		expect(toTimeseriesRows([frame]).map((row) => row.time)).toEqual([1, 2]);
	});
});
