import { createMiddleware } from 'hono/factory';
import { AuthError } from '../lib/errors';
import type { AppEnv } from '../lib/types';
import { verifyAccessToken } from '../services/token.service';

export const authMiddleware = () => {
  return createMiddleware<AppEnv>(async (c, next) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new AuthError('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1];

    try {
      const payload = await verifyAccessToken(token);
      c.set('user', payload);
    } catch {
      throw new AuthError('Invalid or expired token');
    }

    await next();
  });
};
