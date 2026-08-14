import { randomUUID } from "node:crypto";
import { createMiddleware } from "hono/factory";
import {
	createStructuredLogRecord,
	type StructuredLogSink,
	writeStructuredLog,
} from "../app/structured-log";

type RequestLoggerOptions = {
	now?: () => number;
	createRequestId?: () => string;
	write?: StructuredLogSink;
};

const validRequestId = /^[A-Za-z0-9._:-]{1,128}$/;

export function createRequestLogger(options: RequestLoggerOptions = {}) {
	const now = options.now ?? Date.now;
	const createRequestId = options.createRequestId ?? randomUUID;
	const write = options.write ?? writeStructuredLog;

	return createMiddleware(async (c, next) => {
		const suppliedRequestId = c.req.header("x-request-id");
		const requestId =
			suppliedRequestId && validRequestId.test(suppliedRequestId)
				? suppliedRequestId
				: createRequestId();
		const startedAt = now();
		c.set("requestId", requestId);
		c.header("X-Request-Id", requestId);

		try {
			await next();
		} finally {
			const finishedAt = now();
			write(
				createStructuredLogRecord(
					"info",
					"http_request",
					{
						requestId,
						method: c.req.method,
						path: c.req.path,
						status: c.res.status,
						durationMs: Math.max(0, finishedAt - startedAt),
					},
					() => finishedAt,
				),
			);
		}
	});
}
