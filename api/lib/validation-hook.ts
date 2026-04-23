import type { OpenAPIHono } from '@hono/zod-openapi';
import type { ZodError } from 'zod';
import { ValidationError } from './errors';
import type { AppEnv } from './types';

type OpenApiRouterOptions = NonNullable<ConstructorParameters<typeof OpenAPIHono<AppEnv>>[0]>;

export const validationHook: OpenApiRouterOptions['defaultHook'] = (result, c) => {
  if (!result.success) {
    const error = result.error as ZodError;
    throw new ValidationError('Validation error', error.flatten());
  }
  if (c) {
    console.log('Validation success. Path:', c.req.path, 'Data:', JSON.stringify(result.data));
  }
};
