/**
 * OpenAPI JSON をファイルに書き出し（サーバー起動不要）。
 * `pnpm openapi:types` の前置ステップ。
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';

loadEnv();

process.env.JWT_SECRET ??= '01234567890123456789012345678901';
process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/hono_standard';
process.env.AUTH_MODE ??= 'local';
process.env.NODE_ENV ??= 'development';
process.env.CORS_ORIGIN ??= 'http://localhost:5173';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(here, '../openapi/openapi.json');

const { default: app } = await import('../api/app');
const doc = app.getOpenAPIDocument({
  openapi: '3.0.0',
  info: {
    title: 'Hono Standard API',
    version: '1.0.0',
  },
});

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
console.info('OpenAPI written to', outPath);
