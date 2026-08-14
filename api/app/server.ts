import app, { getAppRuntime } from "./hono";
import { readAppEnv } from "./env";
import {
	createStructuredLogRecord,
	errorLogFields,
	writeStructuredLog,
} from "./structured-log";

const env = readAppEnv();

const server = Bun.serve({
	fetch: app.fetch,
	hostname: env.host,
	port: env.port,
});

writeStructuredLog(
	createStructuredLogRecord("info", "server_started", {
		host: env.host,
		port: server.port,
	}),
);

const shutdown = async (signal: string) => {
	writeStructuredLog(
		createStructuredLogRecord("info", "server_stopping", { signal }),
	);
	server.stop(true);

	try {
		const runtime = await getAppRuntime();
		await runtime.dbRuntime.close();
		writeStructuredLog(
			createStructuredLogRecord("info", "server_stopped", { signal }),
		);
		process.exit(0);
	} catch (error) {
		writeStructuredLog(
			createStructuredLogRecord("error", "server_shutdown_failed", {
				signal,
				...errorLogFields(error),
			}),
		);
		process.exit(1);
	}
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
