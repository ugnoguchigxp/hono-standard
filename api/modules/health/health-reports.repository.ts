import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { weeklyHealthReports } from '../../db/schema';

export type WeeklyHealthReportRow = typeof weeklyHealthReports.$inferSelect;

export const upsertWeeklyHealthReport = async (values: typeof weeklyHealthReports.$inferInsert) => {
  const now = new Date();
  const [row] = await db
    .insert(weeklyHealthReports)
    .values(values)
    .onConflictDoUpdate({
      target: [weeklyHealthReports.userId, weeklyHealthReports.reportKey],
      set: {
        timeZone: values.timeZone,
        weekStart: values.weekStart,
        weekEnd: values.weekEnd,
        generatedAt: values.generatedAt ?? now,
        stepsTotal: values.stepsTotal ?? 0,
        avgSteps: values.avgSteps ?? 0,
        activityCaloriesTotal: values.activityCaloriesTotal ?? 0,
        mealCount: values.mealCount ?? 0,
        mealCaloriesTotal: values.mealCaloriesTotal ?? 0,
        mealCaloriesAverage: values.mealCaloriesAverage ?? null,
        avgSystolic: values.avgSystolic ?? null,
        avgDiastolic: values.avgDiastolic ?? null,
        bloodPressureSampleCount: values.bloodPressureSampleCount ?? 0,
        avgFastingGlucose: values.avgFastingGlucose ?? null,
        avgPostprandialGlucose: values.avgPostprandialGlucose ?? null,
        bloodGlucoseSampleCount: values.bloodGlucoseSampleCount ?? 0,
        goalCount: values.goalCount ?? 0,
        goalAchievementRateAverage: values.goalAchievementRateAverage ?? null,
        previousWeekStepsTotal: values.previousWeekStepsTotal ?? 0,
        stepsDelta: values.stepsDelta ?? 0,
        summary: values.summary ?? null,
        updatedAt: now,
      },
    })
    .returning();
  return row;
};

export const findWeeklyHealthReportByKey = async (userId: string, reportKey: string) => {
  const [row] = await db
    .select()
    .from(weeklyHealthReports)
    .where(
      and(eq(weeklyHealthReports.userId, userId), eq(weeklyHealthReports.reportKey, reportKey))
    )
    .limit(1);
  return row ?? null;
};

export const listWeeklyHealthReportsByUser = async (userId: string, limit = 12) => {
  return db
    .select()
    .from(weeklyHealthReports)
    .where(eq(weeklyHealthReports.userId, userId))
    .orderBy(desc(weeklyHealthReports.weekStart))
    .limit(limit);
};
