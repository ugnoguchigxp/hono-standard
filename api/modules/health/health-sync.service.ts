import type { HealthSyncPreferenceInput } from '../../../shared/schemas/health.schema';
import { ForbiddenError } from '../../lib/errors';
import type { HealthSyncPreferenceRow } from './health-sync.repository';
import * as Repo from './health-sync.repository';

const normalizePreference = (row: HealthSyncPreferenceRow) => ({
  id: row.id,
  isEnabled: row.isEnabled,
  intervalHours: row.intervalHours,
  wifiOnly: row.wifiOnly,
  lastSyncedAt: row.lastSyncedAt ? row.lastSyncedAt.toISOString() : null,
  memo: row.memo,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const getHealthSyncPreference = async (userId: string) => {
  const row = await Repo.findHealthSyncPreferenceByUser(userId);
  if (!row) {
    const created = await Repo.upsertHealthSyncPreference({
      userId,
      isEnabled: false,
      intervalHours: 6,
      wifiOnly: false,
    });
    if (!created) throw new Error('createHealthSyncPreference failed');
    return normalizePreference(created);
  }
  if (row.userId !== userId) throw new ForbiddenError('Cannot access another user health data');
  return normalizePreference(row);
};

export const updateHealthSyncPreference = async (
  userId: string,
  input: HealthSyncPreferenceInput
) => {
  const existing = await Repo.findHealthSyncPreferenceByUser(userId);
  const row = await Repo.upsertHealthSyncPreference({
    userId,
    isEnabled: input.isEnabled ?? existing?.isEnabled ?? false,
    intervalHours: input.intervalHours ?? existing?.intervalHours ?? 6,
    wifiOnly: input.wifiOnly ?? existing?.wifiOnly ?? false,
    lastSyncedAt: existing?.lastSyncedAt ?? null,
    memo: input.memo ?? existing?.memo ?? null,
  });
  if (!row) throw new Error('updateHealthSyncPreference failed');
  return normalizePreference(row);
};
