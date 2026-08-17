import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ensureEnvFile } from "./bootstrap";

const tempRoots: string[] = [];

function makeTempRoot(): string {
	const tempRoot = fs.mkdtempSync(
		path.join(os.tmpdir(), "hono-authless-boot-"),
	);
	tempRoots.push(tempRoot);
	return tempRoot;
}

afterEach(() => {
	for (const tempRoot of tempRoots.splice(0)) {
		fs.rmSync(tempRoot, { recursive: true, force: true });
	}
});

describe("authless bootstrap env setup", () => {
	it("creates .env from the example and returns its database path", () => {
		const tempRoot = makeTempRoot();
		fs.writeFileSync(
			path.join(tempRoot, ".env.example"),
			"NODE_ENV=development\nDATABASE_URL=data/sqlite.db\n",
		);

		expect(ensureEnvFile(tempRoot)).toBe("data/sqlite.db");
		expect(fs.existsSync(path.join(tempRoot, ".env"))).toBe(true);
	});

	it("preserves an existing local database path", () => {
		const tempRoot = makeTempRoot();
		fs.writeFileSync(
			path.join(tempRoot, ".env.example"),
			"DATABASE_URL=data/sqlite.db\n",
		);
		fs.writeFileSync(
			path.join(tempRoot, ".env"),
			'DATABASE_URL="data/custom.sqlite"\n',
		);

		expect(ensureEnvFile(tempRoot)).toBe("data/custom.sqlite");
	});

	it("uses the SQLite default when DATABASE_URL is absent", () => {
		const tempRoot = makeTempRoot();
		fs.writeFileSync(
			path.join(tempRoot, ".env.example"),
			"NODE_ENV=development\n",
		);

		expect(ensureEnvFile(tempRoot)).toBe("data/sqlite.db");
	});
});
