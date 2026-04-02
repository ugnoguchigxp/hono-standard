import { describe, expect, it } from 'vitest';
import app from '../api/app';

describe('Health Check Endpoint', () => {
  it('should return 200 OK and healthy status', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.status).toBe('healthy');
    expect(data.version).toBeDefined();
    expect(data.timestamp).toBeDefined();
  });
});
