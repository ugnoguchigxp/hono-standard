import {
	index,
	pgTable,
	text,
	timestamp,
	uuid,
	vector,
} from "drizzle-orm/pg-core";

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
