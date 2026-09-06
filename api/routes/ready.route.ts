import { Hono } from "hono";

export function createReadyRoute(
	checkReady: () => Promise<void>,
	timeoutMs = 1000,
) {
	return new Hono().get("/", async (c) => {
		c.header("Cache-Control", "no-store");
		let timer: ReturnType<typeof setTimeout> | undefined;
		try {
			await Promise.race([
				checkReady(),
				new Promise<never>((_, reject) => {
					timer = setTimeout(
						() => reject(new Error("Readiness timeout")),
						timeoutMs,
					);
				}),
			]);
			return c.json({ status: "ready", service: "hono-standard" });
		} catch {
			return c.json({ status: "not_ready", service: "hono-standard" }, 503);
		} finally {
			clearTimeout(timer);
		}
	});
}
