import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { readAppEnv, type AppEnv } from "./app/env";
import * as schema from "./db/schema";
import { requireAuth } from "./middleware/auth";
import { AuthService } from "./modules/auth/auth.service";
import { HttpError } from "./modules/auth/errors";
import { createAuthRoute } from "./routes/auth.route";
import { createHealthRoute } from "./routes/health.route";

type D1DatabaseBinding = Parameters<typeof drizzle>[0];

type WorkerBindings = {
	DB: D1DatabaseBinding;
	[key: string]: string | D1DatabaseBinding | undefined;
};

function readWorkerEnv(bindings: WorkerBindings): AppEnv {
	return readAppEnv({
		...(bindings as Record<string, string>),
		DATABASE_URL: "file:cloudflare-d1",
	});
}

function createWorkerApp(bindings: WorkerBindings) {
	const env = readWorkerEnv(bindings);
	const db = drizzle(bindings.DB, { schema });
	const authService = new AuthService(db as never, env);
	const app = new Hono<{ Bindings: WorkerBindings }>();

	app.use("*", secureHeaders({ contentSecurityPolicy: undefined }));
	app.use(
		"/api/*",
		cors({
			origin: (origin) => {
				if (!origin) return undefined;
				if (env.corsOrigins.includes(origin)) return origin;
				return null;
			},
			credentials: true,
			allowMethods: ["GET", "POST", "OPTIONS"],
			allowHeaders: ["Content-Type", "Authorization"],
		}),
	);
	app.use("/api/*", csrf());

	app.onError((error, c) => {
		if (error instanceof HttpError) {
			return c.json(
				{ message: error.message },
				error.status as 400 | 401 | 403 | 404 | 409 | 500,
			);
		}
		if (error instanceof HTTPException) {
			return c.json({ message: error.message }, error.status as 400 | 500);
		}
		return c.json({ message: "Internal server error" }, 500);
	});

	const apiRoutes = new Hono()
		.route("/health", createHealthRoute())
		.use(
			"/auth/me",
			requireAuth({
				env,
				authService,
			}),
		)
		.route(
			"/auth",
			createAuthRoute({
				authService,
				env,
			}),
		);

	app.route("/api", apiRoutes);
	return app;
}

export default {
	fetch(request: Request, env: WorkerBindings, executionContext: unknown) {
		return createWorkerApp(env).fetch(request, env, executionContext as never);
	},
};
