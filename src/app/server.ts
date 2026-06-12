import app, { getAppRuntime } from "./hono";
import { readAppEnv } from "./env";

const env = readAppEnv();

const server = Bun.serve({
	fetch: app.fetch,
	hostname: env.host,
	port: env.port,
});

console.log(
	`RAG template server listening on http://${env.host}:${server.port}`,
);

const shutdown = async (signal: string) => {
	console.log(`\nReceived ${signal}. Shutting down gracefully...`);
	server.stop(true);

	try {
		const runtime = await getAppRuntime();
		if (runtime?.dbConnection?.ownsConnection) {
			const client = runtime.dbConnection.pgClient;
			if ("end" in client && typeof client.end === "function") {
				console.log("Closing database connection pool...");
				await client.end();
			}
		}
		console.log("Shutdown complete.");
		process.exit(0);
	} catch (error) {
		console.error("Error during shutdown:", error);
		process.exit(1);
	}
};

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
