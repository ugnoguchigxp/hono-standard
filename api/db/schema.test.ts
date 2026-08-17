import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import { refreshTokens, users } from "./schema";

describe("database schema", () => {
	it("defines users and refresh token tables with expected keys", () => {
		const usersTable = getTableConfig(users);
		const refreshTable = getTableConfig(refreshTokens);

		expect(usersTable.name).toBe("users");
		expect(refreshTable.name).toBe("refresh_tokens");
		expect(usersTable.columns.map((column) => column.name)).toEqual(
			expect.arrayContaining([
				"id",
				"email",
				"password_hash",
				"display_name",
				"role",
				"is_active",
			]),
		);
		expect(refreshTable.columns.map((column) => column.name)).toEqual(
			expect.arrayContaining(["id", "token", "user_id", "family_id"]),
		);

		expect(refreshTable.foreignKeys).not.toHaveLength(0);
		for (const foreignKey of refreshTable.foreignKeys) {
			const reference = foreignKey.reference();
			expect(reference.foreignTable).toBe(users);
			expect(reference.columns.map((column) => column.name)).toEqual([
				"user_id",
			]);
		}
	});
});
