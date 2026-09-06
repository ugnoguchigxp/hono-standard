import { spawnSync } from "node:child_process";
import {
	chmodSync,
	existsSync,
	linkSync,
	mkdirSync,
	mkdtempSync,
	rmSync,
	statSync,
} from "node:fs";
import path from "node:path";

export type PgToolRunner = (
	command: "pg_dump" | "pg_restore",
	args: string[],
) => { status: number | null; stderr?: string };

const runPgTool: PgToolRunner = (command, args) => {
	const result = spawnSync(command, args, { encoding: "utf8" });
	if (result.error) throw result.error;
	return { status: result.status, stderr: result.stderr };
};

function requireSuccess(
	result: ReturnType<PgToolRunner>,
	operation: string,
): void {
	if (result.status === 0) return;
	const detail = result.stderr?.trim();
	throw new Error(
		detail ? `${operation} failed: ${detail}` : `${operation} failed`,
	);
}

export function verifySnapshot(
	filename: string,
	run: PgToolRunner = runPgTool,
) {
	const resolved = path.resolve(filename);
	if (!existsSync(resolved) || statSync(resolved).size === 0) {
		throw new Error("PostgreSQL backup is missing or empty");
	}
	requireSuccess(
		run("pg_restore", ["--list", resolved]),
		"Backup verification",
	);
	return { path: resolved, bytes: statSync(resolved).size };
}

export function backupDatabase(
	databaseUrl: string,
	destination: string,
	run: PgToolRunner = runPgTool,
) {
	const resolved = path.resolve(destination);
	if (existsSync(resolved))
		throw new Error("Backup destination already exists");
	mkdirSync(path.dirname(resolved), { recursive: true, mode: 0o700 });
	const stagingDirectory = mkdtempSync(
		path.join(path.dirname(resolved), ".pg-backup-"),
	);
	const staged = path.join(stagingDirectory, "snapshot.dump");
	try {
		requireSuccess(
			run("pg_dump", [
				"--format=custom",
				"--no-owner",
				"--no-privileges",
				"--file",
				staged,
				databaseUrl,
			]),
			"Database backup",
		);
		verifySnapshot(staged, run);
		chmodSync(staged, 0o600);
		linkSync(staged, resolved);
		return { path: resolved, bytes: statSync(resolved).size };
	} finally {
		rmSync(stagingDirectory, { recursive: true, force: true });
	}
}

export function restoreDatabase(
	source: string,
	databaseUrl: string,
	allowRestore: boolean,
	run: PgToolRunner = runPgTool,
) {
	const snapshot = verifySnapshot(source, run);
	if (!allowRestore) {
		throw new Error("Set ALLOW_DB_RESTORE=1 to confirm the restore target");
	}
	requireSuccess(
		run("pg_restore", [
			"--clean",
			"--if-exists",
			"--no-owner",
			"--no-privileges",
			"--exit-on-error",
			"--dbname",
			databaseUrl,
			snapshot.path,
		]),
		"Database restore",
	);
	return snapshot;
}

if (import.meta.main) {
	const [command, filename, ...extra] = process.argv.slice(2);
	try {
		if (!filename || extra.length > 0)
			throw new Error("Expected one backup path");
		if (command === "backup") {
			console.log(
				JSON.stringify(
					backupDatabase(process.env.DATABASE_URL ?? "", filename),
					null,
					2,
				),
			);
		} else if (command === "verify") {
			console.log(JSON.stringify(verifySnapshot(filename), null, 2));
		} else if (command === "restore") {
			const target = process.env.RESTORE_DATABASE_URL;
			if (!target) throw new Error("Set RESTORE_DATABASE_URL for restore");
			console.log(
				JSON.stringify(
					restoreDatabase(
						filename,
						target,
						process.env.ALLOW_DB_RESTORE === "1",
					),
					null,
					2,
				),
			);
		} else {
			throw new Error("Invalid backup command");
		}
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		console.error(
			"Usage: bun run db:backup <new-file> | db:verify-backup <file> | RESTORE_DATABASE_URL=... ALLOW_DB_RESTORE=1 bun run db:restore <file>",
		);
		process.exitCode = 1;
	}
}
