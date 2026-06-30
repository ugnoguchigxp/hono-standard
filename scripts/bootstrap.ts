import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const envPath = path.resolve(cwd, ".env");
const envExamplePath = path.resolve(cwd, ".env.example");
const nodeModulesPath = path.resolve(cwd, "node_modules");
const defaultDatabaseUrl = "sqlite.db";
const urlWithAuthorityPattern = /^[a-z][a-z0-9+.-]*:\/\//i;

type DotenvEntry =
	| { type: "assignment"; key: string; value: string; raw: string }
	| { type: "raw"; raw: string };

function runCommand(command: string, args: string[], env = process.env): void {
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

function parseDotenv(text: string): DotenvEntry[] {
	return text.split(/\r?\n/).map((raw) => {
		const trimmed = raw.trim();
		if (!trimmed || trimmed.startsWith("#")) return { type: "raw", raw };

		const separator = raw.indexOf("=");
		if (separator === -1) return { type: "raw", raw };

		return {
			type: "assignment",
			key: raw.slice(0, separator).trim(),
			value: raw
				.slice(separator + 1)
				.trim()
				.replace(/^(['"])(.*)\1$/, "$2"),
			raw,
		};
	});
}

function serializeDotenv(entries: DotenvEntry[]): string {
	const lines = entries.map((entry) => {
		if (entry.type === "raw") return entry.raw;
		return `${entry.key}=${entry.value}`;
	});

	while (lines.length > 0 && lines[lines.length - 1] === "") {
		lines.pop();
	}

	return `${lines.join("\n")}\n`;
}

function ensureEnvFile(): string {
	if (!fs.existsSync(envPath)) {
		fs.copyFileSync(envExamplePath, envPath);
		console.log("created .env from .env.example");
	}

	const entries = parseDotenv(fs.readFileSync(envPath, "utf8"));
	const databaseEntry = entries.find(
		(entry): entry is Extract<DotenvEntry, { type: "assignment" }> =>
			entry.type === "assignment" && entry.key === "DATABASE_URL",
	);

	let databaseUrl = databaseEntry?.value ?? defaultDatabaseUrl;
	if (!databaseEntry) {
		entries.push({
			type: "assignment",
			key: "DATABASE_URL",
			value: databaseUrl,
			raw: "",
		});
	} else if (urlWithAuthorityPattern.test(databaseEntry.value)) {
		databaseUrl = defaultDatabaseUrl;
		databaseEntry.value = databaseUrl;
	}

	const nextText = serializeDotenv(entries);
	const currentText = fs.readFileSync(envPath, "utf8");
	if (nextText !== currentText) {
		fs.writeFileSync(envPath, nextText);
		console.log("updated .env for local SQLite");
	}

	return databaseUrl;
}

function ensureDependencies(): void {
	if (fs.existsSync(nodeModulesPath)) return;

	console.log("installing dependencies");
	runCommand("bun", ["install", "--frozen-lockfile"]);
}

function main(): void {
	const databaseUrl = ensureEnvFile();
	ensureDependencies();
	runCommand("bun", ["run", "db:migrate"], {
		...process.env,
		DATABASE_URL: databaseUrl,
	});
	console.log("bootstrap complete");
}

main();
