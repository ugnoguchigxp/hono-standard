import fs from "node:fs/promises";
import path from "node:path";
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { secureHeaders } from "hono/secure-headers";
import type { DbRuntime } from "../db";
import { createDbRuntime } from "../db";
import { requireAuth } from "../middleware/auth";
import { AuthService } from "../modules/auth/auth.service";
import { HttpError } from "../modules/auth/errors";
import {
	createDashboardModule,
	type DashboardModule,
} from "../modules/dashboard";
import {
	galleryDashboardV2,
	galleryVisualizations,
} from "../modules/dashboard/v2/gallery-dashboard";
import { operationsDashboardV2 } from "../modules/dashboard/v2/operations-dashboard";
import { createAuthRoute } from "../routes/auth.route";
import { createDashboardRoute } from "../routes/dashboard.route";
import { createHealthRoute } from "../routes/health.route";
import { createProtectedRoute } from "../routes/protected.route";
import { type AppEnv, readAppEnv } from "./env";
import { appContentSecurityPolicy } from "./security-headers";

export type AppDeps = {
	env: AppEnv;
	dbRuntime: DbRuntime;
	authService: AuthService;
	dashboard: DashboardModule;
};

declare global {
	var __honoStandardRuntime__: Promise<AppDeps> | undefined;
}

export async function createDefaultAppDeps(): Promise<AppDeps> {
	const env = readAppEnv();
	const dbRuntime = createDbRuntime(env);
	const authService = new AuthService(dbRuntime.client, env);
	const dashboard = createDashboardModule({
		dashboards: [],
		nativeDashboards: [operationsDashboardV2, galleryDashboardV2],
		visualizations: galleryVisualizations,
	});
	return { env, dbRuntime, authService, dashboard };
}

export async function getAppRuntime(): Promise<AppDeps> {
	if (!globalThis.__honoStandardRuntime__) {
		globalThis.__honoStandardRuntime__ = createDefaultAppDeps().catch(
			(error) => {
				globalThis.__honoStandardRuntime__ = undefined;
				throw error;
			},
		);
	}
	return globalThis.__honoStandardRuntime__;
}

const distWebDirectory = process.env.DIST_WEB_ROOT ?? "dist-web";
const distWebRoot = path.resolve(process.cwd(), distWebDirectory);
const distWebIndex = path.resolve(distWebRoot, "index.html");

export function createApiRoutes(deps: AppDeps) {
	return new Hono()
		.route("/health", createHealthRoute())
		.use(
			"/protected/*",
			requireAuth({
				env: deps.env,
				authService: deps.authService,
			}),
		)
		.route("/protected", createProtectedRoute())
		.use(
			"/dashboards/*",
			requireAuth({
				env: deps.env,
				authService: deps.authService,
			}),
		)
		.route("/dashboards", createDashboardRoute({ dashboard: deps.dashboard }))
		.use(
			"/auth/me",
			requireAuth({
				env: deps.env,
				authService: deps.authService,
			}),
		)
		.route(
			"/auth",
			createAuthRoute({
				authService: deps.authService,
				env: deps.env,
			}),
		);
}

export function createApp(deps: AppDeps) {
	const app = new Hono();
	const useHttpsSecurityHeaders =
		deps.env.securityHeadersMode === "https" ||
		(deps.env.securityHeadersMode === "auto" && deps.env.secureCookie);
	const secureHeaderOptions = useHttpsSecurityHeaders
		? { contentSecurityPolicy: appContentSecurityPolicy }
		: {
				contentSecurityPolicy: appContentSecurityPolicy,
				crossOriginOpenerPolicy: false,
				originAgentCluster: false,
				strictTransportSecurity: false,
			};

	app.use("*", logger());
	app.use("*", secureHeaders(secureHeaderOptions));
	app.use(
		"/api/*",
		cors({
			origin: (origin) => {
				if (!origin) return undefined;
				if (deps.env.corsOrigins.includes(origin)) return origin;
				return null;
			},
			credentials: true,
			allowMethods: ["GET", "POST", "OPTIONS"],
			allowHeaders: ["Content-Type", "Authorization"],
		}),
	);
	app.use("/api/*", csrf());

	app.onError(async (error, c) => {
		if (error instanceof HttpError) {
			if (error.status >= 500) {
				console.error(error);
			}
			return c.json(
				{ message: error.message },
				error.status as 400 | 401 | 403 | 404 | 409 | 500,
			);
		}
		if (error instanceof HTTPException) {
			const response = error.getResponse();
			if (response.status >= 500) {
				console.error(error);
			}
			const message =
				(await response
					.clone()
					.text()
					.catch(() => "")) ||
				error.message ||
				response.statusText ||
				"Request failed";
			return c.json(
				{ message },
				error.status as 400 | 401 | 403 | 404 | 409 | 500,
			);
		}
		const message =
			deps.env.nodeEnv === "production"
				? "Internal server error"
				: error instanceof Error
					? error.message
					: "Internal server error";
		console.error(error);
		return c.json({ message }, 500);
	});

	app.route("/api", createApiRoutes(deps));

	app.use("/assets/*", serveStatic({ root: distWebRoot }));
	app.use("/favicon.ico", serveStatic({ root: distWebRoot }));
	app.get("*", async (c) => {
		if (c.req.path.startsWith("/api/")) {
			return c.notFound();
		}
		try {
			const html = await fs.readFile(distWebIndex, "utf8");
			return c.html(html);
		} catch {
			return c.text(
				"Frontend is not built. Run `bun run build:web` or `bun run dev`.",
				404,
			);
		}
	});

	return app;
}

const runtime = await getAppRuntime();
const app = createApp(runtime);

export default app;
export type AppType = ReturnType<typeof createApiRoutes>;
