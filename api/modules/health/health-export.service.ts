import * as Repo from './health.repository';
import * as HealthService from './health.service';
import { listHealthAlerts } from './health-alerts.service';
import { listReminderSettings } from './health-reminders.service';
import { listWeeklyHealthReportsByUser } from './health-reports.repository';

type ExportFile = {
  name: string;
  contentType: string;
  content: string;
};

const csvEscape = (value: unknown): string => {
  if (value == null) return '';
  const str = String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replaceAll('"', '""')}"`;
  }
  return str;
};

const toCsv = (records: Record<string, unknown>[]) => {
  if (!records.length) return '';
  const keys = Object.keys(records[0] ?? {});
  const lines = [keys.map(csvEscape).join(',')];
  for (const record of records) {
    lines.push(keys.map((key) => csvEscape(record[key])).join(','));
  }
  return lines.join('\n');
};

const buildExportFiles = (payload: {
  bloodPressure: Record<string, unknown>[];
  bloodGlucose: Record<string, unknown>[];
  meals: Record<string, unknown>[];
  activities: Record<string, unknown>[];
  goals: Record<string, unknown>[];
  alerts: Record<string, unknown>[];
  reports: Record<string, unknown>[];
  reminders: Record<string, unknown>[];
}): ExportFile[] => [
  { name: 'blood_pressure.csv', contentType: 'text/csv', content: toCsv(payload.bloodPressure) },
  { name: 'blood_glucose.csv', contentType: 'text/csv', content: toCsv(payload.bloodGlucose) },
  { name: 'meals.csv', contentType: 'text/csv', content: toCsv(payload.meals) },
  { name: 'activities.csv', contentType: 'text/csv', content: toCsv(payload.activities) },
  { name: 'goals.csv', contentType: 'text/csv', content: toCsv(payload.goals) },
  { name: 'alerts.csv', contentType: 'text/csv', content: toCsv(payload.alerts) },
  { name: 'weekly_reports.csv', contentType: 'text/csv', content: toCsv(payload.reports) },
  { name: 'reminders.csv', contentType: 'text/csv', content: toCsv(payload.reminders) },
];

export const exportHealthData = async (
  userId: string,
  from?: string,
  to?: string,
  timeZone?: string | null,
  format: 'json' | 'csv' = 'json'
) => {
  const toStr = to ?? new Date().toISOString().slice(0, 10);
  const fromStr = from ?? Repo.addUtcDays(toStr, -30);
  const bloodPressure = (await HealthService.listBloodPressure(userId, fromStr, toStr, timeZone))
    .records;
  const bloodGlucose = (await HealthService.listBloodGlucose(userId, fromStr, toStr, timeZone))
    .records;
  const meals = (await HealthService.listMeals(userId, fromStr, toStr, timeZone)).records;
  const activities = (await HealthService.listActivity(userId, fromStr, toStr, timeZone)).records;
  const goals = (await HealthService.listHealthGoals(userId)).records;
  const alerts = (await listHealthAlerts(userId, { limit: 1000 })).records;
  const reports = (await listWeeklyHealthReportsByUser(userId, 1000)).map((row) => ({
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
    mealCaloriesAverage: row.mealCaloriesAverage,
    avgSystolic: row.avgSystolic,
    avgDiastolic: row.avgDiastolic,
    bloodPressureSampleCount: row.bloodPressureSampleCount,
    avgFastingGlucose: row.avgFastingGlucose,
    avgPostprandialGlucose: row.avgPostprandialGlucose,
    bloodGlucoseSampleCount: row.bloodGlucoseSampleCount,
    goalCount: row.goalCount,
    goalAchievementRateAverage: row.goalAchievementRateAverage,
    previousWeekStepsTotal: row.previousWeekStepsTotal,
    stepsDelta: row.stepsDelta,
    summary: row.summary,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
  const reminders = (await listReminderSettings(userId)).records;

  const records = {
    bloodPressure,
    bloodGlucose,
    meals,
    activities,
    goals,
    alerts,
    reports,
    reminders,
  };

  const response: {
    exportDate: string;
    format: 'json' | 'csv';
    period: { from: string; to: string };
    records: typeof records;
    files?: ExportFile[];
  } = {
    exportDate: new Date().toISOString().slice(0, 10),
    format,
    period: { from: fromStr, to: toStr },
    records,
  };

  if (format === 'csv') {
    response.files = buildExportFiles(records);
  }

  return response;
};
