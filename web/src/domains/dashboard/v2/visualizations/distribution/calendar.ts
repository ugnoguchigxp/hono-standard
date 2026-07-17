import type { CalendarHeatmapConfigV1 } from "@shared/schemas/dashboard/distribution-visualizations.schema";
import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";

export type CalendarCell = {
	dateKey: string;
	startUtc: number;
	value: number | null;
	state?: string;
	weekIndex: number;
	weekdayIndex: number;
	inRange: boolean;
};
const dateKeyFormatters = new Map<string, Intl.DateTimeFormat>();
const startFormatters = new Map<string, Intl.DateTimeFormat>();
const startUtcCache = new Map<string, number>();
const dateKeyFormatter = (timezone: string) => {
	const cached = dateKeyFormatters.get(timezone);
	if (cached) return cached;
	const formatter = new Intl.DateTimeFormat("en-CA", {
		timeZone: timezone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	});
	dateKeyFormatters.set(timezone, formatter);
	return formatter;
};
const parts = (date: Date, timezone: string) =>
	Object.fromEntries(
		dateKeyFormatter(timezone)
			.formatToParts(date)
			.filter((item) => item.type !== "literal")
			.map((item) => [item.type, item.value]),
	);
export function dateKeyForInstant(instant: number | Date, timezone: string) {
	const p = parts(new Date(instant), timezone);
	return `${p.year}-${p.month}-${p.day}`;
}
export function addDateKey(dateKey: string, days: number) {
	const date = new Date(`${dateKey}T12:00:00Z`);
	date.setUTCDate(date.getUTCDate() + days);
	return date.toISOString().slice(0, 10);
}
export function startUtcForDateKey(dateKey: string, timezone: string) {
	const cacheKey = `${timezone}\u0000${dateKey}`;
	const cached = startUtcCache.get(cacheKey);
	if (cached !== undefined) return cached;
	const [year, month, day] = dateKey.split("-").map(Number);
	if (!year || !month || !day) throw new Error("CALENDAR_DATE_KEY_INVALID");
	const target = Date.UTC(year, month - 1, day);
	let formatter = startFormatters.get(timezone);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat("en-CA", {
			timeZone: timezone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
			hourCycle: "h23",
		});
		startFormatters.set(timezone, formatter);
	}
	let candidate = target;
	for (let iteration = 0; iteration < 3; iteration += 1) {
		const local = Object.fromEntries(
			formatter
				.formatToParts(candidate)
				.filter((item) => item.type !== "literal")
				.map((item) => [item.type, Number(item.value)]),
		);
		const representedAsUtc = Date.UTC(
			local.year,
			local.month - 1,
			local.day,
			local.hour,
			local.minute,
			local.second,
		);
		const adjustment = target - representedAsUtc;
		candidate += adjustment;
		if (adjustment === 0) break;
	}
	startUtcCache.set(cacheKey, candidate);
	return candidate;
}
export function calendarDateKeys(
	config: CalendarHeatmapConfigV1,
	anchorUtc = Date.now(),
	timezone = "UTC",
) {
	const range = config.range;
	if (range.mode === "year") {
		const start = `${range.year}-01-01`;
		return Array.from(
			{
				length:
					(new Date(Date.UTC(range.year + 1, 0, 1)).getTime() -
						new Date(Date.UTC(range.year, 0, 1)).getTime()) /
					86_400_000,
			},
			(_, i) => addDateKey(start, i),
		);
	}
	if (range.mode === "month") {
		const start = `${range.year}-${String(range.month).padStart(2, "0")}-01`;
		const days = new Date(Date.UTC(range.year, range.month, 0)).getUTCDate();
		return Array.from({ length: days }, (_, i) => addDateKey(start, i));
	}
	const end = dateKeyForInstant(anchorUtc, timezone);
	return Array.from({ length: range.weeks * 7 }, (_, i) =>
		addDateKey(end, i - range.weeks * 7 + 1),
	);
}
export function buildCalendarModel(
	frame: DashboardDataFrameV2,
	config: CalendarHeatmapConfigV1,
	timezone: string,
	anchorUtc?: number,
) {
	const time = frame.fields.find(
		(item) => item.type === "time" && item.roles.includes("time"),
	);
	const value = frame.fields.find(
		(item) => item.type === "number" && item.roles.includes("value"),
	);
	const state = frame.fields.find((item) => item.roles.includes("state"));
	if (!time || (!value && !state)) throw new Error("CALENDAR_FIELDS_MISSING");
	const latestInput = time.values.reduce<number | undefined>(
		(latest, item) =>
			typeof item === "number" && (latest === undefined || item > latest)
				? item
				: latest,
		undefined,
	);
	const resolvedAnchor = anchorUtc ?? latestInput ?? Date.now();
	const byDate = new Map<string, { value: number | null; state?: string }>();
	for (let row = 0; row < time.values.length; row += 1) {
		const rawTime = time.values[row];
		if (typeof rawTime !== "number") continue;
		const key = dateKeyForInstant(rawTime, timezone);
		if (byDate.has(key)) throw new Error("CALENDAR_DUPLICATE_DATE");
		const rawValue = value?.type === "number" ? value.values[row] : null;
		byDate.set(key, {
			value: rawValue ?? null,
			state: state ? String(state.values[row] ?? "unknown") : undefined,
		});
	}
	const keys = calendarDateKeys(config, resolvedAnchor, timezone);
	const anchorDateKey = dateKeyForInstant(resolvedAnchor, timezone);
	const first = new Date(`${keys[0] ?? "1970-01-01"}T12:00:00Z`).getUTCDay();
	const mondayOffset = (first + 6) % 7;
	const offset = config.weekStartsOn === "monday" ? mondayOffset : first;
	return keys.flatMap((dateKey, index) => {
		const future = dateKey > anchorDateKey;
		if (future && config.future === "hide") return [];
		const datum = future ? undefined : byDate.get(dateKey);
		return {
			dateKey,
			startUtc: startUtcForDateKey(dateKey, timezone),
			value: datum?.value ?? null,
			state: datum?.state,
			weekIndex: Math.floor((index + offset) / 7),
			weekdayIndex: (index + offset) % 7,
			inRange: datum !== undefined,
		} satisfies CalendarCell;
	});
}
