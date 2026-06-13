process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'file:sqlite-test.db';
process.env.JWT_SECRET ??= 'test-jwt-secret-with-at-least-32-chars';
process.env.APP_URL ??= 'http://localhost:5173';
process.env.CORS_ORIGIN ??= 'http://localhost:5173';
process.env.AUTH_MODE ??= 'both';
