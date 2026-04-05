import { config as dotenvConfig } from 'dotenv';
import { z } from 'zod';

dotenvConfig(); // ensure env is loaded in Node.js, Bun might auto-load

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  DATABASE_URL: z.string(),
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  AUTH_MODE: z.enum(['local', 'oauth', 'both']).default('both'),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  APP_URL: z.string().optional(),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  LOG_LEVEL: z.string().default('info'),
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  console.error('❌ Invalid environment variables:');
  console.error(result.error.format());
  process.exit(1);
}

const corsOrigins = result.data.CORS_ORIGIN.split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

if (corsOrigins.length === 0 || corsOrigins.includes('*')) {
  console.error('❌ Invalid CORS_ORIGIN: wildcard (*) is not allowed. Use explicit origin list.');
  process.exit(1);
}

export const config = {
  ...result.data,
  CORS_ORIGINS: corsOrigins,
};
