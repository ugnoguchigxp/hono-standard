import { randomUUID } from "node:crypto";
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
		createdAt: integer("created_at", { mode: "timestamp" })
			.$defaultFn(() => new Date())
			.notNull(),
	},
	(table) => ({
		tokenIdx: uniqueIndex("refresh_tokens_token_idx").on(table.token),
		userIdIdx: index("refresh_tokens_user_id_idx").on(table.userId),
		expiresAtIdx: index("refresh_tokens_expires_at_idx").on(table.expiresAt),
	}),
);

export const gameSaves = sqliteTable(
	"game_saves",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => randomUUID()),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		gameId: text("game_id").notNull(),
		slotId: text("slot_id").notNull(),
		revision: integer("revision").notNull(),
		contentVersion: text("content_version").notNull(),
		stateRevision: integer("state_revision").notNull(),
		savedAt: text("saved_at").notNull(),
		saveJson: text("save_json").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$defaultFn(() => new Date())
			.notNull(),
	},
	(table) => ({
		ownerSlotIdx: uniqueIndex("game_saves_owner_slot_idx").on(
			table.userId,
			table.gameId,
			table.slotId,
		),
		userIdx: index("game_saves_user_id_idx").on(table.userId),
		updatedAtIdx: index("game_saves_updated_at_idx").on(table.updatedAt),
	}),
);

export const gameSaveOperations = sqliteTable(
	"game_save_operations",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => randomUUID()),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		gameId: text("game_id").notNull(),
		slotId: text("slot_id").notNull(),
		idempotencyKey: text("idempotency_key").notNull(),
		requestHash: text("request_hash").notNull(),
		resultRevision: integer("result_revision").notNull(),
		resultSaveJson: text("result_save_json").notNull(),
		resultUpdatedAt: text("result_updated_at").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.$defaultFn(() => new Date())
			.notNull(),
	},
	(table) => ({
		idempotencyIdx: uniqueIndex("game_save_operations_idempotency_idx").on(
			table.userId,
			table.gameId,
			table.slotId,
			table.idempotencyKey,
		),
		userCreatedAtIdx: index("game_save_operations_user_created_at_idx").on(
			table.userId,
			table.createdAt,
		),
	}),
);

export const gameSaveVersions = sqliteTable(
	"game_save_versions",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => randomUUID()),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		gameId: text("game_id").notNull(),
		slotId: text("slot_id").notNull(),
		revision: integer("revision").notNull(),
		contentVersion: text("content_version").notNull(),
		stateRevision: integer("state_revision").notNull(),
		savedAt: text("saved_at").notNull(),
		saveJson: text("save_json").notNull(),
		checksum: text("checksum").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.$defaultFn(() => new Date())
			.notNull(),
	},
	(table) => ({
		ownerSlotRevisionIdx: uniqueIndex(
			"game_save_versions_owner_slot_revision_idx",
		).on(table.userId, table.gameId, table.slotId, table.revision),
		ownerSlotCreatedIdx: index("game_save_versions_owner_slot_created_idx").on(
			table.userId,
			table.gameId,
			table.slotId,
			table.createdAt,
		),
	}),
);
