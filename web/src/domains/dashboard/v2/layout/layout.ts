import type { PublicDashboardManifestV2 } from "@shared/schemas/dashboard.schema";
import { z } from "zod";
export const dashboardBreakpoints = {
	lg: 1200,
	md: 996,
	sm: 768,
	xs: 0,
} as const;
export const dashboardColumns = { lg: 12, md: 8, sm: 4, xs: 1 } as const;
export type DashboardBreakpoint = keyof typeof dashboardColumns;
export type DashboardLayoutItem = {
	i: string;
	x: number;
	y: number;
	w: number;
	h: number;
	minW?: number;
	minH?: number;
	maxW?: number;
	maxH?: number;
};
export type DashboardLayouts = Record<
	DashboardBreakpoint,
	DashboardLayoutItem[]
>;
export type DashboardMinimumSizeResolver = (
	visualizationType: string,
) => { w: number; h: number } | undefined;
const pack = (items: DashboardLayoutItem[], cols: number) => {
	let x = 0;
	let y = 0;
	let row = 0;
	return items.map((item) => {
		const w = Math.min(cols, Math.max(1, item.w));
		if (x + w > cols) {
			x = 0;
			y += row;
			row = 0;
		}
		const result = { ...item, x, y, w };
		x += w;
		row = Math.max(row, item.h);
		return result;
	});
};
export function layoutsFromManifest(
	manifest: PublicDashboardManifestV2,
	minimumSize?: DashboardMinimumSizeResolver,
): DashboardLayouts {
	const lg = manifest.panels.map((panel) => {
		const minimum = minimumSize?.(panel.visualization.type);
		const minW = Math.max(panel.layout.minW ?? 1, minimum?.w ?? 1);
		const minH = Math.max(panel.layout.minH ?? 1, minimum?.h ?? 1);
		return {
			...panel.layout,
			i: panel.id,
			w: Math.max(panel.layout.w, minW),
			h: Math.max(panel.layout.h, minH),
			minW,
			minH,
		};
	});
	return {
		lg,
		md: pack(
			lg.map((item) => ({ ...item, w: Math.min(8, item.w) })),
			8,
		),
		sm: pack(
			lg.map((item) => ({ ...item, w: Math.min(4, item.w) })),
			4,
		),
		xs: pack(
			lg.map((item) => ({
				...item,
				w: 1,
				minW: 1,
				maxW: 1,
				h: Math.max(4, item.h),
			})),
			1,
		),
	};
}
const storageKey = (id: string, version: number) =>
	`hono-standard:dashboard-layout:${id}:v${version}`;

const storedLayoutItemSchema = z
	.object({
		i: z.string().min(1).max(64),
		x: z.number().int().min(0).max(1_000),
		y: z.number().int().min(0).max(100_000),
		w: z.number().int().min(1).max(1_000),
		h: z.number().int().min(1).max(1_000),
		minW: z.number().int().min(1).max(1_000).optional(),
		minH: z.number().int().min(1).max(1_000).optional(),
		maxW: z.number().int().min(1).max(1_000).optional(),
		maxH: z.number().int().min(1).max(1_000).optional(),
	})
	.strict();
const storedLayoutsSchema = z
	.object({
		layoutVersion: z.number().int().min(1),
		updatedAt: z.string().datetime().optional(),
		layouts: z
			.object({
				lg: z.array(storedLayoutItemSchema).max(100),
				md: z.array(storedLayoutItemSchema).max(100),
				sm: z.array(storedLayoutItemSchema).max(100),
				xs: z.array(storedLayoutItemSchema).max(100),
			})
			.strict(),
	})
	.strict();

const overlaps = (left: DashboardLayoutItem, right: DashboardLayoutItem) =>
	left.x < right.x + right.w &&
	left.x + left.w > right.x &&
	left.y < right.y + right.h &&
	left.y + left.h > right.y;

const normalizeStoredLayout = (
	stored: DashboardLayoutItem[],
	defaults: DashboardLayoutItem[],
	breakpoint: DashboardBreakpoint,
) => {
	const cols = dashboardColumns[breakpoint];
	const defaultById = new Map(defaults.map((item) => [item.i, item]));
	const seen = new Set<string>();
	const candidates = [...stored, ...defaults].flatMap((item) => {
		const base = defaultById.get(item.i);
		if (!base || seen.has(item.i)) return [];
		seen.add(item.i);
		const minW = breakpoint === "xs" ? 1 : Math.min(cols, base.minW ?? 1);
		const maxW = Math.max(minW, Math.min(cols, base.maxW ?? cols));
		const minH = base.minH ?? 1;
		const maxH = Math.max(minH, base.maxH ?? 24);
		const w = breakpoint === "xs" ? 1 : Math.min(maxW, Math.max(minW, item.w));
		const h = Math.min(maxH, Math.max(minH, item.h));
		return [
			{
				...base,
				x: breakpoint === "xs" ? 0 : Math.min(Math.max(0, item.x), cols - w),
				y: Math.max(0, item.y),
				w,
				h,
			},
		];
	});
	const placed: DashboardLayoutItem[] = [];
	for (const candidate of candidates.sort((a, b) => a.y - b.y || a.x - b.x)) {
		const next = { ...candidate };
		while (placed.some((item) => overlaps(next, item))) next.y += 1;
		placed.push(next);
	}
	return placed;
};

export function restoreLayouts(
	manifest: PublicDashboardManifestV2,
	minimumSize?: DashboardMinimumSizeResolver,
): DashboardLayouts {
	const defaults = layoutsFromManifest(manifest, minimumSize);
	if (typeof window === "undefined") return defaults;
	const key = storageKey(manifest.id, manifest.layoutVersion);
	try {
		const raw = window.localStorage.getItem(key);
		if (!raw) return defaults;
		const parsed = storedLayoutsSchema.safeParse(JSON.parse(raw));
		if (
			!parsed.success ||
			parsed.data.layoutVersion !== manifest.layoutVersion
		) {
			window.localStorage.removeItem(key);
			return defaults;
		}
		return Object.fromEntries(
			(Object.keys(defaults) as DashboardBreakpoint[]).map((bp) => [
				bp,
				normalizeStoredLayout(parsed.data.layouts[bp], defaults[bp], bp),
			]),
		) as DashboardLayouts;
	} catch {
		window.localStorage.removeItem(key);
		return defaults;
	}
}

export function moveDashboardLayout(
	layouts: DashboardLayouts,
	id: string,
	direction: "up" | "down",
): DashboardLayouts {
	const next = { ...layouts };
	for (const breakpoint of Object.keys(next) as DashboardBreakpoint[]) {
		const items = [...next[breakpoint]].sort((a, b) => a.y - b.y || a.x - b.x);
		const index = items.findIndex((item) => item.i === id);
		const target = direction === "up" ? index - 1 : index + 1;
		if (index < 0 || target < 0 || target >= items.length) continue;
		[items[index], items[target]] = [items[target], items[index]];
		next[breakpoint] = pack(items, dashboardColumns[breakpoint]);
	}
	return next;
}

export function writeStoredLayouts(
	id: string,
	version: number,
	layouts: DashboardLayouts,
) {
	if (typeof window === "undefined") return true;
	try {
		const storedLayouts = Object.fromEntries(
			(Object.keys(layouts) as DashboardBreakpoint[]).map((breakpoint) => [
				breakpoint,
				layouts[breakpoint].map((item) => ({
					i: item.i,
					x: item.x,
					y: item.y,
					w: item.w,
					h: item.h,
					...(item.minW === undefined ? {} : { minW: item.minW }),
					...(item.minH === undefined ? {} : { minH: item.minH }),
					...(item.maxW === undefined ? {} : { maxW: item.maxW }),
					...(item.maxH === undefined ? {} : { maxH: item.maxH }),
				})),
			]),
		);
		window.localStorage.setItem(
			storageKey(id, version),
			JSON.stringify({
				layoutVersion: version,
				updatedAt: new Date().toISOString(),
				layouts: storedLayouts,
			}),
		);
		return true;
	} catch {
		return false;
	}
}
