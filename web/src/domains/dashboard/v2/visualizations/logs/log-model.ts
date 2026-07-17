import type { DashboardDataFrameV2 } from "@shared/schemas/dashboard.schema";
import type { LogsConfig } from "@shared/schemas/dashboard/specialized-visualizations.schema";
import { SPECIALIZED_LIMITS } from "../specialized/limits";
import {
	fieldFor,
	rowCount,
	stringAt,
	valueAt,
} from "../specialized/frame-values";
import { sanitizeDisplayText, truncateDisplayText } from "../specialized/text";

export type LogRow = {
	time: number;
	message: string;
	severity?: string;
	context?: "before" | "focal" | "after";
	id?: string;
	attributes: Record<string, string>;
	originalIndex: number;
};

export function buildLogModel(
	frame: DashboardDataFrameV2,
	config: LogsConfig,
	preset = "stream",
) {
	const time = fieldFor(frame, "time");
	const message = fieldFor(frame, "message");
	if (!time || !message)
		throw new Error("logs require time and message fields");
	const severity = fieldFor(frame, "severity");
	const id = fieldFor(frame, "id");
	const context = fieldFor(frame, "state");
	if (rowCount(frame) > SPECIALIZED_LIMITS.maxLogs)
		throw new Error("log row limit exceeded");
	for (const key of config.attributeFields)
		if (!frame.fields.some((field) => field.key === key))
			throw new Error(`log attribute field is missing: ${key}`);
	const semantic = frame.fields.filter((field) =>
		["service", "category", "trace-id", "span-id"].some((role) =>
			field.roles.includes(role as never),
		),
	);
	const rows: LogRow[] = [];
	const ids = new Set<string>();
	let focalRows = 0;
	let truncatedCount = 0;
	for (let index = 0; index < rowCount(frame); index += 1) {
		const timestamp = valueAt(time, index);
		if (
			typeof timestamp !== "number" ||
			!Number.isFinite(timestamp) ||
			Math.abs(timestamp) > 8.64e15
		)
			throw new Error("log time must be finite");
		const rawMessage = valueAt(message, index);
		if (typeof rawMessage !== "string")
			throw new Error("log message must be a string");
		const rowId = id ? stringAt(id, index) || undefined : undefined;
		if (rowId) {
			if (ids.has(rowId)) throw new Error("log IDs must be unique");
			ids.add(rowId);
		}
		const contextValue = context ? stringAt(context, index).toLowerCase() : "";
		if (
			contextValue &&
			!(["before", "focal", "after"] as const).includes(contextValue as never)
		)
			throw new Error("log context must be before, focal, or after");
		if (contextValue === "focal") focalRows += 1;
		const attributes: Record<string, string> = {};
		for (const field of [
			...semantic,
			...config.attributeFields
				.map((key) => frame.fields.find((item) => item.key === key))
				.filter((field): field is NonNullable<typeof field> => !!field),
		])
			attributes[field.key] = sanitizeDisplayText(valueAt(field, index));
		const normalizedMessage = sanitizeDisplayText(rawMessage)
			.replaceAll("\t", "    ")
			.replace(/\r\n?|\n/g, config.wrap ? "\n" : "↵");
		const renderedMessage = truncateDisplayText(
			normalizedMessage,
			config.maxMessageCharacters,
		);
		if (renderedMessage.endsWith("…")) truncatedCount += 1;
		rows.push({
			time: timestamp,
			message: renderedMessage,
			severity: severity
				? sanitizeDisplayText(stringAt(severity, index)) || undefined
				: undefined,
			context: contextValue ? (contextValue as LogRow["context"]) : undefined,
			id: rowId,
			attributes,
			originalIndex: index,
		});
	}
	if (preset === "context" && focalRows !== 1)
		throw new Error("log context must contain exactly one focal row");
	rows.sort(
		(a, b) =>
			(config.order === "ascending" ? a.time - b.time : b.time - a.time) ||
			a.originalIndex - b.originalIndex,
	);
	return {
		rows,
		total: rows.length,
		visibleRows: rows.slice(0, Math.min(rows.length, 80)),
		truncatedCount,
		notices: rows.length > 80 ? ["log rows are windowed"] : [],
	};
}
