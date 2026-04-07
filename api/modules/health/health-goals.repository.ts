import { and, desc, eq, gte, isNull, lte, or } from 'drizzle-orm';
import { db } from '../../db/client';
import { healthGoals } from '../../db/schema';

export type HealthGoalRow = typeof healthGoals.$inferSelect;

export const insertHealthGoal = async (values: typeof healthGoals.$inferInsert) => {
  const [row] = await db.insert(healthGoals).values(values).returning();
  return row;
};

export const listHealthGoalsByUser = async (userId: string) => {
  return db
    .select()
    .from(healthGoals)
    .where(eq(healthGoals.userId, userId))
    .orderBy(desc(healthGoals.isActive), desc(healthGoals.updatedAt), desc(healthGoals.createdAt));
};

export const listActiveHealthGoalsByUser = async (userId: string, asOfDate: string) => {
  return db
    .select()
    .from(healthGoals)
    .where(
      and(
        eq(healthGoals.userId, userId),
        eq(healthGoals.isActive, true),
        lte(healthGoals.startsOn, asOfDate),
        or(isNull(healthGoals.endsOn), gte(healthGoals.endsOn, asOfDate))
      )
    )
    .orderBy(desc(healthGoals.updatedAt), desc(healthGoals.createdAt));
};

export const findHealthGoalById = async (id: string) => {
  const [row] = await db.select().from(healthGoals).where(eq(healthGoals.id, id)).limit(1);
  return row ?? null;
};

export const updateHealthGoal = async (
  id: string,
  values: Partial<typeof healthGoals.$inferInsert>
) => {
  const [row] = await db
    .update(healthGoals)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(healthGoals.id, id))
    .returning();
  return row;
};

export const deleteHealthGoal = async (id: string) => {
  await db.delete(healthGoals).where(eq(healthGoals.id, id));
};
