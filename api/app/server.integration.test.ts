import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

it("finishes an in-flight HTTP write after SIGTERM before closing SQLite", () => {
	const directory = mkdtempSync(path.join(tmpdir(), "hono-shutdown-"));
	try {
		const result = spawnSync(
			"bun",
			[
				"-e",
				`
import assert from "node:assert/strict";
import { Database } from "bun:sqlite";
import { sql } from "drizzle-orm";
const { shutdownHttpServer, bindHttpServerSignals, toHttpServer } = await import("./api/app/server.ts");
const { getAppRuntime } = await import("./api/app/hono.ts");
const runtime = await getAppRuntime();
await runtime.dbRuntime.client.write.execute(db => db.run(sql.raw("CREATE TABLE shutdown_probe(value TEXT)")));
let entered = false, closed = false, release, finished;
const gate = new Promise(resolve => { release = resolve; });
const exited = new Promise(resolve => { finished = resolve; });
const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async () => {
 entered = true; await gate;
 await runtime.dbRuntime.client.write.execute(db => db.run(sql.raw("INSERT INTO shutdown_probe VALUES('committed')")));
 return new Response("finished");
}});
const deps = { getRuntime: async () => ({ ...runtime, dbRuntime: { ...runtime.dbRuntime, close: async () => { await runtime.dbRuntime.close(); closed = true; } } }), exit: finished };
const http = toHttpServer(server, 0);
const unbind = bindHttpServerSignals(http, signal => shutdownHttpServer(http, signal, deps));
const request = fetch("http://127.0.0.1:" + server.port);
while (!entered) await Bun.sleep(1);
process.kill(process.pid, "SIGTERM");
process.kill(process.pid, "SIGINT");
await Bun.sleep(15);
assert.equal(closed, false);
release();
assert.equal(await (await request).text(), "finished");
assert.equal(await exited, 0);
assert.equal(closed, true);
unbind();
const restored = new Database(process.env.DATABASE_URL, { readonly: true });
assert.equal(restored.query("SELECT value FROM shutdown_probe").get().value, "committed");
restored.close();
let started = false;
const stuck = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => { started = true; return new Promise(() => {}); } });
void fetch("http://127.0.0.1:" + stuck.port).catch(() => {});
while (!started) await Bun.sleep(1);
await shutdownHttpServer(toHttpServer(stuck, 0), "SIGTERM", { exit: code => { console.log("FORCED_EXIT=" + code); process.exit(code); }, timeoutMs: 20 });
`,
			],
			{
				encoding: "utf8",
				env: {
					...process.env,
					DATABASE_URL: path.join(directory, "app.sqlite"),
					NODE_ENV: "test",
					JWT_SECRET: "hono-shutdown-test-secret-32-characters",
					APP_URL: "http://localhost:5173",
					CORS_ORIGINS: "http://localhost:5173",
				},
				timeout: 10_000,
			},
		);
		expect(result.status, result.stderr).toBe(1);
		expect(result.stdout).toContain('"event":"server_stopped"');
		expect(result.stdout).toContain("FORCED_EXIT=1");
	} finally {
		rmSync(directory, { recursive: true, force: true });
	}
}, 15_000);
