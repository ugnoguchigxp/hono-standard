import { createRoute, z } from '@hono/zod-openapi';
import {
  notificationDeviceListResponseSchema,
  notificationDeviceRecordSchema,
  registerNotificationDeviceSchema,
} from '../../../shared/schemas/health.schema';
import { AuthError } from '../../lib/errors';
import { createOpenApiRouter } from '../../lib/openapi';
import { authMiddleware } from '../../middleware/auth';
import * as NotificationService from './notifications.service';

const deviceParamSchema = z.object({
  id: z.string().uuid(),
});

const listDevicesRoute = createRoute({
  method: 'get',
  path: '/device-token',
  responses: {
    200: {
      description: '通知端末一覧',
      content: {
        'application/json': { schema: notificationDeviceListResponseSchema },
      },
    },
  },
});

const postDeviceRoute = createRoute({
  method: 'post',
  path: '/device-token',
  request: {
    body: {
      content: {
        'application/json': {
          schema: registerNotificationDeviceSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: '通知端末登録',
      content: {
        'application/json': { schema: notificationDeviceRecordSchema },
      },
    },
  },
});

const deleteDeviceRoute = createRoute({
  method: 'delete',
  path: '/device-token/{id}',
  request: {
    params: deviceParamSchema,
  },
  responses: {
    204: { description: '削除成功' },
  },
});

const notificationsRouter = createOpenApiRouter();
notificationsRouter.use('*', authMiddleware());

notificationsRouter.openapi(listDevicesRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const data = await NotificationService.listNotificationDevices(user.userId);
  return c.json(data, 200);
});

notificationsRouter.openapi(postDeviceRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const body = c.req.valid('json');
  const data = await NotificationService.registerNotificationDevice(user.userId, body);
  return c.json(data, 201);
});

notificationsRouter.openapi(deleteDeviceRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const { id } = c.req.valid('param');
  await NotificationService.deleteNotificationDevice(user.userId, id);
  return c.body(null, 204);
});

export const notificationsRouterV1 = notificationsRouter;
