import { randomUUID } from "node:crypto";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import {
	index,
	integer,
	sqliteTable,
	text,
	uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
	"users",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => randomUUID()),
		email: text("email").notNull().unique(),
		passwordHash: text("password_hash").notNull(),
		displayName: text("display_name").notNull(),
		role: text("role").notNull().default("member"),
		isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
		lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$defaultFn(() => new Date())
			.notNull(),
	},
	(table) => ({
		emailIdx: uniqueIndex("users_email_idx").on(table.email),
		roleIdx: index("users_role_idx").on(table.role),
		isActiveIdx: index("users_is_active_idx").on(table.isActive),
	}),
);

export const refreshTokens = sqliteTable(
	"refresh_tokens",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => randomUUID()),
		token: text("token").notNull().unique(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
		familyId: text("family_id"),
		consumedAt: integer("consumed_at", { mode: "timestamp" }),
		revokedAt: integer("revoked_at", { mode: "timestamp" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.$defaultFn(() => new Date())
			.notNull(),
	},
	(table) => ({
		tokenIdx: uniqueIndex("refresh_tokens_token_idx").on(table.token),
		userIdIdx: index("refresh_tokens_user_id_idx").on(table.userId),
		expiresAtIdx: index("refresh_tokens_expires_at_idx").on(table.expiresAt),
		familyIdIdx: index("refresh_tokens_family_id_idx").on(table.familyId),
	}),
);

export const pages = sqliteTable(
	"pages",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => randomUUID()),
		ownerId: text("owner_id")
			.notNull()
			.references(() => users.id),
		parentId: text("parent_id").references((): AnySQLiteColumn => pages.id),
		title: text("title").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$defaultFn(() => new Date())
			.notNull(),
		deletedAt: integer("deleted_at", { mode: "timestamp" }),
	},
	(table) => ({
		ownerParentIdx: index("pages_owner_id_parent_id_idx").on(
			table.ownerId,
			table.parentId,
		),
		parentIdx: index("pages_parent_id_idx").on(table.parentId),
	}),
);

export const pageContents = sqliteTable("page_contents", {
	pageId: text("page_id")
		.primaryKey()
		.references(() => pages.id, { onDelete: "cascade" }),
	valueJson: text("value_json").notNull(),
	revision: integer("revision").notNull().default(0),
	updatedAt: integer("updated_at", { mode: "timestamp" })
		.$defaultFn(() => new Date())
		.notNull(),
});

export const pageDuplicateRequests = sqliteTable(
	"page_duplicate_requests",
	{
		ownerId: text("owner_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		requestId: text("request_id").notNull(),
		sourcePageId: text("source_page_id").notNull(),
		inputJson: text("input_json").notNull(),
		createdPageId: text("created_page_id")
			.notNull()
			.references(() => pages.id, { onDelete: "restrict" }),
		createdAt: integer("created_at", { mode: "timestamp" })
			.$defaultFn(() => new Date())
			.notNull(),
	},
	(table) => ({
		ownerRequestIdx: uniqueIndex(
			"page_duplicate_requests_owner_request_idx",
		).on(table.ownerId, table.requestId),
		createdPageIdx: index("page_duplicate_requests_created_page_idx").on(
			table.createdPageId,
		),
	}),
);
