import fs from "node:fs/promises";
import { HTTPException } from "hono/http-exception";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "./http-error";

vi.mock("../db", () => ({
	createDbRuntime: vi.fn().mockReturnValue({
		db: {},
		client: { read: {}, write: { execute: vi.fn(), close: vi.fn() } },
		close: vi.fn(),
	}),
}));

vi.mock("./env", () => ({
	readAppEnv: vi.fn().mockReturnValue({
		nodeEnv: "test",
		host: "127.0.0.1",
		port: 5173,
		databaseUrl: "mock.db",
		appUrl: "http://localhost:5173",
		corsOrigins: ["http://localhost:5173"],
		securityHeadersMode: "auto",
	}),
}));

(globalThis as unknown as { Bun: unknown }).Bun = {
	file: () => ({ exists: () => Promise.resolve(true) }),
};

const { default: app, createApp, getAppRuntime } = await import("./hono");
app.post("/api/test-app-error", () => {
	throw new HttpError(400, "Bad request");
});
app.post("/api/test-app-error-500", () => {
	throw new HttpError(500, "Persisted write failed");
});
app.post("/api/test-http-error", () => {
	throw new HTTPException(409, { message: "Conflict" });
});
app.post("/api/test-http-error-500", () => {
	throw new HTTPException(500, { message: "Upstream failed" });
});
app.post("/api/test-http-error-status-text", () => {
	throw new HTTPException(500, {
		res: new Response(null, {
			status: 500,
			statusText: "Upstream unavailable",
		}),
	});
});
app.post("/api/test-error", () => {
	throw new Error("Broken");
});

describe("authless hono app", () => {
	beforeEach(() => vi.restoreAllMocks());

	it("serves health with security headers", async () => {
		const response = await app.request("/api/health");
		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Security-Policy")).toContain(
			"default-src 'self'",
		);
	});

	it("reuses runtime dependencies", async () => {
		expect(await getAppRuntime()).toBe(await getAppRuntime());
	});

	it("applies HTTPS headers and configured CORS", async () => {
		const runtime = await getAppRuntime();
		const httpsApp = createApp({
			...runtime,
			env: {
				...runtime.env,
				appUrl: "https://app.example.com",
				corsOrigins: ["https://app.example.com"],
				securityHeadersMode: "https",
			},
		});
		const allowed = await httpsApp.request("/api/health", {
			headers: { Origin: "https://app.example.com" },
		});
		expect(allowed.headers.get("Strict-Transport-Security")).toContain(
			"max-age",
		);
		expect(allowed.headers.get("Access-Control-Allow-Origin")).toBe(
			"https://app.example.com",
		);
		const denied = await httpsApp.request("/api/health", {
			headers: { Origin: "https://denied.example.com" },
		});
		expect(denied.headers.get("Access-Control-Allow-Origin")).toBeNull();
	});

	it("uses HTTPS headers when auto mode receives an HTTPS app URL", async () => {
		const runtime = await getAppRuntime();
		const httpsApp = createApp({
			...runtime,
			env: {
				...runtime.env,
				appUrl: "https://app.example.com",
				securityHeadersMode: "auto",
			},
		});

		expect(
			(await httpsApp.request("/api/health")).headers.get(
				"Strict-Transport-Security",
			),
		).toContain("max-age");
	});

	it("serves the frontend and reports a missing build", async () => {
		vi.spyOn(fs, "readFile").mockResolvedValueOnce("<html>authless</html>");
		expect(await (await app.request("/")).text()).toBe("<html>authless</html>");
		vi.spyOn(fs, "readFile").mockRejectedValueOnce(new Error("missing"));
		expect((await app.request("/missing-build")).status).toBe(404);
	});

	it("rejects unknown API paths", async () => {
		expect((await app.request("/api/missing")).status).toBe(404);
	});

	it("handles application, Hono, and generic errors", async () => {
		const request = (path: string) =>
			app.request(`http://localhost:5173${path}`, {
				method: "POST",
				headers: { Origin: "http://localhost:5173" },
			});
		const applicationError = await request("/api/test-app-error");
		expect(applicationError.status).toBe(400);
		expect(await applicationError.json()).toEqual({ message: "Bad request" });
		expect((await request("/api/test-http-error")).status).toBe(409);
		const generic = await request("/api/test-error");
		expect(generic.status).toBe(500);
		expect(await generic.json()).toEqual({ message: "Broken" });
	});

	it("logs server errors while preserving their public messages", async () => {
		const consoleError = vi
			.spyOn(console, "error")
			.mockImplementation(() => {});
		const request = (path: string) =>
			app.request(`http://localhost:5173${path}`, {
				method: "POST",
				headers: { Origin: "http://localhost:5173" },
			});

		try {
			const appError = await request("/api/test-app-error-500");
			expect(appError.status).toBe(500);
			expect(await appError.json()).toEqual({
				message: "Persisted write failed",
			});

			const httpError = await request("/api/test-http-error-500");
			expect(httpError.status).toBe(500);
			expect(await httpError.json()).toEqual({ message: "Upstream failed" });

			const statusTextError = await request("/api/test-http-error-status-text");
			expect(statusTextError.status).toBe(500);
			expect(await statusTextError.json()).toEqual({
				message: "Request failed",
			});
			expect(consoleError).toHaveBeenCalled();
		} finally {
			consoleError.mockRestore();
		}
	});

	it("hides unexpected error details in production", async () => {
		const runtime = await getAppRuntime();
		const productionApp = createApp({
			...runtime,
			env: { ...runtime.env, nodeEnv: "production" },
		});
		productionApp.post("/api/test-production-error", () => {
			throw new Error("Sensitive details");
		});

		const response = await productionApp.request(
			"http://localhost:5173/api/test-production-error",
			{
				method: "POST",
				headers: { Origin: "http://localhost:5173" },
			},
		);
		expect(response.status).toBe(500);
		expect(await response.json()).toEqual({
			message: "Internal server error",
		});
	});
});
