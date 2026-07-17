import type {
	DashboardDataFrameV2,
	PanelQueryResponseV2,
} from "@shared/schemas/dashboard.schema";

const sensitiveKey = /authorization|cookie|token|password|secret|email|sql/i;
const emailValue = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const sqlValue = /\b(select|insert|update|delete)\b[\s\S]*\b(from|into|set)\b/i;

export function sanitizeInspectorValue(value: unknown, depth = 0): unknown {
	if (depth > 5) return "[depth limit]";
	if (typeof value === "string")
		return emailValue.test(value) || sqlValue.test(value)
			? "[redacted]"
			: value;
	if (Array.isArray(value))
		return value
			.slice(0, 100)
			.map((item) => sanitizeInspectorValue(item, depth + 1));
	if (value && typeof value === "object")
		return Object.fromEntries(
			Object.entries(value as Record<string, unknown>)
				.slice(0, 100)
				.map(([key, item]) => [
					key,
					sensitiveKey.test(key)
						? "[redacted]"
						: sanitizeInspectorValue(item, depth + 1),
				]),
		);
	return value;
}

export function sanitizeInspectorResponse(
	response: PanelQueryResponseV2 | undefined,
) {
	if (!response) return null;
	return {
		requestId: response.requestId,
		generatedAt: response.generatedAt,
		durationMs: response.durationMs,
		resolvedRange: response.resolvedRange,
		counts: response.counts,
		state: sanitizeInspectorValue(response.state),
		frames: response.frames.map((frame) => ({
			refId: frame.refId,
			name: frame.name,
			shape: frame.meta.shapeHint,
			fields: frame.fields.map((field) => ({
				key: field.key,
				label: field.label,
				type: field.type,
				roles: field.roles,
				rowCount: field.values.length,
			})),
			preview: previewFrameRows(frame),
		})),
	};
}
export function previewFrameRows(frame: DashboardDataFrameV2, maxRows = 100) {
	const rows = Math.min(maxRows, frame.fields[0]?.values.length ?? 0);
	return Array.from({ length: rows }, (_, index) =>
		Object.fromEntries(
			frame.fields.map((field) => [
				field.key,
				sensitiveKey.test(field.key)
					? "[redacted]"
					: sanitizeInspectorValue(field.values[index]),
			]),
		),
	);
}
