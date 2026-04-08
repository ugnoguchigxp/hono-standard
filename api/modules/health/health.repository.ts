import { and, count, desc, eq, gte, lt, lte } from 'drizzle-orm';
import { db } from '../../db/client';
import {
  activityRecords,
  bloodGlucoseRecords,
  bloodPressureRecords,
  dailyHealthSummaries,
  healthSyncStates,
  mealRecords,
  weightRecords,
} from '../../db/schema';
import {
  getLocalDateRange,
  getLocalDayRange,
  normalizeTimeZone,
  toLocalDateString,
} from './health-timezone';

export { getLocalDateRange, getLocalDayRange, normalizeTimeZone, toLocalDateString };

export type BloodPressureRow = typeof bloodPressureRecords.$inferSelect;
export type BloodGlucoseRow = typeof bloodGlucoseRecords.$inferSelect;
export type MealRow = typeof mealRecords.$inferSelect;
export type WeightRow = typeof weightRecords.$inferSelect;
export type ActivityRow = typeof activityRecords.$inferSelect;

export const findBloodPressureByExternalOrHash = async (
  userId: string,
  externalId: string | null | undefined,
  valueHash: string | null | undefined
) => {
  if (externalId) {
    const [row] = await db
      .select()
      .from(bloodPressureRecords)
      .where(
        and(
          eq(bloodPressureRecords.userId, userId),
          eq(bloodPressureRecords.externalId, externalId)
        )
      )
      .limit(1);
    if (row) return row;
  }
  if (valueHash) {
    const [row] = await db
      .select()
      .from(bloodPressureRecords)
      .where(
        and(eq(bloodPressureRecords.userId, userId), eq(bloodPressureRecords.valueHash, valueHash))
      )
      .limit(1);
    if (row) return row;
  }
  return null;
};

export const insertBloodPressure = async (values: typeof bloodPressureRecords.$inferInsert) => {
  const [row] = await db.insert(bloodPressureRecords).values(values).returning();
  return row;
};

export const listBloodPressureByUser = async (
  userId: string,
  fromDateStr: string,
  toDateStr: string,
  timeZone?: string | null
) => {
  const { start, endExclusive } = getLocalDateRange(fromDateStr, toDateStr, timeZone);
  return db
    .select()
    .from(bloodPressureRecords)
    .where(
      and(
        eq(bloodPressureRecords.userId, userId),
        gte(bloodPressureRecords.recordedAt, start),
        lt(bloodPressureRecords.recordedAt, endExclusive)
      )
    )
    .orderBy(desc(bloodPressureRecords.recordedAt));
};

export const findBloodPressureById = async (id: string) => {
  const [row] = await db
    .select()
    .from(bloodPressureRecords)
    .where(eq(bloodPressureRecords.id, id))
    .limit(1);
  return row ?? null;
};

export const updateBloodPressure = async (
  id: string,
  values: Partial<typeof bloodPressureRecords.$inferInsert>
) => {
  const [row] = await db
    .update(bloodPressureRecords)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(bloodPressureRecords.id, id))
    .returning();
  return row;
};

export const deleteBloodPressure = async (id: string) => {
  await db.delete(bloodPressureRecords).where(eq(bloodPressureRecords.id, id));
};

export const findGlucoseByExternalOrHash = async (
  userId: string,
  externalId: string | null | undefined,
  valueHash: string | null | undefined
) => {
  if (externalId) {
    const [row] = await db
      .select()
      .from(bloodGlucoseRecords)
      .where(
        and(eq(bloodGlucoseRecords.userId, userId), eq(bloodGlucoseRecords.externalId, externalId))
      )
      .limit(1);
    if (row) return row;
  }
  if (valueHash) {
    const [row] = await db
      .select()
      .from(bloodGlucoseRecords)
      .where(
        and(eq(bloodGlucoseRecords.userId, userId), eq(bloodGlucoseRecords.valueHash, valueHash))
      )
      .limit(1);
    if (row) return row;
  }
  return null;
};

export const insertBloodGlucose = async (values: typeof bloodGlucoseRecords.$inferInsert) => {
  const [row] = await db.insert(bloodGlucoseRecords).values(values).returning();
  return row;
};

export const listBloodGlucoseByUser = async (
  userId: string,
  fromDateStr: string,
  toDateStr: string,
  timeZone?: string | null
) => {
  const { start, endExclusive } = getLocalDateRange(fromDateStr, toDateStr, timeZone);
  return db
    .select()
    .from(bloodGlucoseRecords)
    .where(
      and(
        eq(bloodGlucoseRecords.userId, userId),
        gte(bloodGlucoseRecords.recordedAt, start),
        lt(bloodGlucoseRecords.recordedAt, endExclusive)
      )
    )
    .orderBy(desc(bloodGlucoseRecords.recordedAt));
};

export const findGlucoseById = async (id: string) => {
  const [row] = await db
    .select()
    .from(bloodGlucoseRecords)
    .where(eq(bloodGlucoseRecords.id, id))
    .limit(1);
  return row ?? null;
};

export const updateBloodGlucose = async (
  id: string,
  values: Partial<typeof bloodGlucoseRecords.$inferInsert>
) => {
  const [row] = await db
    .update(bloodGlucoseRecords)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(bloodGlucoseRecords.id, id))
    .returning();
  return row;
};

export const deleteBloodGlucose = async (id: string) => {
  await db.delete(bloodGlucoseRecords).where(eq(bloodGlucoseRecords.id, id));
};

export const findMealByExternalOrHash = async (
  userId: string,
  externalId: string | null | undefined,
  valueHash: string | null | undefined
) => {
  if (externalId) {
    const [row] = await db
      .select()
      .from(mealRecords)
      .where(and(eq(mealRecords.userId, userId), eq(mealRecords.externalId, externalId)))
      .limit(1);
    if (row) return row;
  }
  if (valueHash) {
    const [row] = await db
      .select()
      .from(mealRecords)
      .where(and(eq(mealRecords.userId, userId), eq(mealRecords.valueHash, valueHash)))
      .limit(1);
    if (row) return row;
  }
  return null;
};

export const insertMeal = async (values: typeof mealRecords.$inferInsert) => {
  const [row] = await db.insert(mealRecords).values(values).returning();
  return row;
};

export const listMealsByUser = async (
  userId: string,
  fromDateStr: string,
  toDateStr: string,
  timeZone?: string | null
) => {
  const { start, endExclusive } = getLocalDateRange(fromDateStr, toDateStr, timeZone);
  return db
    .select()
    .from(mealRecords)
    .where(
      and(
        eq(mealRecords.userId, userId),
        gte(mealRecords.recordedAt, start),
        lt(mealRecords.recordedAt, endExclusive)
      )
    )
    .orderBy(desc(mealRecords.recordedAt));
};

export const updateMeal = async (id: string, values: Partial<typeof mealRecords.$inferInsert>) => {
  const [row] = await db
    .update(mealRecords)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(mealRecords.id, id))
    .returning();
  return row;
};

export const deleteMeal = async (id: string) => {
  await db.delete(mealRecords).where(eq(mealRecords.id, id));
};

export const findMealById = async (id: string) => {
  const [row] = await db.select().from(mealRecords).where(eq(mealRecords.id, id)).limit(1);
  return row ?? null;
};

export const findWeightByExternalOrHash = async (
  userId: string,
  externalId: string | null | undefined,
  valueHash: string | null | undefined
) => {
  if (externalId) {
    const [row] = await db
      .select()
      .from(weightRecords)
      .where(and(eq(weightRecords.userId, userId), eq(weightRecords.externalId, externalId)))
      .limit(1);
    if (row) return row;
  }
  if (valueHash) {
    const [row] = await db
      .select()
      .from(weightRecords)
      .where(and(eq(weightRecords.userId, userId), eq(weightRecords.valueHash, valueHash)))
      .limit(1);
    if (row) return row;
  }
  return null;
};

export const insertWeight = async (values: typeof weightRecords.$inferInsert) => {
  const [row] = await db.insert(weightRecords).values(values).returning();
  return row;
};

export const listWeightByUser = async (
  userId: string,
  fromDateStr: string,
  toDateStr: string,
  timeZone?: string | null
) => {
  const { start, endExclusive } = getLocalDateRange(fromDateStr, toDateStr, timeZone);
  return db
    .select()
    .from(weightRecords)
    .where(
      and(
        eq(weightRecords.userId, userId),
        gte(weightRecords.recordedAt, start),
        lt(weightRecords.recordedAt, endExclusive)
      )
    )
    .orderBy(desc(weightRecords.recordedAt));
};

export const findWeightById = async (id: string) => {
  const [row] = await db.select().from(weightRecords).where(eq(weightRecords.id, id)).limit(1);
  return row ?? null;
};

export const findLatestWeightByUser = async (userId: string) => {
  const [row] = await db
    .select()
    .from(weightRecords)
    .where(eq(weightRecords.userId, userId))
    .orderBy(desc(weightRecords.recordedAt))
    .limit(1);
  return row ?? null;
};

export const updateWeight = async (
  id: string,
  values: Partial<typeof weightRecords.$inferInsert>
) => {
  const [row] = await db
    .update(weightRecords)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(weightRecords.id, id))
    .returning();
  return row;
};

export const deleteWeight = async (id: string) => {
  await db.delete(weightRecords).where(eq(weightRecords.id, id));
};

export const findActivityByExternalOrHash = async (
  userId: string,
  externalId: string | null | undefined,
  valueHash: string | null | undefined
) => {
  if (externalId) {
    const [row] = await db
      .select()
      .from(activityRecords)
      .where(and(eq(activityRecords.userId, userId), eq(activityRecords.externalId, externalId)))
      .limit(1);
    if (row) return row;
  }
  if (valueHash) {
    const [row] = await db
      .select()
      .from(activityRecords)
      .where(and(eq(activityRecords.userId, userId), eq(activityRecords.valueHash, valueHash)))
      .limit(1);
    if (row) return row;
  }
  return null;
};

export const insertActivity = async (values: typeof activityRecords.$inferInsert) => {
  const [row] = await db.insert(activityRecords).values(values).returning();
  return row;
};

export const findActivityById = async (id: string) => {
  const [row] = await db.select().from(activityRecords).where(eq(activityRecords.id, id)).limit(1);
  return row ?? null;
};

export const updateActivity = async (
  id: string,
  values: Partial<typeof activityRecords.$inferInsert>
) => {
  const [row] = await db
    .update(activityRecords)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(activityRecords.id, id))
    .returning();
  return row;
};

export const deleteActivity = async (id: string) => {
  await db.delete(activityRecords).where(eq(activityRecords.id, id));
};

export const listActivityByUserDay = async (
  userId: string,
  dateStr: string,
  timeZone?: string | null
) => {
  const { start, endExclusive } = getLocalDayRange(dateStr, timeZone);
  return db
    .select()
    .from(activityRecords)
    .where(
      and(
        eq(activityRecords.userId, userId),
        gte(activityRecords.recordedAt, start),
        lt(activityRecords.recordedAt, endExclusive)
      )
    )
    .orderBy(desc(activityRecords.recordedAt));
};

export const listActivityInRange = async (userId: string, from: Date, toExclusive: Date) => {
  return db
    .select()
    .from(activityRecords)
    .where(
      and(
        eq(activityRecords.userId, userId),
        gte(activityRecords.recordedAt, from),
        lt(activityRecords.recordedAt, toExclusive)
      )
    )
    .orderBy(desc(activityRecords.recordedAt));
};

export const upsertHealthSyncState = async (userId: string, provider: string) => {
  const now = new Date();
  await db
    .insert(healthSyncStates)
    .values({
      userId,
      provider,
      lastSyncedAt: now,
      status: 'ok',
    })
    .onConflictDoUpdate({
      target: [healthSyncStates.userId, healthSyncStates.provider],
      set: {
        lastSyncedAt: now,
        updatedAt: now,
        status: 'ok',
      },
    });
};

export const aggregateDailySummary = async (
  userId: string,
  summaryDateStr: string,
  timeZone?: string | null
) => {
  const { start: dayStart, endExclusive: dayEnd } = getLocalDayRange(summaryDateStr, timeZone);

  const activities = await db
    .select()
    .from(activityRecords)
    .where(
      and(
        eq(activityRecords.userId, userId),
        gte(activityRecords.recordedAt, dayStart),
        lt(activityRecords.recordedAt, dayEnd)
      )
    );

  let stepsTotal = 0;
  let activeMinutesTotal = 0;
  let activityCaloriesTotal = 0;
  for (const a of activities) {
    stepsTotal += a.steps ?? 0;
    activeMinutesTotal += a.activeMinutes ?? 0;
    activityCaloriesTotal += a.caloriesBurned ?? 0;
  }

  const [mealCnt] = await db
    .select({ c: count() })
    .from(mealRecords)
    .where(
      and(
        eq(mealRecords.userId, userId),
        gte(mealRecords.recordedAt, dayStart),
        lt(mealRecords.recordedAt, dayEnd)
      )
    );

  const [latestBp] = await db
    .select()
    .from(bloodPressureRecords)
    .where(
      and(
        eq(bloodPressureRecords.userId, userId),
        gte(bloodPressureRecords.recordedAt, dayStart),
        lt(bloodPressureRecords.recordedAt, dayEnd)
      )
    )
    .orderBy(desc(bloodPressureRecords.recordedAt))
    .limit(1);

  const [latestG] = await db
    .select()
    .from(bloodGlucoseRecords)
    .where(
      and(
        eq(bloodGlucoseRecords.userId, userId),
        gte(bloodGlucoseRecords.recordedAt, dayStart),
        lt(bloodGlucoseRecords.recordedAt, dayEnd)
      )
    )
    .orderBy(desc(bloodGlucoseRecords.recordedAt))
    .limit(1);

  const mealCount = Number(mealCnt?.c ?? 0);

  await db
    .insert(dailyHealthSummaries)
    .values({
      userId,
      summaryDate: summaryDateStr,
      stepsTotal,
      activeMinutesTotal,
      activityCaloriesTotal,
      mealCount,
      latestBpSystolic: latestBp?.systolic ?? null,
      latestBpDiastolic: latestBp?.diastolic ?? null,
      latestBpPulse: latestBp?.pulse ?? null,
      latestBpRecordedAt: latestBp?.recordedAt ?? null,
      latestGlucoseValue: latestG?.value ?? null,
      latestGlucoseUnit: latestG?.unit ?? null,
      latestGlucoseRecordedAt: latestG?.recordedAt ?? null,
      computedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [dailyHealthSummaries.userId, dailyHealthSummaries.summaryDate],
      set: {
        stepsTotal,
        activeMinutesTotal,
        activityCaloriesTotal,
        mealCount,
        latestBpSystolic: latestBp?.systolic ?? null,
        latestBpDiastolic: latestBp?.diastolic ?? null,
        latestBpPulse: latestBp?.pulse ?? null,
        latestBpRecordedAt: latestBp?.recordedAt ?? null,
        latestGlucoseValue: latestG?.value ?? null,
        latestGlucoseUnit: latestG?.unit ?? null,
        latestGlucoseRecordedAt: latestG?.recordedAt ?? null,
        computedAt: new Date(),
      },
    });

  return {
    stepsTotal,
    activeMinutesTotal,
    activityCaloriesTotal,
    mealCount,
    latestBp: latestBp ?? null,
    latestG: latestG ?? null,
  };
};

export const listBloodPressureInRange = async (userId: string, from: Date, toExclusive: Date) => {
  return db
    .select()
    .from(bloodPressureRecords)
    .where(
      and(
        eq(bloodPressureRecords.userId, userId),
        gte(bloodPressureRecords.recordedAt, from),
        lt(bloodPressureRecords.recordedAt, toExclusive)
      )
    )
    .orderBy(desc(bloodPressureRecords.recordedAt));
};

export const listBloodGlucoseInRange = async (userId: string, from: Date, toExclusive: Date) => {
  return db
    .select()
    .from(bloodGlucoseRecords)
    .where(
      and(
        eq(bloodGlucoseRecords.userId, userId),
        gte(bloodGlucoseRecords.recordedAt, from),
        lt(bloodGlucoseRecords.recordedAt, toExclusive)
      )
    )
    .orderBy(desc(bloodGlucoseRecords.recordedAt));
};

export const listMealsInRange = async (userId: string, from: Date, toExclusive: Date) => {
  return db
    .select()
    .from(mealRecords)
    .where(
      and(
        eq(mealRecords.userId, userId),
        gte(mealRecords.recordedAt, from),
        lt(mealRecords.recordedAt, toExclusive)
      )
    )
    .orderBy(desc(mealRecords.recordedAt));
};

export const listWeightInRange = async (userId: string, from: Date, toExclusive: Date) => {
  return db
    .select()
    .from(weightRecords)
    .where(
      and(
        eq(weightRecords.userId, userId),
        gte(weightRecords.recordedAt, from),
        lt(weightRecords.recordedAt, toExclusive)
      )
    )
    .orderBy(desc(weightRecords.recordedAt));
};

export const aggregateDayMetrics = async (
  userId: string,
  summaryDateStr: string,
  timeZone?: string | null
) => {
  const { start: dayStart, endExclusive: dayEnd } = getLocalDayRange(summaryDateStr, timeZone);

  const activities = await db
    .select()
    .from(activityRecords)
    .where(
      and(
        eq(activityRecords.userId, userId),
        gte(activityRecords.recordedAt, dayStart),
        lt(activityRecords.recordedAt, dayEnd)
      )
    );

  let stepsTotal = 0;
  let activeMinutesTotal = 0;
  let caloriesBurnedTotal = 0;
  for (const a of activities) {
    stepsTotal += a.steps ?? 0;
    activeMinutesTotal += a.activeMinutes ?? 0;
    caloriesBurnedTotal += a.caloriesBurned ?? 0;
  }

  const [mealCnt] = await db
    .select({ c: count() })
    .from(mealRecords)
    .where(
      and(
        eq(mealRecords.userId, userId),
        gte(mealRecords.recordedAt, dayStart),
        lt(mealRecords.recordedAt, dayEnd)
      )
    );

  return {
    records: activities,
    stepsTotal,
    activeMinutesTotal,
    caloriesBurnedTotal,
    mealCount: Number(mealCnt?.c ?? 0),
  };
};

export const addUtcDays = (dateStr: string, days: number): string => {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const listDailySummaries = async (userId: string, from: string, to: string) => {
  return db
    .select()
    .from(dailyHealthSummaries)
    .where(
      and(
        eq(dailyHealthSummaries.userId, userId),
        gte(dailyHealthSummaries.summaryDate, from),
        lte(dailyHealthSummaries.summaryDate, to)
      )
    )
    .orderBy(dailyHealthSummaries.summaryDate);
};
