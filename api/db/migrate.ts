import { readdir, readFile } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import type { AppEnv } from "../app/env";

type MigrationRecord = {
	filename: string;
	applied_at: string;
};

const MIGRATIONS_TABLE = "hono_standard_schema_migrations";

function ensureLocalLibsqlParentDirectory(databaseUrl: string): void {
	if (!databaseUrl.startsWith("file:")) return;
	const databasePath = databaseUrl.slice("file:".length);
	if (!databasePath || databasePath === ":memory:") return;
	const parentDirectory = path.dirname(databasePath);
	if (parentDirectory === ".") return;
	fs.mkdirSync(parentDirectory, { recursive: true });
}

async function listSqlMigrations(dir: string): Promise<string[]> {
	const entries = await readdir(dir, { withFileTypes: true });
	return entries
		.filter((entry) => entry.isFile() && entry.name.endsWith(".sql"))
		.map((entry) => entry.name)
		.sort((a, b) => a.localeCompare(b));
}

async function ensureMigrationsTable(client: Client): Promise<void> {
	await client.execute(`
		CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
			filename text PRIMARY KEY,
			applied_at text NOT NULL DEFAULT CURRENT_TIMESTAMP
		)
	`);
}

async function appliedMigrations(client: Client): Promise<Set<string>> {
	const result = await client.execute(
		`SELECT filename, applied_at FROM ${MIGRATIONS_TABLE}`,
	);
	return new Set(
		(result.rows as unknown as MigrationRecord[]).map((row) => row.filename),
	);
}

async function applyMigrationFile(
	client: Client,
	migrationsDir: string,
	filename: string,
): Promise<void> {
	const fullPath = path.resolve(migrationsDir, filename);
	const sqlText = await readFile(fullPath, "utf8");
	await client.executeMultiple(sqlText);
	await client.execute({
		sql: `INSERT INTO ${MIGRATIONS_TABLE} (filename) VALUES (?)`,
		args: [filename],
	});
}

export async function runMigrations(env: AppEnv): Promise<{
	ok: true;
	total: number;
	applied: number;
	skipped: number;
}> {
	ensureLocalLibsqlParentDirectory(env.databaseUrl);
	const client = createClient({
		url: env.databaseUrl,
		authToken: env.databaseAuthToken,
	});
	const migrationsDir = path.resolve(process.cwd(), "drizzle");

	try {
		await ensureMigrationsTable(client);
		const allMigrations = await listSqlMigrations(migrationsDir);
		const applied = await appliedMigrations(client);
		const pending = allMigrations.filter((filename) => !applied.has(filename));

		for (const filename of pending) {
			await applyMigrationFile(client, migrationsDir, filename);
			console.log(`applied: ${filename}`);
		}

		return {
			ok: true,
			total: allMigrations.length,
			applied: pending.length,
			skipped: allMigrations.length - pending.length,
		};
	} finally {
		client.close();
	}
}
