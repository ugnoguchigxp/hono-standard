import { describe, expect, it, vi } from "vitest";
import { DashboardRuntimeError } from "../../runtime-errors";
import type { DashboardQueryHandlerContextV2 } from "../types";
import { defineRecordQueryV2 } from "./record-query";
import { dashboardRecordQueryTestContext as context } from "./test-helpers";

describe("defineRecordQueryV2", () => {
	it("forwards the exact context and resolves the runtime frame ref", async () => {
		const load = vi.fn((value: DashboardQueryHandlerContextV2) => [
			{ value: value.filters.status?.length ?? 0 },
		]);
		const query = defineRecordQueryV2({
			id: "records",
			filterKeys: ["status"],
			frameName: "Records",
			columns: [{ source: "value", type: "number" }],
			load,
		});
		const input = context({ outputFrameRefs: ["Z9"] });
		const result = await query.handler(input);
		expect(load).toHaveBeenCalledWith(input);
		expect(result.frames[0]?.refId).toBe("Z9");
		expect(result.frames[0]?.fields[0]?.values).toEqual([1]);
	});

	it("returns an explicit empty state", async () => {
		const query = defineRecordQueryV2({
			id: "records",
			filterKeys: [],
			frameName: "Records",
			columns: [{ source: "value", type: "number" }],
			load: () => [] as Array<{ value: number }>,
		});
		await expect(query.handler(context())).resolves.toMatchObject({
			state: { emptyReason: "no-records" },
		});
	});

	it("maps adapter failures to non-retryable invalid results", async () => {
		const query = defineRecordQueryV2({
			id: "records",
			filterKeys: [],
			frameName: "Records",
			columns: [{ source: "value", type: "number" }],
			load: () => [{ value: Number.NaN }],
		});
		const error = await Promise.resolve(query.handler(context())).catch(
			(caught: unknown) => caught,
		);
		expect(error).toBeInstanceOf(DashboardRuntimeError);
		expect(error).toMatchObject({
			code: "INVALID_HANDLER_RESULT",
			status: 422,
			retryable: false,
		});
	});

	it("rejects multiple refs and aborts before and after load", async () => {
		const load = vi.fn(() => [{ value: 1 }]);
		const query = defineRecordQueryV2({
			id: "records",
			filterKeys: [],
			frameName: "Records",
			columns: [{ source: "value", type: "number" }],
			load,
		});
		await expect(
			query.handler(context({ outputFrameRefs: ["A", "B"] })),
		).rejects.toMatchObject({ code: "INVALID_HANDLER_RESULT" });

		const before = new AbortController();
		before.abort();
		await expect(
			query.handler(context({ signal: before.signal })),
		).rejects.toMatchObject({ code: "REQUEST_CANCELLED" });
		expect(load).not.toHaveBeenCalled();

		const after = new AbortController();
		const aborting = defineRecordQueryV2({
			id: "records",
			filterKeys: [],
			frameName: "Records",
			columns: [{ source: "value", type: "number" }],
			load: () => {
				after.abort();
				return [{ value: 1 }];
			},
		});
		await expect(
			aborting.handler(context({ signal: after.signal })),
		).rejects.toMatchObject({ code: "REQUEST_CANCELLED" });
	});
});
