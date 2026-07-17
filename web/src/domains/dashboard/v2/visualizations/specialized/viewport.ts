import { clamp } from "./limits";

export type ViewportRange = { start: number; end: number };

export function visibleRange(
	count: number,
	viewportStart: number,
	viewportHeight: number,
	rowHeight: number,
	overscan = 4,
): ViewportRange {
	if (count <= 0) return { start: 0, end: 0 };
	const first = Math.floor(Math.max(0, viewportStart) / Math.max(1, rowHeight));
	const rows = Math.ceil(Math.max(1, viewportHeight) / Math.max(1, rowHeight));
	return {
		start: clamp(first - overscan, 0, count),
		end: clamp(first + rows + overscan, 0, count),
	};
}

export function windowed<T>(items: readonly T[], range: ViewportRange) {
	return items.slice(range.start, range.end);
}
