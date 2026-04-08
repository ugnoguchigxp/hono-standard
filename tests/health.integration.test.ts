import { beforeAll, describe, expect, it } from 'vitest';
import { generateAccessToken } from '../api/services/token.service';

const enabled = Boolean(process.env.DATABASE_URL);
const d = enabled ? describe : describe.skip;

let app: typeof import('../api/app').default;
let sharedUser: { id: string; email: string };
let sharedToken: string;

d('health API integration (DB)', () => {
  beforeAll(async () => {
    const mod = await import('../api/app');
    app = mod.default;

    const email = `hi-${Date.now()}-shared@local.test`;
    const reg = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password: 'password12345',
        name: 'SharedUser',
      }),
    });
    expect(reg.status).toBe(201);
    const payload = (await reg.json()) as { user: { id: string; email: string } };
    sharedUser = payload.user;
    sharedToken = await generateAccessToken({
      userId: sharedUser.id,
      email: sharedUser.email,
    });
  });

  it('register → 血圧登録 → 同内容は重複で 200', async () => {
    const payload = {
      recordedAt: '2026-04-07T10:00:00.000Z',
      systolic: 121,
      diastolic: 79,
      period: 'morning' as const,
      timeZone: 'UTC',
    };

    const first = await app.request('/api/v1/health/vitals/blood-pressure', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sharedToken}`,
      },
      body: JSON.stringify(payload),
    });
    expect(first.status).toBe(201);
    const firstBody = (await first.json()) as { duplicate: boolean };
    expect(firstBody.duplicate).toBe(false);

    const second = await app.request('/api/v1/health/vitals/blood-pressure', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sharedToken}`,
      },
      body: JSON.stringify(payload),
    });
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { duplicate: boolean };
    expect(secondBody.duplicate).toBe(true);
  });

  it('register → 体重登録 → 同内容は重複で 200', async () => {
    const payload = {
      recordedAt: '2026-04-07T10:00:00.000Z',
      value: 70.2,
      timeZone: 'UTC',
    };

    const first = await app.request('/api/v1/health/vitals/weight', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sharedToken}`,
      },
      body: JSON.stringify(payload),
    });
    expect(first.status).toBe(201);
    const firstBody = (await first.json()) as { duplicate: boolean };
    expect(firstBody.duplicate).toBe(false);

    const second = await app.request('/api/v1/health/vitals/weight', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sharedToken}`,
      },
      body: JSON.stringify(payload),
    });
    expect(second.status).toBe(200);
    const secondBody = (await second.json()) as { duplicate: boolean };
    expect(secondBody.duplicate).toBe(true);
  });

  it('他ユーザーの血圧 ID は 403', async () => {
    const e1 = `hi-${Date.now()}-b1@local.test`;
    const e2 = `hi-${Date.now()}-b2@local.test`;

    const r1 = await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: e1, password: 'password12345', name: 'U1' }),
    });
    const u1 = (await r1.json()) as { user: { id: string; email: string } };

    await app.request('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: e2, password: 'password12345', name: 'U2' }),
    });

    const t1 = await generateAccessToken({ userId: u1.user.id, email: u1.user.email });

    const bpRes = await app.request('/api/v1/health/vitals/blood-pressure', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${t1}`,
      },
      body: JSON.stringify({
        recordedAt: '2026-05-01T08:00:00.000Z',
        systolic: 130,
        diastolic: 85,
        period: 'evening',
        timeZone: 'UTC',
      }),
    });
    expect(bpRes.status).toBe(201);
    const { record } = (await bpRes.json()) as { record: { id: string } };

    const r2login = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: e2, password: 'password12345' }),
    });
    expect(r2login.status).toBe(200);
    const u2 = (await r2login.json()) as { user: { id: string; email: string } };
    const t2 = await generateAccessToken({ userId: u2.user.id, email: u2.user.email });

    const bad = await app.request(`/api/v1/health/vitals/blood-pressure/${record.id}`, {
      headers: { Authorization: `Bearer ${t2}` },
    });
    expect(bad.status).toBe(403);
  });

  it('運動同期と日次サマリ集計', async () => {
    const sync = await app.request('/api/v1/health/activity/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sharedToken}`,
      },
      body: JSON.stringify({
        items: [
          {
            recordedAt: '2026-06-15T12:00:00.000Z',
            steps: 5000,
            timeZone: 'UTC',
          },
        ],
      }),
    });
    expect(sync.status).toBe(200);
    const sum = await app.request('/api/v1/health/summary/daily?date=2026-06-15&timeZone=UTC', {
      headers: { Authorization: `Bearer ${sharedToken}` },
    });
    expect(sum.status).toBe(200);
    const json = (await sum.json()) as { stepsTotal: number };
    expect(json.stepsTotal).toBeGreaterThanOrEqual(5000);
  });

  it('GET /activity/records は期間内のレコードを返す', async () => {
    await app.request('/api/v1/health/activity/sync', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sharedToken}`,
      },
      body: JSON.stringify({
        items: [
          {
            recordedAt: '2026-07-01T09:00:00.000Z',
            steps: 100,
            timeZone: 'UTC',
          },
        ],
      }),
    });

    const list = await app.request(
      '/api/v1/health/activity/records?from=2026-07-01&to=2026-07-01&timeZone=UTC',
      {
        headers: { Authorization: `Bearer ${sharedToken}` },
      }
    );
    expect(list.status).toBe(200);
    const body = (await list.json()) as { records: { steps: number | null }[] };
    expect(body.records.length).toBeGreaterThan(0);
    expect(body.records[0].steps).toBe(100);
  });
});
