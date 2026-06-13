import { zValidator } from "@hono/zod-validator";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Hono } from "hono";
import { z } from "zod";
import type * as schema from "../db/schema";
import { documents } from "../db/schema";

const embeddingSchema = z.tuple([z.number(), z.number(), z.number()]);

const insertDocumentSchema = z.object({
	content: z.string().trim().min(1),
	embedding: embeddingSchema,
});

const searchDocumentsSchema = z.object({
	embedding: embeddingSchema,
	limit: z.number().int().positive().default(5),
});

type DocumentsRouteDeps = {
	db: NodePgDatabase<typeof schema>;
};

export function createDocumentsRoute(deps: DocumentsRouteDeps) {
	return new Hono()
		.post("/", zValidator("json", insertDocumentSchema), async (c) => {
			const body = c.req.valid("json");
			const [inserted] = await deps.db
				.insert(documents)
				.values({
					content: body.content,
					embedding: body.embedding,
				})
				.returning({
					id: documents.id,
					content: documents.content,
				});

			return c.json(inserted, 201);
		})
		.post("/search", zValidator("json", searchDocumentsSchema), async (c) => {
			const body = c.req.valid("json");
			const queryVector = `[${body.embedding.join(",")}]`;
			const similarity = sql<number>`1 - (${documents.embedding} <=> ${queryVector})`;

			const results = await deps.db
				.select({
					id: documents.id,
					content: documents.content,
					similarity,
				})
				.from(documents)
				.orderBy(sql`${documents.embedding} <=> ${queryVector}`)
				.limit(body.limit);

			return c.json(results);
		});
}
