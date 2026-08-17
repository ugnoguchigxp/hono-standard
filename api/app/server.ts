import { type AppEnv, readAppEnv } from "./env";
import app, { getAppRuntime } from "./hono";
import {
	createStructuredLogRecord,
	errorLogFields,
	writeStructuredLog,
} from "./structured-log";

export type HttpServer = {
	port: number;
	stop: (closeActiveConnections?: boolean) => void;
};

export type ServeHttp = (options: {
	fetch: typeof app.fetch;
	hostname: string;
	port: number;
}) => HttpServer;

export function toHttpServer(
	server: {
		port?: number;
		stop: (closeActiveConnections?: boolean) => void;
	},
	fallbackPort: number,
): HttpServer {
	return {
		port: server.port ?? fallbackPort,
		stop: (closeActiveConnections) => server.stop(closeActiveConnections),
	};
}

export async function shutdownHttpServer(
	server: HttpServer,
	signal: string,
	deps: {
		getRuntime?: typeof getAppRuntime;
		exit?: (code: number) => void;
	} = {},
): Promise<void> {
	const getRuntime = deps.getRuntime ?? getAppRuntime;
	const exit = deps.exit ?? ((code) => process.exit(code));

	writeStructuredLog(
		createStructuredLogRecord("info", "server_stopping", { signal }),
	);
	server.stop(true);

	try {
		const runtime = await getRuntime();
		await runtime.dbRuntime.close();
		writeStructuredLog(
			createStructuredLogRecord("info", "server_stopped", { signal }),
		);
		exit(0);
	} catch (error) {
		writeStructuredLog(
			createStructuredLogRecord("error", "server_shutdown_failed", {
				signal,
				...errorLogFields(error),
			}),
		);
		exit(1);
	}
}

export function startHttpServer(env: AppEnv, serve: ServeHttp): HttpServer {
	const server = serve({
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

	return server;
}

export function bindHttpServerSignals(
	server: HttpServer,
	onShutdown: (signal: string) => Promise<void> = (signal) =>
		shutdownHttpServer(server, signal),
): () => void {
	const onSigint = () => {
		void onShutdown("SIGINT");
	};
	const onSigterm = () => {
		void onShutdown("SIGTERM");
	};
	process.on("SIGINT", onSigint);
	process.on("SIGTERM", onSigterm);
	return () => {
		process.off("SIGINT", onSigint);
		process.off("SIGTERM", onSigterm);
	};
}

if (import.meta.main) {
	const env = readAppEnv();
	const server = startHttpServer(env, (options) =>
		toHttpServer(Bun.serve(options), options.port),
	);
	bindHttpServerSignals(server);
}
