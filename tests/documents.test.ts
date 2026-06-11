import { OpenAPIHono } from '@hono/zod-openapi';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../api/lib/types';

const dbMocks = vi.hoisted(() => {
  const returning = vi.fn();
  const values = vi.fn().mockReturnValue({ returning });
  const limit = vi.fn();
  const orderBy = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ orderBy });

  return {
    insert: vi.fn().mockReturnValue({ values }),
    select: vi.fn().mockReturnValue({ from }),
    values,
    returning,
    from,
    orderBy,
    limit,
  };
});

vi.mock('../api/db/client', () => ({
  db: {
    insert: dbMocks.insert,
    select: dbMocks.select,
  },
}));

import { documentsRouter } from '../api/routes/documents';

const createApp = () => {
  const app = new OpenAPIHono<AppEnv>();
  app.route('/api/documents', documentsRouter);
  return app;
};

describe('Documents & Vector Search Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dbMocks.returning.mockReset();
    dbMocks.limit.mockReset();
  });

  it('POST /api/documents inserts a new document and returns 201', async () => {
    const mockDoc = { id: 'a57ba8d8-21cc-4cb5-8d5c-dcf5d8521a00', content: 'Apple' };
    dbMocks.returning.mockResolvedValueOnce([mockDoc]);

    const app = createApp();
    const res = await app.request('/api/documents', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        content: 'Apple',
        embedding: [1, 0, 0],
      }),
    });

    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data).toEqual(mockDoc);
    expect(dbMocks.insert).toHaveBeenCalled();
    expect(dbMocks.values).toHaveBeenCalledWith({
      content: 'Apple',
      embedding: [1, 0, 0],
    });
  });

  it('POST /api/documents/search returns semantic search results', async () => {
    const mockResults = [
      { id: 'a57ba8d8-21cc-4cb5-8d5c-dcf5d8521a00', content: 'Apple', similarity: 0.99 },
    ];
    dbMocks.limit.mockResolvedValueOnce(mockResults);

    const app = createApp();
    const res = await app.request('/api/documents/search', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        embedding: [1, 0, 0],
        limit: 3,
      }),
    });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual(mockResults);
    expect(dbMocks.select).toHaveBeenCalled();
    expect(dbMocks.from).toHaveBeenCalled();
    expect(dbMocks.orderBy).toHaveBeenCalled();
    expect(dbMocks.limit).toHaveBeenCalledWith(3);
  });
});
