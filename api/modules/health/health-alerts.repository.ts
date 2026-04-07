import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db/client';
import { healthAlerts } from '../../db/schema';

export type HealthAlertRow = typeof healthAlerts.$inferSelect;

export const upsertHealthAlert = async (values: typeof healthAlerts.$inferInsert) => {
  const now = new Date();
  const [row] = await db
    .insert(healthAlerts)
    .values(values)
    .onConflictDoUpdate({
      target: [healthAlerts.userId, healthAlerts.alertKey],
      set: {
        alertType: values.alertType,
        severity: values.severity,
        title: values.title,
        message: values.message,
        timeZone: values.timeZone,
        periodStart: values.periodStart,
        periodEnd: values.periodEnd,
        metricName: values.metricName ?? null,
        currentValue: values.currentValue ?? null,
        thresholdValue: values.thresholdValue ?? null,
        goalId: values.goalId ?? null,
        detectedAt: values.detectedAt ?? now,
        updatedAt: now,
      },
    })
    .returning();
  return row;
};

export const listHealthAlertsByUser = async (
  userId: string,
  opts?: { isRead?: boolean; limit?: number }
) => {
  const where =
    opts?.isRead == null
      ? eq(healthAlerts.userId, userId)
      : and(eq(healthAlerts.userId, userId), eq(healthAlerts.isRead, opts.isRead));
  const query = db.select().from(healthAlerts).where(where).orderBy(desc(healthAlerts.detectedAt));
  if (opts?.limit != null) {
    return query.limit(opts.limit);
  }
  return query;
};

export const findHealthAlertById = async (id: string) => {
  const [row] = await db.select().from(healthAlerts).where(eq(healthAlerts.id, id)).limit(1);
  return row ?? null;
};

export const markHealthAlertAsRead = async (id: string) => {
  const [row] = await db
    .update(healthAlerts)
    .set({ isRead: true, readAt: new Date(), updatedAt: new Date() })
    .where(eq(healthAlerts.id, id))
    .returning();
  return row ?? null;
};
