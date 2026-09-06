import { spawnSync } from "node:child_process";
import {
	cpSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";

it("generates only schema changes and applies them without losing existing data", () => {
	const root = mkdtempSync(path.join(tmpdir(), "hono-migration-contract-"));
	try {
		for (const file of [
			"api",
			"drizzle",
			"drizzle.config.ts",
			"package.json",
			"tsconfig.json",
		]) {
			cpSync(file, path.join(root, file), { recursive: true });
		}
		symlinkSync(
			path.resolve("node_modules"),
			path.join(root, "node_modules"),
			"dir",
		);
		const env = {
			...process.env,
			NODE_ENV: "test",
			DATABASE_URL: path.join(root, "contract.sqlite"),
			JWT_SECRET: "migration-contract-secret-for-tests",
		};
		const run = (args: string[], extraEnv = {}) => {
			const result = spawnSync("bun", args, {
				cwd: root,
				env: { ...env, ...extraEnv },
				encoding: "utf8",
			});
			expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
			return result.stdout;
		};
		const sql = (statement: string) =>
			JSON.parse(
				run(
					[
						"-e",
						`
			import { Database } from "bun:sqlite";
			const db = new Database(process.env.DATABASE_URL);
			console.log(JSON.stringify(db.query(process.env.MIGRATION_CONTRACT_SQL).all()));
			db.close();
		`,
					],
					{ MIGRATION_CONTRACT_SQL: statement },
				),
			);
		const migrationFiles = () =>
			readdirSync(path.join(root, "drizzle"))
				.filter((file) => file.endsWith(".sql"))
				.sort();
		run(["run", "db:migrate"]);
		const originalFiles = migrationFiles();
		run(["run", "db:generate"]);
		expect(migrationFiles()).toEqual(originalFiles);

		const schema = path.join(root, "api/db/schema.ts");
		writeFileSync(
			schema,
			`${readFileSync(schema, "utf8")}\nimport { sqliteTable as contractTable, text as contractText } from "drizzle-orm/sqlite-core";
export const migrationContract = contractTable("migration_contract", { value: contractText("value").notNull() });\n`,
		);
		run(["run", "db:generate"]);
		expect(migrationFiles()).toHaveLength(originalFiles.length + 1);
		run(["run", "db:migrate"]);
		sql(
			"INSERT INTO migration_contract (value) VALUES ('preserved') RETURNING value",
		);
		writeFileSync(
			schema,
			readFileSync(schema, "utf8").replace(
				'value: contractText("value").notNull()',
				'value: contractText("value").notNull(), note: contractText("note")',
			),
		);
		run(["run", "db:generate"]);
		expect(migrationFiles()).toHaveLength(originalFiles.length + 2);
		run(["run", "db:migrate:drizzle"]);
		expect(sql("SELECT value, note FROM migration_contract")).toEqual([
			{ value: "preserved", note: null },
		]);
		run(["run", "db:migrate"]);
		expect(
			sql("SELECT count(*) AS count FROM hono_standard_schema_migrations"),
		).toEqual([{ count: originalFiles.length + 2 }]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
}, 30_000);
