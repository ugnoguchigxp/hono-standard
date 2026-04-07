import type {
  ReminderDayOfWeek,
  ReminderType,
  UpdateReminderSettingInput,
} from '../../../shared/schemas/health.schema';
import { ForbiddenError, NotFoundError } from '../../lib/errors';
import type { ReminderSettingRow } from './health-reminders.repository';
import * as ReminderRepo from './health-reminders.repository';

type ReminderSettingRecord = {
  id: string;
  reminderType: ReminderType;
  isEnabled: boolean;
  localTime: string;
  daysOfWeek: ReminderDayOfWeek[];
  timeZone: string;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
};

const parseDaysOfWeek = (daysOfWeek: string): ReminderDayOfWeek[] =>
  daysOfWeek
    .split(',')
    .map((day) => day.trim())
    .filter(Boolean) as ReminderDayOfWeek[];

const normalizeReminder = (row: ReminderSettingRow): ReminderSettingRecord => ({
  id: row.id,
  reminderType: row.reminderType as ReminderType,
  isEnabled: row.isEnabled,
  localTime: row.localTime,
  daysOfWeek: parseDaysOfWeek(row.daysOfWeek),
  timeZone: row.timeZone,
  memo: row.memo,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const joinDaysOfWeek = (daysOfWeek: ReminderDayOfWeek[]) => daysOfWeek.join(',');

const defaultReminderDays = (reminderType: ReminderType): ReminderDayOfWeek[] => {
  if (reminderType === 'activity')
    return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  return ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
};

export const listReminderSettings = async (userId: string) => {
  const rows = await ReminderRepo.listReminderSettingsByUser(userId);
  return { records: rows.map(normalizeReminder) };
};

export const upsertReminderSetting = async (
  userId: string,
  reminderType: ReminderType,
  input: UpdateReminderSettingInput
) => {
  const existing = await ReminderRepo.findReminderSettingByUserAndType(userId, reminderType);
  const normalized = {
    isEnabled: input.isEnabled ?? existing?.isEnabled ?? false,
    localTime: input.localTime ?? existing?.localTime ?? '08:00',
    daysOfWeek:
      input.daysOfWeek ??
      parseDaysOfWeek(existing?.daysOfWeek ?? joinDaysOfWeek(defaultReminderDays(reminderType))),
    timeZone: input.timeZone ?? existing?.timeZone ?? 'UTC',
    memo: input.memo ?? existing?.memo ?? null,
  };

  const row = await ReminderRepo.upsertReminderSetting({
    userId,
    reminderType,
    isEnabled: normalized.isEnabled,
    localTime: normalized.localTime,
    daysOfWeek: joinDaysOfWeek(normalized.daysOfWeek),
    timeZone: normalized.timeZone,
    memo: normalized.memo,
  });
  if (!row) throw new Error('upsertReminderSetting failed');
  return normalizeReminder(row);
};

export const getReminderSetting = async (userId: string, reminderType: ReminderType) => {
  const row = await ReminderRepo.findReminderSettingByUserAndType(userId, reminderType);
  if (!row) throw new NotFoundError('Reminder setting not found');
  if (row.userId !== userId) throw new ForbiddenError('Cannot access another user health data');
  return normalizeReminder(row);
};
