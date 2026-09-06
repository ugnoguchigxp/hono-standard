import { describe, expect, it, vi } from "vitest";
import { HTTPException } from "hono/http-exception";
import { HttpError } from "./app/http-error";
import worker, { checkD1Ready, createWorkerApp } from "./worker";

function createD1Binding(options?: {
	missingTable?: boolean;
	missingColumn?: boolean;
}) {
	return {
		prepare: vi.fn((statement: string) => ({
			all: vi.fn().mockResolvedValue(
				statement.includes("sqlite_schema")
					? {
							success: true,
							results: options?.missingTable
								? [{ name: "users" }]
								: [{ name: "users" }, { name: "refresh_tokens" }],
						}
					: {
							success: true,
							results: ["family_id", "consumed_at", "revoked_at"]
								.filter(
									(name) => !(options?.missingColumn && name === "revoked_at"),
								)
								.map((name) => ({ name })),
						},
			),
		})),
	};
}

const bindingValues = {
	DB: createD1Binding(),
	NODE_ENV: "development",
	JWT_SECRET: "hono-standard-worker-test-secret-32-chars",
	APP_URL: "http://localhost:5173",
	CORS_ORIGINS: "http://localhost:5173",
	AUTH_COOKIE_SECURE: "false",
	AUTH_COOKIE_SAME_SITE: "lax",
	SECURITY_HEADERS_MODE: "auto",
};
const bindings = bindingValues as never;

describe("Cloudflare Worker entrypoint", () => {
	it("serves the health route through the Worker fetch handler", async () => {
		const response = await worker.fetch(
			new Request("https://example.test/api/health"),
			bindings,
			{},
		);

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			status: "ok",
			service: "hono-standard",
		});
	});

	it("reports ready only when the D1 schema is current", async () => {
		await expect(
			checkD1Ready(bindingValues.DB as never),
		).resolves.toBeUndefined();
		const ready = await worker.fetch(
			new Request("https://example.test/api/ready"),
			bindings,
			{},
		);
		expect(ready.status).toBe(200);

		const stale = await worker.fetch(
			new Request("https://example.test/api/ready"),
			{
				...bindingValues,
				DB: createD1Binding({ missingColumn: true }),
			} as never,
			{},
		);
		expect(stale.status).toBe(503);

		const incomplete = await worker.fetch(
			new Request("https://example.test/api/ready"),
			{
				...bindingValues,
				DB: createD1Binding({ missingTable: true }),
			} as never,
			{},
		);
		expect(incomplete.status).toBe(503);
	});

	it("returns an unauthorized response for protected routes", async () => {
		const response = await worker.fetch(
			new Request("https://example.test/api/protected/profile"),
			bindings,
			{},
		);

		expect(response.status).toBe(401);
		await expect(response.json()).resolves.toMatchObject({
			message: "Unauthorized",
		});
	});

	it("allows configured CORS origins and rejects unconfigured ones", async () => {
		const allowed = await worker.fetch(
			new Request("https://example.test/api/health", {
				headers: { Origin: "http://localhost:5173" },
			}),
			bindings,
			{},
		);
		expect(allowed.headers.get("access-control-allow-origin")).toBe(
			"http://localhost:5173",
		);

		const rejected = await worker.fetch(
			new Request("https://example.test/api/health", {
				headers: { Origin: "https://untrusted.example" },
			}),
			bindings,
			{},
		);
		expect(rejected.headers.get("access-control-allow-origin")).toBeNull();
	});

	it("normalizes unexpected route failures", async () => {
		const unexpectedFailure = await worker.fetch(
			new Request("https://example.test/api/auth/login", {
				method: "POST",
				headers: {
					"content-type": "application/json",
					Origin: "http://localhost:5173",
				},
				body: JSON.stringify({
					email: "user@example.com",
					password: "password123456",
				}),
			}),
			bindings,
			{},
		);
		expect(unexpectedFailure.status).toBe(500);
		await expect(unexpectedFailure.json()).resolves.toEqual({
			message: "Internal server error",
		});
	});

	it("normalizes Worker-specific HTTP errors", async () => {
		const app = createWorkerApp(bindings, (testApp) => {
			testApp.get("/test/http-error", () => {
				throw new HttpError(500, "Worker persistence failed");
			});
			testApp.get("/test/hono-error", () => {
				throw new HTTPException(403, { message: "Access forbidden" });
			});
			testApp.get("/test/hono-empty-error", () => {
				throw new HTTPException(403);
			});
		});

		const applicationError = await app.request(
			"https://example.test/test/http-error",
		);
		expect(applicationError.status).toBe(500);
		await expect(applicationError.json()).resolves.toEqual({
			message: "Worker persistence failed",
		});

		const honoError = await app.request("https://example.test/test/hono-error");
		expect(honoError.status).toBe(403);
		await expect(honoError.json()).resolves.toEqual({
			message: "Access forbidden",
		});

		const emptyHonoError = await app.request(
			"https://example.test/test/hono-empty-error",
		);
		expect(emptyHonoError.status).toBe(403);
		await expect(emptyHonoError.json()).resolves.toMatchObject({
			message: expect.any(String),
		});
	});
});
