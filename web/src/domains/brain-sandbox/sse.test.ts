import { describe, expect, it } from "vitest";
import { SseParser } from "./sse";
describe("SseParser", () => {
	it("handles split CRLF and multiple data lines", () => {
		const parser = new SseParser();
		expect(parser.push('event: batch\r\ndata: {"a":')).toEqual([]);
		expect(
			parser.push("1}\r\ndata: second\r\nid: 3\r\n\r\n: keepalive\r\n\r\n"),
		).toEqual([{ event: "batch", data: '{"a":1}\nsecond', id: "3" }]);
	});
});
