import { describe, expect, it } from "vitest";
import { SseParser } from "./stream-parser";

describe("SseParser", () => {
	it("handles split frames, CRLF, comments, and multiline data", () => {
		const parser = new SseParser();
		expect(parser.feed(": keepalive\r\nevent: snapshot\r\nid: a:1\r\ndata: {\"a\":")).toEqual([]);
		expect(parser.feed(" 1}\r\n\r\nevent: event\ndata: first\ndata: second\n\n")).toEqual([
			{ event: "snapshot", id: "a:1", data: '{"a": 1}' },
			{ event: "event", id: undefined, data: "first\nsecond" },
		]);
	});
	it("rejects unbounded frames", () => {
		expect(() => new SseParser().feed("x".repeat(1_048_577))).toThrow("too large");
	});
	it("accepts multiple bounded frames in one large network chunk", () => {
		const parser = new SseParser();
		const frame = `event: event\ndata: ${"x".repeat(600_000)}\n\n`;
		expect(parser.feed(frame + frame)).toHaveLength(2);
	});
});
