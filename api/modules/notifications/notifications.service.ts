import type { RegisterNotificationDeviceInput } from '../../../shared/schemas/health.schema';
import { ForbiddenError, NotFoundError } from '../../lib/errors';
import type { NotificationDeviceRow } from './notifications.repository';
import * as Repo from './notifications.repository';

const normalizeDevice = (row: NotificationDeviceRow) => ({
  id: row.id,
  platform: row.platform as 'ios' | 'android' | 'web',
  deviceToken: row.deviceToken,
  pushEnabled: row.pushEnabled,
  lastSeenAt: row.lastSeenAt ? row.lastSeenAt.toISOString() : null,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const listNotificationDevices = async (userId: string) => {
  const rows = await Repo.listNotificationDevicesByUser(userId);
  return { records: rows.map(normalizeDevice) };
};

export const registerNotificationDevice = async (
  userId: string,
  input: RegisterNotificationDeviceInput
) => {
  const existing = await Repo.findNotificationDeviceByToken(
    userId,
    input.platform,
    input.deviceToken
  );
  const row = await Repo.upsertNotificationDevice({
    userId,
    platform: input.platform,
    deviceToken: input.deviceToken,
    pushEnabled: input.pushEnabled ?? true,
    lastSeenAt: existing?.lastSeenAt ?? new Date(),
  });
  if (!row) throw new Error('registerNotificationDevice failed');
  return normalizeDevice(row);
};

export const deleteNotificationDevice = async (userId: string, id: string) => {
  const row = await Repo.findNotificationDeviceById(id);
  if (!row) throw new NotFoundError('Notification device not found');
  if (row.userId !== userId) throw new ForbiddenError('Cannot access another user health data');
  await Repo.deleteNotificationDevice(id);
};
