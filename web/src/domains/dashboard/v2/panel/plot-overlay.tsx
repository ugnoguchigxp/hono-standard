import type { ResolvedAnnotationLayer } from "../runtime/visualization-types";
import type { AnnotationViewport } from "../visualizations/annotations/annotation-layer";
import { DeferredAnnotationLayer } from "../visualizations/annotations/lazy-components";

export type PlotViewport = AnnotationViewport;
export function PlotOverlay({
	layers,
	viewport,
}: {
	layers: ResolvedAnnotationLayer[];
	viewport: PlotViewport;
}) {
	if (layers.length === 0) return null;
	return (
		<section className="dashboard-plot-overlay" aria-label="Plot annotations">
			<DeferredAnnotationLayer layers={layers} viewport={viewport} />
		</section>
	);
}
