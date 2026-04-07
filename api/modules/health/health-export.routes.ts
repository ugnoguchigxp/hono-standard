import { createRoute } from '@hono/zod-openapi';
import {
  healthExportQuerySchema,
  healthExportResponseSchema,
} from '../../../shared/schemas/health.schema';
import { AuthError } from '../../lib/errors';
import { createOpenApiRouter } from '../../lib/openapi';
import { authMiddleware } from '../../middleware/auth';
import { exportHealthData } from './health-export.service';

const exportRoute = createRoute({
  method: 'get',
  path: '/export',
  request: {
    query: healthExportQuerySchema,
  },
  responses: {
    200: {
      description: '健康データのエクスポート',
      content: {
        'application/json': { schema: healthExportResponseSchema },
      },
    },
  },
});

const exportRouter = createOpenApiRouter();
exportRouter.use('*', authMiddleware());

exportRouter.openapi(exportRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const q = c.req.valid('query');
  const data = await exportHealthData(user.userId, q.from, q.to, q.timeZone, q.format ?? 'json');
  return c.json(data, 200);
});

export const healthExportRouter = exportRouter;
