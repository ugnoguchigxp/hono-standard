import { describe, expect, it } from "vitest";
import { SseParser } from "./stream-parser";

describe("SseParser edge cases", () => {
	it("rejects a completed frame larger than the limit", () => {
		expect(() =>
			new SseParser().feed(`data: ${"x".repeat(1_048_577)}\n\n`),
		).toThrow("too large");
	});

	it("handles fields without values, unknown fields, and empty frames", () => {
		expect(
			new SseParser().feed("retry: 10\n\ndata\nid\nevent\n\n"),
		).toEqual([{ event: "", id: "", data: "" }]);
	});
});
