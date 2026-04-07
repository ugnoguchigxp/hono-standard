const dateFormatterCache = new Map<string, Intl.DateTimeFormat>();

const getDateFormatter = (timeZone: string) => {
  const cached = dateFormatterCache.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  dateFormatterCache.set(timeZone, formatter);
  return formatter;
};

const parseDateString = (dateStr: string) => {
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  if (!yearStr || !monthStr || !dayStr) {
    throw new Error(`Invalid date string: ${dateStr}`);
  }

  return {
    year: Number(yearStr),
    month: Number(monthStr),
    day: Number(dayStr),
  };
};

const formatLocalDateParts = (date: Date, timeZone: string) => {
  const formatter = getDateFormatter(timeZone);
  const parts = formatter.formatToParts(date);
  const values = Object.fromEntries(
    parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
  );

  const year = values.year;
  const month = values.month;
  const day = values.day;

  if (!year || !month || !day) {
    throw new Error(`Unable to format date for time zone: ${timeZone}`);
  }

  return `${year}-${month}-${day}`;
};

const findLocalDayStart = (dateStr: string, timeZone: string) => {
  const { year, month, day } = parseDateString(dateStr);
  const utcGuess = Date.UTC(year, month - 1, day, 0, 0, 0, 0);
  const lowerBound = utcGuess - 36 * 60 * 60 * 1000;
  const upperBound = utcGuess + 36 * 60 * 60 * 1000;

  let lo = lowerBound;
  let hi = upperBound;

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const localDate = formatLocalDateParts(new Date(mid), timeZone);
    if (localDate < dateStr) {
      lo = mid + 1;
    } else {
      hi = mid;
    }
  }

  return new Date(lo);
};

export const normalizeTimeZone = (timeZone?: string | null): string => timeZone ?? 'UTC';

export const toLocalDateString = (date: Date, timeZone?: string | null): string => {
  return formatLocalDateParts(date, normalizeTimeZone(timeZone));
};

export const addCalendarDays = (dateStr: string, days: number): string => {
  const { year, month, day } = parseDateString(dateStr);
  const shifted = new Date(Date.UTC(year, month - 1, day + days, 0, 0, 0, 0));
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}-${String(
    shifted.getUTCDate()
  ).padStart(2, '0')}`;
};

export const getLocalDayRange = (dateStr: string, timeZone?: string | null) => {
  const normalizedTimeZone = normalizeTimeZone(timeZone);
  const start = findLocalDayStart(dateStr, normalizedTimeZone);
  const endExclusive = findLocalDayStart(addCalendarDays(dateStr, 1), normalizedTimeZone);
  return { start, endExclusive };
};

export const getLocalDateRange = (
  fromDateStr: string,
  toDateStr: string,
  timeZone?: string | null
) => {
  const start = findLocalDayStart(fromDateStr, normalizeTimeZone(timeZone));
  const endExclusive = findLocalDayStart(
    addCalendarDays(toDateStr, 1),
    normalizeTimeZone(timeZone)
  );
  return { start, endExclusive };
};

export const getLocalWeekStart = (dateStr: string): string => {
  const parsed = new Date(`${dateStr}T00:00:00.000Z`);
  const day = parsed.getUTCDay();
  const offset = day === 0 ? -6 : 1 - day;
  return addCalendarDays(dateStr, offset);
};

export const getLocalWeekRange = (dateStr: string) => {
  const start = getLocalWeekStart(dateStr);
  const endExclusive = addCalendarDays(start, 7);
  return { start, endExclusive };
};
