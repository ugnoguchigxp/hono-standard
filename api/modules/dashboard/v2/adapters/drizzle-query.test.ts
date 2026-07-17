import { describe, expect, it, vi } from "vitest";
import { defineDrizzleRecordQueryV2 } from "./drizzle-query";
import { dashboardRecordQueryTestContext } from "./test-helpers";

describe("defineDrizzleRecordQueryV2", () => {
	it("binds the read database and typed select callback", async () => {
		const database = { kind: "read" as const };
		const select = vi.fn(() => [
			{ at: new Date("2026-07-18T00:00:00.000Z"), count: 2 },
		]);
		const query = defineDrizzleRecordQueryV2({
			id: "daily-orders",
			filterKeys: [],
			database,
			outputShape: "timeseries",
			frameName: "Daily orders",
			columns: [
				{ source: "at", type: "time", roles: ["time"] },
				{ source: "count", type: "number", roles: ["value"] },
			],
			select,
		});
		const input = dashboardRecordQueryTestContext();
		const result = await query.handler(input);
		expect(select).toHaveBeenCalledWith(database, input);
		expect(result.frames[0]?.fields[1]?.values).toEqual([2]);
	});

	it("preserves select failures", async () => {
		const failure = new Error("database unavailable");
		const query = defineDrizzleRecordQueryV2({
			id: "orders",
			filterKeys: [],
			database: { kind: "read" },
			frameName: "Orders",
			columns: [{ source: "count", type: "number" }],
			select: () => Promise.reject(failure) as Promise<Array<{ count: number }>>,
		});
		await expect(query.handler(dashboardRecordQueryTestContext())).rejects.toBe(
			failure,
		);
	});
});
