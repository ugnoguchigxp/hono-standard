import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { secureHeaders } from "hono/secure-headers";
import { readAppEnv } from "./app/env";
import { createRequestLogger } from "./middleware/request-logger";
import { createHealthRoute } from "./routes/health.route";
import { createReadyRoute } from "./routes/ready.route";

type D1DatabaseBinding = Parameters<typeof drizzle>[0];

type WorkerBindings = {
	DB: D1DatabaseBinding;
	[key: string]: string | D1DatabaseBinding | undefined;
};

export function createWorkerApp(bindings: WorkerBindings) {
	const env = readAppEnv({
		...(bindings as Record<string, string>),
		DATABASE_URL: "file:cloudflare-d1",
	});
	const app = new Hono<{ Bindings: WorkerBindings }>();

	app.use("*", createRequestLogger());
	app.use("*", secureHeaders({ contentSecurityPolicy: undefined }));
	app.use(
		"/api/*",
		cors({
			origin: (origin) =>
				origin && env.corsOrigins.includes(origin) ? origin : null,
			allowMethods: ["GET", "POST", "OPTIONS"],
			allowHeaders: ["Content-Type"],
		}),
	);
	app.use("/api/*", csrf());
	app.route(
		"/api",
		new Hono().route("/health", createHealthRoute()).route(
			"/ready",
			createReadyRoute(async () => {
				const probe = await bindings.DB.prepare("SELECT 1").all();
				if (!probe.success) throw new Error("D1 probe failed");
			}),
		),
	);
	return app;
}

export default {
	fetch(request: Request, env: WorkerBindings, executionContext: unknown) {
		return createWorkerApp(env).fetch(request, env, executionContext as never);
	},
};
