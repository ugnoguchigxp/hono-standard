import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const defaultDatabaseUrl = "data/sqlite.db";

function runCommand(
	cwd: string,
	command: string,
	args: string[],
	env = process.env,
): void {
	const result = spawnSync(command, args, {
		cwd,
		env,
		stdio: "inherit",
	});
	if (result.error) throw result.error;
	if (result.status !== 0) {
		throw new Error(`${command} ${args.join(" ")} failed.`);
	}
}

function readDatabaseUrl(envText: string): string {
	for (const line of envText.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) continue;
		const separator = trimmed.indexOf("=");
		if (separator === -1) continue;
		if (trimmed.slice(0, separator).trim() !== "DATABASE_URL") continue;
		const value = trimmed
			.slice(separator + 1)
			.trim()
			.replace(/^(['"])(.*)\1$/, "$2");
		if (value) return value;
	}
	return defaultDatabaseUrl;
}

export function ensureEnvFile(cwd = process.cwd()): string {
	const envPath = path.resolve(cwd, ".env");
	const envExamplePath = path.resolve(cwd, ".env.example");
	if (!fs.existsSync(envPath)) {
		fs.copyFileSync(envExamplePath, envPath);
		console.log("created .env from .env.example");
	}
	return readDatabaseUrl(fs.readFileSync(envPath, "utf8"));
}

export function main(cwd = process.cwd()): void {
	const databaseUrl = ensureEnvFile(cwd);
	if (!fs.existsSync(path.resolve(cwd, "node_modules"))) {
		console.log("installing dependencies");
		runCommand(cwd, "bun", ["install", "--frozen-lockfile"]);
	}
	runCommand(cwd, "bun", ["run", "db:migrate"], {
		...process.env,
		DATABASE_URL: databaseUrl,
	});
	console.log("bootstrap complete");
}

if (import.meta.main) main();
