import { describe, expect, it } from 'vitest';
import {
  hashActivityItem,
  hashBloodGlucose,
  hashBloodPressure,
  hashMeal,
} from '../api/modules/health/health.service';
import { getLocalDayRange, toLocalDateString } from '../api/modules/health/health-timezone';
import {
  activitySyncBodySchema,
  createBloodGlucoseSchema,
  createBloodPressureSchema,
  createHealthGoalSchema,
  createMealSchema,
  dateQuerySchema,
  healthAlertListQuerySchema,
  healthExportQuerySchema,
  healthSyncPreferenceSchema,
  registerNotificationDeviceSchema,
  updateReminderSettingSchema,
} from '../shared/schemas/health.schema';

describe('health shared schemas', () => {
  it('validates blood pressure create input', () => {
    const parsed = createBloodPressureSchema.parse({
      recordedAt: '2026-04-07T08:30:00.000Z',
      systolic: 120,
      diastolic: 80,
      pulse: 72,
      period: 'morning',
      externalId: 'x:1',
    });
    expect(parsed.systolic).toBe(120);
  });

  it('rejects blood pressure with invalid period', () => {
    expect(() =>
      createBloodPressureSchema.parse({
        recordedAt: '2026-04-07T08:30:00.000Z',
        systolic: 120,
        diastolic: 80,
        period: 'noon',
      })
    ).toThrow();
  });

  it('validates blood glucose', () => {
    const parsed = createBloodGlucoseSchema.parse({
      recordedAt: '2026-04-07T08:30:00.000Z',
      value: 5.5,
      unit: 'mmol_l',
      timing: 'fasting',
    });
    expect(parsed.unit).toBe('mmol_l');
  });

  it('validates meal', () => {
    const parsed = createMealSchema.parse({
      recordedAt: '2026-04-07T12:00:00.000Z',
      items: 'ランチ',
      estimatedCalories: 600,
    });
    expect(parsed.items).toBe('ランチ');
  });

  it('validates activity sync requires at least one metric', () => {
    expect(() =>
      activitySyncBodySchema.parse({
        items: [{ recordedAt: '2026-04-07T08:30:00.000Z' }],
      })
    ).toThrow();

    const ok = activitySyncBodySchema.parse({
      items: [{ recordedAt: '2026-04-07T08:30:00.000Z', steps: 1000 }],
    });
    expect(ok.items[0].steps).toBe(1000);
  });

  it('accepts optional date query params', () => {
    expect(dateQuerySchema.parse({})).toEqual({});
    expect(dateQuerySchema.parse({ from: '2026-04-01' })).toEqual({ from: '2026-04-01' });
    expect(dateQuerySchema.parse({ timeZone: 'Asia/Tokyo' })).toEqual({ timeZone: 'Asia/Tokyo' });
  });

  it('rejects malformed date query', () => {
    expect(() => dateQuerySchema.parse({ from: '2026/04/01' })).toThrow();
  });

  it('parses alert list query coercions', () => {
    const parsed = healthAlertListQuerySchema.parse({ isRead: 'true', limit: '10' });
    expect(parsed.isRead).toBe(true);
    expect(parsed.limit).toBe(10);
  });

  it('validates goal create input', () => {
    const parsed = createHealthGoalSchema.parse({
      goalType: 'daily_step_count',
      period: 'daily',
      targetValue: 8000,
      startsOn: '2026-04-01',
      isActive: true,
    });
    expect(parsed.goalType).toBe('daily_step_count');
  });

  it('validates goal range input', () => {
    const parsed = createHealthGoalSchema.parse({
      goalType: 'blood_glucose_fasting_range',
      period: 'daily',
      targetMin: 80,
      targetMax: 120,
      startsOn: '2026-04-01',
    });
    expect(parsed.targetMin).toBe(80);
  });

  it('validates reminder settings update input', () => {
    const parsed = updateReminderSettingSchema.parse({
      isEnabled: true,
      localTime: '08:30',
      daysOfWeek: ['monday', 'tuesday'],
    });
    expect(parsed.localTime).toBe('08:30');
  });

  it('validates notification device registration', () => {
    const parsed = registerNotificationDeviceSchema.parse({
      platform: 'android',
      deviceToken: 'token-123456',
    });
    expect(parsed.platform).toBe('android');
  });

  it('validates sync preference update input', () => {
    const parsed = healthSyncPreferenceSchema.parse({
      isEnabled: true,
      intervalHours: '6',
      wifiOnly: false,
    });
    expect(parsed.intervalHours).toBe(6);
  });

  it('validates export query parsing', () => {
    const parsed = healthExportQuerySchema.parse({ format: 'csv', from: '2026-04-01' });
    expect(parsed.format).toBe('csv');
  });
});

describe('health hash helpers', () => {
  it('hashBloodPressure is stable for same payload', () => {
    const input = createBloodPressureSchema.parse({
      recordedAt: '2026-04-07T08:30:00.000Z',
      systolic: 118,
      diastolic: 76,
      period: 'evening',
    });
    const a = hashBloodPressure('user-1', input);
    const b = hashBloodPressure('user-1', input);
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });

  it('hash helpers normalize equivalent instants across offsets', () => {
    const bpA = createBloodPressureSchema.parse({
      recordedAt: '2026-04-07T08:30:00.000Z',
      systolic: 118,
      diastolic: 76,
      period: 'evening',
    });
    const bpB = createBloodPressureSchema.parse({
      recordedAt: '2026-04-07T17:30:00+09:00',
      systolic: 118,
      diastolic: 76,
      period: 'evening',
    });
    expect(hashBloodPressure('user-1', bpA)).toBe(hashBloodPressure('user-1', bpB));

    const glucoseA = createBloodGlucoseSchema.parse({
      recordedAt: '2026-04-07T08:30:00.000Z',
      value: 95,
      unit: 'mg_dl',
      timing: 'fasting',
    });
    const glucoseB = createBloodGlucoseSchema.parse({
      recordedAt: '2026-04-07T17:30:00+09:00',
      value: 95,
      unit: 'mg_dl',
      timing: 'fasting',
    });
    expect(hashBloodGlucose('user-1', glucoseA)).toBe(hashBloodGlucose('user-1', glucoseB));

    const mealA = createMealSchema.parse({
      recordedAt: '2026-04-07T08:30:00.000Z',
      items: '玄米ごはん、味噌汁',
      estimatedCalories: 420,
    });
    const mealB = createMealSchema.parse({
      recordedAt: '2026-04-07T17:30:00+09:00',
      items: '玄米ごはん、味噌汁',
      estimatedCalories: 420,
    });
    expect(hashMeal('user-1', mealA)).toBe(hashMeal('user-1', mealB));

    const activityA = {
      recordedAt: '2026-04-07T08:30:00.000Z',
      steps: 1000,
      activeMinutes: 30,
    };
    const activityB = {
      recordedAt: '2026-04-07T17:30:00+09:00',
      steps: 1000,
      activeMinutes: 30,
    };
    expect(hashActivityItem('user-1', activityA)).toBe(hashActivityItem('user-1', activityB));
  });
});

describe('health timezone helpers', () => {
  it('formats local dates in the requested timezone', () => {
    expect(toLocalDateString(new Date('2026-04-06T16:00:00.000Z'), 'Asia/Tokyo')).toBe(
      '2026-04-07'
    );
  });

  it('computes the correct local day range for Asia/Tokyo', () => {
    const range = getLocalDayRange('2026-04-07', 'Asia/Tokyo');
    expect(range.start.toISOString()).toBe('2026-04-06T15:00:00.000Z');
    expect(range.endExclusive.toISOString()).toBe('2026-04-07T15:00:00.000Z');
  });
});
