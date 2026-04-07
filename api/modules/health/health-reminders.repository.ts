import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { reminderSettings } from '../../db/schema';

export type ReminderSettingRow = typeof reminderSettings.$inferSelect;

export const upsertReminderSetting = async (values: typeof reminderSettings.$inferInsert) => {
  const [row] = await db
    .insert(reminderSettings)
    .values(values)
    .onConflictDoUpdate({
      target: [reminderSettings.userId, reminderSettings.reminderType],
      set: {
        isEnabled: values.isEnabled ?? false,
        localTime: values.localTime,
        daysOfWeek: values.daysOfWeek,
        timeZone: values.timeZone,
        memo: values.memo ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
};

export const listReminderSettingsByUser = async (userId: string) => {
  return db
    .select()
    .from(reminderSettings)
    .where(eq(reminderSettings.userId, userId))
    .orderBy(desc(reminderSettings.reminderType));
};

export const findReminderSettingByUserAndType = async (userId: string, reminderType: string) => {
  const [row] = await db
    .select()
    .from(reminderSettings)
    .where(
      and(eq(reminderSettings.userId, userId), eq(reminderSettings.reminderType, reminderType))
    )
    .limit(1);
  return row ?? null;
};
