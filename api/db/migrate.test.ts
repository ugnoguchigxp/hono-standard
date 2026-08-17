import { describe, expect, it, vi } from "vitest";
import type { AppEnv } from "../app/env";

const { clients, query, connect, end, Client, readdir, readFile } = vi.hoisted(
	() => {
		const clients: FakeClient[] = [];
		const query = vi.fn();
		const connect = vi.fn();
		const end = vi.fn();
		class FakeClient {
			query = query;
			connect = connect;
			end = end;
			constructor(_options?: unknown) {
				clients.push(this);
			}
		}
		return {
			clients,
			query,
			connect,
			end,
			Client: FakeClient,
			readdir: vi.fn(),
			readFile: vi.fn(),
		};
	},
);

vi.mock("pg", () => ({ Client }));
vi.mock("node:fs/promises", () => ({ readdir, readFile }));

describe("runMigrations", () => {
	it("applies pending PostgreSQL migrations and closes the client", async () => {
		readdir.mockResolvedValue([
			{ name: "0001_init.sql", isFile: () => true },
			{ name: "notes.md", isFile: () => true },
		]);
		readFile.mockResolvedValue("SELECT 1;");
		query.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ rows: [] });
		query.mockResolvedValue(undefined);
		const log = vi.spyOn(console, "log").mockImplementation(() => {});

		try {
			const { runMigrations } = await import("./migrate");
			await expect(
				runMigrations({
					databaseUrl: "postgres://localhost/hono_standard",
				} as AppEnv),
			).resolves.toEqual({ ok: true, total: 1, applied: 1, skipped: 0 });
			expect(connect).toHaveBeenCalledOnce();
			expect(query).toHaveBeenCalledWith("BEGIN");
			expect(query).toHaveBeenCalledWith("COMMIT");
			expect(end).toHaveBeenCalledOnce();
		} finally {
			log.mockRestore();
		}
	});

	it("rolls back failed migrations and still closes the client", async () => {
		readdir.mockResolvedValue([{ name: "0001_bad.sql", isFile: () => true }]);
		readFile.mockResolvedValue("INVALID SQL");
		query
			.mockResolvedValueOnce(undefined)
			.mockResolvedValueOnce({ rows: [] })
			.mockResolvedValueOnce(undefined)
			.mockRejectedValueOnce(new Error("migration sql failed"))
			.mockResolvedValue(undefined);
		const { runMigrations } = await import("./migrate");

		await expect(
			runMigrations({
				databaseUrl: "postgres://localhost/hono_standard",
			} as AppEnv),
		).rejects.toThrow("migration sql failed");
		expect(query).toHaveBeenCalledWith("ROLLBACK");
		expect(end).toHaveBeenCalledTimes(2);
		expect(clients).toHaveLength(2);
	});
});
