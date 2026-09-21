import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
it("persists experiment lifecycle rows in migrated SQLite", () => {
	const root = mkdtempSync(path.join(tmpdir(), "brain-persistence-"));
	try {
		const result = spawnSync(
			"bun",
			[
				"-e",
				`import { readAppEnv } from './api/app/env.ts'; import { runSqliteMigrations } from './api/db/migrate-sqlite.ts'; import { createDbRuntime } from './api/db/index.ts'; import { users } from './api/db/schema.ts'; import { BrainPersistence } from './api/modules/brain-sandbox/persistence.ts'; const env=readAppEnv(); await runSqliteMigrations(env); const runtime=createDbRuntime(env); try { await runtime.client.write.execute(db=>db.insert(users).values({id:'user',email:'user@example.com',passwordHash:'hash',displayName:'User'})); const p=new BrainPersistence(runtime.client); await p.create({runId:'run',ownerUserId:'user',status:'running',seed:1,engineVersion:1,configVersion:1,resolvedConfig:{},initialTopology:{},revision:0}); await p.saveCheckpoint('run',100,{a:1},{spikes:1}); await p.saveCheckpoint('run',100,{a:2},{spikes:2}); await p.update('run','completed',1,{counters:{spikes:2}},'time_limit'); console.log(JSON.stringify(await p.find('run','user'))); } finally { await runtime.close(); }`,
			],
			{
				cwd: process.cwd(),
				encoding: "utf8",
				env: {
					...process.env,
					NODE_ENV: "test",
					DATABASE_URL: path.join(root, "brain.sqlite"),
					JWT_SECRET: "x".repeat(32),
				},
			},
		);
		expect(result.status, result.stderr).toBe(0);
		expect(
			JSON.parse(result.stdout.trim().split("\n").at(-1) ?? ""),
		).toMatchObject({
			runId: "run",
			status: "completed",
			revision: 1,
			terminalReason: "time_limit",
		});
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
