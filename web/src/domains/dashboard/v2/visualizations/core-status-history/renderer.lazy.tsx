import type { StatusHistoryConfigV1 } from "@shared/schemas/dashboard/state-visualizations.schema";
import { useState } from "react";
import type { DashboardRendererContext } from "../../runtime/visualization-types";
import {
	DeferredAnnotationLayer,
	DeferredAnnotationList,
} from "../annotations/lazy-components";
import { buildStateSamples } from "../state/sample-model";
import { SampleTable, StateLegend } from "../state/primitives";
import { historySummary } from "../state/summary";
import { resolveFrameTimeRange } from "../state/time-range";
import type { StateSemantic } from "../state/state-value";
import { resolveThemeColor } from "../../runtime/theme";
export function Renderer({
	frames,
	config,
	panel,
	annotationLayers,
	resolvedRange,
}: DashboardRendererContext<StatusHistoryConfigV1>) {
	const [hiddenStates, setHiddenStates] = useState<Set<StateSemantic>>(
		new Set(),
	);
	const frame = frames[0];
	if (!frame) return <div role="alert">Status history data is unavailable</div>;
	const range = resolveFrameTimeRange(
		frame,
		resolvedRange,
		config.expectedCadenceMs,
	);
	const model = buildStateSamples(frame, { ...config, range });
	const toggleState = (semantic: StateSemantic) =>
		setHiddenStates((current) => {
			const next = new Set(current);
			current.has(semantic) ? next.delete(semantic) : next.add(semantic);
			return next;
		});
	const lanes = [
		...new Map(
			model.samples.map((item) => [item.laneId, item.laneLabel]),
		).entries(),
	];
	const columns = config.latestColumn ? model.columns.slice(-1) : model.columns;
	const from = range.from;
	const to = range.to;
	const width = Math.max(360, 120 + columns.length * config.cellWidth);
	const height = Math.max(64, lanes.length * config.rowHeight + 24);
	const plotRect = {
		x: 110,
		y: 12,
		width: Math.max(config.cellWidth, columns.length * config.cellWidth),
		height: Math.max(config.rowHeight, lanes.length * config.rowHeight),
	};
	return (
		<figure
			className="dashboard-status-history"
			aria-label={panel.accessibleLabel}
		>
			<div className="dashboard-state-scroll">
				<svg
					viewBox={`0 0 ${width} ${height}`}
					role="img"
					aria-label="Status history"
				>
					<g transform="translate(110,12)">
						{lanes.map(([laneId, label], laneIndex) => (
							<g
								key={laneId}
								transform={`translate(0,${laneIndex * config.rowHeight})`}
							>
								<text x={-8} y={config.rowHeight / 2 + 4} textAnchor="end">
									{label}
								</text>
								{columns.map((time, columnIndex) => {
									const sample = model.samples.find(
										(item) => item.laneId === laneId && item.time === time,
									);
									const previous = model.samples
										.filter(
											(item) => item.laneId === laneId && item.time < time,
										)
										.at(-1);
									const unchanged =
										config.emphasizeChanges &&
										!!sample &&
										!!previous &&
										sample.state.raw === previous.state.raw;
									return (
										<rect
											key={`${laneId}:${time}`}
											x={columnIndex * config.cellWidth}
											y={2}
											width={config.cellWidth - 2}
											height={config.rowHeight - 4}
											fill={
												hiddenStates.has(sample?.state.semantic ?? "unknown") ||
												unchanged
													? "transparent"
													: sample?.missing &&
															config.missing === "unknown-token"
														? "var(--color-muted)"
														: sample
															? resolveThemeColor(sample.state.colorToken)
															: "transparent"
											}
										>
											<title>{`${label} ${time}: ${sample?.state.text ?? "missing"}`}</title>
										</rect>
									);
								})}
							</g>
						))}
					</g>
				</svg>
				{annotationLayers?.length ? (
					<DeferredAnnotationLayer
						layers={annotationLayers}
						viewport={{
							xDomain: [from, to],
							plotRect,
							canvasSize: { width, height },
						}}
					/>
				) : null}
			</div>
			<StateLegend hidden={hiddenStates} onToggle={toggleState} />
			<p className="dashboard-panel-summary">{historySummary(model.samples)}</p>
			<SampleTable samples={model.samples} />
			{annotationLayers?.length ? (
				<DeferredAnnotationList
					layers={annotationLayers}
					range={{ from, to }}
				/>
			) : null}
		</figure>
	);
}
export function buildAccessibleSummary({
	frames,
	config,
	panel,
	resolvedRange,
}: DashboardRendererContext<StatusHistoryConfigV1>) {
	const frame = frames[0];
	const range = frame
		? resolveFrameTimeRange(frame, resolvedRange, config.expectedCadenceMs)
		: undefined;
	return `${panel.accessibleLabel}: ${frame && range ? historySummary(buildStateSamples(frame, { ...config, range }).samples) : "Status history data is unavailable"}`.slice(
		0,
		1000,
	);
}
