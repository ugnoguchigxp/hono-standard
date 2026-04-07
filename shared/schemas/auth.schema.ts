import { z } from '@hono/zod-openapi';
import sanitizeHtml from 'sanitize-html';

const sanitize = (val: string) =>
  sanitizeHtml(val, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'discard',
  });

export const loginSchema = z
  .object({
    email: z.string().email().openapi({ example: 'ugnoguchigxp@gmail.com' }),
    password: z.string().min(1).openapi({ example: '8f7D9s2A1q5W4e3R' }),
  })
  .openapi('LoginInput');

export const registerSchema = z
  .object({
    email: z.string().email().openapi({ example: 'ugnoguchigxp@gmail.com' }),
    password: z.string().min(8).openapi({ example: '8f7D9s2A1q5W4e3R' }),
    name: z.string().min(1).transform(sanitize).openapi({ example: 'Admin User' }),
  })
  .openapi('RegisterInput');

export const authResponseSchema = z.object({
  user: z.object({
    id: z.string(),
    email: z.string(),
  }),
});

// Infer types
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
