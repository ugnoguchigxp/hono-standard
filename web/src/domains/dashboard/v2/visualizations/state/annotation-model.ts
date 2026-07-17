import {
	DASHBOARD_V2_LIMITS,
	type AnnotationLayerSpecV1,
	type DashboardDataFrameV2,
} from "@shared/schemas/dashboard.schema";

export type AnnotationDatum = {
	id: string;
	layerId: string;
	kind: "event" | "region";
	start: number;
	end?: number;
	message: string;
	severity?: string;
	category?: string;
	colorToken: string;
	safeLink?: string;
};
export type AnnotationModel = {
	annotations: AnnotationDatum[];
	clusters: Array<{
		start: number;
		end: number;
		count: number;
		items: AnnotationDatum[];
	}>;
	notices: string[];
};

const defaultColor = "--color-chart-muted";
function severityColor(severity: string | undefined) {
	switch (severity?.trim().toLowerCase()) {
		case "critical":
		case "error":
		case "fatal":
			return "--color-chart-danger";
		case "warning":
		case "warn":
			return "--color-chart-warning";
		case "healthy":
		case "success":
			return "--color-chart-success";
		default:
			return defaultColor;
	}
}
function resolveSafeLink(url: string) {
	try {
		const origin =
			typeof window === "undefined"
				? "http://dashboard.local"
				: window.location.origin;
		const parsed = new URL(url, origin);
		return parsed.origin === origin &&
			(parsed.protocol === "http:" || parsed.protocol === "https:")
			? parsed.pathname + parsed.search + parsed.hash
			: undefined;
	} catch {
		return undefined;
	}
}
const fieldByRole = (frame: DashboardDataFrameV2, role: string) =>
	frame.fields.find((field) => field.roles.includes(role as never));
export function buildAnnotationModel(
	layer: AnnotationLayerSpecV1,
	frame: DashboardDataFrameV2,
	range: { from: number; to: number },
	options: { resolveLink?: (url: string) => string | undefined } = {},
): AnnotationModel {
	if (
		!Number.isSafeInteger(range.from) ||
		!Number.isSafeInteger(range.to) ||
		range.from >= range.to
	)
		throw new Error("ANNOTATION_RANGE_INVALID");
	const time = fieldByRole(frame, "time");
	const startField = fieldByRole(frame, "start-time");
	const endField = fieldByRole(frame, "end-time");
	const message = fieldByRole(frame, "message");
	const severity = fieldByRole(frame, "severity");
	const category = fieldByRole(frame, "category");
	const id = fieldByRole(frame, "id");
	const url = fieldByRole(frame, "url");
	if (!message || (!time && !(startField && endField)))
		throw new Error("ANNOTATION_FIELDS_MISSING");
	if (time && (startField || endField))
		throw new Error("ANNOTATION_TIME_FORM_MISMATCH");
	if (layer.mode === "region" ? !!time : !time)
		throw new Error("ANNOTATION_MODE_SHAPE_MISMATCH");
	if (message.values.length > DASHBOARD_V2_LIMITS.maxAnnotations)
		throw new Error("ANNOTATION_LIMIT");
	const annotations: AnnotationDatum[] = [];
	const seen = new Set<string>();
	for (let row = 0; row < message.values.length; row += 1) {
		const rawStart = time?.values[row] ?? startField?.values[row];
		const rawEnd = endField?.values[row];
		if (typeof rawStart !== "number" || !Number.isSafeInteger(rawStart))
			throw new Error("ANNOTATION_TIME_INVALID");
		const kind = time ? "event" : "region";
		if (
			kind === "region" &&
			(typeof rawEnd !== "number" ||
				!Number.isSafeInteger(rawEnd) ||
				rawStart >= rawEnd)
		)
			throw new Error("ANNOTATION_REGION_INVALID");
		const rawId = id?.values[row];
		const annotationId =
			rawId == null ? `${layer.id}:${rawStart}:${row}` : String(rawId);
		if (seen.has(annotationId)) throw new Error("ANNOTATION_DUPLICATE_ID");
		seen.add(annotationId);
		const severityValue =
			severity?.values[row] == null ? undefined : String(severity.values[row]);
		if (
			layer.severityFilter.length > 0 &&
			(!severityValue || !layer.severityFilter.includes(severityValue))
		)
			continue;
		const rawMessage = message.values[row];
		if (
			typeof rawMessage !== "string" ||
			rawMessage.trim().length < 1 ||
			rawMessage.length > 512
		)
			throw new Error("ANNOTATION_MESSAGE_INVALID");
		const end = kind === "region" ? (rawEnd as number) : undefined;
		const clippedStart = Math.max(range.from, rawStart);
		const clippedEnd = end === undefined ? undefined : Math.min(range.to, end);
		if (clippedEnd !== undefined && clippedStart >= clippedEnd) continue;
		if (
			clippedEnd === undefined &&
			(rawStart < range.from || rawStart > range.to)
		)
			continue;
		const safeLink = url?.values[row]
			? (options.resolveLink ?? resolveSafeLink)(String(url.values[row]))
			: undefined;
		annotations.push({
			id: annotationId,
			layerId: layer.id,
			kind,
			start: clippedStart,
			...(clippedEnd === undefined ? {} : { end: clippedEnd }),
			message: rawMessage,
			severity: severityValue,
			category:
				category?.values[row] == null
					? undefined
					: String(category.values[row]),
			colorToken: layer.colorToken ?? severityColor(severityValue),
			...(safeLink ? { safeLink } : {}),
		});
	}
	if (annotations.length > DASHBOARD_V2_LIMITS.maxAnnotations)
		throw new Error("ANNOTATION_LIMIT");
	const sorted = annotations.sort(
		(a, b) => a.start - b.start || a.id.localeCompare(b.id),
	);
	const clusters: AnnotationModel["clusters"] = [];
	for (const item of sorted) {
		const end = item.end ?? item.start;
		const cluster = clusters.at(-1);
		if (
			cluster &&
			item.start <= cluster.end &&
			cluster.items.length < DASHBOARD_V2_LIMITS.maxAnnotationCluster
		) {
			cluster.end = Math.max(cluster.end, end);
			cluster.items.push(item);
			cluster.count += 1;
		} else clusters.push({ start: item.start, end, count: 1, items: [item] });
	}
	return { annotations: sorted, clusters, notices: [] };
}
export const normalizeAnnotations = buildAnnotationModel;
