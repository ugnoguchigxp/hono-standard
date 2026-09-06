import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureEnvFile } from "./bootstrap";

const tempRoots: string[] = [];

function makeTempRoot(): string {
	const tempRoot = fs.mkdtempSync(
		path.join(os.tmpdir(), "hono-standard-boot-"),
	);
	tempRoots.push(tempRoot);
	return tempRoot;
}

afterEach(() => {
	for (const tempRoot of tempRoots.splice(0)) {
		fs.rmSync(tempRoot, { recursive: true, force: true });
	}
});

describe("bootstrap env setup", () => {
	it("creates .env from .env.example and returns the SQLite database path", () => {
		const tempRoot = makeTempRoot();
		fs.writeFileSync(
			path.join(tempRoot, ".env.example"),
			"NODE_ENV=development\nDATABASE_URL=data/sqlite.db\n",
		);

		const databaseUrl = ensureEnvFile(tempRoot);

		expect(databaseUrl).toBe("data/sqlite.db");
		expect(fs.readFileSync(path.join(tempRoot, ".env"), "utf8")).toContain(
			"DATABASE_URL=data/sqlite.db",
		);
	});

	it("uses a PostgreSQL default from the variant .env.example", () => {
		const tempRoot = makeTempRoot();
		fs.writeFileSync(
			path.join(tempRoot, ".env.example"),
			"NODE_ENV=development\nDATABASE_URL=postgres://postgres:postgres@localhost:5432/hono_standard\n",
		);

		const databaseUrl = ensureEnvFile(tempRoot);

		expect(databaseUrl).toBe(
			"postgres://postgres:postgres@localhost:5432/hono_standard",
		);
		expect(fs.readFileSync(path.join(tempRoot, ".env"), "utf8")).toContain(
			"DATABASE_URL=postgres://postgres:postgres@localhost:5432/hono_standard",
		);
	});

	it("normalizes URL-style or legacy SQLite database values for local bootstrap", () => {
		const tempRoot = makeTempRoot();
		fs.writeFileSync(
			path.join(tempRoot, ".env.example"),
			"NODE_ENV=development\nDATABASE_URL=data/sqlite.db\n",
		);
		fs.writeFileSync(
			path.join(tempRoot, ".env"),
			"NODE_ENV=development\nDATABASE_URL=postgres://localhost/app\n",
		);

		const databaseUrl = ensureEnvFile(tempRoot);

		expect(databaseUrl).toBe("data/sqlite.db");
		expect(fs.readFileSync(path.join(tempRoot, ".env"), "utf8")).toContain(
			"DATABASE_URL=data/sqlite.db",
		);
	});

	it("preserves an existing PostgreSQL URL for PostgreSQL variants", () => {
		const tempRoot = makeTempRoot();
		fs.writeFileSync(
			path.join(tempRoot, ".env.example"),
			"NODE_ENV=development\nDATABASE_URL=postgres://postgres:postgres@localhost:5432/hono_standard\n",
		);
		fs.writeFileSync(
			path.join(tempRoot, ".env"),
			"NODE_ENV=development\nDATABASE_URL=postgres://postgres:postgres@localhost:5433/custom\n",
		);

		const databaseUrl = ensureEnvFile(tempRoot);

		expect(databaseUrl).toBe(
			"postgres://postgres:postgres@localhost:5433/custom",
		);
		expect(fs.readFileSync(path.join(tempRoot, ".env"), "utf8")).toContain(
			"DATABASE_URL=postgres://postgres:postgres@localhost:5433/custom",
		);
	});

	it("replaces another template default with the current variant default", () => {
		const tempRoot = makeTempRoot();
		fs.writeFileSync(
			path.join(tempRoot, ".env.example"),
			"NODE_ENV=development\nDATABASE_URL=postgres://postgres:postgres@localhost:5432/hono_standard\n",
		);
		fs.writeFileSync(
			path.join(tempRoot, ".env"),
			"NODE_ENV=development\nDATABASE_URL=data/sqlite.db\n",
		);

		const databaseUrl = ensureEnvFile(tempRoot);

		expect(databaseUrl).toBe(
			"postgres://postgres:postgres@localhost:5432/hono_standard",
		);
		expect(fs.readFileSync(path.join(tempRoot, ".env"), "utf8")).toContain(
			"DATABASE_URL=postgres://postgres:postgres@localhost:5432/hono_standard",
		);
	});
});

it("preserves quoted secrets, comments, and multiline settings when normalizing only DATABASE_URL", () => {
	const root = makeTempRoot();
	const unchanged = [
		"# User configuration",
		'JWT_SECRET="review-secret-abcdefghijklmnopqrstuvwxyz # suffix"',
		"LITERAL='dollar $VALUE and # hash'",
		'MULTILINE="first',
		'second=value"',
		'APP_URL="http://localhost:5173" # keep this comment',
	].join("\r\n");
	fs.writeFileSync(
		path.join(root, ".env.example"),
		"DATABASE_URL=data/sqlite.db\n",
	);
	fs.writeFileSync(
		path.join(root, ".env"),
		`${unchanged}\r\nDATABASE_URL=sqlite.db\r\n`,
	);
	expect(ensureEnvFile(root)).toBe("data/sqlite.db");
	const normalized = fs.readFileSync(path.join(root, ".env"), "utf8");
	expect(normalized).toBe(`${unchanged}\r\nDATABASE_URL=data/sqlite.db\r\n`);
	ensureEnvFile(root);
	expect(fs.readFileSync(path.join(root, ".env"), "utf8")).toBe(normalized);
});

it("preserves an exported, quoted SQLite path with a hash and trailing comment", () => {
	const root = makeTempRoot();
	const original =
		'export DATABASE_URL="data/a # b.sqlite" # selected by user\nJWT_SECRET="unchanged # secret"\n\n';
	fs.writeFileSync(path.join(root, ".env"), original);
	expect(ensureEnvFile(root)).toBe("data/a # b.sqlite");
	expect(fs.readFileSync(path.join(root, ".env"), "utf8")).toBe(original);
});

it("appends a missing database setting without rewriting existing assignments", () => {
	const root = makeTempRoot();
	fs.writeFileSync(path.join(root, ".env"), 'JWT_SECRET="keep # value"\n');
	expect(ensureEnvFile(root)).toBe("data/sqlite.db");
	expect(fs.readFileSync(path.join(root, ".env"), "utf8")).toContain(
		'JWT_SECRET="keep # value"',
	);
});
