import type {
	PanelManifestV2,
	PanelQueryResponseV2,
} from "@shared/schemas/dashboard.schema";
import type { UseQueryResult } from "@tanstack/react-query";
import {
	ArrowDown,
	ArrowUp,
	DatabaseZap,
	GripVertical,
	Info,
	RefreshCw,
	TriangleAlert,
} from "lucide-react";
import { type ReactNode, useEffect, useState } from "react";
import { frameRowCount, selectPanelFrames } from "../runtime/frame-selection";
import { derivePanelState } from "../runtime/panel-state";
import { createDashboardTheme } from "../runtime/theme";
import type { FrontendTransformationRegistry } from "../runtime/transformation-registry";
import { useBrowserTransformations } from "../runtime/use-browser-transformations";
import type { FrontendVisualizationRegistry } from "../runtime/visualization-registry";
import type { DashboardPanelInteraction } from "../runtime/visualization-types";
import { PanelNotices } from "./panel-notices";
import { PanelRendererHost } from "./panel-renderer-host";
import { PanelTable } from "./panel-table";

const useDashboardNow = () => {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const timer = window.setInterval(() => setNow(Date.now()), 30_000);
		return () => window.clearInterval(timer);
	}, []);
	return now;
};

export function PanelShell({
	dashboardId,
	panel,
	query,
	visualizations,
	transformations,
	timezone,
	onInspect,
	headerLinks,
	editMode,
	onMove,
}: {
	dashboardId: string;
	panel: PanelManifestV2;
	query: UseQueryResult<PanelQueryResponseV2, Error>;
	visualizations: FrontendVisualizationRegistry;
	transformations: FrontendTransformationRegistry;
	timezone: string;
	onInspect?: () => void;
	headerLinks?: ReactNode;
	editMode: boolean;
	onMove: (direction: "up" | "down") => void;
}) {
	const transform = useBrowserTransformations(
		panel,
		query.data,
		transformations,
	);
	const hasBrowserTransformations = panel.transformations.some(
		(item) => !item.disabled && item.execution === "browser",
	);
	const frames = transform.error
		? []
		: (transform.data?.frames ??
			(hasBrowserTransformations ? [] : (query.data?.frames ?? [])));
	const resolution = visualizations.resolve({
		spec: panel.visualization,
		frames,
	});
	const [tableMode, setTableMode] = useState(
		panel.visualization.tableFallback.defaultView === "table",
	);
	useEffect(() => {
		setTableMode(panel.visualization.tableFallback.defaultView === "table");
	}, [panel.visualization]);
	const [hidden, setHidden] = useState<Set<string>>(new Set());
	const fieldKeys = frames.flatMap((frame) =>
		frame.fields.map((field) =>
			frames.length > 1 ? `${frame.refId}:${field.key}` : field.key,
		),
	);
	const interaction: DashboardPanelInteraction = {
		hiddenFieldKeys: hidden,
		toggleField: (key) =>
			setHidden((current) => {
				const next = new Set(current);
				next.has(key) ? next.delete(key) : next.add(key);
				return next;
			}),
		isolateField: (key) =>
			setHidden(new Set(fieldKeys.filter((item) => item !== key))),
		resetFields: () => setHidden(new Set()),
		onDatumActivate: () => undefined,
	};
	const selectedFrames = selectPanelFrames(panel, frames);
	const hasSelectedData = selectedFrames.some(
		(frame) => frameRowCount(frame) > 0,
	);
	const transformationComplete =
		!hasBrowserTransformations || !!transform.data || !!transform.error;
	const responseComplete = !!query.data && transformationComplete;
	const now = useDashboardNow();
	const dataThrough = query.data?.state.dataThrough;
	const staleAfterMs = query.data?.state.staleAfterMs;
	const stale =
		!!dataThrough &&
		staleAfterMs !== undefined &&
		now >= Date.parse(dataThrough) + staleAfterMs;
	const state = derivePanelState({
		isPending:
			query.isPending ||
			(hasBrowserTransformations && transform.isPending) ||
			(hasBrowserTransformations && !transform.data && !transform.error),
		error: query.error ?? transform.error,
		hasData: hasSelectedData && !transform.error && responseComplete,
		emptyReason:
			responseComplete &&
			!transform.error &&
			resolution.status !== "missing-frame" &&
			!hasSelectedData
				? (query.data?.state.emptyReason ?? "no-records")
				: undefined,
		partial: query.data?.state.partial || transform.data?.truncated,
		stale,
		incompatible: resolution.status !== "ready" && hasSelectedData,
	});
	const retryPanel = () => {
		if (transform.error) void transform.refetch();
		else void query.refetch({ cancelRefetch: true });
	};
	const emptyMessage =
		query.data?.state.emptyReason === "filter-no-match"
			? {
					title: "No matching data",
					detail: "Adjust the selected filters to broaden the result.",
				}
			: query.data?.state.emptyReason === "not-configured"
				? {
						title: "Panel not configured",
						detail: "Add a query or data source to finish this panel.",
					}
				: {
						title: "No data for this period",
						detail: "The query completed successfully but returned no rows.",
					};
	const responseNotices = query.data?.state.notices ?? [];
	const partialNotice = responseNotices.find(
		(notice) => notice.code === "PARTIAL_DATA",
	);
	const truncatedNotice = responseNotices.find(
		(notice) => notice.code === "DATA_TRUNCATED",
	);
	const remainingNotices = [
		...responseNotices.filter(
			(notice) =>
				notice.code !== "PARTIAL_DATA" && notice.code !== "DATA_TRUNCATED",
		),
		...(transform.data?.notices ?? []),
		...resolution.annotationNotices,
	];
	const resolvedRange = query.data
		? {
				from: Date.parse(query.data.resolvedRange.from),
				to: Date.parse(query.data.resolvedRange.to),
			}
		: undefined;
	return (
		<article
			className="dashboard-panel"
			data-panel-id={panel.id}
			aria-busy={state === "loading"}
		>
			<header className="dashboard-panel-header">
				<div className="dashboard-panel-heading">
					{editMode ? (
						<button
							type="button"
							className="dashboard-panel-drag-handle"
							aria-label={`Drag ${panel.title}`}
						>
							<GripVertical className="dashboard-drag-indicator" />
						</button>
					) : null}
					<div>
						<h2>{panel.title}</h2>
						<p>{panel.description}</p>
					</div>
				</div>
				<div className="dashboard-panel-actions">
					{editMode ? (
						<>
							<button
								type="button"
								onClick={() => onMove("up")}
								aria-label={`Move ${panel.title} up`}
							>
								<ArrowUp className="icon" />
							</button>
							<button
								type="button"
								onClick={() => onMove("down")}
								aria-label={`Move ${panel.title} down`}
							>
								<ArrowDown className="icon" />
							</button>
						</>
					) : null}
					{onInspect ? (
						<button
							type="button"
							onClick={onInspect}
							aria-label={`View details for ${panel.title}`}
							title={`View details for ${panel.title}`}
						>
							<Info className="icon" aria-hidden="true" />
						</button>
					) : null}
					<button
						type="button"
						onClick={() => void query.refetch({ cancelRefetch: true })}
						aria-label={`Refresh ${panel.title}`}
						title={`Refresh ${panel.title}`}
					>
						<RefreshCw className="icon" aria-hidden="true" />
					</button>
				</div>
			</header>
			{headerLinks ? (
				<nav
					className="dashboard-panel-links"
					aria-label={`${panel.title} links`}
				>
					{headerLinks}
				</nav>
			) : null}
			<div className="dashboard-panel-body">
				{state === "loading" ? (
					<div className="dashboard-panel-state">Loading…</div>
				) : state === "error" ? (
					<div
						className="dashboard-panel-state dashboard-panel-error"
						role="alert"
					>
						<p>
							{query.error?.message ??
								transform.error?.message ??
								"Panel unavailable"}
						</p>
						<button type="button" onClick={retryPanel}>
							Retry
						</button>
					</div>
				) : state === "empty" ? (
					<div className="dashboard-panel-empty" role="status">
						<div className="dashboard-panel-empty-icon" aria-hidden="true">
							<DatabaseZap />
						</div>
						<strong>{emptyMessage.title}</strong>
						<span>{emptyMessage.detail}</span>
					</div>
				) : resolution.status !== "ready" ? (
					panel.visualization.tableFallback.enabled &&
					resolution.status !== "missing-frame" &&
					selectedFrames.length > 0 ? (
						<>
							<p className="dashboard-panel-warning" role="status">
								{resolution.message} Showing table fallback.
							</p>
							<PanelTable
								frames={selectedFrames}
								panel={panel}
								timezone={timezone}
							/>
						</>
					) : (
						<div className="dashboard-panel-state" role="status">
							{resolution.message}
						</div>
					)
				) : tableMode ? (
					<PanelTable
						frames={resolution.frames}
						panel={panel}
						timezone={timezone}
					/>
				) : (
					<PanelRendererHost
						dashboardId={dashboardId}
						panel={panel}
						resolution={resolution}
						registry={visualizations}
						timezone={timezone}
						interaction={interaction}
						theme={createDashboardTheme()}
						dataKey={query.data?.requestId ?? "pending"}
						resolvedRange={resolvedRange}
						intervalMs={query.data?.intervalMs}
					/>
				)}
				{query.data?.state.truncated || transform.data?.truncated ? (
					<div
						className="dashboard-data-status"
						data-status="truncated"
						role="status"
					>
						<TriangleAlert aria-hidden="true" />
						<div>
							<strong>Result limited</strong>
							<span>
								{truncatedNotice?.message ??
									"Only a subset of the available rows is shown."}
							</span>
						</div>
					</div>
				) : query.data?.state.partial ? (
					<div
						className="dashboard-data-status"
						data-status="partial"
						role="status"
					>
						<TriangleAlert aria-hidden="true" />
						<div>
							<strong>Partial data</strong>
							<span>
								{partialNotice?.message ??
									"Some expected data points are not available yet."}
							</span>
						</div>
					</div>
				) : null}
				{state === "stale" ? (
					<div
						className="dashboard-data-status"
						data-status="stale"
						role="status"
					>
						<TriangleAlert aria-hidden="true" />
						<div>
							<strong>Data may be out of date</strong>
							<span>The latest sample is older than the freshness limit.</span>
						</div>
					</div>
				) : null}
				{query.isFetching && query.data ? (
					<p className="dashboard-panel-warning" role="status">
						Refreshing data…
					</p>
				) : null}
				<PanelNotices notices={remainingNotices} />
			</div>
			{resolution.status === "ready" &&
			panel.visualization.tableFallback.enabled &&
			hasSelectedData ? (
				<div className="dashboard-panel-view-toggle">
					<button
						type="button"
						aria-pressed={!tableMode}
						onClick={() => setTableMode(false)}
					>
						Visualization
					</button>
					<button
						type="button"
						aria-pressed={tableMode}
						onClick={() => setTableMode(true)}
					>
						Table
					</button>
				</div>
			) : null}
		</article>
	);
}
