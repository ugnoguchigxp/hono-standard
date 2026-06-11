import { createRoute, z } from '@hono/zod-openapi';
import { sql } from 'drizzle-orm';
import { db } from '../db/client';
import { documents } from '../db/schema';
import { createOpenApiRouter } from '../lib/openapi';

const insertDocumentRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            content: z.string(),
            embedding: z.array(z.number()).length(3),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: z.object({
            id: z.string().uuid(),
            content: z.string(),
          }),
        },
      },
      description: 'Document created successfully',
    },
  },
});

const searchDocumentsRoute = createRoute({
  method: 'post',
  path: '/search',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            embedding: z.array(z.number()).length(3),
            limit: z.number().int().positive().optional().default(5),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.array(
            z.object({
              id: z.string().uuid(),
              content: z.string(),
              similarity: z.number(),
            })
          ),
        },
      },
      description: 'Semantic search results',
    },
  },
});

export const documentsRouter = createOpenApiRouter()
  .openapi(insertDocumentRoute, async (c) => {
    const { content, embedding } = c.req.valid('json');

    const [inserted] = await db
      .insert(documents)
      .values({
        content,
        embedding,
      })
      .returning({
        id: documents.id,
        content: documents.content,
      });

    return c.json(inserted, 201);
  })
  .openapi(searchDocumentsRoute, async (c) => {
    const { embedding, limit } = c.req.valid('json');

    // Convert vector array to postgres pgvector format string, e.g. '[1,0,0]'
    const queryVector = `[${embedding.join(',')}]`;
    const similarity = sql<number>`1 - (${documents.embedding} <=> ${queryVector})`;

    const results = await db
      .select({
        id: documents.id,
        content: documents.content,
        similarity: similarity,
      })
      .from(documents)
      .orderBy(sql`${documents.embedding} <=> ${queryVector}`)
      .limit(limit);

    return c.json(results, 200);
  });
