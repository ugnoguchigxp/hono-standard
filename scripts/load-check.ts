import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createLoadWorkloads } from "./load-workloads";

export type LoadWorkload = {
	name: string;
	request: (baseUrl: string, worker: number) => Promise<Response>;
};

const options = new Map<string, string>();
const args = process.argv.slice(2);
for (let index = 0; index < args.length; index += 2) {
	const key = args[index];
	const value = args[index + 1];
	if (
		!key ||
		!value ||
		![
			"--requests",
			"--concurrency",
			"--runs",
			"--max-p95-ms",
			"--output",
		].includes(key)
	) {
		throw new Error(
			"Usage: bun run verify:load [--requests 200] [--concurrency 8] [--runs 3] [--max-p95-ms 500] [--output file.json]",
		);
	}
	options.set(key, value);
}
function integer(key: string, fallback: number, maximum: number) {
	const value = Number(options.get(key) ?? fallback);
	if (!Number.isInteger(value) || value < 1 || value > maximum)
		throw new Error(`Invalid ${key}: 1..${maximum} required`);
	return value;
}
const requests = integer("--requests", 200, 10_000);
const concurrency = integer("--concurrency", 8, 64);
const runs = integer("--runs", 3, 10);
const maxP95Ms = integer("--max-p95-ms", 500, 60_000);
const directory = mkdtempSync(path.join(tmpdir(), "hono-load-"));
Object.assign(process.env, {
	NODE_ENV: "production",
	HOST: "127.0.0.1",
	PORT: "5173",
	DATABASE_URL: path.join(directory, "load.sqlite"),
	JWT_SECRET: "hono-standard-isolated-load-check-secret-2026",
	APP_URL: "http://127.0.0.1",
	CORS_ORIGINS: "http://127.0.0.1",
	AUTH_COOKIE_SECURE: "false",
	AUTH_COOKIE_SAME_SITE: "lax",
	SECURITY_HEADERS_MODE: "http",
});

const { readAppEnv } = await import("../api/app/env");
const { runMigrations } = await import("../api/db/migrate");
await runMigrations(readAppEnv());
const { default: app, getAppRuntime } = await import("../api/app/hono");
const runtime = await getAppRuntime();
const server = Bun.serve({ fetch: app.fetch, hostname: "127.0.0.1", port: 0 });
const baseUrl = `http://127.0.0.1:${server.port}`;
runtime.env.appUrl = baseUrl;
runtime.env.corsOrigins = [baseUrl];

const results: Array<{
	workload: string;
	run: number;
	requests: number;
	errors: number;
	p50Ms: number;
	p95Ms: number;
	p99Ms: number;
	requestsPerSecond: number;
	rssBytes: number;
}> = [];
try {
	const workloads = await createLoadWorkloads(runtime, concurrency);
	for (const workload of workloads) {
		// Warm the same paths and connections outside the measurement window.
		for (let worker = 0; worker < concurrency; worker++) {
			const response = await workload.request(baseUrl, worker);
			await response.arrayBuffer();
			if (!response.ok)
				throw new Error(`Warmup failed: ${workload.name} (${response.status})`);
		}
		for (let run = 1; run <= runs; run++) {
			let next = 0;
			let errors = 0;
			const latencies: number[] = [];
			const start = performance.now();
			await Promise.all(
				Array.from({ length: concurrency }, async (_, worker) => {
					while (next++ < requests) {
						const began = performance.now();
						try {
							const response = await workload.request(baseUrl, worker);
							await response.arrayBuffer();
							if (!response.ok) errors++;
						} catch {
							errors++;
						}
						latencies.push(performance.now() - began);
					}
				}),
			);
			const elapsed = performance.now() - start;
			latencies.sort((a, b) => a - b);
			const percentile = (p: number) =>
				Number(
					(latencies[Math.ceil(latencies.length * p) - 1] ?? 0).toFixed(2),
				);
			results.push({
				workload: workload.name,
				run,
				requests,
				errors,
				p50Ms: percentile(0.5),
				p95Ms: percentile(0.95),
				p99Ms: percentile(0.99),
				requestsPerSecond: Number(((requests / elapsed) * 1000).toFixed(2)),
				rssBytes: process.memoryUsage().rss,
			});
		}
	}
	const passed = results.every(
		(result) => result.errors === 0 && result.p95Ms <= maxP95Ms,
	);
	const report = {
		passed,
		measuredAt: new Date().toISOString(),
		bun: Bun.version,
		platform: `${process.platform}/${process.arch}`,
		concurrency,
		maxP95Ms,
		results,
	};
	const serialized = `${JSON.stringify(report, null, 2)}\n`;
	const output = options.get("--output");
	if (output) writeFileSync(output, serialized);
	console.log(serialized);
	if (!passed) process.exitCode = 1;
} finally {
	await server.stop(false);
	await runtime.dbRuntime.close();
	rmSync(directory, { recursive: true, force: true });
}
