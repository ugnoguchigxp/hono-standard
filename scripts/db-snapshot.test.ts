import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { backupDatabase, restoreDatabase, verifySnapshot } from "./db-snapshot";

const roots: string[] = [];

afterEach(() => {
	for (const root of roots.splice(0))
		rmSync(root, { recursive: true, force: true });
});

describe("PostgreSQL backup tooling", () => {
	it("creates a private custom-format backup and verifies it", () => {
		const root = mkdtempSync(path.join(tmpdir(), "pg-backup-"));
		roots.push(root);
		const destination = path.join(root, "backups", "snapshot.dump");
		const run = vi.fn((command: string, args: string[]) => {
			if (command === "pg_dump") {
				const output = args.at(args.indexOf("--file") + 1);
				if (!output) throw new Error("missing output");
				mkdirSync(path.dirname(output), { recursive: true });
				writeFileSync(output, "postgres custom backup");
			}
			return { status: 0, stderr: "" };
		});

		const result = backupDatabase("postgres://db/app", destination, run);
		expect(result.path).toBe(destination);
		expect(result.bytes).toBeGreaterThan(0);
		expect(run).toHaveBeenCalledWith("pg_restore", [
			"--list",
			expect.stringContaining("snapshot.dump"),
		]);
		expect(() => backupDatabase("postgres://db/app", destination, run)).toThrow(
			"already exists",
		);
	});

	it("requires an explicit target confirmation before restore", () => {
		const root = mkdtempSync(path.join(tmpdir(), "pg-restore-"));
		roots.push(root);
		const source = path.join(root, "snapshot.dump");
		writeFileSync(source, "postgres custom backup");
		const run = vi.fn(() => ({ status: 0, stderr: "" }));

		expect(() =>
			restoreDatabase(source, "postgres://db/restored", false, run),
		).toThrow("ALLOW_DB_RESTORE=1");
		restoreDatabase(source, "postgres://db/restored", true, run);
		expect(run).toHaveBeenLastCalledWith(
			"pg_restore",
			expect.arrayContaining([
				"--clean",
				"--exit-on-error",
				"postgres://db/restored",
			]),
		);
	});

	it("rejects empty or invalid backups", () => {
		const root = mkdtempSync(path.join(tmpdir(), "pg-verify-"));
		roots.push(root);
		const source = path.join(root, "snapshot.dump");
		writeFileSync(source, "");
		expect(() => verifySnapshot(source, vi.fn())).toThrow("missing or empty");
		writeFileSync(source, "not empty");
		expect(() =>
			verifySnapshot(source, () => ({ status: 1, stderr: "invalid archive" })),
		).toThrow("invalid archive");
	});
});
