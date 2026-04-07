import { eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { healthSyncPreferences } from '../../db/schema';

export type HealthSyncPreferenceRow = typeof healthSyncPreferences.$inferSelect;

export const upsertHealthSyncPreference = async (
  values: typeof healthSyncPreferences.$inferInsert
) => {
  const [row] = await db
    .insert(healthSyncPreferences)
    .values(values)
    .onConflictDoUpdate({
      target: [healthSyncPreferences.userId],
      set: {
        isEnabled: values.isEnabled ?? false,
        intervalHours: values.intervalHours ?? 6,
        wifiOnly: values.wifiOnly ?? false,
        lastSyncedAt: values.lastSyncedAt ?? null,
        memo: values.memo ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
};

export const findHealthSyncPreferenceByUser = async (userId: string) => {
  const [row] = await db
    .select()
    .from(healthSyncPreferences)
    .where(eq(healthSyncPreferences.userId, userId))
    .limit(1);
  return row ?? null;
};
