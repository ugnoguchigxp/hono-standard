import { createRoute } from '@hono/zod-openapi';
import {
  healthSyncPreferenceRecordSchema,
  healthSyncPreferenceSchema,
} from '../../../shared/schemas/health.schema';
import { AuthError } from '../../lib/errors';
import { createOpenApiRouter } from '../../lib/openapi';
import { authMiddleware } from '../../middleware/auth';
import * as SyncService from './health-sync.service';

const getSyncSettingsRoute = createRoute({
  method: 'get',
  path: '/settings',
  responses: {
    200: {
      description: '健康同期設定',
      content: {
        'application/json': { schema: healthSyncPreferenceRecordSchema },
      },
    },
  },
});

const putSyncSettingsRoute = createRoute({
  method: 'put',
  path: '/settings',
  request: {
    body: {
      content: {
        'application/json': {
          schema: healthSyncPreferenceSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: '更新後の健康同期設定',
      content: {
        'application/json': { schema: healthSyncPreferenceRecordSchema },
      },
    },
  },
});

const syncRouter = createOpenApiRouter();
syncRouter.use('*', authMiddleware());

syncRouter.openapi(getSyncSettingsRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const data = await SyncService.getHealthSyncPreference(user.userId);
  return c.json(data, 200);
});

syncRouter.openapi(putSyncSettingsRoute, async (c) => {
  const user = c.get('user');
  if (!user) throw new AuthError('Unauthorized');
  const body = c.req.valid('json');
  const data = await SyncService.updateHealthSyncPreference(user.userId, body);
  return c.json(data, 200);
});

export const healthSyncSettingsRouter = syncRouter;
