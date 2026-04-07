import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { notificationDevices } from '../../db/schema';

export type NotificationDeviceRow = typeof notificationDevices.$inferSelect;

export const upsertNotificationDevice = async (values: typeof notificationDevices.$inferInsert) => {
  const now = new Date();
  const [row] = await db
    .insert(notificationDevices)
    .values(values)
    .onConflictDoUpdate({
      target: [
        notificationDevices.userId,
        notificationDevices.platform,
        notificationDevices.deviceToken,
      ],
      set: {
        pushEnabled: values.pushEnabled ?? true,
        lastSeenAt: values.lastSeenAt ?? now,
        updatedAt: now,
      },
    })
    .returning();
  return row;
};

export const listNotificationDevicesByUser = async (userId: string) => {
  return db
    .select()
    .from(notificationDevices)
    .where(eq(notificationDevices.userId, userId))
    .orderBy(desc(notificationDevices.updatedAt));
};

export const findNotificationDeviceById = async (id: string) => {
  const [row] = await db
    .select()
    .from(notificationDevices)
    .where(eq(notificationDevices.id, id))
    .limit(1);
  return row ?? null;
};

export const deleteNotificationDevice = async (id: string) => {
  await db.delete(notificationDevices).where(eq(notificationDevices.id, id));
};

export const findNotificationDeviceByToken = async (
  userId: string,
  platform: string,
  deviceToken: string
) => {
  const [row] = await db
    .select()
    .from(notificationDevices)
    .where(
      and(
        eq(notificationDevices.userId, userId),
        eq(notificationDevices.platform, platform),
        eq(notificationDevices.deviceToken, deviceToken)
      )
    )
    .limit(1);
  return row ?? null;
};
