import { Database } from "bun:sqlite";
import { createHash } from "node:crypto";
import {
	chmodSync,
	closeSync,
	constants,
	copyFileSync,
	existsSync,
	fsyncSync,
	mkdirSync,
	mkdtempSync,
	linkSync,
	openSync,
	readSync,
	rmSync,
	statSync,
} from "node:fs";
import { createReadStream } from "node:fs";
import path from "node:path";
import { assertDatabaseFilePath } from "../api/db/path";

function databasePath(value: string): string {
	assertDatabaseFilePath(value);
	if (!value.trim() || value === ":memory:" || value.startsWith("file:")) {
		throw new Error("A local SQLite file path is required");
	}
	return path.resolve(value);
}

function assertNoSidecars(filename: string) {
	for (const suffix of ["-wal", "-shm", "-journal"]) {
		if (existsSync(`${filename}${suffix}`)) {
			throw new Error(
				`Snapshot path has a SQLite sidecar: ${filename}${suffix}`,
			);
		}
	}
}

async function sha256(filename: string) {
	const hash = createHash("sha256");
	for await (const chunk of createReadStream(filename)) hash.update(chunk);
	return hash.digest("hex");
}

export async function verifySnapshot(filename: string) {
	const resolved = databasePath(filename);
	assertNoSidecars(resolved);
	// Opening an empty file as SQLite would otherwise produce a false positive.
	const header = Buffer.alloc(16);
	const input = openSync(resolved, "r");
	try {
		readSync(input, header, 0, 16, 0);
	} finally {
		closeSync(input);
	}
	if (header.toString() !== "SQLite format 3\0")
		throw new Error("Invalid SQLite snapshot header");
	const db = new Database(resolved, { readonly: true });
	try {
		const integrity = db.query("PRAGMA integrity_check").values();
		if (integrity.length !== 1 || integrity[0]?.[0] !== "ok")
			throw new Error("Snapshot integrity check failed");
		if (db.query("PRAGMA foreign_key_check").all().length > 0)
			throw new Error("Snapshot has foreign key violations");
	} finally {
		db.close();
	}
	return {
		path: resolved,
		bytes: statSync(resolved).size,
		sha256: await sha256(resolved),
	};
}

async function createSnapshot(
	destination: string,
	write: (filename: string) => void,
) {
	const filename = databasePath(destination);
	assertNoSidecars(filename);
	mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
	// Build privately on the same filesystem, then publish with an exclusive link.
	// VACUUM INTO requires a new file on all supported SQLite builds.
	const stagingDirectory = mkdtempSync(
		path.join(path.dirname(filename), ".snapshot-"),
	);
	const staged = path.join(stagingDirectory, "snapshot.sqlite");
	try {
		write(staged);
		chmodSync(staged, 0o600);
		const result = await verifySnapshot(staged);
		const output = openSync(staged, "r");
		try {
			fsyncSync(output);
		} finally {
			closeSync(output);
		}
		assertNoSidecars(filename);
		linkSync(staged, filename);
		return { ...result, path: filename };
	} finally {
		rmSync(stagingDirectory, { recursive: true, force: true });
	}
}

export async function backupDatabase(source: string, destination: string) {
	const db = new Database(databasePath(source), { readonly: true });
	try {
		return await createSnapshot(destination, (filename) => {
			db.run("PRAGMA busy_timeout = 5000");
			db.query("VACUUM INTO ?").run(filename);
		});
	} finally {
		db.close();
	}
}

export async function restoreDatabase(source: string, destination: string) {
	const snapshot = await verifySnapshot(source);
	const restored = await createSnapshot(destination, (filename) => {
		copyFileSync(snapshot.path, filename, constants.COPYFILE_EXCL);
	});
	if (restored.sha256 !== snapshot.sha256) {
		rmSync(restored.path, { force: true });
		throw new Error("Snapshot changed while restoring");
	}
	return restored;
}

if (import.meta.main) {
	const [command, first, second, ...extra] = process.argv.slice(2);
	try {
		if (!first || extra.length > 0)
			throw new Error("Expected snapshot file path");
		let result: Awaited<ReturnType<typeof verifySnapshot>>;
		if (command === "backup" && !second) {
			result = await backupDatabase(
				process.env.DATABASE_URL ?? "./data/sqlite.db",
				first,
			);
		} else if (command === "verify" && !second) {
			result = await verifySnapshot(first);
		} else if (command === "restore" && second) {
			result = await restoreDatabase(first, second);
		} else throw new Error("Invalid snapshot command or arguments");
		console.log(JSON.stringify(result, null, 2));
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		console.error(
			"Usage: bun run db:backup <new-file> | db:verify-backup <file> | db:restore <snapshot> <new-db>",
		);
		process.exitCode = 1;
	}
}
