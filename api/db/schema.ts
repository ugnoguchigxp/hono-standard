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

/** Durable experiment metadata. Snapshots deliberately omit PRNG and queue state: runs never resume after restart. */
export const brainExperiments = sqliteTable(
	"brain_experiments",
	{
		runId: text("run_id").primaryKey(),
		ownerUserId: text("owner_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		status: text("status").notNull(),
		terminalReason: text("terminal_reason"),
		seed: integer("seed").notNull(),
		engineVersion: integer("engine_version").notNull(),
		configVersion: integer("config_version").notNull(),
		resolvedConfig: text("resolved_config").notNull(),
		initialTopology: text("initial_topology").notNull(),
		finalSnapshot: text("final_snapshot"),
		summaryMetrics: text("summary_metrics"),
		revision: integer("revision").notNull().default(0),
		createdAt: integer("created_at", { mode: "timestamp" })
			.$defaultFn(() => new Date())
			.notNull(),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.$defaultFn(() => new Date())
			.notNull(),
	},
	(table) => ({
		ownerIdx: index("brain_experiments_owner_idx").on(table.ownerUserId),
		statusIdx: index("brain_experiments_status_idx").on(table.status),
	}),
);
export const brainCheckpoints = sqliteTable(
	"brain_checkpoints",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		runId: text("run_id")
			.notNull()
			.references(() => brainExperiments.runId, { onDelete: "cascade" }),
		simTimeMs: integer("sim_time_ms").notNull(),
		snapshot: text("snapshot").notNull(),
		metrics: text("metrics").notNull(),
	},
	(table) => ({
		uniqueTime: uniqueIndex("brain_checkpoints_run_time_idx").on(
			table.runId,
			table.simTimeMs,
		),
	}),
);
export const brainCommands = sqliteTable(
	"brain_commands",
	{
		id: integer("id").primaryKey({ autoIncrement: true }),
		ownerUserId: text("owner_user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		commandId: text("command_id").notNull(),
		runId: text("run_id")
			.notNull()
			.references(() => brainExperiments.runId, { onDelete: "cascade" }),
		payloadHash: text("payload_hash").notNull(),
		response: text("response").notNull(),
		createdAt: integer("created_at", { mode: "timestamp" })
			.$defaultFn(() => new Date())
			.notNull(),
	},
	(table) => ({
		commandIdx: uniqueIndex("brain_commands_owner_command_idx").on(
			table.ownerUserId,
			table.commandId,
		),
	}),
);
