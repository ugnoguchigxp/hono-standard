import { logger } from '@api/lib/logger';
import { createOpenApiRouter } from '@api/lib/openapi';
import { createRoute, z } from '@hono/zod-openapi';
import { SpeechService } from './speechService';

const speechService = new SpeechService();

const getTokenRoute = createRoute({
  method: 'get',
  path: '/token',
  summary: 'Azure Speech Service用の認証トークンを取得する',
  responses: {
    200: {
      description: 'トークンが取得されました',
      content: {
        'application/json': {
          schema: z.object({
            token: z.string(),
            region: z.string(),
            expiresIn: z.number(),
          }),
        },
      },
    },
    503: {
      description: 'サービスが利用不可',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
    500: {
      description: '内部サーバーエラー',
      content: {
        'application/json': {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
    },
  },
});

export const speechRouter = createOpenApiRouter().openapi(getTokenRoute, async (c) => {
  try {
    if (!speechService.isAvailable()) {
      return c.json({ error: 'Speech service not configured' }, 503);
    }

    const token = await speechService.getAuthToken();
    const region = speechService.getRegion() || 'japaneast';

    return c.json(
      {
        token,
        region,
        expiresIn: 600, // 10 minutes
      },
      200
    );
  } catch (error) {
    logger.error({ error }, 'Failed to generate speech token');
    return c.json({ error: 'Internal server error' }, 500);
  }
});
