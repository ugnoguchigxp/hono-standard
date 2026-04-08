import { createHash } from 'node:crypto';
import type {
  ActivitySyncBody,
  CreateActivityInput,
  CreateBloodGlucoseInput,
  CreateBloodPressureInput,
  CreateHealthGoalInput,
  CreateMealInput,
  CreateWeightInput,
  UpdateHealthGoalInput,
} from '../../../shared/schemas/health.schema';
import { ForbiddenError, NotFoundError, ValidationError } from '../../lib/errors';
import { isUniqueViolation } from '../../lib/pg-errors';
import type {
  ActivityRow,
  BloodGlucoseRow,
  BloodPressureRow,
  MealRow,
  WeightRow,
} from './health.repository';
import * as Repo from './health.repository';
import type { HealthGoalRow } from './health-goals.repository';
import * as GoalRepo from './health-goals.repository';
import { refreshHealthInsightsForDate } from './health-insights.service';
import { toLocalDateString } from './health-timezone';

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

const stableSerialize = (obj: Record<string, unknown>): string => {
  const keys = Object.keys(obj).sort();
  const sorted: Record<string, unknown> = {};
  for (const k of keys) sorted[k] = obj[k];
  return JSON.stringify(sorted);
};

const sha256Hex = (s: string): string => createHash('sha256').update(s, 'utf8').digest('hex');

export const hashBloodPressure = (userId: string, input: CreateBloodPressureInput): string =>
  sha256Hex(
    stableSerialize({
      u: userId,
      t: new Date(input.recordedAt).toISOString(),
      s: input.systolic,
      d: input.diastolic,
      p: input.pulse ?? null,
      k: input.period,
    })
  );

export const hashBloodGlucose = (userId: string, input: CreateBloodGlucoseInput): string =>
  sha256Hex(
    stableSerialize({
      u: userId,
      t: new Date(input.recordedAt).toISOString(),
      v: input.value,
      unit: input.unit,
      timing: input.timing,
    })
  );

export const hashMeal = (userId: string, input: CreateMealInput): string =>
  sha256Hex(
    stableSerialize({
      u: userId,
      t: new Date(input.recordedAt).toISOString(),
      items: input.items,
      cal: input.estimatedCalories ?? null,
    })
  );

export const hashActivity = (userId: string, input: CreateActivityInput): string =>
  sha256Hex(
    stableSerialize({
      u: userId,
      t: new Date(input.recordedAt).toISOString(),
      steps: input.steps ?? null,
      am: input.activeMinutes ?? null,
      cb: input.caloriesBurned ?? null,
      memo: input.memo ?? null,
    })
  );

export const hashWeight = (userId: string, input: CreateWeightInput): string =>
  sha256Hex(
    stableSerialize({
      u: userId,
      t: new Date(input.recordedAt).toISOString(),
      value: input.value,
    })
  );

export const hashActivityItem = (
  userId: string,
  item: ActivitySyncBody['items'][number],
  syncSource?: string
): string =>
  sha256Hex(
    stableSerialize({
      u: userId,
      t: new Date(item.recordedAt).toISOString(),
      steps: item.steps ?? null,
      am: item.activeMinutes ?? null,
      cb: item.caloriesBurned ?? null,
      src: syncSource ?? item.syncSource ?? null,
    })
  );

const toIso = (d: Date): string => d.toISOString();

const mapBp = (r: BloodPressureRow) => ({
  id: r.id,
  recordedAt: toIso(r.recordedAt),
  systolic: r.systolic,
  diastolic: r.diastolic,
  pulse: r.pulse,
  period: r.period as 'morning' | 'evening' | 'other',
  externalId: r.externalId,
  valueHash: r.valueHash,
  inputSource: r.inputSource as 'manual' | 'device' | 'import' | 'api',
  syncSource: r.syncSource,
  memo: r.memo,
  createdAt: toIso(r.createdAt),
  updatedAt: toIso(r.updatedAt),
});

const mapG = (r: BloodGlucoseRow) => ({
  id: r.id,
  recordedAt: toIso(r.recordedAt),
  value: r.value,
  unit: r.unit as 'mg_dl' | 'mmol_l',
  timing: r.timing as 'fasting' | 'postprandial' | 'random',
  externalId: r.externalId,
  valueHash: r.valueHash,
  inputSource: r.inputSource as 'manual' | 'device' | 'import' | 'api',
  syncSource: r.syncSource,
  memo: r.memo,
  createdAt: toIso(r.createdAt),
  updatedAt: toIso(r.updatedAt),
});

const mapMeal = (r: MealRow) => ({
  id: r.id,
  recordedAt: toIso(r.recordedAt),
  items: r.items,
  estimatedCalories: r.estimatedCalories,
  photoUri: r.photoUri,
  externalId: r.externalId,
  valueHash: r.valueHash,
  inputSource: r.inputSource as 'manual' | 'device' | 'import' | 'api',
  syncSource: r.syncSource,
  memo: r.memo,
  createdAt: toIso(r.createdAt),
  updatedAt: toIso(r.updatedAt),
});

const mapWeight = (r: WeightRow) => ({
  id: r.id,
  recordedAt: toIso(r.recordedAt),
  value: r.value,
  externalId: r.externalId,
  valueHash: r.valueHash,
  inputSource: r.inputSource as 'manual' | 'device' | 'import' | 'api',
  syncSource: r.syncSource,
  memo: r.memo,
  createdAt: toIso(r.createdAt),
  updatedAt: toIso(r.updatedAt),
});

const mapAct = (r: ActivityRow) => ({
  id: r.id,
  recordedAt: toIso(r.recordedAt),
  steps: r.steps,
  activeMinutes: r.activeMinutes,
  caloriesBurned: r.caloriesBurned,
  externalId: r.externalId,
  valueHash: r.valueHash,
  inputSource: r.inputSource as 'manual' | 'device' | 'import' | 'api',
  syncSource: r.syncSource,
  memo: r.memo,
  createdAt: toIso(r.createdAt),
  updatedAt: toIso(r.updatedAt),
});

const defaultRangeTo = (timeZone?: string | null): string =>
  toLocalDateString(new Date(), timeZone);

const defaultRangeFrom = (toStr: string): string => Repo.addUtcDays(toStr, -30);

const goalTypesWithRange = new Set([
  'blood_glucose_fasting_range',
  'blood_glucose_postprandial_range',
]);

const weeklyGoalTypes = new Set(['weekly_exercise_days']);

const defaultGoalPeriod = (goalType: CreateHealthGoalInput['goalType']): 'daily' | 'weekly' =>
  weeklyGoalTypes.has(goalType) ? 'weekly' : 'daily';

const toIsoDate = (value: string | Date | null | undefined): string | null => {
  if (value == null) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  return value.toISOString().slice(0, 10);
};

const normalizeGoalRow = (row: HealthGoalRow) => ({
  id: row.id,
  goalType: row.goalType as CreateHealthGoalInput['goalType'],
  period: row.period as 'daily' | 'weekly',
  targetValue: row.targetValue,
  targetMin: row.targetMin,
  targetMax: row.targetMax,
  startsOn: toIsoDate(row.startsOn) ?? '',
  endsOn: toIsoDate(row.endsOn),
  isActive: row.isActive,
  memo: row.memo,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const assertGoalShape = (goal: {
  goalType: CreateHealthGoalInput['goalType'];
  period?: 'daily' | 'weekly';
  targetValue: number | null;
  targetMin: number | null;
  targetMax: number | null;
  startsOn?: string;
  endsOn?: string | null;
}) => {
  if (goalTypesWithRange.has(goal.goalType)) {
    if (goal.targetMin == null || goal.targetMax == null) {
      throw new ValidationError('targetMin と targetMax は必須です');
    }
    if (goal.targetMin > goal.targetMax) {
      throw new ValidationError('targetMax は targetMin 以上である必要があります');
    }
  } else if (goal.targetValue == null) {
    throw new ValidationError('targetValue は必須です');
  }
  if (goal.goalType === 'weekly_exercise_days') {
    if (goal.period && goal.period !== 'weekly') {
      throw new ValidationError('weekly_exercise_days は weekly 期間である必要があります');
    }
  } else if (goal.period && goal.period !== 'daily') {
    throw new ValidationError('この目標種別は daily 期間である必要があります');
  }
  if (goal.startsOn && goal.endsOn && goal.endsOn < goal.startsOn) {
    throw new ValidationError('endsOn は startsOn 以降の日付である必要があります');
  }
};

const resolveGoalInput = (
  input: CreateHealthGoalInput | UpdateHealthGoalInput,
  existing?: HealthGoalRow | null
) => {
  const goalType = (input.goalType ?? existing?.goalType) as
    | CreateHealthGoalInput['goalType']
    | undefined;
  if (!goalType) throw new ValidationError('goalType は必須です');
  const period = (input.period ?? existing?.period ?? defaultGoalPeriod(goalType)) as
    | 'daily'
    | 'weekly';
  const targetValue = input.targetValue ?? existing?.targetValue ?? null;
  const targetMin = input.targetMin ?? existing?.targetMin ?? null;
  const targetMax = input.targetMax ?? existing?.targetMax ?? null;
  const startsOn =
    input.startsOn ?? (existing ? (toIsoDate(existing.startsOn) ?? undefined) : undefined);
  if (!startsOn) throw new ValidationError('startsOn は必須です');
  const endsOn = input.endsOn ?? (existing ? toIsoDate(existing.endsOn) : null);
  const isActive = input.isActive ?? existing?.isActive ?? true;
  const memo = input.memo ?? existing?.memo ?? null;

  assertGoalShape({ goalType, period, targetValue, targetMin, targetMax, startsOn, endsOn });

  return {
    goalType,
    period,
    targetValue,
    targetMin,
    targetMax,
    startsOn,
    endsOn,
    isActive,
    memo,
  };
};

const clampPercentage = (value: number): number => Math.max(0, Math.min(100, value));

const getDailySummarySnapshot = async (userId: string, date: string, timeZone?: string | null) => {
  const summaries = await Repo.listDailySummaries(userId, date, date);
  const summary = summaries[0];
  if (summary) return summary;
  const agg = await Repo.aggregateDayMetrics(userId, date, timeZone);
  return {
    summaryDate: date,
    stepsTotal: agg.stepsTotal,
    activeMinutesTotal: agg.activeMinutesTotal,
    activityCaloriesTotal: 0,
    mealCount: agg.mealCount,
    latestBpSystolic: null,
    latestBpDiastolic: null,
    latestBpPulse: null,
    latestBpRecordedAt: null,
    latestGlucoseValue: null,
    latestGlucoseUnit: null,
    latestGlucoseRecordedAt: null,
  };
};

const normalizeDailySummary = (
  row: Awaited<ReturnType<typeof Repo.listDailySummaries>>[number]
): DailySummarySnapshot => {
  const summaryDate = String(row.summaryDate);

  return {
    summaryDate,
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
  };
};

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

const recalculateDerivedHealthData = async (
  userId: string,
  date: string,
  timeZone?: string | null
) => {
  await Repo.aggregateDailySummary(userId, date, timeZone);
  await refreshHealthInsightsForDate(userId, date, timeZone);
};

const recalculateDerivedHealthDataForDays = async (
  userId: string,
  days: Array<{ date: string; timeZone?: string | null }>
) => {
  const seen = new Set<string>();
  for (const { date, timeZone } of days) {
    const key = `${date}::${timeZone ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    await recalculateDerivedHealthData(userId, date, timeZone);
  }
};

export const createBloodPressure = async (userId: string, input: CreateBloodPressureInput) => {
  const timeZone = input.timeZone ?? 'UTC';
  const valueHash = input.valueHash ?? hashBloodPressure(userId, input);
  const existing = await Repo.findBloodPressureByExternalOrHash(
    userId,
    input.externalId,
    valueHash
  );
  if (existing) {
    return { record: mapBp(existing), duplicate: true as const };
  }
  try {
    const row = await Repo.insertBloodPressure({
      userId,
      recordedAt: new Date(input.recordedAt),
      timeZone,
      externalId: input.externalId ?? null,
      valueHash,
      inputSource: input.inputSource,
      syncSource: input.syncSource ?? null,
      memo: input.memo ?? null,
      systolic: input.systolic,
      diastolic: input.diastolic,
      pulse: input.pulse ?? null,
      period: input.period,
    });
    if (!row) throw new Error('insertBloodPressure returned no row');
    const day = toLocalDateString(row.recordedAt, timeZone);
    await recalculateDerivedHealthData(userId, day, timeZone);
    return { record: mapBp(row), duplicate: false as const };
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    const row = await Repo.findBloodPressureByExternalOrHash(userId, input.externalId, valueHash);
    if (!row) throw e;
    return { record: mapBp(row), duplicate: true as const };
  }
};

export const listBloodPressure = async (
  userId: string,
  from?: string,
  to?: string,
  timeZone?: string | null
) => {
  const toStr = to ?? defaultRangeTo(timeZone);
  const fromStr = from ?? defaultRangeFrom(toStr);
  const fromDate = Repo.getLocalDayRange(fromStr, timeZone).start;
  const toExclusive = Repo.getLocalDayRange(toStr, timeZone).endExclusive;
  const rows = await Repo.listBloodPressureInRange(userId, fromDate, toExclusive);
  return { records: rows.map(mapBp) };
};

export const getBloodPressureById = async (userId: string, id: string) => {
  const row = await Repo.findBloodPressureById(id);
  if (!row) throw new NotFoundError('Blood pressure record not found');
  if (row.userId !== userId) throw new ForbiddenError('Cannot access another user health data');
  return mapBp(row);
};

export const updateBloodPressure = async (
  userId: string,
  id: string,
  input: Partial<CreateBloodPressureInput>
) => {
  const existing = await Repo.findBloodPressureById(id);
  if (!existing) throw new NotFoundError('Blood pressure record not found');
  if (existing.userId !== userId)
    throw new ForbiddenError('Cannot access another user health data');
  const previousDay = toLocalDateString(existing.recordedAt, existing.timeZone);
  const timeZone = input.timeZone ?? existing.timeZone;
  const row = await Repo.updateBloodPressure(id, {
    recordedAt: input.recordedAt ? new Date(input.recordedAt) : undefined,
    timeZone,
    systolic: input.systolic,
    diastolic: input.diastolic,
    pulse: input.pulse,
    period: input.period,
    memo: input.memo,
  });
  if (!row) throw new Error('updateBloodPressure failed');
  const day = toLocalDateString(row.recordedAt, timeZone);
  await recalculateDerivedHealthDataForDays(userId, [
    { date: previousDay, timeZone: existing.timeZone },
    { date: day, timeZone },
  ]);
  return mapBp(row);
};

export const deleteBloodPressure = async (userId: string, id: string) => {
  const existing = await Repo.findBloodPressureById(id);
  if (!existing) throw new NotFoundError('Blood pressure record not found');
  if (existing.userId !== userId)
    throw new ForbiddenError('Cannot access another user health data');
  await Repo.deleteBloodPressure(id);
  const day = toLocalDateString(existing.recordedAt, existing.timeZone);
  await recalculateDerivedHealthData(userId, day, existing.timeZone);
};

export const createBloodGlucose = async (userId: string, input: CreateBloodGlucoseInput) => {
  const timeZone = input.timeZone ?? 'UTC';
  const valueHash = input.valueHash ?? hashBloodGlucose(userId, input);
  const existing = await Repo.findGlucoseByExternalOrHash(userId, input.externalId, valueHash);
  if (existing) {
    return { record: mapG(existing), duplicate: true as const };
  }
  try {
    const row = await Repo.insertBloodGlucose({
      userId,
      recordedAt: new Date(input.recordedAt),
      timeZone,
      externalId: input.externalId ?? null,
      valueHash,
      inputSource: input.inputSource,
      syncSource: input.syncSource ?? null,
      memo: input.memo ?? null,
      value: input.value,
      unit: input.unit,
      timing: input.timing,
    });
    if (!row) throw new Error('insertBloodGlucose returned no row');
    const day = toLocalDateString(row.recordedAt, timeZone);
    await recalculateDerivedHealthData(userId, day, timeZone);
    return { record: mapG(row), duplicate: false as const };
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    const row = await Repo.findGlucoseByExternalOrHash(userId, input.externalId, valueHash);
    if (!row) throw e;
    return { record: mapG(row), duplicate: true as const };
  }
};

export const listBloodGlucose = async (
  userId: string,
  from?: string,
  to?: string,
  timeZone?: string | null
) => {
  const toStr = to ?? defaultRangeTo(timeZone);
  const fromStr = from ?? defaultRangeFrom(toStr);
  const fromDate = Repo.getLocalDayRange(fromStr, timeZone).start;
  const toExclusive = Repo.getLocalDayRange(toStr, timeZone).endExclusive;
  const rows = await Repo.listBloodGlucoseInRange(userId, fromDate, toExclusive);
  return { records: rows.map(mapG) };
};

export const getBloodGlucoseById = async (userId: string, id: string) => {
  const row = await Repo.findGlucoseById(id);
  if (!row) throw new NotFoundError('Blood glucose record not found');
  if (row.userId !== userId) throw new ForbiddenError('Cannot access another user health data');
  return mapG(row);
};

export const updateBloodGlucose = async (
  userId: string,
  id: string,
  input: Partial<CreateBloodGlucoseInput>
) => {
  const existing = await Repo.findGlucoseById(id);
  if (!existing) throw new NotFoundError('Blood glucose record not found');
  if (existing.userId !== userId)
    throw new ForbiddenError('Cannot access another user health data');
  const previousDay = toLocalDateString(existing.recordedAt, existing.timeZone);
  const timeZone = input.timeZone ?? existing.timeZone;
  const row = await Repo.updateBloodGlucose(id, {
    recordedAt: input.recordedAt ? new Date(input.recordedAt) : undefined,
    timeZone,
    value: input.value,
    unit: input.unit,
    timing: input.timing,
    memo: input.memo,
  });
  if (!row) throw new Error('updateBloodGlucose failed');
  const day = toLocalDateString(row.recordedAt, timeZone);
  await recalculateDerivedHealthDataForDays(userId, [
    { date: previousDay, timeZone: existing.timeZone },
    { date: day, timeZone },
  ]);
  return mapG(row);
};

export const deleteBloodGlucose = async (userId: string, id: string) => {
  const existing = await Repo.findGlucoseById(id);
  if (!existing) throw new NotFoundError('Blood glucose record not found');
  if (existing.userId !== userId)
    throw new ForbiddenError('Cannot access another user health data');
  await Repo.deleteBloodGlucose(id);
  const day = toLocalDateString(existing.recordedAt, existing.timeZone);
  await recalculateDerivedHealthData(userId, day, existing.timeZone);
};

export const createMeal = async (userId: string, input: CreateMealInput) => {
  const timeZone = input.timeZone ?? 'UTC';
  const valueHash = input.valueHash ?? hashMeal(userId, input);
  const existing = await Repo.findMealByExternalOrHash(userId, input.externalId, valueHash);
  if (existing) {
    return { record: mapMeal(existing), duplicate: true as const };
  }
  try {
    const row = await Repo.insertMeal({
      userId,
      recordedAt: new Date(input.recordedAt),
      timeZone,
      externalId: input.externalId ?? null,
      valueHash,
      inputSource: input.inputSource,
      syncSource: input.syncSource ?? null,
      memo: input.memo ?? null,
      items: input.items,
      estimatedCalories: input.estimatedCalories ?? null,
      photoUri: input.photoUri ?? null,
    });
    if (!row) throw new Error('insertMeal returned no row');
    const day = toLocalDateString(row.recordedAt, timeZone);
    await recalculateDerivedHealthData(userId, day, timeZone);
    return { record: mapMeal(row), duplicate: false as const };
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    const row = await Repo.findMealByExternalOrHash(userId, input.externalId, valueHash);
    if (!row) throw e;
    return { record: mapMeal(row), duplicate: true as const };
  }
};

export const listMeals = async (
  userId: string,
  from?: string,
  to?: string,
  timeZone?: string | null
) => {
  const toStr = to ?? defaultRangeTo(timeZone);
  const fromStr = from ?? defaultRangeFrom(toStr);
  const fromDate = Repo.getLocalDayRange(fromStr, timeZone).start;
  const toExclusive = Repo.getLocalDayRange(toStr, timeZone).endExclusive;
  const rows = await Repo.listMealsInRange(userId, fromDate, toExclusive);
  return { records: rows.map(mapMeal) };
};

export const updateMeal = async (userId: string, id: string, input: Partial<CreateMealInput>) => {
  const existing = await Repo.findMealById(id);
  if (!existing) throw new NotFoundError('Meal record not found');
  if (existing.userId !== userId)
    throw new ForbiddenError('Cannot access another user health data');

  const previousDay = toLocalDateString(existing.recordedAt, existing.timeZone);
  const timeZone = input.timeZone ?? existing.timeZone;
  const row = await Repo.updateMeal(id, {
    recordedAt: input.recordedAt ? new Date(input.recordedAt) : undefined,
    timeZone,
    items: input.items,
    estimatedCalories: input.estimatedCalories,
    photoUri: input.photoUri,
    memo: input.memo,
  });
  if (!row) throw new Error('updateMeal failed');
  const day = toLocalDateString(row.recordedAt, timeZone);
  await recalculateDerivedHealthDataForDays(userId, [
    { date: previousDay, timeZone: existing.timeZone },
    { date: day, timeZone },
  ]);
  return mapMeal(row);
};

export const createActivity = async (userId: string, input: CreateActivityInput) => {
  const timeZone = input.timeZone ?? 'UTC';
  const valueHash = input.valueHash ?? hashActivity(userId, input);
  const existing = await Repo.findActivityByExternalOrHash(userId, input.externalId, valueHash);
  if (existing) {
    return { record: mapAct(existing), duplicate: true as const };
  }
  try {
    const row = await Repo.insertActivity({
      userId,
      recordedAt: new Date(input.recordedAt),
      timeZone,
      externalId: input.externalId ?? null,
      valueHash,
      inputSource: input.inputSource,
      syncSource: input.syncSource ?? null,
      memo: input.memo ?? null,
      steps: input.steps ?? null,
      activeMinutes: input.activeMinutes ?? null,
      caloriesBurned: input.caloriesBurned ?? null,
    });
    if (!row) throw new Error('insertActivity returned no row');
    const day = toLocalDateString(row.recordedAt, timeZone);
    await recalculateDerivedHealthData(userId, day, timeZone);
    return { record: mapAct(row), duplicate: false as const };
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    const row = await Repo.findActivityByExternalOrHash(userId, input.externalId, valueHash);
    if (!row) throw e;
    return { record: mapAct(row), duplicate: true as const };
  }
};

export const updateActivity = async (
  userId: string,
  id: string,
  input: Partial<CreateActivityInput>
) => {
  const existing = await Repo.findActivityById(id);
  if (!existing) throw new NotFoundError('Activity record not found');
  if (existing.userId !== userId)
    throw new ForbiddenError('Cannot access another user health data');
  const previousDay = toLocalDateString(existing.recordedAt, existing.timeZone);
  const timeZone = input.timeZone ?? existing.timeZone;
  const row = await Repo.updateActivity(id, {
    recordedAt: input.recordedAt ? new Date(input.recordedAt) : undefined,
    timeZone,
    steps: input.steps,
    activeMinutes: input.activeMinutes,
    caloriesBurned: input.caloriesBurned,
    memo: input.memo,
  });
  if (!row) throw new Error('updateActivity failed');
  const day = toLocalDateString(row.recordedAt, timeZone);
  await recalculateDerivedHealthDataForDays(userId, [
    { date: previousDay, timeZone: existing.timeZone },
    { date: day, timeZone },
  ]);
  return mapAct(row);
};

export const deleteActivity = async (userId: string, id: string) => {
  const existing = await Repo.findActivityById(id);
  if (!existing) throw new NotFoundError('Activity record not found');
  if (existing.userId !== userId)
    throw new ForbiddenError('Cannot access another user health data');
  await Repo.deleteActivity(id);
  const day = toLocalDateString(existing.recordedAt, existing.timeZone);
  await recalculateDerivedHealthData(userId, day, existing.timeZone);
};

export const createWeight = async (userId: string, input: CreateWeightInput) => {
  const timeZone = input.timeZone ?? 'UTC';
  const valueHash = input.valueHash ?? hashWeight(userId, input);
  const existing = await Repo.findWeightByExternalOrHash(userId, input.externalId, valueHash);
  if (existing) {
    return { record: mapWeight(existing), duplicate: true as const };
  }
  try {
    const row = await Repo.insertWeight({
      userId,
      recordedAt: new Date(input.recordedAt),
      timeZone,
      externalId: input.externalId ?? null,
      valueHash,
      inputSource: input.inputSource,
      syncSource: input.syncSource ?? null,
      memo: input.memo ?? null,
      value: input.value,
    });
    if (!row) throw new Error('insertWeight returned no row');
    const day = toLocalDateString(row.recordedAt, timeZone);
    await recalculateDerivedHealthData(userId, day, timeZone);
    return { record: mapWeight(row), duplicate: false as const };
  } catch (e) {
    if (!isUniqueViolation(e)) throw e;
    const row = await Repo.findWeightByExternalOrHash(userId, input.externalId, valueHash);
    if (!row) throw e;
    return { record: mapWeight(row), duplicate: true as const };
  }
};

export const listWeight = async (
  userId: string,
  from?: string,
  to?: string,
  timeZone?: string | null
) => {
  const toStr = to ?? defaultRangeTo(timeZone);
  const fromStr = from ?? defaultRangeFrom(toStr);
  const fromDate = Repo.getLocalDayRange(fromStr, timeZone).start;
  const toExclusive = Repo.getLocalDayRange(toStr, timeZone).endExclusive;
  const rows = await Repo.listWeightInRange(userId, fromDate, toExclusive);
  return { records: rows.map(mapWeight) };
};

export const getWeightById = async (userId: string, id: string) => {
  const row = await Repo.findWeightById(id);
  if (!row) throw new NotFoundError('Weight record not found');
  if (row.userId !== userId) throw new ForbiddenError('Cannot access another user health data');
  return mapWeight(row);
};

export const updateWeight = async (
  userId: string,
  id: string,
  input: Partial<CreateWeightInput>
) => {
  const existing = await Repo.findWeightById(id);
  if (!existing) throw new NotFoundError('Weight record not found');
  if (existing.userId !== userId)
    throw new ForbiddenError('Cannot access another user health data');
  const previousDay = toLocalDateString(existing.recordedAt, existing.timeZone);
  const timeZone = input.timeZone ?? existing.timeZone;
  const row = await Repo.updateWeight(id, {
    recordedAt: input.recordedAt ? new Date(input.recordedAt) : undefined,
    timeZone,
    value: input.value,
    memo: input.memo,
  });
  if (!row) throw new Error('updateWeight failed');
  const day = toLocalDateString(row.recordedAt, timeZone);
  await recalculateDerivedHealthDataForDays(userId, [
    { date: previousDay, timeZone: existing.timeZone },
    { date: day, timeZone },
  ]);
  return mapWeight(row);
};

export const deleteWeight = async (userId: string, id: string) => {
  const existing = await Repo.findWeightById(id);
  if (!existing) throw new NotFoundError('Weight record not found');
  if (existing.userId !== userId)
    throw new ForbiddenError('Cannot access another user health data');
  await Repo.deleteWeight(id);
  const day = toLocalDateString(existing.recordedAt, existing.timeZone);
  await recalculateDerivedHealthData(userId, day, existing.timeZone);
};

export const deleteMeal = async (userId: string, id: string) => {
  const existing = await Repo.findMealById(id);
  if (!existing) throw new NotFoundError('Meal record not found');
  if (existing.userId !== userId)
    throw new ForbiddenError('Cannot access another user health data');

  await Repo.deleteMeal(id);
  const day = toLocalDateString(existing.recordedAt, existing.timeZone);
  await recalculateDerivedHealthData(userId, day, existing.timeZone);
};

export const syncActivity = async (userId: string, body: ActivitySyncBody) => {
  const provider = body.syncSource ?? body.items[0]?.syncSource ?? 'activity_sync';
  let inserted = 0;
  let duplicates = 0;
  const out: ReturnType<typeof mapAct>[] = [];

  for (const item of body.items) {
    const itemSync = body.syncSource ?? item.syncSource;
    const timeZone = item.timeZone ?? 'UTC';
    const valueHash = item.valueHash ?? hashActivityItem(userId, item, body.syncSource);
    const existing = await Repo.findActivityByExternalOrHash(userId, item.externalId, valueHash);
    if (existing) {
      duplicates += 1;
      out.push(mapAct(existing));
      continue;
    }
    try {
      const row = await Repo.insertActivity({
        userId,
        recordedAt: new Date(item.recordedAt),
        timeZone,
        externalId: item.externalId ?? null,
        valueHash,
        inputSource: item.inputSource,
        syncSource: itemSync ?? null,
        memo: item.memo ?? null,
        steps: item.steps ?? null,
        activeMinutes: item.activeMinutes ?? null,
        caloriesBurned: item.caloriesBurned ?? null,
      });
      if (!row) throw new Error('insertActivity returned no row');
      inserted += 1;
      out.push(mapAct(row));
      const day = toLocalDateString(row.recordedAt, timeZone);
      await recalculateDerivedHealthData(userId, day, timeZone);
    } catch (e) {
      if (!isUniqueViolation(e)) throw e;
      const row = await Repo.findActivityByExternalOrHash(userId, item.externalId, valueHash);
      if (!row) throw e;
      duplicates += 1;
      out.push(mapAct(row));
    }
  }

  await Repo.upsertHealthSyncState(userId, provider);

  return { records: out, inserted, duplicates };
};

export const listActivity = async (
  userId: string,
  from?: string,
  to?: string,
  timeZone?: string | null
) => {
  const toStr = to ?? defaultRangeTo(timeZone);
  const fromStr = from ?? defaultRangeFrom(toStr);
  const fromDate = Repo.getLocalDayRange(fromStr, timeZone).start;
  const toExclusive = Repo.getLocalDayRange(toStr, timeZone).endExclusive;
  const rows = await Repo.listActivityInRange(userId, fromDate, toExclusive);
  return { records: rows.map(mapAct) };
};

export const getDailyActivity = async (userId: string, date?: string, timeZone?: string | null) => {
  const d = date ?? defaultRangeTo(timeZone);
  const { records, stepsTotal, activeMinutesTotal, caloriesBurnedTotal } =
    await Repo.aggregateDayMetrics(userId, d, timeZone);
  return {
    date: d,
    stepsTotal,
    activeMinutesTotal,
    caloriesBurnedTotal,
    records: records.map(mapAct),
  };
};

export const getDailySummary = async (userId: string, date?: string, timeZone?: string | null) => {
  const d = date ?? defaultRangeTo(timeZone);
  const agg = await Repo.aggregateDailySummary(userId, d, timeZone);
  return {
    date: d,
    stepsTotal: agg.stepsTotal,
    activeMinutesTotal: agg.activeMinutesTotal,
    activityCaloriesTotal: agg.activityCaloriesTotal,
    mealCount: agg.mealCount,
    latestBloodPressure: agg.latestBp ? mapBp(agg.latestBp) : null,
    latestBloodGlucose: agg.latestG ? mapG(agg.latestG) : null,
  };
};

export const getWeeklySummary = async (
  userId: string,
  weekStart: string,
  timeZone?: string | null
) => {
  const days: {
    date: string;
    stepsTotal: number;
    mealCount: number;
  }[] = [];

  for (let i = 0; i < 7; i++) {
    const dateStr = Repo.addUtcDays(weekStart, i);
    const m = await Repo.aggregateDayMetrics(userId, dateStr, timeZone);
    days.push({
      date: dateStr,
      stepsTotal: m.stepsTotal,
      mealCount: m.mealCount,
    });
  }

  const weekEnd = Repo.addUtcDays(weekStart, 6);
  const from = Repo.getLocalDayRange(weekStart, timeZone).start;
  const toExclusive = Repo.getLocalDayRange(Repo.addUtcDays(weekEnd, 1), timeZone).start;

  const bpRows = await Repo.listBloodPressureInRange(userId, from, toExclusive);
  const bloodPressureSampleCount = bpRows.length;
  const avgSystolic = bloodPressureSampleCount
    ? bpRows.reduce((s, r) => s + r.systolic, 0) / bloodPressureSampleCount
    : null;
  const avgDiastolic = bloodPressureSampleCount
    ? bpRows.reduce((s, r) => s + r.diastolic, 0) / bloodPressureSampleCount
    : null;

  return {
    weekStart,
    weekEnd,
    days,
    avgSystolic,
    avgDiastolic,
    bloodPressureSampleCount,
  };
};

export const getMonthlySummary = async (userId: string, yearMonth: string) => {
  const from = `${yearMonth}-01`;
  const [year, month] = yearMonth.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${yearMonth}-${lastDay.toString().padStart(2, '0')}`;

  const summaries = await Repo.listDailySummaries(userId, from, to);

  let stepsTotal = 0;
  let activityCaloriesTotal = 0;
  let mealCount = 0;
  for (const s of summaries) {
    stepsTotal += s.stepsTotal;
    activityCaloriesTotal += s.activityCaloriesTotal;
    mealCount += s.mealCount;
  }

  return {
    yearMonth,
    days: summaries.map((s) => ({
      date: s.summaryDate,
      stepsTotal: s.stepsTotal,
      mealCount: s.mealCount,
    })),
    stepsTotal,
    activityCaloriesTotal,
    mealCount,
    avgSteps: summaries.length ? Math.round(stepsTotal / summaries.length) : 0,
  };
};

export const createHealthGoal = async (userId: string, input: CreateHealthGoalInput) => {
  const normalized = resolveGoalInput(input);
  const row = await GoalRepo.insertHealthGoal({
    userId,
    goalType: normalized.goalType,
    period: normalized.period,
    targetValue: normalized.targetValue,
    targetMin: normalized.targetMin,
    targetMax: normalized.targetMax,
    startsOn: normalized.startsOn,
    endsOn: normalized.endsOn,
    isActive: normalized.isActive,
    memo: normalized.memo,
  });
  if (!row) throw new Error('insertHealthGoal returned no row');
  return normalizeGoalRow(row);
};

export const listHealthGoals = async (userId: string) => {
  const rows = await GoalRepo.listHealthGoalsByUser(userId);
  return { records: rows.map(normalizeGoalRow) };
};

export const getHealthGoalById = async (userId: string, id: string) => {
  const row = await GoalRepo.findHealthGoalById(id);
  if (!row) throw new NotFoundError('Health goal not found');
  if (row.userId !== userId) throw new ForbiddenError('Cannot access another user health data');
  return normalizeGoalRow(row);
};

export const updateHealthGoal = async (
  userId: string,
  id: string,
  input: UpdateHealthGoalInput
) => {
  const existing = await GoalRepo.findHealthGoalById(id);
  if (!existing) throw new NotFoundError('Health goal not found');
  if (existing.userId !== userId)
    throw new ForbiddenError('Cannot access another user health data');

  const normalized = resolveGoalInput(input, existing);
  const row = await GoalRepo.updateHealthGoal(id, {
    goalType: normalized.goalType,
    period: normalized.period,
    targetValue: normalized.targetValue,
    targetMin: normalized.targetMin,
    targetMax: normalized.targetMax,
    startsOn: normalized.startsOn,
    endsOn: normalized.endsOn,
    isActive: normalized.isActive,
    memo: normalized.memo,
  });
  if (!row) throw new Error('updateHealthGoal failed');
  return normalizeGoalRow(row);
};

export const deleteHealthGoal = async (userId: string, id: string) => {
  const existing = await GoalRepo.findHealthGoalById(id);
  if (!existing) throw new NotFoundError('Health goal not found');
  if (existing.userId !== userId)
    throw new ForbiddenError('Cannot access another user health data');
  await GoalRepo.deleteHealthGoal(id);
};

export const getHealthGoalAchievements = async (
  userId: string,
  asOfDate?: string,
  timeZone?: string | null
) => {
  const date = asOfDate ?? defaultRangeTo(timeZone);
  const goals = await GoalRepo.listActiveHealthGoalsByUser(userId, date);
  const goalTypes = new Set(goals.map((goal) => goal.goalType));
  const currentSummary = await getDailySummarySnapshot(userId, date, timeZone);
  const hasCalorieGoal = goalTypes.has('daily_calorie_limit');
  const hasGlucoseGoal =
    goalTypes.has('blood_glucose_fasting_range') ||
    goalTypes.has('blood_glucose_postprandial_range');
  const hasWeeklyExerciseGoal = goalTypes.has('weekly_exercise_days');
  const hasWeightGoal = goalTypes.has('weight_target');
  const currentMealRows = hasCalorieGoal
    ? await Repo.listMealsInRange(
        userId,
        Repo.getLocalDayRange(date, timeZone).start,
        Repo.getLocalDayRange(date, timeZone).endExclusive
      )
    : [];
  const currentGlucoseRows = hasGlucoseGoal
    ? await Repo.listBloodGlucoseInRange(
        userId,
        Repo.getLocalDayRange(date, timeZone).start,
        Repo.getLocalDayRange(date, timeZone).endExclusive
      )
    : [];
  const currentWeightRows = hasWeightGoal
    ? await Repo.listWeightInRange(
        userId,
        Repo.getLocalDayRange(date, timeZone).start,
        Repo.getLocalDayRange(date, timeZone).endExclusive
      )
    : [];
  const weeklySummaries = hasWeeklyExerciseGoal
    ? await loadDailySummaryRange(userId, Repo.addUtcDays(date, -6), date, timeZone ?? 'UTC')
    : null;
  const items = [];
  const mealCaloriesTotal = currentMealRows.reduce(
    (sum, meal) => sum + (meal.estimatedCalories ?? 0),
    0
  );

  for (const goal of goals) {
    const normalizedGoal = normalizeGoalRow(goal);
    let currentValue: number | null = null;
    let achievementRate = 0;
    let achieved = false;
    let details: string | null = null;

    if (goal.goalType === 'daily_step_count') {
      currentValue = currentSummary.stepsTotal;
      const target = goal.targetValue ?? 0;
      achieved = target > 0 ? currentValue >= target : false;
      achievementRate = target > 0 ? clampPercentage((currentValue / target) * 100) : 0;
      details = `steps ${currentValue}/${target}`;
    } else if (goal.goalType === 'daily_calorie_limit') {
      currentValue = mealCaloriesTotal;
      const target = goal.targetValue ?? 0;
      achieved = target > 0 ? currentValue <= target : false;
      achievementRate =
        target > 0 ? clampPercentage((target / Math.max(currentValue, 1)) * 100) : 0;
      details = `calories ${currentValue}/${target}`;
    } else if (
      goal.goalType === 'blood_pressure_systolic_max' ||
      goal.goalType === 'blood_pressure_diastolic_max'
    ) {
      const systolic = currentSummary.latestBpSystolic ?? null;
      const diastolic = currentSummary.latestBpDiastolic ?? null;
      currentValue = goal.goalType === 'blood_pressure_systolic_max' ? systolic : diastolic;
      const target = goal.targetValue ?? 0;
      achieved = currentValue != null ? currentValue <= target : false;
      achievementRate =
        currentValue != null && target > 0
          ? clampPercentage((target / Math.max(currentValue, 1)) * 100)
          : 0;
      details =
        currentValue != null ? `latest ${currentValue}/${target}` : 'no blood pressure record';
    } else if (
      goal.goalType === 'blood_glucose_fasting_range' ||
      goal.goalType === 'blood_glucose_postprandial_range'
    ) {
      const timing = goal.goalType === 'blood_glucose_fasting_range' ? 'fasting' : 'postprandial';
      const glucose = currentGlucoseRows.find((row) => row.timing === timing);
      currentValue = glucose?.value ?? null;
      const min = goal.targetMin ?? 0;
      const max = goal.targetMax ?? 0;
      achieved = currentValue != null ? currentValue >= min && currentValue <= max : false;
      achievementRate = achieved ? 100 : 0;
      details =
        currentValue != null
          ? `latest ${currentValue} (${min}-${max})`
          : `no ${timing} glucose record`;
    } else if (goal.goalType === 'weight_target') {
      const latestWeight = currentWeightRows[0]?.value ?? null;
      currentValue = latestWeight;
      const target = goal.targetValue ?? 0;
      achieved = currentValue != null ? currentValue <= target : false;
      achievementRate =
        currentValue != null && target > 0
          ? clampPercentage((target / Math.max(currentValue, 1)) * 100)
          : 0;
      details = currentValue != null ? `latest ${currentValue}/${target}` : 'no weight record';
    } else if (goal.goalType === 'weekly_exercise_days') {
      const summaryMap = weeklySummaries ?? new Map();
      const start = Repo.addUtcDays(date, -6);
      let qualifyingDays = 0;
      for (let i = 0; i < 7; i++) {
        const day = Repo.addUtcDays(start, i);
        const summary = summaryMap.get(day);
        const steps = summary?.stepsTotal ?? 0;
        const activeMinutes = summary?.activeMinutesTotal ?? 0;
        if (steps >= 3000 || activeMinutes >= 30) qualifyingDays += 1;
      }

      currentValue = qualifyingDays;
      const target = goal.targetValue ?? 0;
      achieved = target > 0 ? qualifyingDays >= target : false;
      achievementRate = target > 0 ? clampPercentage((qualifyingDays / target) * 100) : 0;
      details = `${qualifyingDays}/7 days met activity threshold`;
    }

    items.push({
      goal: normalizedGoal,
      asOfDate: date,
      currentValue,
      targetValue: goal.targetValue,
      achievementRate,
      achieved,
      details,
    });
  }

  return { asOfDate: date, items };
};
