import type { Hook } from '@hono/zod-validator';
import type { ZodError } from 'zod';
import { ValidationError } from './errors';
import type { AppEnv } from './types';

export const validationHook: Hook<unknown, AppEnv, string> = (result) => {
  if (!result.success) {
    const error = result.error as ZodError;
    throw new ValidationError('Validation error', error.flatten());
  }
};
