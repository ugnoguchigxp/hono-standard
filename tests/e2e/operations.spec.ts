import { expect, test } from "@playwright/test";

test("liveness and database readiness are separate endpoints", async ({
	request,
}) => {
	const health = await request.get("/api/health");
	expect(health.status()).toBe(200);
	expect((await health.json()).status).toBe("ok");
	const ready = await request.get("/api/ready");
	expect(ready.status()).toBe(200);
	expect(ready.headers()["cache-control"]).toBe("no-store");
	expect((await ready.json()).status).toBe("ready");
});
