import { getTableConfig } from "drizzle-orm/sqlite-core";
import { describe, expect, it } from "vitest";
import {
	pageContents,
	pageDuplicateRequests,
	pages,
	refreshTokens,
	users,
} from "./schema";

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

	it("defines pages and page contents with owner, parent, and cascade constraints", () => {
		const pagesTable = getTableConfig(pages);
		const contentsTable = getTableConfig(pageContents);

		expect(pagesTable.name).toBe("pages");
		expect(contentsTable.name).toBe("page_contents");
		expect(pagesTable.columns.map((column) => column.name)).toEqual(
			expect.arrayContaining([
				"id",
				"owner_id",
				"parent_id",
				"title",
				"created_at",
				"updated_at",
				"deleted_at",
			]),
		);
		expect(contentsTable.columns.map((column) => column.name)).toEqual(
			expect.arrayContaining([
				"page_id",
				"value_json",
				"revision",
				"updated_at",
			]),
		);

		expect(pagesTable.indexes.map((index) => index.config.name).sort()).toEqual(
			["pages_owner_id_parent_id_idx", "pages_parent_id_idx"],
		);

		const ownerForeignKeys = pagesTable.foreignKeys.filter((foreignKey) => {
			const reference = foreignKey.reference();
			return reference.columns.some((column) => column.name === "owner_id");
		});
		expect(ownerForeignKeys).toHaveLength(1);
		expect(ownerForeignKeys[0]?.reference().foreignTable).toBe(users);

		const parentForeignKeys = pagesTable.foreignKeys.filter((foreignKey) => {
			const reference = foreignKey.reference();
			return reference.columns.some((column) => column.name === "parent_id");
		});
		expect(parentForeignKeys).toHaveLength(1);
		expect(parentForeignKeys[0]?.reference().foreignTable).toBe(pages);

		expect(contentsTable.foreignKeys).toHaveLength(1);
		const contentReference = contentsTable.foreignKeys[0]?.reference();
		expect(contentReference?.foreignTable).toBe(pages);
		expect(contentReference?.columns.map((column) => column.name)).toEqual([
			"page_id",
		]);
		expect(contentsTable.foreignKeys[0]?.onDelete).toBe("cascade");
	});

	it("records page duplicate request ownership and protects created pages", () => {
		const table = getTableConfig(pageDuplicateRequests);
		expect(table.name).toBe("page_duplicate_requests");
		expect(table.columns.map((column) => column.name)).toEqual([
			"owner_id",
			"request_id",
			"source_page_id",
			"input_json",
			"created_page_id",
			"created_at",
		]);
		expect(table.indexes.map((index) => index.config.name).sort()).toEqual([
			"page_duplicate_requests_created_page_idx",
			"page_duplicate_requests_owner_request_idx",
		]);
		const references = table.foreignKeys.map((foreignKey) => ({
			columns: foreignKey.reference().columns.map((column) => column.name),
			table: foreignKey.reference().foreignTable,
			onDelete: foreignKey.onDelete,
		}));
		expect(references).toEqual(
			expect.arrayContaining([
				{ columns: ["owner_id"], table: users, onDelete: "cascade" },
				{ columns: ["created_page_id"], table: pages, onDelete: "restrict" },
			]),
		);
	});
});
