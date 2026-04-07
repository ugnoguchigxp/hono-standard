import { createRoute } from '@hono/zod-openapi';
import {
  healthWeeklyReportQuerySchema,
  weeklyHealthReportResponseSchema,
} from '../../../shared/schemas/health.schema';
import { AuthError } from '../../lib/errors';
import { createOpenApiRouter } from '../../lib/openapi';
import { authMiddleware } from '../../middleware/auth';
import * as HealthReportService from './health-reports.service';

const reportsRouter = createOpenApiRouter();
reportsRouter.use('*', authMiddleware());

const weeklyReportRoute = createRoute({
  method: 'get',
  path: '/weekly',
  request: {
    query: healthWeeklyReportQuerySchema,
  },
  responses: {
    200: {
      description: '週次健康レポート',
      content: {
        'application/json': { schema: weeklyHealthReportResponseSchema },
      },
    },
  },
});

reportsRouter.openapi(weeklyReportRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const q = c.req.valid('query');
  const data = await HealthReportService.getWeeklyHealthReport(
    user.userId,
    q.weekStart,
    q.timeZone
  );
  return c.json(data, 200);
});

export const healthReportsRouter = reportsRouter;
