import { describe, expect, it } from "vitest";
import { traceCriticalPath } from "./critical-path";
import type { TraceSpan } from "./trace-model";

describe("traceCriticalPath", () => {
	it("should find the longest path (critical path) from spans", () => {
		const spans: TraceSpan[] = [
			{ key: "root", spanId: "root", parentSpanId: null, duration: 10, children: ["child1", "child2"] } as any,
			{ key: "child1", spanId: "child1", parentSpanId: "root", duration: 20, children: ["grandchild"] } as any,
			{ key: "child2", spanId: "child2", parentSpanId: "root", duration: 5, children: [] } as any,
			{ key: "grandchild", spanId: "grandchild", parentSpanId: "child1", duration: 15, children: [] } as any,
		];

		const result = traceCriticalPath(spans);
		// root (10) -> child1 (20) -> grandchild (15) = 45
		// root (10) -> child2 (5) = 15
		// クリティカルパスは root -> child1 -> grandchild
		expect(result).toEqual(["root", "child1", "grandchild"]);
	});

	it("should tie-break using pathKey if durations are equal", () => {
		// A (10) -> B (10) = 20
		// A (10) -> C (10) = 20
		// pathKey "A→B" vs "A→C" where "A→B" < "A→C" so "A→B" is selected
		const spans: TraceSpan[] = [
			{ key: "A", spanId: "A", parentSpanId: null, duration: 10, children: ["B", "C"] } as any,
			{ key: "B", spanId: "B", parentSpanId: "A", duration: 10, children: [] } as any,
			{ key: "C", spanId: "C", parentSpanId: "A", duration: 10, children: [] } as any,
		];

		const result = traceCriticalPath(spans);
		expect(result).toEqual(["A", "B"]);
	});
});
