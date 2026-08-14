import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";
import type { StructuredLogRecord } from "../app/structured-log";
import { HttpError } from "../app/http-error";
import { createRequestLogger } from "./request-logger";

describe("createRequestLogger", () => {
	it("writes a structured request summary and returns a request id", async () => {
		const records: StructuredLogRecord[] = [];
		const ticks = [100, 125];
		const app = new Hono();
		app.use(
			"*",
			createRequestLogger({
				now: () => ticks.shift() ?? 125,
				createRequestId: () => "generated-id",
				write: (record) => records.push(record),
			}),
		);
		app.get("/health", (c) => c.json({ ok: true }));

		const response = await app.request("/health");
		expect(response.headers.get("X-Request-Id")).toBe("generated-id");
		expect(records[0]).toMatchObject({
			level: "info",
			event: "http_request",
			requestId: "generated-id",
			method: "GET",
			path: "/health",
			status: 200,
			durationMs: 25,
		});
	});

	it("accepts safe upstream ids and records thrown HTTP status codes", async () => {
		const records: StructuredLogRecord[] = [];
		const app = new Hono();
		app.use(
			"*",
			createRequestLogger({
				write: (record) => records.push(record),
			}),
		);
		app.get("/private", () => {
			throw new HttpError(403, "Forbidden");
		});
		app.onError((error, c) =>
			c.json({ message: error.message }, (error as HttpError).status as 403),
		);

		const response = await app.request("/private", {
			headers: { "X-Request-Id": "upstream:123" },
		});
		expect(response.status).toBe(403);
		expect(records[0]).toMatchObject({
			requestId: "upstream:123",
			status: 403,
		});
	});

	it("replaces unsafe request ids", async () => {
		const app = new Hono();
		app.use(
			"*",
			createRequestLogger({ createRequestId: () => "safe-generated-id" }),
		);
		app.get("/", (c) => c.text("ok"));
		const response = await app.request("/", {
			headers: { "X-Request-Id": "unsafe id" },
		});
		expect(response.headers.get("X-Request-Id")).toBe("safe-generated-id");
	});

	it.each([
		["HTTPException", new HTTPException(409), 409],
		["unknown error", new Error("broken"), 500],
	] as const)("records %s failures", async (_label, thrownError, status) => {
		const records: StructuredLogRecord[] = [];
		const app = new Hono();
		app.use(
			"*",
			createRequestLogger({ write: (record) => records.push(record) }),
		);
		app.get("/failure", () => {
			throw thrownError;
		});
		app.onError((_error, c) => c.text("failed", status as 409 | 500));

		expect((await app.request("/failure")).status).toBe(status);
		expect(records[0]?.status).toBe(status);
	});
});
