import fs from "node:fs/promises";
import path from "node:path";
import { serveStatic } from "hono/bun";
import { csrf } from "hono/csrf";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import type { DbRuntime } from "../db";
import { createDbRuntime } from "../db";
import { createRequestLogger } from "../middleware/request-logger";
import { createHealthRoute } from "../routes/health.route";
import { readAppEnv, type AppEnv } from "./env";
import { HttpError } from "./http-error";
import { appContentSecurityPolicy } from "./security-headers";
import {
	createStructuredLogRecord,
	errorLogFields,
	writeStructuredLog,
} from "./structured-log";

export type AppDeps = { env: AppEnv; dbRuntime: DbRuntime };

declare global {
	var __honoStandardRuntime__: Promise<AppDeps> | undefined;
}

export async function createDefaultAppDeps(): Promise<AppDeps> {
	const env = readAppEnv();
	return { env, dbRuntime: await createDbRuntime(env) };
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

const distWebRoot = path.resolve(process.cwd(), "dist-web");
const distWebIndex = path.resolve(distWebRoot, "index.html");

export function createApiRoutes() {
	return new Hono().route("/health", createHealthRoute());
}

export function createApp(deps: AppDeps) {
	const app = new Hono();
	const useHttpsSecurityHeaders =
		deps.env.securityHeadersMode === "https" ||
		(deps.env.securityHeadersMode === "auto" &&
			deps.env.appUrl.startsWith("https://"));
	const secureHeaderOptions = useHttpsSecurityHeaders
		? { contentSecurityPolicy: appContentSecurityPolicy }
		: {
				contentSecurityPolicy: appContentSecurityPolicy,
				crossOriginOpenerPolicy: false,
				originAgentCluster: false,
				strictTransportSecurity: false,
			};

	app.use("*", createRequestLogger());
	app.use("*", secureHeaders(secureHeaderOptions));
	app.use(
		"/api/*",
		cors({
			origin: (origin) =>
				origin && deps.env.corsOrigins.includes(origin) ? origin : null,
			allowMethods: ["GET", "POST", "OPTIONS"],
			allowHeaders: ["Content-Type"],
		}),
	);
	app.use("/api/*", csrf());

	app.onError(async (error, c) => {
		if (error instanceof HttpError) {
			if (error.status >= 500) {
				writeStructuredLog(
					createStructuredLogRecord("error", "request_error", {
						requestId: c.get("requestId"),
						status: error.status,
						...errorLogFields(error),
					}),
				);
			}
			return c.json(
				{ message: error.message },
				error.status as 400 | 401 | 403 | 404 | 409 | 429 | 500,
			);
		}
		if (error instanceof HTTPException) {
			const response = error.getResponse();
			if (response.status >= 500) {
				writeStructuredLog(
					createStructuredLogRecord("error", "request_error", {
						requestId: c.get("requestId"),
						status: response.status,
						...errorLogFields(error),
					}),
				);
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
				error.status as 400 | 401 | 403 | 404 | 409 | 429 | 500,
			);
		}
		writeStructuredLog(
			createStructuredLogRecord("error", "request_error", {
				requestId: c.get("requestId"),
				status: 500,
				...errorLogFields(error),
			}),
		);
		return c.json(
			{
				message:
					deps.env.nodeEnv === "production"
						? "Internal server error"
						: error instanceof Error
							? error.message
							: "Internal server error",
			},
			500,
		);
	});

	app.route("/api", createApiRoutes());
	app.use("/assets/*", serveStatic({ root: "./dist-web" }));
	app.use("/favicon.ico", serveStatic({ root: "./dist-web" }));
	app.get("*", async (c) => {
		if (c.req.path.startsWith("/api/")) return c.notFound();
		try {
			return c.html(await fs.readFile(distWebIndex, "utf8"));
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
