import { createRoute, z } from '@hono/zod-openapi';
import {
  reminderSettingListResponseSchema,
  reminderSettingRecordSchema,
  reminderTypeSchema,
  updateReminderSettingSchema,
} from '../../../shared/schemas/health.schema';
import { AuthError } from '../../lib/errors';
import { createOpenApiRouter } from '../../lib/openapi';
import { authMiddleware } from '../../middleware/auth';
import * as ReminderService from './health-reminders.service';

const reminderParamSchema = z.object({
  reminderType: reminderTypeSchema,
});

const listSettingsRoute = createRoute({
  method: 'get',
  path: '/settings',
  responses: {
    200: {
      description: 'リマインド設定一覧',
      content: {
        'application/json': { schema: reminderSettingListResponseSchema },
      },
    },
  },
});

const getSettingRoute = createRoute({
  method: 'get',
  path: '/settings/{reminderType}',
  request: {
    params: reminderParamSchema,
  },
  responses: {
    200: {
      description: 'リマインド設定',
      content: {
        'application/json': { schema: reminderSettingRecordSchema },
      },
    },
  },
});

const putSettingRoute = createRoute({
  method: 'put',
  path: '/settings/{reminderType}',
  request: {
    params: reminderParamSchema,
    body: {
      content: {
        'application/json': {
          schema: updateReminderSettingSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: '更新後のリマインド設定',
      content: {
        'application/json': { schema: reminderSettingRecordSchema },
      },
    },
  },
});

const remindersRouter = createOpenApiRouter();
remindersRouter.use('*', authMiddleware());

remindersRouter.openapi(listSettingsRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const data = await ReminderService.listReminderSettings(user.userId);
  return c.json(data, 200);
});

remindersRouter.openapi(getSettingRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const { reminderType } = c.req.valid('param');
  const data = await ReminderService.getReminderSetting(user.userId, reminderType);
  return c.json(data, 200);
});

remindersRouter.openapi(putSettingRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const { reminderType } = c.req.valid('param');
  const body = c.req.valid('json');
  const data = await ReminderService.upsertReminderSetting(user.userId, reminderType, body);
  return c.json(data, 200);
});

export const healthRemindersRouter = remindersRouter;
