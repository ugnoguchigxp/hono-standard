import * as Repo from './health.repository';
import * as GoalRepo from './health-goals.repository';
import type { WeeklyHealthReportRow } from './health-reports.repository';
import * as ReportRepo from './health-reports.repository';
import { getLocalWeekStart, toLocalDateString } from './health-timezone';

type WeeklyReportRecord = {
  id: string;
  reportKey: string;
  timeZone: string;
  weekStart: string;
  weekEnd: string;
  generatedAt: string;
  stepsTotal: number;
  avgSteps: number;
  activityCaloriesTotal: number;
  mealCount: number;
  mealCaloriesTotal: number;
  mealCaloriesAverage: number | null;
  avgSystolic: number | null;
  avgDiastolic: number | null;
  bloodPressureSampleCount: number;
  avgFastingGlucose: number | null;
  avgPostprandialGlucose: number | null;
  bloodGlucoseSampleCount: number;
  goalCount: number;
  goalAchievementRateAverage: number | null;
  previousWeekStepsTotal: number;
  stepsDelta: number;
  summary: string | null;
  createdAt: string;
  updatedAt: string;
};

const normalizeReport = (row: WeeklyHealthReportRow): WeeklyReportRecord => ({
  id: row.id,
  reportKey: row.reportKey,
  timeZone: row.timeZone,
  weekStart: String(row.weekStart),
  weekEnd: String(row.weekEnd),
  generatedAt: row.generatedAt.toISOString(),
  stepsTotal: row.stepsTotal,
  avgSteps: row.avgSteps,
  activityCaloriesTotal: row.activityCaloriesTotal,
  mealCount: row.mealCount,
  mealCaloriesTotal: row.mealCaloriesTotal,
  mealCaloriesAverage: row.mealCaloriesAverage ?? null,
  avgSystolic: row.avgSystolic ?? null,
  avgDiastolic: row.avgDiastolic ?? null,
  bloodPressureSampleCount: row.bloodPressureSampleCount,
  avgFastingGlucose: row.avgFastingGlucose ?? null,
  avgPostprandialGlucose: row.avgPostprandialGlucose ?? null,
  bloodGlucoseSampleCount: row.bloodGlucoseSampleCount,
  goalCount: row.goalCount,
  goalAchievementRateAverage: row.goalAchievementRateAverage ?? null,
  previousWeekStepsTotal: row.previousWeekStepsTotal,
  stepsDelta: row.stepsDelta,
  summary: row.summary,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const buildReportKey = (weekStart: string, timeZone: string) => `${timeZone}:${weekStart}`;

const average = (values: number[]): number | null =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

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

const calculateGoalAchievementRates = async (
  userId: string,
  _weekStart: string,
  weekEnd: string,
  _timeZone: string,
  dailySummaries: DailySummarySnapshot[],
  mealCaloriesTotal: number,
  bloodPressureRows: Awaited<ReturnType<typeof Repo.listBloodPressureInRange>>,
  bloodGlucoseRows: Awaited<ReturnType<typeof Repo.listBloodGlucoseInRange>>,
  weightRows: Awaited<ReturnType<typeof Repo.listWeightInRange>>
) => {
  const activeGoals = await GoalRepo.listActiveHealthGoalsByUser(userId, weekEnd);
  const averageDailySteps = average(dailySummaries.map((summary) => summary.stepsTotal)) ?? 0;
  const qualifyingActivityDays = dailySummaries.filter(
    (summary) => summary.stepsTotal >= 3000 || summary.activeMinutesTotal >= 30
  ).length;
  const avgMealCalories = mealCaloriesTotal / 7;
  const avgSystolic = average(bloodPressureRows.map((row) => row.systolic));
  const avgDiastolic = average(bloodPressureRows.map((row) => row.diastolic));
  const fastingRows = bloodGlucoseRows.filter((row) => row.timing === 'fasting');
  const postprandialRows = bloodGlucoseRows.filter((row) => row.timing === 'postprandial');
  const latestWeight = weightRows[0]?.value ?? null;

  const rates: number[] = [];
  for (const goal of activeGoals) {
    if (goal.goalType === 'daily_step_count' && goal.targetValue) {
      rates.push(Math.min(100, Math.max(0, (averageDailySteps / goal.targetValue) * 100)));
      continue;
    }
    if (goal.goalType === 'daily_calorie_limit' && goal.targetValue) {
      if (avgMealCalories <= 0) {
        rates.push(0);
      } else {
        rates.push(Math.min(100, Math.max(0, (goal.targetValue / avgMealCalories) * 100)));
      }
      continue;
    }
    if (goal.goalType === 'blood_pressure_systolic_max' && goal.targetValue) {
      rates.push(
        avgSystolic == null ? 0 : Math.min(100, Math.max(0, (goal.targetValue / avgSystolic) * 100))
      );
      continue;
    }
    if (goal.goalType === 'blood_pressure_diastolic_max' && goal.targetValue) {
      rates.push(
        avgDiastolic == null
          ? 0
          : Math.min(100, Math.max(0, (goal.targetValue / avgDiastolic) * 100))
      );
      continue;
    }
    if (
      goal.goalType === 'blood_glucose_fasting_range' &&
      goal.targetMin != null &&
      goal.targetMax != null
    ) {
      const min = goal.targetMin;
      const max = goal.targetMax;
      const values = fastingRows.map((row) => row.value);
      const rate = values.length
        ? (values.filter((value) => value >= min && value <= max).length / values.length) * 100
        : 0;
      rates.push(rate);
      continue;
    }
    if (
      goal.goalType === 'blood_glucose_postprandial_range' &&
      goal.targetMin != null &&
      goal.targetMax != null
    ) {
      const min = goal.targetMin;
      const max = goal.targetMax;
      const values = postprandialRows.map((row) => row.value);
      const rate = values.length
        ? (values.filter((value) => value >= min && value <= max).length / values.length) * 100
        : 0;
      rates.push(rate);
      continue;
    }
    if (goal.goalType === 'weekly_exercise_days' && goal.targetValue) {
      rates.push(Math.min(100, Math.max(0, (qualifyingActivityDays / goal.targetValue) * 100)));
      continue;
    }
    if (goal.goalType === 'weight_target' && goal.targetValue) {
      if (latestWeight == null) {
        rates.push(0);
      } else {
        rates.push(Math.min(100, Math.max(0, (goal.targetValue / latestWeight) * 100)));
      }
    }
  }

  return {
    goalCount: activeGoals.length,
    goalAchievementRateAverage: average(rates),
  };
};

const calculateWeeklyReport = async (userId: string, weekStart: string, timeZone: string) => {
  const weekEnd = Repo.addUtcDays(weekStart, 6);
  const rangeStart = Repo.getLocalDayRange(weekStart, timeZone).start;
  const rangeEnd = Repo.getLocalDayRange(Repo.addUtcDays(weekEnd, 1), timeZone).start;
  const [
    currentWeekSummaries,
    previousWeekSummaries,
    mealRows,
    bloodPressureRows,
    bloodGlucoseRows,
    weightRows,
  ] = await Promise.all([
    loadDailySummaryRange(userId, weekStart, weekEnd, timeZone),
    loadDailySummaryRange(
      userId,
      Repo.addUtcDays(weekStart, -7),
      Repo.addUtcDays(weekStart, -1),
      timeZone
    ),
    Repo.listMealsInRange(userId, rangeStart, rangeEnd),
    Repo.listBloodPressureInRange(userId, rangeStart, rangeEnd),
    Repo.listBloodGlucoseInRange(userId, rangeStart, rangeEnd),
    Repo.listWeightInRange(userId, rangeStart, rangeEnd),
  ]);
  const dailySummaries = Array.from({ length: 7 }, (_, index) =>
    currentWeekSummaries.get(Repo.addUtcDays(weekStart, index))
  );
  const previousSummaries = Array.from({ length: 7 }, (_, index) =>
    previousWeekSummaries.get(Repo.addUtcDays(Repo.addUtcDays(weekStart, -7), index))
  );
  const stepsTotal = dailySummaries.reduce((sum, summary) => sum + (summary?.stepsTotal ?? 0), 0);
  const activityCaloriesTotal = dailySummaries.reduce(
    (sum, summary) => sum + (summary?.activityCaloriesTotal ?? 0),
    0
  );
  const mealCount = dailySummaries.reduce((sum, summary) => sum + (summary?.mealCount ?? 0), 0);

  const mealCaloriesTotal = mealRows.reduce((sum, meal) => sum + (meal.estimatedCalories ?? 0), 0);
  const mealCaloriesAverage = mealCaloriesTotal / 7;

  const bpSampleCount = bloodPressureRows.length;
  const avgSystolic = average(bloodPressureRows.map((row) => row.systolic));
  const avgDiastolic = average(bloodPressureRows.map((row) => row.diastolic));

  const fastingValues = bloodGlucoseRows
    .filter((row) => row.timing === 'fasting')
    .map((row) => row.value);
  const postValues = bloodGlucoseRows
    .filter((row) => row.timing === 'postprandial')
    .map((row) => row.value);
  const glucoseSampleCount = fastingValues.length + postValues.length;
  const avgFastingGlucose = average(fastingValues);
  const avgPostprandialGlucose = average(postValues);

  const { goalCount, goalAchievementRateAverage } = await calculateGoalAchievementRates(
    userId,
    weekStart,
    weekEnd,
    timeZone,
    dailySummaries.filter((summary): summary is DailySummarySnapshot => summary != null),
    mealCaloriesTotal,
    bloodPressureRows,
    bloodGlucoseRows,
    weightRows
  );

  const previousWeekStepsTotal = previousSummaries.reduce(
    (sum, summary) => sum + (summary?.stepsTotal ?? 0),
    0
  );
  const stepsDelta = stepsTotal - previousWeekStepsTotal;

  return {
    reportKey: buildReportKey(weekStart, timeZone),
    timeZone,
    weekStart,
    weekEnd,
    generatedAt: new Date(),
    stepsTotal,
    avgSteps: stepsTotal / 7,
    activityCaloriesTotal,
    mealCount,
    mealCaloriesTotal,
    mealCaloriesAverage,
    avgSystolic,
    avgDiastolic,
    bloodPressureSampleCount: bpSampleCount,
    avgFastingGlucose,
    avgPostprandialGlucose,
    bloodGlucoseSampleCount: glucoseSampleCount,
    goalCount,
    goalAchievementRateAverage,
    previousWeekStepsTotal,
    stepsDelta,
    summary: `歩数 ${stepsTotal.toLocaleString()}、食事 ${mealCount} 件、目標 ${goalCount} 件`,
  };
};

const upsertWeeklyReport = async (userId: string, weekStart: string, timeZone: string) => {
  const existing = await ReportRepo.findWeeklyHealthReportByKey(
    userId,
    buildReportKey(weekStart, timeZone)
  );
  const snapshot = await calculateWeeklyReport(userId, weekStart, timeZone);
  const row = await ReportRepo.upsertWeeklyHealthReport({
    userId,
    reportKey: snapshot.reportKey,
    timeZone: snapshot.timeZone,
    weekStart: snapshot.weekStart,
    weekEnd: snapshot.weekEnd,
    generatedAt: snapshot.generatedAt,
    stepsTotal: snapshot.stepsTotal,
    avgSteps: snapshot.avgSteps,
    activityCaloriesTotal: snapshot.activityCaloriesTotal,
    mealCount: snapshot.mealCount,
    mealCaloriesTotal: snapshot.mealCaloriesTotal,
    mealCaloriesAverage: snapshot.mealCaloriesAverage,
    avgSystolic: snapshot.avgSystolic,
    avgDiastolic: snapshot.avgDiastolic,
    bloodPressureSampleCount: snapshot.bloodPressureSampleCount,
    avgFastingGlucose: snapshot.avgFastingGlucose,
    avgPostprandialGlucose: snapshot.avgPostprandialGlucose,
    bloodGlucoseSampleCount: snapshot.bloodGlucoseSampleCount,
    goalCount: snapshot.goalCount,
    goalAchievementRateAverage: snapshot.goalAchievementRateAverage,
    previousWeekStepsTotal: snapshot.previousWeekStepsTotal,
    stepsDelta: snapshot.stepsDelta,
    summary: snapshot.summary,
  });
  if (!row) throw new Error('upsertWeeklyReport failed');

  return { report: normalizeReport(row), generated: !existing };
};

export const refreshWeeklyReportForDate = async (
  userId: string,
  date: string,
  timeZone?: string | null
) => {
  const weekStart = getLocalWeekStart(date);
  return upsertWeeklyReport(userId, weekStart, timeZone ?? 'UTC');
};

export const getWeeklyHealthReport = async (
  userId: string,
  weekStart?: string,
  timeZone?: string | null
) => {
  const normalizedTimeZone = timeZone ?? 'UTC';
  const resolvedWeekStart =
    weekStart ?? getLocalWeekStart(toLocalDateString(new Date(), normalizedTimeZone));
  const existing = await ReportRepo.findWeeklyHealthReportByKey(
    userId,
    buildReportKey(resolvedWeekStart, normalizedTimeZone)
  );
  if (existing) {
    return { report: normalizeReport(existing), generated: false };
  }
  return upsertWeeklyReport(userId, resolvedWeekStart, normalizedTimeZone);
};
