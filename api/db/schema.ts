import {
	boolean,
	index,
	pgTable,
	text,
	timestamp,
	uniqueIndex,
	uuid,
	vector,
} from "drizzle-orm/pg-core";

export const users = pgTable(
	"users",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		email: text("email").notNull().unique(),
		passwordHash: text("password_hash").notNull(),
		displayName: text("display_name").notNull(),
		role: text("role").notNull().default("member"),
		isActive: boolean("is_active").notNull().default(true),
		lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => ({
		emailIdx: uniqueIndex("users_email_idx").on(table.email),
		roleIdx: index("users_role_idx").on(table.role),
		isActiveIdx: index("users_is_active_idx").on(table.isActive),
	}),
);

export const refreshTokens = pgTable(
	"refresh_tokens",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		token: text("token").notNull().unique(),
		userId: uuid("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
		familyId: text("family_id"),
		consumedAt: timestamp("consumed_at", { withTimezone: true }),
		revokedAt: timestamp("revoked_at", { withTimezone: true }),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => ({
		tokenIdx: uniqueIndex("refresh_tokens_token_idx").on(table.token),
		userIdIdx: index("refresh_tokens_user_id_idx").on(table.userId),
		expiresAtIdx: index("refresh_tokens_expires_at_idx").on(table.expiresAt),
		familyIdIdx: index("refresh_tokens_family_id_idx").on(table.familyId),
	}),
);

export const documents = pgTable(
	"documents",
	{
		id: uuid("id").defaultRandom().primaryKey(),
		content: text("content").notNull(),
		embedding: vector("embedding", { dimensions: 3 }).notNull(),
		createdAt: timestamp("created_at", { withTimezone: true })
			.defaultNow()
			.notNull(),
	},
	(table) => ({
		embeddingIdx: index("documents_embedding_idx").using(
			"hnsw",
			table.embedding.op("vector_cosine_ops"),
		),
	}),
);
