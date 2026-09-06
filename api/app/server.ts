import { type AppEnv, readAppEnv } from "./env";
import app, { getAppRuntime } from "./hono";
import {
	createStructuredLogRecord,
	errorLogFields,
	writeStructuredLog,
} from "./structured-log";

export type HttpServer = {
	port: number;
	stop: (closeActiveConnections?: boolean) => void | Promise<void>;
};

export type ServeHttp = (options: {
	fetch: typeof app.fetch;
	hostname: string;
	port: number;
}) => HttpServer;

export function toHttpServer(
	server: {
		port?: number;
		stop: HttpServer["stop"];
	},
	fallbackPort: number,
): HttpServer {
	return {
		port: server.port ?? fallbackPort,
		stop: (closeActiveConnections) => server.stop(closeActiveConnections),
	};
}

const shutdowns = new WeakMap<HttpServer, Promise<void>>();

export function shutdownHttpServer(
	server: HttpServer,
	signal: string,
	deps: {
		getRuntime?: typeof getAppRuntime;
		exit?: (code: number) => void;
		timeoutMs?: number;
	} = {},
): Promise<void> {
	const existing = shutdowns.get(server);
	if (existing) return existing;
	const shutdown = performShutdown(server, signal, deps);
	shutdowns.set(server, shutdown);
	return shutdown;
}

async function performShutdown(
	server: HttpServer,
	signal: string,
	deps: {
		getRuntime?: typeof getAppRuntime;
		exit?: (code: number) => void;
		timeoutMs?: number;
	},
) {
	const getRuntime = deps.getRuntime ?? getAppRuntime;
	const exit = deps.exit ?? ((code) => process.exit(code));
	let timer: ReturnType<typeof setTimeout> | undefined;

	writeStructuredLog(
		createStructuredLogRecord("info", "server_stopping", { signal }),
	);
	try {
		await Promise.race([
			(async () => {
				await server.stop(false);
				const runtime = await getRuntime();
				await runtime.dbRuntime.close();
			})(),
			new Promise<never>((_, reject) => {
				timer = setTimeout(
					() => reject(new Error("Graceful shutdown deadline exceeded")),
					deps.timeoutMs ?? 10_000,
				);
			}),
		]);
		writeStructuredLog(
			createStructuredLogRecord("info", "server_stopped", { signal }),
		);
		exit(0);
	} catch (error) {
		// Force-close without allowing a stuck connection to delay process exit.
		try {
			void Promise.resolve(server.stop(true)).catch(() => undefined);
		} catch {
			// The original shutdown error is logged below.
		}
		writeStructuredLog(
			createStructuredLogRecord("error", "server_shutdown_failed", {
				signal,
				...errorLogFields(error),
			}),
		);
		exit(1);
	} finally {
		clearTimeout(timer);
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
	let stopping = false;
	const stopOnce = (signal: string) => {
		if (stopping) return;
		stopping = true;
		void onShutdown(signal);
	};
	const onSigint = () => {
		stopOnce("SIGINT");
	};
	const onSigterm = () => {
		stopOnce("SIGTERM");
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
