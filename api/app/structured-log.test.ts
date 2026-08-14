import { describe, expect, it, vi } from "vitest";
import {
	createStructuredLogRecord,
	errorLogFields,
	writeStructuredLog,
} from "./structured-log";

describe("structured logging", () => {
	it("creates stable JSON-ready records", () => {
		expect(
			createStructuredLogRecord("info", "server_started", { port: 5173 }, () =>
				Date.parse("2026-08-14T00:00:00.000Z"),
			),
		).toEqual({
			timestamp: "2026-08-14T00:00:00.000Z",
			level: "info",
			event: "server_started",
			port: 5173,
		});
	});

	it("does not allow additional fields to replace the log envelope", () => {
		expect(
			createStructuredLogRecord(
				"info",
				"expected_event",
				{
					timestamp: "forged",
					level: "error",
					event: "forged_event",
				},
				() => Date.parse("2026-08-14T00:00:00.000Z"),
			),
		).toMatchObject({
			timestamp: "2026-08-14T00:00:00.000Z",
			level: "info",
			event: "expected_event",
		});
	});

	it("writes info and error records to the matching console stream", () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		writeStructuredLog(createStructuredLogRecord("info", "info_event"));
		writeStructuredLog(createStructuredLogRecord("error", "error_event"));
		expect(JSON.parse(String(log.mock.calls[0]?.[0])).event).toBe("info_event");
		expect(JSON.parse(String(error.mock.calls[0]?.[0])).event).toBe(
			"error_event",
		);
	});

	it("normalizes Error and non-Error values", () => {
		expect(errorLogFields(new TypeError("broken"))).toEqual({
			errorName: "TypeError",
			errorMessage: "broken",
		});
		expect(errorLogFields("broken")).toEqual({
			errorName: "UnknownError",
			errorMessage: "broken",
		});
	});
});
