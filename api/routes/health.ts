import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { sql } from 'drizzle-orm';
import { db } from '../db/client';
import type { AppEnv } from '../lib/types';

const healthSchema = z.object({
  status: z.string().openapi({ example: 'healthy' }),
  database: z.string().openapi({ example: 'connected' }),
  timestamp: z.string().openapi({ example: '2026-04-02T11:47:06.000Z' }),
  version: z.string().openapi({ example: '1.0.0' }),
});

const route = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: healthSchema,
        },
      },
      description: 'The health check response',
    },
  },
});

export const healthRouter = new OpenAPIHono<AppEnv>().openapi(route, async (c) => {
  let dbStatus = 'connected';
  try {
    await db.execute(sql`select 1`);
  } catch (_err) {
    dbStatus = 'disconnected';
  }

  return c.json({
    status: dbStatus === 'connected' ? 'healthy' : 'degraded',
    database: dbStatus,
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});
