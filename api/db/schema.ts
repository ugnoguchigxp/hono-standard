import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

const commonColumns = {
  id: uuid('id').primaryKey().defaultRandom(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at')
    .defaultNow()
    .$onUpdateFn(() => new Date())
    .notNull(),
};

export const users = pgTable('users', {
  ...commonColumns,
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  name: text('name').notNull(),
  isActive: boolean('is_active').default(true).notNull(),
});

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    token: text('token').notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index('rt_user_id_idx').on(table.userId),
  })
);

export const userExternalAccounts = pgTable(
  'user_external_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(), // 'google', 'github'
    externalId: text('external_id').notNull(),
    email: text('email'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    providerExternalIdUniqueIdx: uniqueIndex('uex_provider_ext_uidx').on(
      table.provider,
      table.externalId
    ),
    userIdIdx: index('uex_user_id_idx').on(table.userId),
  })
);

const healthRecordColumns = {
  ...commonColumns,
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  recordedAt: timestamp('recorded_at').notNull(),
  timeZone: text('time_zone').default('UTC').notNull(),
  externalId: text('external_id'),
  valueHash: text('value_hash'),
  inputSource: text('input_source').default('manual').notNull(),
  syncSource: text('sync_source'),
  memo: text('memo'),
};

export const activityRecords = pgTable(
  'activity_records',
  {
    ...healthRecordColumns,
    steps: integer('steps'),
    activeMinutes: integer('active_minutes'),
    caloriesBurned: integer('calories_burned'),
  },
  (table) => ({
    userRecordedIdx: index('ar_user_recorded_idx').on(table.userId, table.recordedAt),
    userExternalUnique: uniqueIndex('ar_user_external_id_uidx')
      .on(table.userId, table.externalId)
      .where(sql`${table.externalId} IS NOT NULL`),
    userValueHashUnique: uniqueIndex('ar_user_value_hash_uidx')
      .on(table.userId, table.valueHash)
      .where(sql`${table.valueHash} IS NOT NULL`),
  })
);

export const bloodPressureRecords = pgTable(
  'blood_pressure_records',
  {
    ...healthRecordColumns,
    systolic: integer('systolic').notNull(),
    diastolic: integer('diastolic').notNull(),
    pulse: integer('pulse'),
    period: text('period').notNull(),
  },
  (table) => ({
    userRecordedIdx: index('bpr_user_recorded_idx').on(table.userId, table.recordedAt),
    userExternalUnique: uniqueIndex('bpr_user_external_id_uidx')
      .on(table.userId, table.externalId)
      .where(sql`${table.externalId} IS NOT NULL`),
    userValueHashUnique: uniqueIndex('bpr_user_value_hash_uidx')
      .on(table.userId, table.valueHash)
      .where(sql`${table.valueHash} IS NOT NULL`),
  })
);

export const bloodGlucoseRecords = pgTable(
  'blood_glucose_records',
  {
    ...healthRecordColumns,
    value: doublePrecision('value').notNull(),
    unit: text('unit').notNull(),
    timing: text('timing').notNull(),
  },
  (table) => ({
    userRecordedIdx: index('bgr_user_recorded_idx').on(table.userId, table.recordedAt),
    userExternalUnique: uniqueIndex('bgr_user_external_id_uidx')
      .on(table.userId, table.externalId)
      .where(sql`${table.externalId} IS NOT NULL`),
    userValueHashUnique: uniqueIndex('bgr_user_value_hash_uidx')
      .on(table.userId, table.valueHash)
      .where(sql`${table.valueHash} IS NOT NULL`),
  })
);

export const mealRecords = pgTable(
  'meal_records',
  {
    ...healthRecordColumns,
    items: text('items').notNull(),
    estimatedCalories: integer('estimated_calories'),
    photoUri: text('photo_uri'),
  },
  (table) => ({
    userRecordedIdx: index('mr_user_recorded_idx').on(table.userId, table.recordedAt),
    userExternalUnique: uniqueIndex('mr_user_external_id_uidx')
      .on(table.userId, table.externalId)
      .where(sql`${table.externalId} IS NOT NULL`),
    userValueHashUnique: uniqueIndex('mr_user_value_hash_uidx')
      .on(table.userId, table.valueHash)
      .where(sql`${table.valueHash} IS NOT NULL`),
  })
);

export const weightRecords = pgTable(
  'weight_records',
  {
    ...healthRecordColumns,
    value: doublePrecision('value').notNull(),
  },
  (table) => ({
    userRecordedIdx: index('wr_user_recorded_idx').on(table.userId, table.recordedAt),
    userExternalUnique: uniqueIndex('wr_user_external_id_uidx')
      .on(table.userId, table.externalId)
      .where(sql`${table.externalId} IS NOT NULL`),
    userValueHashUnique: uniqueIndex('wr_user_value_hash_uidx')
      .on(table.userId, table.valueHash)
      .where(sql`${table.valueHash} IS NOT NULL`),
  })
);

export const dailyHealthSummaries = pgTable(
  'daily_health_summaries',
  {
    ...commonColumns,
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    summaryDate: date('summary_date').notNull(),
    stepsTotal: integer('steps_total').default(0).notNull(),
    activeMinutesTotal: integer('active_minutes_total').default(0).notNull(),
    activityCaloriesTotal: integer('activity_calories_total').default(0).notNull(),
    mealCount: integer('meal_count').default(0).notNull(),
    latestBpSystolic: integer('latest_bp_systolic'),
    latestBpDiastolic: integer('latest_bp_diastolic'),
    latestBpPulse: integer('latest_bp_pulse'),
    latestBpRecordedAt: timestamp('latest_bp_recorded_at'),
    latestGlucoseValue: doublePrecision('latest_glucose_value'),
    latestGlucoseUnit: text('latest_glucose_unit'),
    latestGlucoseRecordedAt: timestamp('latest_glucose_recorded_at'),
    computedAt: timestamp('computed_at').defaultNow().notNull(),
  },
  (table) => ({
    userDateUnique: uniqueIndex('dhs_user_date_uidx').on(table.userId, table.summaryDate),
    userDateIdx: index('dhs_user_date_idx').on(table.userId, table.summaryDate),
  })
);

export const healthGoals = pgTable(
  'health_goals',
  {
    ...commonColumns,
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    goalType: text('goal_type').notNull(),
    period: text('period').default('daily').notNull(),
    targetValue: doublePrecision('target_value'),
    targetMin: doublePrecision('target_min'),
    targetMax: doublePrecision('target_max'),
    startsOn: date('starts_on').notNull(),
    endsOn: date('ends_on'),
    isActive: boolean('is_active').default(true).notNull(),
    memo: text('memo'),
  },
  (table) => ({
    userActiveIdx: index('hg_user_active_idx').on(table.userId, table.isActive),
    userGoalTypeIdx: index('hg_user_goal_type_idx').on(table.userId, table.goalType),
    userStartsOnIdx: index('hg_user_starts_on_idx').on(table.userId, table.startsOn),
    userIdIdx: index('hg_user_id_idx').on(table.userId),
  })
);

export const healthAlerts = pgTable(
  'health_alerts',
  {
    ...commonColumns,
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    alertKey: text('alert_key').notNull(),
    alertType: text('alert_type').notNull(),
    severity: text('severity').default('info').notNull(),
    title: text('title').notNull(),
    message: text('message').notNull(),
    timeZone: text('time_zone').default('UTC').notNull(),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    metricName: text('metric_name'),
    currentValue: doublePrecision('current_value'),
    thresholdValue: doublePrecision('threshold_value'),
    goalId: uuid('goal_id').references(() => healthGoals.id, { onDelete: 'set null' }),
    isRead: boolean('is_read').default(false).notNull(),
    readAt: timestamp('read_at'),
    detectedAt: timestamp('detected_at').defaultNow().notNull(),
  },
  (table) => ({
    userAlertKeyUnique: uniqueIndex('ha_user_alert_key_uidx').on(table.userId, table.alertKey),
    userUnreadIdx: index('ha_user_unread_idx').on(table.userId, table.isRead),
    userDetectedIdx: index('ha_user_detected_idx').on(table.userId, table.detectedAt),
  })
);

export const weeklyHealthReports = pgTable(
  'weekly_health_reports',
  {
    ...commonColumns,
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reportKey: text('report_key').notNull(),
    timeZone: text('time_zone').default('UTC').notNull(),
    weekStart: date('week_start').notNull(),
    weekEnd: date('week_end').notNull(),
    generatedAt: timestamp('generated_at').defaultNow().notNull(),
    stepsTotal: integer('steps_total').default(0).notNull(),
    avgSteps: doublePrecision('avg_steps').default(0).notNull(),
    activityCaloriesTotal: integer('activity_calories_total').default(0).notNull(),
    mealCount: integer('meal_count').default(0).notNull(),
    mealCaloriesTotal: integer('meal_calories_total').default(0).notNull(),
    mealCaloriesAverage: doublePrecision('meal_calories_average'),
    avgSystolic: doublePrecision('avg_systolic'),
    avgDiastolic: doublePrecision('avg_diastolic'),
    bloodPressureSampleCount: integer('blood_pressure_sample_count').default(0).notNull(),
    avgFastingGlucose: doublePrecision('avg_fasting_glucose'),
    avgPostprandialGlucose: doublePrecision('avg_postprandial_glucose'),
    bloodGlucoseSampleCount: integer('blood_glucose_sample_count').default(0).notNull(),
    goalCount: integer('goal_count').default(0).notNull(),
    goalAchievementRateAverage: doublePrecision('goal_achievement_rate_average'),
    previousWeekStepsTotal: integer('previous_week_steps_total').default(0).notNull(),
    stepsDelta: integer('steps_delta').default(0).notNull(),
    summary: text('summary'),
  },
  (table) => ({
    userReportKeyUnique: uniqueIndex('whr_user_report_key_uidx').on(table.userId, table.reportKey),
    userWeekIdx: index('whr_user_week_idx').on(table.userId, table.weekStart),
    userGeneratedIdx: index('whr_user_generated_idx').on(table.userId, table.generatedAt),
  })
);

export const reminderSettings = pgTable(
  'reminder_settings',
  {
    ...commonColumns,
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    reminderType: text('reminder_type').notNull(),
    isEnabled: boolean('is_enabled').default(false).notNull(),
    localTime: text('local_time').default('08:00').notNull(),
    daysOfWeek: text('days_of_week').default('monday,tuesday,wednesday,thursday,friday').notNull(),
    timeZone: text('time_zone').default('UTC').notNull(),
    memo: text('memo'),
  },
  (table) => ({
    userReminderTypeUnique: uniqueIndex('rs_user_reminder_type_uidx').on(
      table.userId,
      table.reminderType
    ),
    userEnabledIdx: index('rs_user_enabled_idx').on(table.userId, table.isEnabled),
  })
);

export const notificationDevices = pgTable(
  'notification_devices',
  {
    ...commonColumns,
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    platform: text('platform').notNull(),
    deviceToken: text('device_token').notNull(),
    pushEnabled: boolean('push_enabled').default(true).notNull(),
    lastSeenAt: timestamp('last_seen_at'),
  },
  (table) => ({
    userPlatformTokenUnique: uniqueIndex('nd_user_platform_token_uidx').on(
      table.userId,
      table.platform,
      table.deviceToken
    ),
    userPlatformIdx: index('nd_user_platform_idx').on(table.userId, table.platform),
  })
);

export const healthSyncPreferences = pgTable(
  'health_sync_preferences',
  {
    ...commonColumns,
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    isEnabled: boolean('is_enabled').default(false).notNull(),
    intervalHours: integer('interval_hours').default(6).notNull(),
    wifiOnly: boolean('wifi_only').default(false).notNull(),
    lastSyncedAt: timestamp('last_synced_at'),
    memo: text('memo'),
  },
  (table) => ({
    userIdUnique: uniqueIndex('hsp_user_id_uidx').on(table.userId),
    userEnabledIdx: index('hsp_user_enabled_idx').on(table.userId, table.isEnabled),
  })
);

export const healthSyncStates = pgTable(
  'health_sync_states',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at')
      .defaultNow()
      .$onUpdateFn(() => new Date())
      .notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    lastSyncedAt: timestamp('last_synced_at'),
    cursor: text('cursor'),
    status: text('status').default('idle').notNull(),
  },
  (table) => ({
    userProviderUnique: uniqueIndex('hss_user_provider_uidx').on(table.userId, table.provider),
    userIdIdx: index('hss_user_id_idx').on(table.userId),
  })
);
