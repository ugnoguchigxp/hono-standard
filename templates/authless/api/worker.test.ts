import { describe, expect, it, vi } from "vitest";
import worker, { createWorkerApp } from "./worker";

function createBindings(success = true) {
	return {
		DB: {
			prepare: vi.fn(() => ({
				all: vi.fn().mockResolvedValue({ success, results: [{ value: 1 }] }),
			})),
		},
		NODE_ENV: "development",
		APP_URL: "http://localhost:5173",
		CORS_ORIGINS: "http://localhost:5173",
		SECURITY_HEADERS_MODE: "auto",
	} as never;
}

describe("authless Cloudflare Worker entrypoint", () => {
	it("serves health through the Worker fetch handler", async () => {
		const response = await worker.fetch(
			new Request("https://example.test/api/health"),
			createBindings(),
			{},
		);
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toEqual({
			status: "ok",
			service: "hono-standard",
		});
	});

	it("checks D1 readiness and hides probe failures", async () => {
		const ready = await createWorkerApp(createBindings()).request(
			"https://example.test/api/ready",
		);
		expect(ready.status).toBe(200);

		const unavailable = await createWorkerApp(createBindings(false)).request(
			"https://example.test/api/ready",
		);
		expect(unavailable.status).toBe(503);
	});

	it("applies configured CORS origins", async () => {
		const app = createWorkerApp(createBindings());
		const allowed = await app.request("https://example.test/api/health", {
			headers: { Origin: "http://localhost:5173" },
		});
		expect(allowed.headers.get("access-control-allow-origin")).toBe(
			"http://localhost:5173",
		);
		const denied = await app.request("https://example.test/api/health", {
			headers: { Origin: "https://denied.example" },
		});
		expect(denied.headers.get("access-control-allow-origin")).toBeNull();
	});
});
