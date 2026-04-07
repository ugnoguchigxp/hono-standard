import type { HealthAlertSeverity, HealthAlertType } from '../../../shared/schemas/health.schema';
import { ForbiddenError, NotFoundError } from '../../lib/errors';
import * as Repo from './health.repository';
import type { HealthAlertRow } from './health-alerts.repository';
import * as AlertRepo from './health-alerts.repository';
import * as GoalRepo from './health-goals.repository';

type DailySummarySnapshot = {
  summaryDate: string;
  stepsTotal: number;
  activeMinutesTotal: number;
  activityCaloriesTotal: number;
  mealCount: number;
  latestBpSystolic: number | null;
  latestBpDiastolic: number | null;
  latestBpPulse: number | null;
  latestBpRecordedAt: string | null;
  latestGlucoseValue: number | null;
  latestGlucoseUnit: string | null;
  latestGlucoseRecordedAt: string | null;
};

type AlertCandidate = {
  userId: string;
  alertKey: string;
  alertType: HealthAlertType;
  severity: HealthAlertSeverity;
  title: string;
  message: string;
  timeZone: string;
  periodStart: string;
  periodEnd: string;
  metricName: string | null;
  currentValue: number | null;
  thresholdValue: number | null;
  goalId: string | null;
};

const normalizeAlert = (row: HealthAlertRow) => ({
  id: row.id,
  alertKey: row.alertKey,
  alertType: row.alertType as HealthAlertType,
  severity: row.severity as HealthAlertSeverity,
  title: row.title,
  message: row.message,
  timeZone: row.timeZone,
  periodStart: String(row.periodStart),
  periodEnd: String(row.periodEnd),
  metricName: row.metricName,
  currentValue: row.currentValue,
  thresholdValue: row.thresholdValue,
  goalId: row.goalId,
  isRead: row.isRead,
  readAt: row.readAt ? row.readAt.toISOString() : null,
  detectedAt: row.detectedAt.toISOString(),
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const buildAlertKey = (
  timeZone: string,
  alertType: string,
  periodStart: string,
  periodEnd: string,
  goalId?: string | null
) => [timeZone, alertType, periodStart, periodEnd, goalId ?? ''].join(':');

const normalizeDailySummary = (
  row: Awaited<ReturnType<typeof Repo.listDailySummaries>>[number]
): DailySummarySnapshot => ({
  summaryDate: String(row.summaryDate),
  stepsTotal: row.stepsTotal,
  activeMinutesTotal: row.activeMinutesTotal,
  activityCaloriesTotal: row.activityCaloriesTotal,
  mealCount: row.mealCount,
  latestBpSystolic: row.latestBpSystolic ?? null,
  latestBpDiastolic: row.latestBpDiastolic ?? null,
  latestBpPulse: row.latestBpPulse ?? null,
  latestBpRecordedAt: row.latestBpRecordedAt ? row.latestBpRecordedAt.toISOString() : null,
  latestGlucoseValue: row.latestGlucoseValue ?? null,
  latestGlucoseUnit: row.latestGlucoseUnit ?? null,
  latestGlucoseRecordedAt: row.latestGlucoseRecordedAt
    ? row.latestGlucoseRecordedAt.toISOString()
    : null,
});

const normalizeAggregateSummary = (
  summaryDate: string,
  aggregate: Awaited<ReturnType<typeof Repo.aggregateDailySummary>>
): DailySummarySnapshot => ({
  summaryDate,
  stepsTotal: aggregate.stepsTotal,
  activeMinutesTotal: aggregate.activeMinutesTotal,
  activityCaloriesTotal: aggregate.activityCaloriesTotal,
  mealCount: aggregate.mealCount,
  latestBpSystolic: aggregate.latestBp?.systolic ?? null,
  latestBpDiastolic: aggregate.latestBp?.diastolic ?? null,
  latestBpPulse: aggregate.latestBp?.pulse ?? null,
  latestBpRecordedAt: aggregate.latestBp?.recordedAt
    ? aggregate.latestBp.recordedAt.toISOString()
    : null,
  latestGlucoseValue: aggregate.latestG?.value ?? null,
  latestGlucoseUnit: aggregate.latestG?.unit ?? null,
  latestGlucoseRecordedAt: aggregate.latestG?.recordedAt
    ? aggregate.latestG.recordedAt.toISOString()
    : null,
});

const loadDailySummaryRange = async (
  userId: string,
  from: string,
  to: string,
  timeZone: string
) => {
  const rows = await Repo.listDailySummaries(userId, from, to);
  const summaries = new Map<string, DailySummarySnapshot>();
  for (const row of rows) {
    summaries.set(String(row.summaryDate), normalizeDailySummary(row));
  }

  let cursor = from;
  while (cursor <= to) {
    if (!summaries.has(cursor)) {
      const aggregate = await Repo.aggregateDailySummary(userId, cursor, timeZone);
      summaries.set(cursor, normalizeAggregateSummary(cursor, aggregate));
    }
    cursor = Repo.addUtcDays(cursor, 1);
  }

  return summaries;
};

const loadLatestBloodPressureByDay = async (userId: string, date: string, timeZone: string) => {
  const from = Repo.addUtcDays(date, -2);
  const toExclusive = Repo.getLocalDayRange(Repo.addUtcDays(date, 1), timeZone).start;
  const rows = await Repo.listBloodPressureInRange(
    userId,
    Repo.getLocalDayRange(from, timeZone).start,
    toExclusive
  );
  const latestByDay = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    const day = Repo.toLocalDateString(row.recordedAt, timeZone);
    if (!latestByDay.has(day)) {
      latestByDay.set(day, row);
    }
  }
  return Array.from({ length: 3 }, (_, index) => {
    const day = Repo.addUtcDays(from, index);
    return { day, row: latestByDay.get(day) ?? null };
  });
};

const loadLatestFastingGlucoseByDay = async (userId: string, date: string, timeZone: string) => {
  const from = Repo.addUtcDays(date, -2);
  const toExclusive = Repo.getLocalDayRange(Repo.addUtcDays(date, 1), timeZone).start;
  const rows = await Repo.listBloodGlucoseInRange(
    userId,
    Repo.getLocalDayRange(from, timeZone).start,
    toExclusive
  );
  const latestByDay = new Map<string, (typeof rows)[number]>();
  for (const row of rows) {
    if (row.timing !== 'fasting') continue;
    const day = Repo.toLocalDateString(row.recordedAt, timeZone);
    if (!latestByDay.has(day)) {
      latestByDay.set(day, row);
    }
  }
  return Array.from({ length: 3 }, (_, index) => {
    const day = Repo.addUtcDays(from, index);
    return { day, row: latestByDay.get(day) ?? null };
  });
};

const upsertAlert = async (candidate: AlertCandidate) => {
  const row = await AlertRepo.upsertHealthAlert({
    userId: candidate.userId,
    alertKey: candidate.alertKey,
    alertType: candidate.alertType,
    severity: candidate.severity,
    title: candidate.title,
    message: candidate.message,
    timeZone: candidate.timeZone,
    periodStart: candidate.periodStart,
    periodEnd: candidate.periodEnd,
    metricName: candidate.metricName,
    currentValue: candidate.currentValue,
    thresholdValue: candidate.thresholdValue,
    goalId: candidate.goalId,
    detectedAt: new Date(),
  });
  return row ? normalizeAlert(row) : null;
};

export const listHealthAlerts = async (
  userId: string,
  opts?: { isRead?: boolean; limit?: number }
) => {
  const rows = await AlertRepo.listHealthAlertsByUser(userId, opts);
  return { records: rows.map(normalizeAlert) };
};

export const markHealthAlertRead = async (userId: string, alertId: string) => {
  const row = await AlertRepo.findHealthAlertById(alertId);
  if (!row) throw new NotFoundError('Health alert not found');
  if (row.userId !== userId) throw new ForbiddenError('Cannot access another user health data');
  const updated = await AlertRepo.markHealthAlertAsRead(alertId);
  if (!updated) throw new Error('markHealthAlertAsRead failed');
  return normalizeAlert(updated);
};

const detectTrendAlerts = async (
  userId: string,
  date: string,
  timeZone: string
): Promise<AlertCandidate[]> => {
  const alerts: AlertCandidate[] = [];
  const bpDays = await loadLatestBloodPressureByDay(userId, date, timeZone);

  if (bpDays.every(({ row }) => row && row.systolic >= 140)) {
    const periodStart = bpDays[0]?.day ?? date;
    const periodEnd = bpDays[bpDays.length - 1]?.day ?? date;
    const currentValue = bpDays[bpDays.length - 1]?.row?.systolic ?? null;
    alerts.push({
      userId,
      alertKey: buildAlertKey(timeZone, 'high_blood_pressure_trend', periodStart, periodEnd),
      alertType: 'high_blood_pressure_trend',
      severity: 'warning',
      title: '高血圧傾向を検出しました',
      message: '直近 3 日間の収縮期血圧が 140 以上です。',
      timeZone,
      periodStart,
      periodEnd,
      metricName: 'systolic',
      currentValue,
      thresholdValue: 140,
      goalId: null,
    });
  }

  if (bpDays.every(({ row }) => row && row.systolic <= 90)) {
    const periodStart = bpDays[0]?.day ?? date;
    const periodEnd = bpDays[bpDays.length - 1]?.day ?? date;
    const currentValue = bpDays[bpDays.length - 1]?.row?.systolic ?? null;
    alerts.push({
      userId,
      alertKey: buildAlertKey(timeZone, 'low_blood_pressure_trend', periodStart, periodEnd),
      alertType: 'low_blood_pressure_trend',
      severity: 'warning',
      title: '低血圧傾向を検出しました',
      message: '直近 3 日間の収縮期血圧が 90 以下です。',
      timeZone,
      periodStart,
      periodEnd,
      metricName: 'systolic',
      currentValue,
      thresholdValue: 90,
      goalId: null,
    });
  }

  const glucoseDays = await loadLatestFastingGlucoseByDay(userId, date, timeZone);

  if (glucoseDays.every(({ row }) => row && row.value >= 126)) {
    const periodStart = glucoseDays[0]?.day ?? date;
    const periodEnd = glucoseDays[glucoseDays.length - 1]?.day ?? date;
    const currentValue = glucoseDays[glucoseDays.length - 1]?.row?.value ?? null;
    alerts.push({
      userId,
      alertKey: buildAlertKey(timeZone, 'high_blood_glucose_trend', periodStart, periodEnd),
      alertType: 'high_blood_glucose_trend',
      severity: 'critical',
      title: '高血糖傾向を検出しました',
      message: '直近 3 日間の空腹時血糖が 126 以上です。',
      timeZone,
      periodStart,
      periodEnd,
      metricName: 'fasting_glucose',
      currentValue,
      thresholdValue: 126,
      goalId: null,
    });
  }

  const activityStart = Repo.addUtcDays(date, -6);
  const activityDaysMap = await loadDailySummaryRange(userId, activityStart, date, timeZone);
  const activityDays = Array.from({ length: 7 }, (_, index) => {
    const day = Repo.addUtcDays(activityStart, index);
    return { day, stepsTotal: activityDaysMap.get(day)?.stepsTotal ?? 0 };
  });

  if (activityDays.every(({ stepsTotal }) => stepsTotal < 3000)) {
    const periodStart = activityDays[0]?.day ?? date;
    const periodEnd = activityDays[activityDays.length - 1]?.day ?? date;
    alerts.push({
      userId,
      alertKey: buildAlertKey(timeZone, 'insufficient_activity', periodStart, periodEnd),
      alertType: 'insufficient_activity',
      severity: 'info',
      title: '運動不足の傾向があります',
      message: '直近 7 日間の歩数が 3,000 歩未満です。',
      timeZone,
      periodStart,
      periodEnd,
      metricName: 'steps',
      currentValue: activityDays[activityDays.length - 1]?.stepsTotal ?? null,
      thresholdValue: 3000,
      goalId: null,
    });
  }

  return alerts;
};

const detectGoalStreakAlerts = async (
  userId: string,
  date: string,
  timeZone: string
): Promise<AlertCandidate[]> => {
  const alerts: AlertCandidate[] = [];
  const goals = await GoalRepo.listActiveHealthGoalsByUser(userId, date);
  const stepGoals = goals.filter(
    (goal) => goal.goalType === 'daily_step_count' && goal.targetValue != null
  );
  const start = Repo.addUtcDays(date, -6);
  const dailySummaries = await loadDailySummaryRange(userId, start, date, timeZone);

  for (const goal of stepGoals) {
    const days = Array.from({ length: 7 }, (_, index) => Repo.addUtcDays(start, index));
    const daySteps = days.map((day) => ({
      day,
      stepsTotal: dailySummaries.get(day)?.stepsTotal ?? 0,
    }));
    if (daySteps.every(({ stepsTotal }) => stepsTotal < (goal.targetValue ?? 0))) {
      alerts.push({
        userId,
        alertKey: buildAlertKey(timeZone, 'goal_unmet_streak', start, date, goal.id),
        alertType: 'goal_unmet_streak',
        severity: 'warning',
        title: '歩数目標が 7 日連続で未達です',
        message: `1 日の歩数目標 ${goal.targetValue?.toLocaleString() ?? ''} 歩を 7 日連続で下回っています。`,
        timeZone,
        periodStart: start,
        periodEnd: date,
        metricName: 'steps',
        currentValue: daySteps[daySteps.length - 1]?.stepsTotal ?? null,
        thresholdValue: goal.targetValue ?? null,
        goalId: goal.id,
      });
    }
  }

  return alerts;
};

export const refreshHealthAlertsForDate = async (
  userId: string,
  date: string,
  timeZone?: string | null
) => {
  const normalizedTimeZone = timeZone ?? 'UTC';
  const [trendAlerts, goalAlerts] = await Promise.all([
    detectTrendAlerts(userId, date, normalizedTimeZone),
    detectGoalStreakAlerts(userId, date, normalizedTimeZone),
  ]);
  const candidates = [...trendAlerts, ...goalAlerts];
  const records = [];
  for (const candidate of candidates) {
    const row = await upsertAlert(candidate);
    if (row) records.push(row);
  }
  return { records };
};
