import { z } from '@hono/zod-openapi';

const isValidTimeZone = (timeZone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
};

const timeZoneStringSchema = z
  .string()
  .max(64)
  .refine(isValidTimeZone, { message: 'Invalid time zone' });

/** 記録の入力元 */
export const healthInputSourceSchema = z
  .enum(['manual', 'device', 'import', 'api'])
  .openapi('HealthInputSource');

/** 記録種別（ドメイン横断の分類） */
export const healthRecordKindSchema = z
  .enum(['activity', 'blood_pressure', 'blood_glucose', 'meal', 'summary', 'sync'])
  .openapi('HealthRecordKind');

const optionalMemo = z.string().max(2000).optional();

/**
 * 健康記録共通フィールド（API 入力のベース）
 * - 記録日時 recordedAt
 * - 外部 ID / 値ハッシュ（重複排除）
 * - 入力元・同期元・メモ
 */
export const healthRecordBaseInputSchema = z.object({
  recordedAt: z
    .string()
    .datetime({ offset: true })
    .openapi({ example: '2026-04-07T08:30:00.000Z' }),
  timeZone: timeZoneStringSchema.optional().openapi({ example: 'Asia/Tokyo' }),
  externalId: z.string().max(256).optional().openapi({ example: 'healthkit:sample:123' }),
  valueHash: z
    .string()
    .max(64)
    .regex(/^[a-f0-9]{64}$/i)
    .optional()
    .openapi({ description: '重複排除用 SHA-256 hex' }),
  inputSource: healthInputSourceSchema.optional().default('manual'),
  syncSource: z.string().max(64).optional().openapi({ example: 'apple_health' }),
  memo: optionalMemo,
});

export const bloodPressurePeriodSchema = z
  .enum(['morning', 'evening', 'other'])
  .openapi('BloodPressurePeriod');

export const createBloodPressureSchema = healthRecordBaseInputSchema
  .extend({
    systolic: z.number().int().min(40).max(300).openapi({ example: 120 }),
    diastolic: z.number().int().min(20).max(200).openapi({ example: 80 }),
    pulse: z.number().int().min(20).max(250).optional().openapi({ example: 72 }),
    period: bloodPressurePeriodSchema,
  })
  .openapi('CreateBloodPressureInput');

export const bloodGlucoseUnitSchema = z.enum(['mg_dl', 'mmol_l']).openapi('BloodGlucoseUnit');

export const bloodGlucoseTimingSchema = z
  .enum(['fasting', 'postprandial', 'random'])
  .openapi('BloodGlucoseTiming');

export const createBloodGlucoseSchema = healthRecordBaseInputSchema
  .extend({
    value: z.number().finite().positive().openapi({ example: 95 }),
    unit: bloodGlucoseUnitSchema,
    timing: bloodGlucoseTimingSchema,
  })
  .openapi('CreateBloodGlucoseInput');

export const createMealSchema = healthRecordBaseInputSchema
  .extend({
    items: z.string().min(1).max(4000).openapi({ example: '玄米ごはん、味噌汁、焼き魚' }),
    estimatedCalories: z.number().int().min(0).max(20000).optional().openapi({ example: 450 }),
  })
  .openapi('CreateMealInput');

export const activitySyncItemSchema = healthRecordBaseInputSchema
  .extend({
    steps: z.number().int().min(0).max(200_000).optional(),
    activeMinutes: z
      .number()
      .int()
      .min(0)
      .max(24 * 60)
      .optional(),
    caloriesBurned: z.number().int().min(0).max(20000).optional(),
  })
  .refine((d) => d.steps != null || d.activeMinutes != null || d.caloriesBurned != null, {
    message: 'steps, activeMinutes, caloriesBurned のいずれかは必須です',
  })
  .openapi('ActivitySyncItem');

export const activitySyncBodySchema = z
  .object({
    items: z.array(activitySyncItemSchema).min(1).max(500),
    syncSource: z.string().max(64).optional(),
  })
  .openapi('ActivitySyncBody');

export const bloodPressureRecordSchema = z
  .object({
    id: z.string().uuid(),
    recordedAt: z.string(),
    systolic: z.number().int(),
    diastolic: z.number().int(),
    pulse: z.number().int().nullable(),
    period: bloodPressurePeriodSchema,
    externalId: z.string().nullable(),
    valueHash: z.string().nullable(),
    inputSource: healthInputSourceSchema,
    syncSource: z.string().nullable(),
    memo: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('BloodPressureRecord');

export const bloodGlucoseRecordSchema = z
  .object({
    id: z.string().uuid(),
    recordedAt: z.string(),
    value: z.number(),
    unit: bloodGlucoseUnitSchema,
    timing: bloodGlucoseTimingSchema,
    externalId: z.string().nullable(),
    valueHash: z.string().nullable(),
    inputSource: healthInputSourceSchema,
    syncSource: z.string().nullable(),
    memo: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('BloodGlucoseRecord');

export const mealRecordSchema = z
  .object({
    id: z.string().uuid(),
    recordedAt: z.string(),
    items: z.string(),
    estimatedCalories: z.number().int().nullable(),
    externalId: z.string().nullable(),
    valueHash: z.string().nullable(),
    inputSource: healthInputSourceSchema,
    syncSource: z.string().nullable(),
    memo: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('MealRecord');

export const activityRecordSchema = z
  .object({
    id: z.string().uuid(),
    recordedAt: z.string(),
    steps: z.number().int().nullable(),
    activeMinutes: z.number().int().nullable(),
    caloriesBurned: z.number().int().nullable(),
    externalId: z.string().nullable(),
    valueHash: z.string().nullable(),
    inputSource: healthInputSourceSchema,
    syncSource: z.string().nullable(),
    memo: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('ActivityRecord');

export const bloodPressureCreateResponseSchema = z.object({
  record: bloodPressureRecordSchema,
  duplicate: z.boolean(),
});

export const bloodGlucoseCreateResponseSchema = z.object({
  record: bloodGlucoseRecordSchema,
  duplicate: z.boolean(),
});

export const mealCreateResponseSchema = z.object({
  record: mealRecordSchema,
  duplicate: z.boolean(),
});

export const listBloodPressureResponseSchema = z.object({
  records: z.array(bloodPressureRecordSchema),
});

export const listBloodGlucoseResponseSchema = z.object({
  records: z.array(bloodGlucoseRecordSchema),
});

export const listMealsResponseSchema = z.object({
  records: z.array(mealRecordSchema),
});

export const listActivityResponseSchema = z.object({
  records: z.array(activityRecordSchema),
});

export const activitySyncResponseSchema = z.object({
  records: z.array(activityRecordSchema),
  inserted: z.number().int(),
  duplicates: z.number().int(),
});

export const dailyActivityResponseSchema = z.object({
  date: z.string().openapi({ example: '2026-04-07' }),
  stepsTotal: z.number().int(),
  activeMinutesTotal: z.number().int(),
  caloriesBurnedTotal: z.number().int(),
  records: z.array(activityRecordSchema),
});

export const dailySummaryResponseSchema = z
  .object({
    date: z.string(),
    stepsTotal: z.number().int(),
    activeMinutesTotal: z.number().int(),
    activityCaloriesTotal: z.number().int(),
    mealCount: z.number().int(),
    latestBloodPressure: bloodPressureRecordSchema.nullable(),
    latestBloodGlucose: bloodGlucoseRecordSchema.nullable(),
  })
  .openapi('DailySummaryResponse');

export const weeklySummaryDaySchema = z.object({
  date: z.string(),
  stepsTotal: z.number().int(),
  mealCount: z.number().int(),
});

export const weeklySummaryResponseSchema = z.object({
  weekStart: z.string(),
  weekEnd: z.string(),
  days: z.array(weeklySummaryDaySchema),
  avgSystolic: z.number().nullable(),
  avgDiastolic: z.number().nullable(),
  bloodPressureSampleCount: z.number().int(),
});

const isoDateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .openapi({ example: '2026-04-07' });

export const dateQuerySchema = z.object({
  from: isoDateStr.optional(),
  to: isoDateStr.optional(),
  timeZone: timeZoneStringSchema.optional().openapi({ example: 'Asia/Tokyo' }),
});

export const summaryDateQuerySchema = z.object({
  date: isoDateStr.optional(),
  timeZone: timeZoneStringSchema.optional().openapi({ example: 'Asia/Tokyo' }),
});

export const weeklySummaryQuerySchema = z.object({
  weekStart: isoDateStr,
  timeZone: timeZoneStringSchema.optional().openapi({ example: 'Asia/Tokyo' }),
});

export const healthGoalTypeSchema = z
  .enum([
    'daily_step_count',
    'blood_pressure_systolic_max',
    'blood_pressure_diastolic_max',
    'blood_glucose_fasting_range',
    'blood_glucose_postprandial_range',
    'daily_calorie_limit',
    'weekly_exercise_days',
  ])
  .openapi('HealthGoalType');

export const healthGoalPeriodSchema = z.enum(['daily', 'weekly']).openapi('HealthGoalPeriod');

const healthGoalValueSchema = z.number().finite().positive().max(1_000_000).optional();

const healthGoalRangeBoundSchema = z.number().finite().positive().max(1_000_000).optional();

const healthGoalBaseSchema = z.object({
  goalType: healthGoalTypeSchema,
  period: healthGoalPeriodSchema.optional(),
  targetValue: healthGoalValueSchema.openapi({ example: 8000 }),
  targetMin: healthGoalRangeBoundSchema.openapi({ example: 80 }),
  targetMax: healthGoalRangeBoundSchema.openapi({ example: 120 }),
  startsOn: isoDateStr,
  endsOn: isoDateStr.optional(),
  isActive: z.boolean().default(true),
  memo: optionalMemo,
});

const healthGoalValidationSchema = healthGoalBaseSchema.superRefine((value, ctx) => {
  const requiresRange =
    value.goalType === 'blood_glucose_fasting_range' ||
    value.goalType === 'blood_glucose_postprandial_range';

  if (requiresRange) {
    if (value.targetMin == null || value.targetMax == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetMin'],
        message: 'targetMin と targetMax は必須です',
      });
    } else if (value.targetMin > value.targetMax) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['targetMax'],
        message: 'targetMax は targetMin 以上である必要があります',
      });
    }
  } else if (value.targetValue == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['targetValue'],
      message: 'targetValue は必須です',
    });
  }

  if (value.goalType === 'weekly_exercise_days') {
    if (value.period && value.period !== 'weekly') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['period'],
        message: 'weekly_exercise_days は weekly 期間である必要があります',
      });
    }
  } else if (value.period && value.period !== 'daily') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['period'],
      message: 'この目標種別は daily 期間である必要があります',
    });
  }
});

export const createHealthGoalSchema = healthGoalValidationSchema.openapi('CreateHealthGoalInput');
export const updateHealthGoalSchema = z
  .object({
    goalType: healthGoalTypeSchema.optional(),
    period: healthGoalPeriodSchema.optional(),
    targetValue: healthGoalValueSchema.openapi({ example: 8000 }).optional(),
    targetMin: healthGoalRangeBoundSchema.openapi({ example: 80 }).optional(),
    targetMax: healthGoalRangeBoundSchema.openapi({ example: 120 }).optional(),
    startsOn: isoDateStr.optional(),
    endsOn: isoDateStr.optional(),
    isActive: z.boolean().optional(),
    memo: optionalMemo.optional(),
  })
  .openapi('UpdateHealthGoalInput');

export const healthGoalRecordSchema = z
  .object({
    id: z.string().uuid(),
    goalType: healthGoalTypeSchema,
    period: healthGoalPeriodSchema,
    targetValue: z.number().nullable(),
    targetMin: z.number().nullable(),
    targetMax: z.number().nullable(),
    startsOn: isoDateStr,
    endsOn: isoDateStr.nullable(),
    isActive: z.boolean(),
    memo: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('HealthGoalRecord');

export const healthGoalAchievementItemSchema = z
  .object({
    goal: healthGoalRecordSchema,
    asOfDate: isoDateStr,
    currentValue: z.number().nullable(),
    targetValue: z.number().nullable(),
    achievementRate: z.number(),
    achieved: z.boolean(),
    details: z.string().nullable(),
  })
  .openapi('HealthGoalAchievementItem');

export const healthGoalAchievementResponseSchema = z
  .object({
    asOfDate: isoDateStr,
    items: z.array(healthGoalAchievementItemSchema),
  })
  .openapi('HealthGoalAchievementResponse');

export const healthGoalListResponseSchema = z
  .object({
    records: z.array(healthGoalRecordSchema),
  })
  .openapi('HealthGoalListResponse');

export const healthAlertTypeSchema = z
  .enum([
    'high_blood_pressure_trend',
    'low_blood_pressure_trend',
    'high_blood_glucose_trend',
    'insufficient_activity',
    'goal_unmet_streak',
  ])
  .openapi('HealthAlertType');

export const healthAlertSeveritySchema = z
  .enum(['info', 'warning', 'critical'])
  .openapi('HealthAlertSeverity');

export const healthAlertListQuerySchema = z.object({
  isRead: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const healthAlertRecordSchema = z
  .object({
    id: z.string().uuid(),
    alertKey: z.string(),
    alertType: healthAlertTypeSchema,
    severity: healthAlertSeveritySchema,
    title: z.string(),
    message: z.string(),
    timeZone: z.string(),
    periodStart: isoDateStr,
    periodEnd: isoDateStr,
    metricName: z.string().nullable(),
    currentValue: z.number().nullable(),
    thresholdValue: z.number().nullable(),
    goalId: z.string().uuid().nullable(),
    isRead: z.boolean(),
    readAt: z.string().nullable(),
    detectedAt: z.string(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('HealthAlertRecord');

export const healthAlertListResponseSchema = z
  .object({
    records: z.array(healthAlertRecordSchema),
  })
  .openapi('HealthAlertListResponse');

export const healthWeeklyReportQuerySchema = z.object({
  weekStart: isoDateStr.optional(),
  timeZone: timeZoneStringSchema.optional().openapi({ example: 'Asia/Tokyo' }),
});

export const weeklyHealthReportRecordSchema = z
  .object({
    id: z.string().uuid(),
    reportKey: z.string(),
    timeZone: z.string(),
    weekStart: isoDateStr,
    weekEnd: isoDateStr,
    generatedAt: z.string(),
    stepsTotal: z.number().int(),
    avgSteps: z.number(),
    activityCaloriesTotal: z.number().int(),
    mealCount: z.number().int(),
    mealCaloriesTotal: z.number().int(),
    mealCaloriesAverage: z.number().nullable(),
    avgSystolic: z.number().nullable(),
    avgDiastolic: z.number().nullable(),
    bloodPressureSampleCount: z.number().int(),
    avgFastingGlucose: z.number().nullable(),
    avgPostprandialGlucose: z.number().nullable(),
    bloodGlucoseSampleCount: z.number().int(),
    goalCount: z.number().int(),
    goalAchievementRateAverage: z.number().nullable(),
    previousWeekStepsTotal: z.number().int(),
    stepsDelta: z.number().int(),
    summary: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('WeeklyHealthReportRecord');

export const weeklyHealthReportResponseSchema = z
  .object({
    report: weeklyHealthReportRecordSchema,
    generated: z.boolean(),
  })
  .openapi('WeeklyHealthReportResponse');

export const reminderTypeSchema = z
  .enum(['blood_pressure', 'blood_glucose', 'meal', 'activity'])
  .openapi('ReminderType');

export const reminderDayOfWeekSchema = z
  .enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
  .openapi('ReminderDayOfWeek');

export const reminderDaysOfWeekSchema = z.array(reminderDayOfWeekSchema).min(1).max(7);

const reminderLocalTimeSchema = z
  .string()
  .regex(/^\d{2}:\d{2}$/)
  .openapi({ example: '08:30' });

export const reminderSettingRecordSchema = z
  .object({
    id: z.string().uuid(),
    reminderType: reminderTypeSchema,
    isEnabled: z.boolean(),
    localTime: reminderLocalTimeSchema,
    daysOfWeek: reminderDaysOfWeekSchema,
    timeZone: z.string(),
    memo: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('ReminderSettingRecord');

export const reminderSettingListResponseSchema = z
  .object({
    records: z.array(reminderSettingRecordSchema),
  })
  .openapi('ReminderSettingListResponse');

export const updateReminderSettingSchema = z
  .object({
    isEnabled: z.boolean().optional(),
    localTime: reminderLocalTimeSchema.optional(),
    daysOfWeek: reminderDaysOfWeekSchema.optional(),
    timeZone: timeZoneStringSchema.optional().openapi({ example: 'Asia/Tokyo' }),
    memo: optionalMemo.optional(),
  })
  .openapi('UpdateReminderSettingInput');

export const healthExportFormatSchema = z.enum(['json', 'csv']).openapi('HealthExportFormat');

export const healthExportQuerySchema = z.object({
  format: healthExportFormatSchema.optional(),
  from: isoDateStr.optional(),
  to: isoDateStr.optional(),
  timeZone: timeZoneStringSchema.optional().openapi({ example: 'Asia/Tokyo' }),
});

export const healthExportFileSchema = z
  .object({
    name: z.string(),
    contentType: z.string(),
    content: z.string(),
  })
  .openapi('HealthExportFile');

export const healthExportRecordsSchema = z.object({
  bloodPressure: z.array(bloodPressureRecordSchema),
  bloodGlucose: z.array(bloodGlucoseRecordSchema),
  meals: z.array(mealRecordSchema),
  activities: z.array(activityRecordSchema),
  goals: z.array(healthGoalRecordSchema),
  alerts: z.array(healthAlertRecordSchema),
  reports: z.array(weeklyHealthReportRecordSchema),
  reminders: z.array(reminderSettingRecordSchema),
});

export const healthExportResponseSchema = z
  .object({
    exportDate: isoDateStr,
    format: healthExportFormatSchema,
    period: z.object({
      from: isoDateStr,
      to: isoDateStr,
    }),
    records: healthExportRecordsSchema,
    files: z.array(healthExportFileSchema).optional(),
  })
  .openapi('HealthExportResponse');

export const notificationPlatformSchema = z
  .enum(['ios', 'android', 'web'])
  .openapi('NotificationPlatform');

export const notificationDeviceRecordSchema = z
  .object({
    id: z.string().uuid(),
    platform: notificationPlatformSchema,
    deviceToken: z.string(),
    pushEnabled: z.boolean(),
    lastSeenAt: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('NotificationDeviceRecord');

export const notificationDeviceListResponseSchema = z
  .object({
    records: z.array(notificationDeviceRecordSchema),
  })
  .openapi('NotificationDeviceListResponse');

export const registerNotificationDeviceSchema = z
  .object({
    platform: notificationPlatformSchema,
    deviceToken: z.string().min(8).max(512),
    pushEnabled: z.boolean().optional().default(true),
  })
  .openapi('RegisterNotificationDeviceInput');

export const healthSyncPreferenceRecordSchema = z
  .object({
    id: z.string().uuid(),
    isEnabled: z.boolean(),
    intervalHours: z.number().int(),
    wifiOnly: z.boolean(),
    lastSyncedAt: z.string().nullable(),
    memo: z.string().nullable(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .openapi('HealthSyncPreferenceRecord');

export const healthSyncPreferenceSchema = z
  .object({
    isEnabled: z.boolean().optional(),
    intervalHours: z.coerce.number().int().min(1).max(24).optional(),
    wifiOnly: z.boolean().optional(),
    memo: optionalMemo.optional(),
  })
  .openapi('HealthSyncPreferenceInput');

export type HealthInputSource = z.infer<typeof healthInputSourceSchema>;
export type HealthRecordKind = z.infer<typeof healthRecordKindSchema>;
export type CreateBloodPressureInput = z.infer<typeof createBloodPressureSchema>;
export type CreateBloodGlucoseInput = z.infer<typeof createBloodGlucoseSchema>;
export type CreateMealInput = z.infer<typeof createMealSchema>;
export type ActivitySyncBody = z.infer<typeof activitySyncBodySchema>;
export type CreateHealthGoalInput = z.infer<typeof createHealthGoalSchema>;
export type UpdateHealthGoalInput = z.infer<typeof updateHealthGoalSchema>;
export type UpdateReminderSettingInput = z.infer<typeof updateReminderSettingSchema>;
export type HealthAlertType = z.infer<typeof healthAlertTypeSchema>;
export type HealthAlertSeverity = z.infer<typeof healthAlertSeveritySchema>;
export type ReminderType = z.infer<typeof reminderTypeSchema>;
export type ReminderDayOfWeek = z.infer<typeof reminderDayOfWeekSchema>;
export type NotificationPlatform = z.infer<typeof notificationPlatformSchema>;
export type RegisterNotificationDeviceInput = z.infer<typeof registerNotificationDeviceSchema>;
export type HealthSyncPreferenceInput = z.infer<typeof healthSyncPreferenceSchema>;
