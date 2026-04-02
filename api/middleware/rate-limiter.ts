import type { Context } from 'hono';

type RateLimiterOptions = {
  windowMs: number;
  limit: number;
  message?: string;
  keyGenerator?: (c: Context) => string;
};

// In-memory store for rate limiting
const store = new Map<string, { count: number; resetTime: number }>();

// Simple cleanup interval (runs every 5 mins to prevent memory leaks)
setInterval(
  () => {
    const now = Date.now();
    for (const [key, record] of store.entries()) {
      if (now > record.resetTime) {
        store.delete(key);
      }
    }
  },
  5 * 60 * 1000
).unref?.();

export const rateLimiter = (options: RateLimiterOptions) => {
  return async (c: Context, next: () => Promise<void>) => {
    /**
     * NOTE: When running behind a reverse proxy (e.g., Nginx, Cloudflare),
     * you should use a trusted header like 'x-forwarded-for' or 'cf-connecting-ip'.
     * Make sure your proxy is configured to set these headers correctly and
     * that you only trust headers from known proxies to prevent IP spoofing.
     */
    const key = options.keyGenerator
      ? options.keyGenerator(c)
      : c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || '127.0.0.1';
    const now = Date.now();
    const record = store.get(key);

    if (record) {
      if (now > record.resetTime) {
        store.set(key, { count: 1, resetTime: now + options.windowMs });
      } else {
        if (record.count >= options.limit) {
          return c.json(
            {
              error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: options.message || 'Too many requests',
              },
            },
            429
          );
        }
        record.count++;
      }
    } else {
      store.set(key, { count: 1, resetTime: now + options.windowMs });
    }

    await next();
  };
};
