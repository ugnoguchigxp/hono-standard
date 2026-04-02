import { z } from '@hono/zod-openapi';
import { sanitize } from '../lib/sanitizer';

export const registerSchema = z
  .object({
    email: z.string().email().openapi({ example: 'user@example.com' }),
    password: z.string().min(8).openapi({ example: 'password123' }),
    name: z.string().min(1).transform(sanitize).openapi({ example: 'John Doe' }),
  })
  .openapi('RegisterInput');

export const loginSchema = z
  .object({
    email: z.string().email().openapi({ example: 'user@example.com' }),
    password: z.string().min(1).openapi({ example: 'password123' }),
  })
  .openapi('LoginInput');

export const refreshSchema = z
  .object({
    refreshToken: z.string().openapi({ example: 'some-refresh-token' }),
  })
  .openapi('RefreshInput');

export const logoutSchema = z
  .object({
    refreshToken: z.string().openapi({ example: 'some-refresh-token' }),
  })
  .openapi('LogoutInput');

// Infer types
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshInput = z.infer<typeof refreshSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
