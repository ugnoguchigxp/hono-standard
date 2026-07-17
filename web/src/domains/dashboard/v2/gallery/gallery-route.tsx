import { createLazyRoute, Link, useSearch } from "@tanstack/react-router";
import { type KeyboardEvent, useMemo, useState } from "react";
import { useAuth } from "../../../../auth-context";
import { resolveDashboardSearch } from "../../../../routes/dashboard-route-search";
import { DashboardInspector } from "../inspector/inspector";
import { DashboardGridV2 } from "../layout/dashboard-grid";
import {
	type DashboardBreakpoint,
	type DashboardLayoutItem,
	type DashboardLayouts,
	dashboardColumns,
	restoreLayouts,
} from "../layout/layout";
import { PanelShell } from "../panel/panel-shell";
import {
	useDashboardManifestV2,
	useDashboardPanelsV2,
	useDashboardVariablesV2,
} from "../query-options";
import { createDashboardFrontendRuntime } from "../runtime/dashboard-runtime";
import { coreVisualizationCatalog } from "../visualizations/catalog";

const runtime = createDashboardFrontendRuntime({
	visualizations: coreVisualizationCatalog,
});
const galleryId = "visualization-gallery";

const galleryCategories = [
	{
		id: "cartesian",
		label: "Cartesian",
		description: "Time series, bars, and combined axis charts",
		types: ["core.timeseries", "core.bar", "core.composed", "core.candlestick"],
	},
	{
		id: "kpi-status",
		label: "KPI & Status",
		description: "Stats, gauges, progress, and status signals",
		types: [
			"core.stat",
			"core.gauge",
			"core.bar-gauge",
			"core.bullet",
			"core.progress",
			"core.traffic-light",
		],
	},
	{
		id: "composition",
		label: "Composition",
		description: "Composition, ranking, relationship, and funnel charts",
		types: [
			"core.pie",
			"core.radar",
			"core.radial-bar",
			"core.scatter",
			"core.node-graph",
			"geo.map",
			"core.funnel",
		],
	},
	{
		id: "hierarchy-flow",
		label: "Hierarchy & Flow",
		description: "Treemaps, sunbursts, and flow diagrams",
		types: ["core.treemap", "core.sunburst", "core.sankey"],
	},
	{
		id: "observability",
		label: "Observability",
		description: "Logs, traces, and profile investigation",
		types: [
			"observability.logs",
			"observability.trace-waterfall",
			"observability.flame-graph",
		],
	},
	{
		id: "distribution",
		label: "Distribution",
		description: "Histograms, heatmaps, box plots, and calendars",
		types: [
			"core.histogram",
			"core.heatmap",
			"core.box-plot",
			"core.calendar-heatmap",
		],
	},
	{
		id: "data-states",
		label: "Data & States",
		description:
			"Tables with clear empty, quality, freshness, and limit states",
		types: ["core.table"],
	},
] as const;

type GalleryCategoryId = (typeof galleryCategories)[number]["id"];
type GalleryPanel = {
	id: string;
	visualization: { type: string };
};

function getGalleryCategoryId(panel: GalleryPanel): GalleryCategoryId {
	if (
		panel.id.startsWith("state-") ||
		panel.visualization.type === "core.table"
	)
		return "data-states";
	return (
		galleryCategories.find((category) =>
			(category.types as readonly string[]).includes(panel.visualization.type),
		)?.id ?? "data-states"
	);
}

function packGalleryLayout(
	items: DashboardLayoutItem[],
	columns: number,
	visiblePanelIds: ReadonlySet<string>,
) {
	let x = 0;
	let y = 0;
	let rowHeight = 0;
	return items
		.filter((item) => visiblePanelIds.has(item.i))
		.sort((left, right) => left.y - right.y || left.x - right.x)
		.map((item) => {
			const width = Math.min(columns, item.w);
			if (x + width > columns) {
				x = 0;
				y += rowHeight;
				rowHeight = 0;
			}
			const packed = { ...item, x, y, w: width };
			x += width;
			rowHeight = Math.max(rowHeight, item.h);
			if (x >= columns) {
				x = 0;
				y += rowHeight;
				rowHeight = 0;
			}
			return packed;
		});
}

function filterGalleryLayouts(
	layouts: DashboardLayouts,
	visiblePanelIds: ReadonlySet<string>,
): DashboardLayouts {
	return Object.fromEntries(
		(Object.keys(dashboardColumns) as DashboardBreakpoint[]).map(
			(breakpoint) => [
				breakpoint,
				packGalleryLayout(
					layouts[breakpoint],
					dashboardColumns[breakpoint],
					visiblePanelIds,
				),
			],
		),
	) as DashboardLayouts;
}

function AuthenticatedGallery() {
	const search = useSearch({ from: "/dashboard/gallery" });
	const [activeCategory, setActiveCategory] =
		useState<GalleryCategoryId>("cartesian");
	const [inspector, setInspector] = useState<string | null>(null);
	const manifestQuery = useDashboardManifestV2(galleryId);
	const manifest = manifestQuery.data;
	const visiblePanels = useMemo(
		() =>
			manifest?.panels.filter(
				(panel) => getGalleryCategoryId(panel) === activeCategory,
			) ?? [],
		[activeCategory, manifest],
	);
	const visibleManifest = useMemo(
		() => (manifest ? { ...manifest, panels: visiblePanels } : undefined),
		[manifest, visiblePanels],
	);
	const resolved = manifest
		? resolveDashboardSearch({ routeSearch: search, manifest })
		: undefined;
	const variables = useDashboardVariablesV2(
		galleryId,
		manifest,
		resolved?.value.range ?? { kind: "relative", value: "1h" },
		resolved?.value.timezone ?? "UTC",
		resolved?.value.filters ?? {},
	);
	const request = {
		schemaVersion: 2 as const,
		range: resolved?.value.range ?? {
			kind: "relative" as const,
			value: "1h" as const,
		},
		timezone: resolved?.value.timezone ?? "UTC",
		filters: resolved?.value.filters ?? {},
		maxDataPoints: 800,
		maxRows: 2_000,
	};
	const panels = useDashboardPanelsV2(
		galleryId,
		visibleManifest,
		request,
		0,
		!!manifest && !variables.some((item) => item.isPending),
	);
	const layouts = useMemo(() => {
		if (!manifest) return { lg: [], md: [], sm: [], xs: [] };
		const restored = restoreLayouts(
			manifest,
			(type) => runtime.visualizations.get(type)?.descriptor.minimumSize,
		);
		return filterGalleryLayouts(
			restored,
			new Set(visiblePanels.map((panel) => panel.id)),
		);
	}, [manifest, visiblePanels]);
	const activeCategoryDetails =
		galleryCategories.find((category) => category.id === activeCategory) ??
		galleryCategories[0];
	const inspectedIndex = inspector
		? visiblePanels.findIndex((panel) => panel.id === inspector)
		: -1;
	const inspectedPanel =
		inspectedIndex >= 0 ? visiblePanels[inspectedIndex] : undefined;

	function handleCategoryKeyDown(
		event: KeyboardEvent<HTMLButtonElement>,
		currentIndex: number,
	) {
		let nextIndex = currentIndex;
		if (event.key === "ArrowRight" || event.key === "ArrowDown")
			nextIndex = (currentIndex + 1) % galleryCategories.length;
		else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
			nextIndex =
				(currentIndex - 1 + galleryCategories.length) %
				galleryCategories.length;
		else if (event.key === "Home") nextIndex = 0;
		else if (event.key === "End") nextIndex = galleryCategories.length - 1;
		else return;

		event.preventDefault();
		const nextCategory = galleryCategories[nextIndex];
		setActiveCategory(nextCategory.id);
		window.requestAnimationFrame(() => {
			document.getElementById(`gallery-tab-${nextCategory.id}`)?.focus();
		});
	}
	if (manifestQuery.isPending)
		return (
			<main className="dashboard-page">
				<div className="dashboard-loading">Loading visualization gallery…</div>
			</main>
		);
	if (manifestQuery.isError || !manifest)
		return (
			<main className="dashboard-page">
				<div
					className="dashboard-panel-state dashboard-panel-error"
					role="alert"
				>
					{manifestQuery.error?.message ?? "Gallery unavailable"}
				</div>
			</main>
		);
	return (
		<main className="dashboard-page" data-dashboard-ready="true">
			<section
				className="dashboard-toolbar"
				aria-label="Visualization gallery controls"
			>
				<div className="dashboard-toolbar-row">
					<div className="dashboard-title-block">
						<div className="dashboard-kicker">Renderer conformance</div>
						<h1>{manifest.title}</h1>
						<p>{manifest.description}</p>
					</div>
					<Link className="auth-open-button" to="/dashboard">
						Operations dashboard
					</Link>
				</div>
			</section>
			<section
				className="dashboard-gallery-categories"
				aria-labelledby="gallery-categories-heading"
			>
				<div className="dashboard-gallery-categories-heading">
					<div>
						<h2 id="gallery-categories-heading">Visualization families</h2>
						<p>{activeCategoryDetails.description}</p>
					</div>
					<strong>{visiblePanels.length} examples</strong>
				</div>
				<div
					className="dashboard-gallery-tabs"
					role="tablist"
					aria-label="Visualization families"
				>
					{galleryCategories.map((category, index) => {
						const isActive = category.id === activeCategory;
						const count = manifest.panels.filter(
							(panel) => getGalleryCategoryId(panel) === category.id,
						).length;
						return (
							<button
								type="button"
								key={category.id}
								id={`gallery-tab-${category.id}`}
								role="tab"
								aria-selected={isActive}
								aria-controls="gallery-panel"
								tabIndex={isActive ? 0 : -1}
								onClick={() => setActiveCategory(category.id)}
								onKeyDown={(event) => handleCategoryKeyDown(event, index)}
							>
								<span>{category.label}</span>
								<span className="dashboard-gallery-tab-count">{count}</span>
							</button>
						);
					})}
				</div>
			</section>
			<section
				className="dashboard-gallery-panel"
				id="gallery-panel"
				role="tabpanel"
				aria-labelledby={`gallery-tab-${activeCategory}`}
			>
				<DashboardGridV2
					layouts={layouts}
					editMode={false}
					onChange={() => undefined}
				>
					{visiblePanels.map((panel, index) => {
						const query = panels[index];
						if (!query) return null;
						return (
							<div key={panel.id} className="dashboard-grid-item">
								<PanelShell
									dashboardId={galleryId}
									panel={panel}
									query={query}
									visualizations={runtime.visualizations}
									transformations={runtime.transformations}
									timezone={request.timezone}
									editMode={false}
									onInspect={() => setInspector(panel.id)}
									onMove={() => undefined}
								/>
							</div>
						);
					})}
				</DashboardGridV2>
			</section>
			{inspector && inspectedPanel ? (
				<DashboardInspector
					panel={inspectedPanel}
					response={panels[inspectedIndex]?.data}
					request={request}
					error={panels[inspectedIndex]?.error}
					onClose={() => setInspector(null)}
				/>
			) : null}
		</main>
	);
}

export function DashboardGalleryPage() {
	const { authUser, authLoading } = useAuth();
	if (authLoading)
		return (
			<main className="center-shell">
				<div className="muted">Checking session...</div>
			</main>
		);
	if (!authUser)
		return (
			<main className="center-shell">
				<section className="signed-in-panel">
					<h1>Login required</h1>
					<p>The visualization gallery is available after sign-in.</p>
					<Link
						to="/login"
						search={{ redirect: "/dashboard/gallery" }}
						className="auth-open-button"
					>
						Login
					</Link>
				</section>
			</main>
		);
	return <AuthenticatedGallery />;
}

export const dashboardGalleryLazyRoute = createLazyRoute("/dashboard/gallery")({
	component: DashboardGalleryPage,
});
