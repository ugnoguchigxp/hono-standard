import type { StateTimelineConfigV1 } from "@shared/schemas/dashboard/state-visualizations.schema";
import { useState } from "react";
import type { DashboardRendererContext } from "../../runtime/visualization-types";
import {
	DeferredAnnotationLayer,
	DeferredAnnotationList,
} from "../annotations/lazy-components";
import { buildStateIntervals } from "../state/interval-model";
import { StateLegend, StateTable } from "../state/primitives";
import { timelineSummary } from "../state/summary";
import { resolveFrameTimeRange } from "../state/time-range";
import type { StateSemantic } from "../state/state-value";
import { resolveThemeColor } from "../../runtime/theme";

function modelFor(
	frame: NonNullable<
		DashboardRendererContext<StateTimelineConfigV1>["frames"][number]
	>,
	config: StateTimelineConfigV1,
	resolvedRange?: { from: number; to: number },
) {
	const range = resolveFrameTimeRange(
		frame,
		resolvedRange,
		config.expectedCadenceMs,
	);
	return buildStateIntervals(frame, {
		range,
		...config,
	});
}
export function Renderer({
	frames,
	config,
	panel,
	annotationLayers,
	resolvedRange,
}: DashboardRendererContext<StateTimelineConfigV1>) {
	const [hiddenStates, setHiddenStates] = useState<Set<StateSemantic>>(
		new Set(),
	);
	const frame = frames[0];
	if (!frame) return <div role="alert">State timeline data is unavailable</div>;
	const model = modelFor(frame, config, resolvedRange);
	const toggleState = (semantic: StateSemantic) =>
		setHiddenStates((current) => {
			const next = new Set(current);
			current.has(semantic) ? next.delete(semantic) : next.add(semantic);
			return next;
		});
	const lanes = [
		...new Map(
			model.intervals.map((item) => [item.laneId, item.laneLabel]),
		).entries(),
	];
	const range = resolveFrameTimeRange(
		frame,
		resolvedRange,
		config.expectedCadenceMs,
	);
	const from = range.from;
	const to = range.to;
	const width = 720;
	const height = Math.max(64, lanes.length * config.rowHeight + 24);
	const span = Math.max(1, to - from);
	const plotRect = {
		x: 120,
		y: 12,
		width: width - 140,
		height: Math.max(config.rowHeight, lanes.length * config.rowHeight),
	};
	return (
		<figure
			className={`dashboard-state-timeline dashboard-state-timeline-${config.rowHeight === 20 ? "compact" : "standard"}`}
			aria-label={panel.accessibleLabel}
		>
			<div className="dashboard-state-scroll">
				<svg
					viewBox={`0 0 ${width} ${height}`}
					role="img"
					aria-label="State timeline"
				>
					<g transform="translate(120,12)">
						{lanes.map(([laneId, laneLabel], laneIndex) => (
							<g
								key={laneId}
								transform={`translate(0,${laneIndex * config.rowHeight})`}
							>
								<text x={-8} y={config.rowHeight / 2 + 4} textAnchor="end">
									{laneLabel}
								</text>
								{model.gaps
									.filter(
										(item) =>
											item.laneId === laneId &&
											config.gapMode === "unknown-token",
									)
									.map((item) => (
										<rect
											key={`gap:${item.laneId}:${item.start}`}
											className="dashboard-state-missing"
											x={((item.start - from) / span) * plotRect.width}
											y={2}
											width={Math.max(
												2,
												((item.end - item.start) / span) * plotRect.width,
											)}
											height={config.rowHeight - 6}
										>
											<title>Missing state data</title>
										</rect>
									))}
								{model.intervals
									.filter((item) => item.laneId === laneId)
									.map((item) => {
										const x = ((item.start - from) / span) * plotRect.width;
										const itemWidth = Math.max(
											2,
											((item.end - item.start) / span) * plotRect.width,
										);
										const showValue =
											config.showValues === "always" ||
											(config.showValues === "auto" && itemWidth >= 54);
										const label = `${item.state.text}${config.showDuration ? ` ${item.durationMs}ms` : ""}`;
										return (
											<g key={item.id}>
												<rect
													x={x}
													y={2}
													width={itemWidth}
													height={config.rowHeight - 6}
													rx={3}
													fill={
														hiddenStates.has(item.state.semantic)
															? "transparent"
															: resolveThemeColor(item.state.colorToken)
													}
													stroke={resolveThemeColor(item.state.colorToken)}
												>
													<title>{`${item.state.text}: ${item.start}–${item.end} (${item.durationMs}ms)`}</title>
												</rect>
												{showValue && !hiddenStates.has(item.state.semantic) ? (
													<text
														x={x + 4}
														y={config.rowHeight / 2 + 4}
														className="dashboard-state-cell-label"
													>
														{label.slice(0, 36)}
													</text>
												) : null}
											</g>
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
			<p className="dashboard-panel-summary">
				{timelineSummary(model.intervals, model.gaps.length)}
			</p>
			<StateTable intervals={model.intervals} gaps={model.gaps} />
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
}: DashboardRendererContext<StateTimelineConfigV1>) {
	const frame = frames[0];
	const model = frame ? modelFor(frame, config, resolvedRange) : undefined;
	return `${panel.accessibleLabel}: ${model ? timelineSummary(model.intervals, model.gaps.length) : "State timeline data is unavailable"}`.slice(
		0,
		1000,
	);
}
