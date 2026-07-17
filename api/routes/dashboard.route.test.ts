import { describe, expect, it } from "vitest";
import { Hono } from "hono";
import { createDashboardModule, demoDashboard } from "../modules/dashboard";
import { createDashboardRoute } from "./dashboard.route";

const createAuthedRoute = (dashboard = createDashboardModule()) => {
	const app = new Hono();
	app.use("*", async (c, next) => { c.set("authUser", { userId: "user-1", email: "user@example.com", role: "member" }); await next(); });
	app.route("/", createDashboardRoute({ dashboard }));
	return app;
};

describe("dashboard route", () => {
	it("serves a public manifest without static option values", async () => {
		const app = createAuthedRoute();
		const response = await app.request("/operations");
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.id).toBe("operations");
		expect(body.variables.find((variable: { id: string }) => variable.id === "service").source).toEqual({ kind: "static" });
	});

	it("returns variable options and panel data", async () => {
		const app = createAuthedRoute();
		const optionsResponse = await app.request("/operations/variables/region/options", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ range: { kind: "relative", value: "1h" }, timezone: "UTC", filters: { service: ["api"] } }),
		});
		expect(optionsResponse.status).toBe(200);
		expect((await optionsResponse.json()).options).toHaveLength(3);

		const panelResponse = await app.request("/operations/panels/request-rate/query", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ range: { kind: "relative", value: "15m" }, timezone: "UTC", filters: { service: ["api"] }, maxDataPoints: 10 }),
		});
		expect(panelResponse.status).toBe(200);
		expect((await panelResponse.json()).data.kind).toBe("timeseries");
	});

	it("returns a structured not-found error", async () => {
		const app = createAuthedRoute();
		const response = await app.request("/missing");
		expect(response.status).toBe(404);
		expect((await response.json()).error.code).toBe("DASHBOARD_NOT_FOUND");
	});
	it("negotiates v2 and keeps request identity across response headers", async () => {
		const app = createAuthedRoute();
		const manifest = await app.request("/operations", { headers: { Accept: "application/vnd.hono-standard.dashboard.v2+json" } });
		expect(manifest.status).toBe(200);
		expect(manifest.headers.get("Vary")).toBe("Accept");
		expect(manifest.headers.get("X-Request-ID")).toMatch(/[0-9a-f-]{36}/);
		expect((await manifest.json()).schemaVersion).toBe(2);
		const panel = await app.request("/operations/panels/request-rate/query", { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/vnd.hono-standard.dashboard.v2+json" }, body: JSON.stringify({ schemaVersion: 2, range: { kind: "relative", value: "15m" }, timezone: "UTC", filters: { service: ["api"] }, maxDataPoints: 10, maxRows: 10 }) });
		expect(panel.status).toBe(200);
		expect((await panel.json()).schemaVersion).toBe(2);
	});
	it("sanitizes malformed requests and requires JSON content type", async () => {
		const app = createAuthedRoute();
		const malformed = await app.request("/operations/panels/request-rate/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
		expect(malformed.status).toBe(400);
		expect((await malformed.json()).error.message).toBe("Invalid dashboard request");
		const missingType = await app.request("/operations/panels/request-rate/query", { method: "POST", body: "{}" });
		expect(missingType.status).toBe(400);
		const misleadingType = await app.request("/operations/panels/request-rate/query", { method: "POST", headers: { "Content-Type": "application/jsonp" }, body: "{}" });
		expect(misleadingType.status).toBe(400);
	});

	it("maps malformed and unsupported versions to 400/406", async () => {
		const app = createAuthedRoute();
		const unsupported = await app.request("/operations", { headers: { Accept: "application/vnd.hono-standard.dashboard.v3+json" } });
		expect(unsupported.status).toBe(406);
		const unsupportedBody = await app.request("/operations/panels/request-rate/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ schemaVersion: 3 }) });
		expect(unsupportedBody.status).toBe(400);
		const oversized = await app.request("/operations", { headers: { Accept: "x".repeat(8193) } });
		expect(oversized.status).toBe(400);
		const body = await unsupported.json();
		expect(body.error.code).toBe("SCHEMA_VERSION_UNSUPPORTED");
		expect(body.error.requestId).toBe(unsupported.headers.get("X-Request-ID"));
	});

	it("sanitizes unknown handler errors and marks limiter responses retryable", async () => {
		const failing = { ...demoDashboard, panels: demoDashboard.panels.map((panel) => panel.manifest.id === "request-rate" ? { ...panel, handler: () => { throw new Error("database password leaked"); } } : panel) };
		const failingApp = createAuthedRoute(createDashboardModule({ dashboards: [failing] }));
		const failed = await failingApp.request("/operations/panels/request-rate/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ range: { kind: "relative", value: "15m" }, timezone: "UTC", maxDataPoints: 10 }) });
		expect(failed.status).toBe(500);
		expect((await failed.json()).error.message).toBe("Dashboard request failed");

		const limitedModule = createDashboardModule({ limits: { maxConcurrent: 1, maxQueued: 0 } });
		const release = await limitedModule.limiter.acquire(new AbortController().signal);
		const limitedApp = createAuthedRoute(limitedModule);
		const limited = await limitedApp.request("/operations/panels/request-rate/query", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ range: { kind: "relative", value: "15m" }, timezone: "UTC", maxDataPoints: 10 }) });
		release();
		expect(limited.status).toBe(429);
		expect(limited.headers.get("Retry-After")).toBe("1");
	});

	it("does not serialize an error body after the client signal disconnects", async () => {
		const app = createAuthedRoute();
		const controller = new AbortController();
		controller.abort(new Error("client disconnected"));
		const request = new Request(
			"http://localhost/operations/panels/request-rate/query",
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					range: { kind: "relative", value: "15m" },
					timezone: "UTC",
					maxDataPoints: 10,
				}),
				signal: controller.signal,
			},
		);
		const response = await app.request(request);
		expect(response.status).toBe(408);
		expect(await response.text()).toBe("");
	});
});
