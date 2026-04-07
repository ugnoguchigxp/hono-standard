import { describe, expect, it } from 'vitest';
import app from '../api/app';

describe('Health records API (v1)', () => {
  it('returns 401 when Authorization is missing', async () => {
    const res = await app.request('/api/v1/health/vitals/blood-pressure', {
      method: 'GET',
    });
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for POST blood pressure without token', async () => {
    const res = await app.request('/api/v1/health/vitals/blood-pressure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recordedAt: '2026-04-07T08:30:00.000Z',
        systolic: 120,
        diastolic: 80,
        period: 'morning',
      }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 for goal listing without token', async () => {
    const res = await app.request('/api/v1/health/goals', {
      method: 'GET',
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 for alert listing without token', async () => {
    const res = await app.request('/api/v1/health/alerts', {
      method: 'GET',
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 for weekly report without token', async () => {
    const res = await app.request('/api/v1/health/reports/weekly', {
      method: 'GET',
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 for export without token', async () => {
    const res = await app.request('/api/v1/health/export', {
      method: 'GET',
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 for notification device registration without token', async () => {
    const res = await app.request('/api/v1/notifications/device-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform: 'android',
        deviceToken: 'mock-token',
      }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 401 for sync settings without token', async () => {
    const res = await app.request('/api/v1/health/sync/settings', {
      method: 'GET',
    });
    expect(res.status).toBe(401);
  });
});
