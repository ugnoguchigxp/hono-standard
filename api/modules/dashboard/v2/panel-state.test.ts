import { describe, expect, it } from "vitest";
import { dataFrame, numberField } from "./frame-builders";
import { mergePanelDataStateV2 } from "./panel-state";

describe("v2 panel state", () => {
	it("merges partial, empty reason, and freshness deterministically", () => {
		const frame = dataFrame({ refId: "A", name: "A", shapeHint: "table", fields: [numberField("value", [1])] });
		const fullFrame = { ...frame, schemaVersion: 2 as const, source: { kind: "query" as const, refId: "A" } };
		const state = mergePanelDataStateV2([{ frames: [fullFrame], state: { partial: false, truncated: false, notices: [], dataThrough: "2026-01-01T00:00:00.000Z", staleAfterMs: 100 } }]);
		expect(state.dataThrough).toBe("2026-01-01T00:00:00.000Z");
		expect(state.emptyReason).toBeUndefined();
		const empty = mergePanelDataStateV2([{ frames: [], state: { partial: false, truncated: false, notices: [], emptyReason: "filter-no-match" } }], [], []);
		expect(empty.emptyReason).toBe("filter-no-match");
		const truncated = mergePanelDataStateV2([{ frames: [fullFrame], state: { partial: false, truncated: false, notices: [] } }], [], [fullFrame], true);
		expect(truncated.truncated).toBe(true);
		expect(truncated.notices).toContainEqual(expect.objectContaining({ code: "DATA_TRUNCATED" }));
	});

	it("omits freshness when any nonempty query has incomplete metadata", () => {
		const frameA = dataFrame({ refId: "A", name: "A", shapeHint: "table", fields: [numberField("value", [1])] });
		const frameB = dataFrame({ refId: "B", name: "B", shapeHint: "table", fields: [numberField("value", [2])] });
		const source = (refId: string) => ({ kind: "query" as const, refId });
		const state = mergePanelDataStateV2([
			{ frames: [{ ...frameA, schemaVersion: 2 as const, source: source("A") }], state: { partial: false, truncated: false, notices: [], dataThrough: "2026-01-01T00:00:00.000Z", staleAfterMs: 100 } },
			{ frames: [{ ...frameB, schemaVersion: 2 as const, source: source("B") }], state: { partial: false, truncated: false, notices: [] } },
		]);
		expect(state.dataThrough).toBeUndefined();
		expect(state.staleAfterMs).toBeUndefined();
		expect(state.notices).toContainEqual(expect.objectContaining({ code: "FRESHNESS_METADATA_INCOMPLETE" }));
	});
});
