import { createRoute, z } from '@hono/zod-openapi';
import {
  activityCreateResponseSchema,
  activityRecordSchema,
  activitySyncBodySchema,
  activitySyncResponseSchema,
  bloodGlucoseCreateResponseSchema,
  bloodGlucoseRecordSchema,
  bloodPressureCreateResponseSchema,
  bloodPressureRecordSchema,
  createActivitySchema,
  createBloodGlucoseSchema,
  createBloodPressureSchema,
  createMealSchema,
  createWeightSchema,
  dailyActivityResponseSchema,
  dailySummaryResponseSchema,
  dateQuerySchema,
  listActivityResponseSchema,
  listBloodGlucoseResponseSchema,
  listBloodPressureResponseSchema,
  listMealsResponseSchema,
  listWeightResponseSchema,
  mealCreateResponseSchema,
  mealRecordSchema,
  summaryDateQuerySchema,
  weeklySummaryQuerySchema,
  weeklySummaryResponseSchema,
  weightCreateResponseSchema,
  weightRecordSchema,
} from '../../../shared/schemas/health.schema';
import { AuthError } from '../../lib/errors';
import { createOpenApiRouter } from '../../lib/openapi';
import { authMiddleware } from '../../middleware/auth';
import * as HealthService from './health.service';
import { healthAlertsRouter } from './health-alerts.routes';
import { healthExportRouter } from './health-export.routes';
import { healthGoalsRouter } from './health-goals.routes';
import { healthRemindersRouter } from './health-reminders.routes';
import { healthReportsRouter } from './health-reports.routes';
import { healthSyncSettingsRouter } from './health-sync.routes';

const postBloodPressureRoute = createRoute({
  method: 'post',
  path: '/vitals/blood-pressure',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createBloodPressureSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': { schema: bloodPressureCreateResponseSchema },
      },
      description: '既存と同一の外部 ID / 値ハッシュの場合は既存レコードを返す',
    },
    201: {
      content: {
        'application/json': { schema: bloodPressureCreateResponseSchema },
      },
      description: '新規作成',
    },
  },
});

const listBloodPressureRoute = createRoute({
  method: 'get',
  path: '/vitals/blood-pressure',
  request: { query: dateQuerySchema },
  responses: {
    200: {
      description: '血圧記録一覧',
      content: {
        'application/json': { schema: listBloodPressureResponseSchema },
      },
    },
  },
});

const getBloodPressureByIdRoute = createRoute({
  method: 'get',
  path: '/vitals/blood-pressure/{id}',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: '血圧記録',
      content: {
        'application/json': { schema: bloodPressureRecordSchema },
      },
    },
    403: { description: '他ユーザーのデータ' },
    404: { description: 'Not found' },
  },
});

const postBloodGlucoseRoute = createRoute({
  method: 'post',
  path: '/vitals/blood-glucose',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createBloodGlucoseSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: '重複のため既存レコードを返却',
      content: {
        'application/json': { schema: bloodGlucoseCreateResponseSchema },
      },
    },
    201: {
      description: '血糖値記録を新規作成',
      content: {
        'application/json': { schema: bloodGlucoseCreateResponseSchema },
      },
    },
  },
});

const listBloodGlucoseRoute = createRoute({
  method: 'get',
  path: '/vitals/blood-glucose',
  request: { query: dateQuerySchema },
  responses: {
    200: {
      description: '血糖値記録一覧',
      content: {
        'application/json': { schema: listBloodGlucoseResponseSchema },
      },
    },
  },
});

const getBloodGlucoseByIdRoute = createRoute({
  method: 'get',
  path: '/vitals/blood-glucose/{id}',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: '血糖値記録',
      content: {
        'application/json': { schema: bloodGlucoseRecordSchema },
      },
    },
    403: { description: '他ユーザーのデータ' },
    404: { description: 'Not found' },
  },
});

const postMealRoute = createRoute({
  method: 'post',
  path: '/nutrition/meals',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createMealSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: '重複のため既存レコードを返却',
      content: {
        'application/json': { schema: mealCreateResponseSchema },
      },
    },
    201: {
      description: '食事記録を新規作成',
      content: {
        'application/json': { schema: mealCreateResponseSchema },
      },
    },
  },
});

const postWeightRoute = createRoute({
  method: 'post',
  path: '/vitals/weight',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createWeightSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: '重複のため既存レコードを返却',
      content: {
        'application/json': { schema: weightCreateResponseSchema },
      },
    },
    201: {
      description: '体重記録を新規作成',
      content: {
        'application/json': { schema: weightCreateResponseSchema },
      },
    },
  },
});

const listWeightRoute = createRoute({
  method: 'get',
  path: '/vitals/weight',
  request: { query: dateQuerySchema },
  responses: {
    200: {
      description: '体重記録一覧',
      content: {
        'application/json': { schema: listWeightResponseSchema },
      },
    },
  },
});

const getWeightByIdRoute = createRoute({
  method: 'get',
  path: '/vitals/weight/{id}',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: '体重記録',
      content: {
        'application/json': { schema: weightRecordSchema },
      },
    },
    403: { description: '他ユーザーのデータ' },
    404: { description: 'Not found' },
  },
});

const listMealsRoute = createRoute({
  method: 'get',
  path: '/nutrition/meals',
  request: { query: dateQuerySchema },
  responses: {
    200: {
      description: '食事記録一覧',
      content: {
        'application/json': { schema: listMealsResponseSchema },
      },
    },
  },
});

const postActivitySyncRoute = createRoute({
  method: 'post',
  path: '/activity/sync',
  request: {
    body: {
      content: {
        'application/json': {
          schema: activitySyncBodySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: '活動データの同期結果',
      content: {
        'application/json': { schema: activitySyncResponseSchema },
      },
    },
  },
});

const getActivityDailyRoute = createRoute({
  method: 'get',
  path: '/activity/daily',
  request: { query: summaryDateQuerySchema },
  responses: {
    200: {
      description: '指定日の活動集計',
      content: {
        'application/json': { schema: dailyActivityResponseSchema },
      },
    },
  },
});

const listActivityRecordsRoute = createRoute({
  method: 'get',
  path: '/activity/records',
  request: { query: dateQuerySchema },
  responses: {
    200: {
      description: '期間内の運動記録一覧',
      content: {
        'application/json': { schema: listActivityResponseSchema },
      },
    },
  },
});

const postActivityRecordRoute = createRoute({
  method: 'post',
  path: '/activity/records',
  request: {
    body: {
      content: {
        'application/json': {
          schema: createActivitySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: '重複のため既存レコードを返却',
      content: {
        'application/json': { schema: activityCreateResponseSchema },
      },
    },
    201: {
      description: '運動記録を新規作成',
      content: {
        'application/json': { schema: activityCreateResponseSchema },
      },
    },
  },
});

const putActivityRoute = createRoute({
  method: 'put',
  path: '/activity/records/{id}',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z
            .object({
              recordedAt: z.string().datetime({ offset: true }),
              timeZone: z.string().max(64),
              externalId: z.string().max(256),
              valueHash: z
                .string()
                .max(64)
                .regex(/^[a-f0-9]{64}$/i),
              inputSource: z.enum(['manual', 'device', 'import', 'api']),
              syncSource: z.string().max(64),
              memo: z.string().max(2000),
              steps: z.number().int().min(0).max(200_000),
              activeMinutes: z
                .number()
                .int()
                .min(0)
                .max(24 * 60),
              caloriesBurned: z.number().int().min(0).max(20000),
            })
            .partial(),
        },
      },
    },
  },
  responses: {
    200: {
      description: '運動記録を更新',
      content: {
        'application/json': { schema: activityRecordSchema },
      },
    },
    403: { description: '他ユーザーのデータ' },
    404: { description: 'Not found' },
  },
});

const deleteActivityRoute = createRoute({
  method: 'delete',
  path: '/activity/records/{id}',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    204: { description: '削除完了' },
    403: { description: '他ユーザーのデータ' },
    404: { description: 'Not found' },
  },
});

const getSummaryDailyRoute = createRoute({
  method: 'get',
  path: '/summary/daily',
  request: { query: summaryDateQuerySchema },
  responses: {
    200: {
      description: '日次健康サマリ',
      content: {
        'application/json': { schema: dailySummaryResponseSchema },
      },
    },
  },
});

const getSummaryWeeklyRoute = createRoute({
  method: 'get',
  path: '/summary/weekly',
  request: { query: weeklySummaryQuerySchema },
  responses: {
    200: {
      description: '週次サマリ',
      content: {
        'application/json': { schema: weeklySummaryResponseSchema },
      },
    },
  },
});

const getSummaryMonthlyRoute = createRoute({
  method: 'get',
  path: '/summary/monthly',
  request: {
    query: z.object({
      yearMonth: z
        .string()
        .regex(/^\d{4}-\d{2}$/)
        .openapi({ example: '2026-04' }),
    }),
  },
  responses: {
    200: {
      description: '月次サマリ',
      content: {
        'application/json': {
          schema: z.object({
            yearMonth: z.string(),
            stepsTotal: z.number(),
            mealCount: z.number(),
            avgSteps: z.number(),
            days: z.array(
              z.object({
                date: z.string(),
                stepsTotal: z.number(),
                mealCount: z.number(),
              })
            ),
          }),
        },
      },
    },
  },
});

const putBloodPressureRoute = createRoute({
  method: 'put',
  path: '/vitals/blood-pressure/{id}',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: { 'application/json': { schema: createBloodPressureSchema.partial() } },
    },
  },
  responses: {
    200: {
      description: '更新後の血圧記録',
      content: { 'application/json': { schema: bloodPressureRecordSchema } },
    },
  },
});

const deleteBloodPressureRoute = createRoute({
  method: 'delete',
  path: '/vitals/blood-pressure/{id}',
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    204: { description: '削除成功' },
  },
});

const putBloodGlucoseRoute = createRoute({
  method: 'put',
  path: '/vitals/blood-glucose/{id}',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: { 'application/json': { schema: createBloodGlucoseSchema.partial() } },
    },
  },
  responses: {
    200: {
      description: '更新後の血糖値記録',
      content: { 'application/json': { schema: bloodGlucoseRecordSchema } },
    },
  },
});

const deleteBloodGlucoseRoute = createRoute({
  method: 'delete',
  path: '/vitals/blood-glucose/{id}',
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    204: { description: '削除成功' },
  },
});

const putMealRoute = createRoute({
  method: 'put',
  path: '/nutrition/meals/{id}',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: { 'application/json': { schema: createMealSchema.partial() } },
    },
  },
  responses: {
    200: {
      description: '更新後の食事記録',
      content: { 'application/json': { schema: mealRecordSchema } },
    },
  },
});

const putWeightRoute = createRoute({
  method: 'put',
  path: '/vitals/weight/{id}',
  request: {
    params: z.object({ id: z.string().uuid() }),
    body: {
      content: { 'application/json': { schema: createWeightSchema.partial() } },
    },
  },
  responses: {
    200: {
      description: '更新後の体重記録',
      content: { 'application/json': { schema: weightRecordSchema } },
    },
  },
});

const deleteWeightRoute = createRoute({
  method: 'delete',
  path: '/vitals/weight/{id}',
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    204: { description: '削除成功' },
  },
});

const deleteMealRoute = createRoute({
  method: 'delete',
  path: '/nutrition/meals/{id}',
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    204: { description: '削除成功' },
  },
});

const protectedHealth = createOpenApiRouter();
protectedHealth.use('*', authMiddleware());

protectedHealth.openapi(postBloodPressureRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const body = c.req.valid('json');
  const { record, duplicate } = await HealthService.createBloodPressure(user.userId, body);
  return c.json({ record, duplicate }, duplicate ? 200 : 201);
});

protectedHealth.openapi(listBloodPressureRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const q = c.req.valid('query');
  const data = await HealthService.listBloodPressure(user.userId, q.from, q.to, q.timeZone);
  return c.json(data, 200);
});

protectedHealth.openapi(getBloodPressureByIdRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const { id } = c.req.valid('param');
  const record = await HealthService.getBloodPressureById(user.userId, id);
  return c.json(record, 200);
});

protectedHealth.openapi(postBloodGlucoseRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const body = c.req.valid('json');
  const { record, duplicate } = await HealthService.createBloodGlucose(user.userId, body);
  return c.json({ record, duplicate }, duplicate ? 200 : 201);
});

protectedHealth.openapi(listBloodGlucoseRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const q = c.req.valid('query');
  const data = await HealthService.listBloodGlucose(user.userId, q.from, q.to, q.timeZone);
  return c.json(data, 200);
});

protectedHealth.openapi(getBloodGlucoseByIdRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const { id } = c.req.valid('param');
  const record = await HealthService.getBloodGlucoseById(user.userId, id);
  return c.json(record, 200);
});

protectedHealth.openapi(postMealRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const body = c.req.valid('json');
  const { record, duplicate } = await HealthService.createMeal(user.userId, body);
  return c.json({ record, duplicate }, duplicate ? 200 : 201);
});

protectedHealth.openapi(postWeightRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const body = c.req.valid('json');
  const { record, duplicate } = await HealthService.createWeight(user.userId, body);
  return c.json({ record, duplicate }, duplicate ? 200 : 201);
});

protectedHealth.openapi(listMealsRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const q = c.req.valid('query');
  const data = await HealthService.listMeals(user.userId, q.from, q.to, q.timeZone);
  return c.json(data, 200);
});

protectedHealth.openapi(listWeightRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const q = c.req.valid('query');
  const data = await HealthService.listWeight(user.userId, q.from, q.to, q.timeZone);
  return c.json(data, 200);
});

protectedHealth.openapi(getWeightByIdRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const { id } = c.req.valid('param');
  const record = await HealthService.getWeightById(user.userId, id);
  return c.json(record, 200);
});

protectedHealth.openapi(postActivitySyncRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const body = c.req.valid('json');
  const data = await HealthService.syncActivity(user.userId, body);
  return c.json(data, 200);
});

protectedHealth.openapi(getActivityDailyRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const q = c.req.valid('query');
  const data = await HealthService.getDailyActivity(user.userId, q.date, q.timeZone);
  return c.json(data, 200);
});

protectedHealth.openapi(listActivityRecordsRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const q = c.req.valid('query');
  const data = await HealthService.listActivity(user.userId, q.from, q.to, q.timeZone);
  return c.json(data, 200);
});

protectedHealth.openapi(postActivityRecordRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const body = c.req.valid('json');
  const { record, duplicate } = await HealthService.createActivity(user.userId, body);
  return c.json({ record, duplicate }, duplicate ? 200 : 201);
});

protectedHealth.openapi(getSummaryDailyRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const q = c.req.valid('query');
  const data = await HealthService.getDailySummary(user.userId, q.date, q.timeZone);
  return c.json(data, 200);
});

protectedHealth.openapi(getSummaryWeeklyRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const q = c.req.valid('query');
  const data = await HealthService.getWeeklySummary(user.userId, q.weekStart, q.timeZone);
  return c.json(data, 200);
});

protectedHealth.openapi(getSummaryMonthlyRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const q = c.req.valid('query');
  const data = await HealthService.getMonthlySummary(user.userId, q.yearMonth);
  return c.json(data, 200);
});

protectedHealth.openapi(putBloodPressureRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const data = await HealthService.updateBloodPressure(user.userId, id, body);
  return c.json(data, 200);
});

protectedHealth.openapi(deleteBloodPressureRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const { id } = c.req.valid('param');
  await HealthService.deleteBloodPressure(user.userId, id);
  return c.body(null, 204);
});

protectedHealth.openapi(putBloodGlucoseRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const data = await HealthService.updateBloodGlucose(user.userId, id, body);
  return c.json(data, 200);
});

protectedHealth.openapi(deleteBloodGlucoseRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const { id } = c.req.valid('param');
  await HealthService.deleteBloodGlucose(user.userId, id);
  return c.body(null, 204);
});

protectedHealth.openapi(putMealRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const data = await HealthService.updateMeal(user.userId, id, body);
  return c.json(data, 200);
});

protectedHealth.openapi(deleteMealRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const { id } = c.req.valid('param');
  await HealthService.deleteMeal(user.userId, id);
  return c.body(null, 204);
});

protectedHealth.openapi(putWeightRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const data = await HealthService.updateWeight(user.userId, id, body);
  return c.json(data, 200);
});

protectedHealth.openapi(deleteWeightRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const { id } = c.req.valid('param');
  await HealthService.deleteWeight(user.userId, id);
  return c.body(null, 204);
});

protectedHealth.openapi(putActivityRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const { id } = c.req.valid('param');
  const body = c.req.valid('json');
  const data = await HealthService.updateActivity(user.userId, id, body);
  return c.json(data, 200);
});

protectedHealth.openapi(deleteActivityRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const { id } = c.req.valid('param');
  await HealthService.deleteActivity(user.userId, id);
  return c.body(null, 204);
});

protectedHealth.route('/goals', healthGoalsRouter);
protectedHealth.route('/alerts', healthAlertsRouter);
protectedHealth.route('/reports', healthReportsRouter);
protectedHealth.route('/reminders', healthRemindersRouter);
protectedHealth.route('/sync', healthSyncSettingsRouter);
protectedHealth.route('/', healthExportRouter);

export const healthRecordsRouter = protectedHealth;
