import { createRoute, z } from '@hono/zod-openapi';
import {
  healthAlertListQuerySchema,
  healthAlertListResponseSchema,
  healthAlertRecordSchema,
} from '../../../shared/schemas/health.schema';
import { AuthError } from '../../lib/errors';
import { createOpenApiRouter } from '../../lib/openapi';
import { authMiddleware } from '../../middleware/auth';
import * as HealthAlertService from './health-alerts.service';

const alertParamSchema = z.object({
  id: z.string().uuid(),
});

const listAlertsRoute = createRoute({
  method: 'get',
  path: '/',
  request: {
    query: healthAlertListQuerySchema,
  },
  responses: {
    200: {
      description: '健康アラート一覧',
      content: {
        'application/json': { schema: healthAlertListResponseSchema },
      },
    },
  },
});

const readAlertRoute = createRoute({
  method: 'put',
  path: '/{id}/read',
  request: {
    params: alertParamSchema,
  },
  responses: {
    200: {
      description: '既読化したアラート',
      content: {
        'application/json': { schema: healthAlertRecordSchema },
      },
    },
  },
});

const alertsRouter = createOpenApiRouter();
alertsRouter.use('*', authMiddleware());

alertsRouter.openapi(listAlertsRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const q = c.req.valid('query');
  const data = await HealthAlertService.listHealthAlerts(user.userId, {
    isRead: q.isRead,
    limit: q.limit,
  });
  return c.json(data, 200);
});

alertsRouter.openapi(readAlertRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const { id } = c.req.valid('param');
  const data = await HealthAlertService.markHealthAlertRead(user.userId, id);
  return c.json(data, 200);
});

export const healthAlertsRouter = alertsRouter;
