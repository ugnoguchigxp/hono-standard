import { describe, expect, it } from "vitest";
import { createReadyRoute } from "./ready.route";

describe("readiness", () => {
	it("reports ready only after the database probe succeeds", async () => {
		let release: () => void = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const request = createReadyRoute(() => gate).request("/");
		release();
		const response = await request;
		expect(response.status).toBe(200);
		expect(response.headers.get("Cache-Control")).toBe("no-store");
		expect(await response.json()).toEqual({
			status: "ready",
			service: "hono-standard",
		});
	});
	it("returns 503 without exposing SQL or file paths", async () => {
		const response = await createReadyRoute(async () => {
			throw new Error("/private/db: missing table users");
		}).request("/");
		expect(response.status).toBe(503);
		expect(await response.text()).not.toContain("private");
	});
	it("bounds the wait for a stalled writer queue", async () => {
		const response = await createReadyRoute(
			() => new Promise(() => {}),
			5,
		).request("/");
		expect(response.status).toBe(503);
		expect(await response.json()).toEqual({
			status: "not_ready",
			service: "hono-standard",
		});
	});
});
