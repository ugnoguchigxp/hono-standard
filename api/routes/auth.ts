import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import { getCookie } from 'hono/cookie';
import { clearAuthCookies, REFRESH_TOKEN_COOKIE_NAME, setAuthCookies } from '../lib/auth-cookies';
import { AuthError } from '../lib/errors';
import type { AppEnv } from '../lib/types';
import { authMiddleware } from '../middleware/auth';
import { loginSchema, registerSchema } from '../schemas/auth.schema';
import { login, logout, refresh, register } from '../services/auth.service';

const authSessionSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
  }),
});

const registerRoute = createRoute({
  method: 'post',
  path: '/register',
  request: {
    body: {
      content: {
        'application/json': {
          schema: registerSchema,
        },
      },
    },
  },
  responses: {
    201: {
      content: {
        'application/json': {
          schema: authSessionSchema,
        },
      },
      description: 'Registration successful',
    },
  },
});

const loginRoute = createRoute({
  method: 'post',
  path: '/login',
  request: {
    body: {
      content: {
        'application/json': {
          schema: loginSchema,
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: authSessionSchema,
        },
      },
      description: 'Login successful',
    },
  },
});

const refreshRoute = createRoute({
  method: 'post',
  path: '/refresh',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: authSessionSchema,
        },
      },
      description: 'Token refresh successful',
    },
  },
});

const logoutRoute = createRoute({
  method: 'post',
  path: '/logout',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: 'Logout successful',
    },
  },
});

const meRoute = createRoute({
  method: 'get',
  path: '/me',
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            userId: z.string(),
            email: z.string(),
          }),
        },
      },
      description: 'Get current user profile',
    },
  },
});

const publicAuthRouter = new OpenAPIHono<AppEnv>()
  .openapi(registerRoute, async (c) => {
    const data = c.req.valid('json');
    const result = await register(data);
    setAuthCookies(c, result);
    return c.json({ user: result.user }, 201);
  })
  .openapi(loginRoute, async (c) => {
    const data = c.req.valid('json');
    const result = await login(data);
    setAuthCookies(c, result);
    return c.json({ user: result.user }, 200);
  })
  .openapi(refreshRoute, async (c) => {
    const refreshToken = getCookie(c, REFRESH_TOKEN_COOKIE_NAME);
    if (!refreshToken) throw new AuthError('Missing refresh token');
    const result = await refresh(refreshToken);
    setAuthCookies(c, result);
    return c.json({ user: result.user }, 200);
  })
  .openapi(logoutRoute, async (c) => {
    const refreshToken = getCookie(c, REFRESH_TOKEN_COOKIE_NAME);
    await logout(refreshToken);
    clearAuthCookies(c);
    return c.json({ success: true }, 200);
  });

const protectedAuthRouterBase = new OpenAPIHono<AppEnv>();
protectedAuthRouterBase.use('/me', authMiddleware());
const protectedAuthRouter = protectedAuthRouterBase.openapi(meRoute, (c) => {
  const user = c.get('user');
  return c.json(user, 200);
});

export const authRouter = new OpenAPIHono<AppEnv>()
  .route('/', publicAuthRouter)
  .route('/', protectedAuthRouter);
