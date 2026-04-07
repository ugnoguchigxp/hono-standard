import { createRoute, z } from '@hono/zod-openapi';
import {
  createHealthGoalSchema,
  healthGoalAchievementResponseSchema,
  healthGoalListResponseSchema,
  healthGoalRecordSchema,
  summaryDateQuerySchema,
  updateHealthGoalSchema,
} from '../../../shared/schemas/health.schema';
import { AuthError } from '../../lib/errors';
import { createOpenApiRouter } from '../../lib/openapi';
import * as HealthGoalService from './health.service';

const goalParamSchema = z.object({
  id: z.string().uuid(),
});

const listGoalsRoute = createRoute({
  method: 'get',
  path: '/',
  responses: {
    200: {
      description: '健康目標一覧',
      content: {
        'application/json': { schema: healthGoalListResponseSchema },
      },
    },
  },
});

const postGoalRoute = createRoute({
  method: 'post',
  path: '/',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createHealthGoalSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: '健康目標を新規作成',
      content: {
        'application/json': { schema: healthGoalRecordSchema },
      },
    },
  },
});

const getGoalRoute = createRoute({
  method: 'get',
  path: '/{id}',
  request: {
    params: goalParamSchema,
  },
  responses: {
    200: {
      description: '健康目標',
      content: {
        'application/json': { schema: healthGoalRecordSchema },
      },
    },
  },
});

const putGoalRoute = createRoute({
  method: 'put',
  path: '/{id}',
  request: {
    params: goalParamSchema,
    body: {
      content: {
        'application/json': {
          schema: updateHealthGoalSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: '更新後の健康目標',
      content: {
        'application/json': { schema: healthGoalRecordSchema },
      },
    },
  },
});

const deleteGoalRoute = createRoute({
  method: 'delete',
  path: '/{id}',
  request: {
    params: goalParamSchema,
  },
  responses: {
    204: {
      description: '削除成功',
    },
  },
});

const getGoalAchievementRoute = createRoute({
  method: 'get',
  path: '/achievements',
  request: {
    query: summaryDateQuerySchema,
  },
  responses: {
    200: {
      description: '健康目標達成度',
      content: {
        'application/json': { schema: healthGoalAchievementResponseSchema },
      },
    },
  },
});

const goalsRouter = createOpenApiRouter();

goalsRouter.openapi(listGoalsRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const data = await HealthGoalService.listHealthGoals(user.userId);
  return c.json(data, 200);
});

goalsRouter.openapi(postGoalRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const body = c.req.valid('json');
  const record = await HealthGoalService.createHealthGoal(user.userId, body);
  return c.json(record, 201);
});

goalsRouter.openapi(getGoalRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const { id } = c.req.valid('param');
  const record = await HealthGoalService.getHealthGoalById(user.userId, id);
  return c.json(record, 200);
});

goalsRouter.openapi(putGoalRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const record = await HealthGoalService.updateHealthGoal(user.userId, id, body);
  return c.json(record, 200);
});

goalsRouter.openapi(deleteGoalRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const { id } = c.req.valid('param');
  await HealthGoalService.deleteHealthGoal(user.userId, id);
  return c.body(null, 204);
});

goalsRouter.openapi(getGoalAchievementRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const q = c.req.valid('query');
  const data = await HealthGoalService.getHealthGoalAchievements(user.userId, q.date, q.timeZone);
  return c.json(data, 200);
});

export const healthGoalsRouter = goalsRouter;
