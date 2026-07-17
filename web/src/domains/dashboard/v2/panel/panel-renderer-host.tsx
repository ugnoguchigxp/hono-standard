import type { PanelManifestV2 } from "@shared/schemas/dashboard.schema";
import { useRendererModule } from "../runtime/renderer-loader";
import type { FrontendVisualizationRegistry } from "../runtime/visualization-registry";
import type {
	DashboardPanelInteraction,
	DashboardVisualizationTheme,
	VisualizationResolution,
} from "../runtime/visualization-types";
import { PanelRenderErrorBoundary } from "./panel-render-error-boundary";
export function PanelRendererHost({
	dashboardId,
	panel,
	resolution,
	registry,
	timezone,
	interaction,
	theme,
	dataKey,
	resolvedRange,
	intervalMs,
	onRetry,
}: {
	dashboardId: string;
	panel: PanelManifestV2;
	resolution: Extract<VisualizationResolution, { status: "ready" }>;
	registry: FrontendVisualizationRegistry;
	timezone: string;
	interaction: DashboardPanelInteraction;
	theme: DashboardVisualizationTheme;
	dataKey: string;
	resolvedRange?: { from: number; to: number };
	intervalMs?: number;
	onRetry?: () => void;
}) {
	const loaded = useRendererModule(registry, resolution.definition);
	if (loaded.isPending)
		return <div className="dashboard-panel-state">Loading visualization…</div>;
	if (loaded.error || !loaded.data)
		return (
			<div className="dashboard-panel-state dashboard-panel-error" role="alert">
				<p>Visualization is unavailable.</p>
				<button type="button" onClick={loaded.retryLoad}>
					Retry
				</button>
			</div>
		);
	const Renderer = loaded.data.Renderer;
	const context = {
		dashboardId,
		panel,
		frames: resolution.frames,
		annotationLayers: resolution.annotationLayers,
		preset: resolution.preset,
		config: resolution.config,
		timezone,
		locale: navigator.language,
		theme,
		interaction,
		resolvedRange,
		intervalMs,
	};
	let summary: string;
	try {
		summary = loaded.data.buildAccessibleSummary(context);
		if (!summary.trim()) throw new Error("Visualization summary is empty");
	} catch {
		return (
			<div className="dashboard-panel-state dashboard-panel-error" role="alert">
				<p>Visualization accessibility summary is unavailable.</p>
				<button type="button" onClick={loaded.retryLoad}>
					Retry
				</button>
			</div>
		);
	}
	return (
		<PanelRenderErrorBoundary
			onRetry={() => {
				loaded.retryLoad();
				onRetry?.();
			}}
			resetKey={`${dataKey}:${JSON.stringify(panel.visualization)}:${resolution.frames
				.map((frame) => `${frame.refId}:${frame.fields[0]?.values.length ?? 0}`)
				.join("|")}`}
		>
			<p className="dashboard-visually-hidden">{summary}</p>
			<div className="dashboard-panel-visual">
				<Renderer {...context} />
			</div>
		</PanelRenderErrorBoundary>
	);
}
