import type { UptimeGridConfigV1 } from "@shared/schemas/dashboard/state-visualizations.schema";
import { useState } from "react";
import type { DashboardRendererContext } from "../../runtime/visualization-types";
import {
	DeferredAnnotationLayer,
	DeferredAnnotationList,
} from "../annotations/lazy-components";
import { buildAnnotationModel } from "../state/annotation-model";
import { StateLegend, UptimeTable } from "../state/primitives";
import { resolveFrameTimeRange } from "../state/time-range";
import { buildUptimeModel } from "../state/uptime-model";
import { uptimeSummary } from "../state/summary";
import { resolveThemeColor } from "../../runtime/theme";
import type { StateSemantic } from "../state/state-value";

function inferCadenceMs(
	frame: DashboardRendererContext<UptimeGridConfigV1>["frames"][number],
) {
	const time = frame.fields.find((field) => field.roles.includes("time"));
	if (!time) return undefined;
	const lane = frame.fields.find(
		(field) =>
			field.roles.includes("category") || field.roles.includes("series"),
	);
	const lastByLane = new Map<string, number>();
	const deltas: number[] = [];
	for (let index = 0; index < time.values.length; index += 1) {
		const value = time.values[index];
		if (typeof value !== "number" || !Number.isSafeInteger(value)) continue;
		const laneId = String(lane?.values[index] ?? "default");
		const prior = lastByLane.get(laneId);
		if (prior !== undefined && value > prior) deltas.push(value - prior);
		lastByLane.set(laneId, value);
	}
	deltas.sort((a, b) => a - b);
	return deltas[Math.floor(deltas.length / 2)];
}

function modelFor(context: DashboardRendererContext<UptimeGridConfigV1>) {
	const frame = context.frames[0];
	if (!frame) return undefined;
	const cadence = context.intervalMs ?? inferCadenceMs(frame);
	const queryRange = resolveFrameTimeRange(
		frame,
		context.resolvedRange,
		cadence,
	);
	const range =
		context.config.range === "query"
			? queryRange
			: {
					from: Math.max(
						queryRange.from,
						queryRange.to - context.config.range.rollingDays * 86_400_000,
					),
					to: queryRange.to,
				};
	const incidentTimes = context.config.showIncidentCount
		? (context.annotationLayers ?? []).flatMap(
				({ spec, frame: annotationFrame }) => {
					try {
						return buildAnnotationModel(
							spec,
							annotationFrame,
							range,
						).annotations.map((item) => item.start);
					} catch {
						return [];
					}
				},
			)
		: undefined;
	return {
		range,
		model: buildUptimeModel({
			frame,
			range,
			timezone: context.timezone,
			bucket: context.config.bucket,
			minimumCoveragePercent: context.config.minimumCoveragePercent,
			expectedCadenceMs: cadence,
			incidentTimes,
		}),
	};
}

export function Renderer(
	context: DashboardRendererContext<UptimeGridConfigV1>,
) {
	const { panel, config, annotationLayers } = context;
	const [hiddenStates, setHiddenStates] = useState<Set<StateSemantic>>(
		new Set(),
	);
	const result = modelFor(context);
	if (!result) return <div role="alert">Uptime data is unavailable</div>;
	const { model, range } = result;
	const toggleState = (semantic: StateSemantic) =>
		setHiddenStates((current) => {
			const next = new Set(current);
			current.has(semantic) ? next.delete(semantic) : next.add(semantic);
			return next;
		});
	const lanes = [
		...new Map(
			model.buckets.map((item) => [item.laneId, item.laneLabel]),
		).entries(),
	];
	const width = 720;
	const bucketsPerLane = model.buckets.length / Math.max(1, lanes.length);
	const cellWidth = Math.max(10, (width - 120) / Math.max(1, bucketsPerLane));
	const height = Math.max(64, lanes.length * 28 + 24);
	const plotRect = {
		x: 110,
		y: 12,
		width: width - 120,
		height: Math.max(28, lanes.length * 28),
	};
	return (
		<figure
			className="dashboard-uptime-grid"
			aria-label={panel.accessibleLabel}
		>
			<div className="dashboard-state-scroll">
				<svg
					viewBox={`0 0 ${width} ${height}`}
					role="img"
					aria-label="Uptime grid"
				>
					<g transform="translate(110,12)">
						{lanes.map(([laneId, label], row) => (
							<g key={laneId} transform={`translate(0,${row * 28})`}>
								<text x={-8} y={18} textAnchor="end">
									{label}
								</text>
								{model.buckets
									.filter((item) => item.laneId === laneId)
									.map((bucket, index) => {
										const fill = hiddenStates.has(bucket.dominantState)
											? "transparent"
											: bucket.uptimeRatio === null
												? config.missing === "unknown-token"
													? "var(--color-muted)"
													: "transparent"
												: resolveThemeColor(
														`--color-chart-${bucket.dominantState === "healthy" ? "success" : bucket.dominantState === "warning" ? "warning" : bucket.dominantState === "critical" ? "danger" : "muted"}`,
													);
										return (
											<g key={`${laneId}:${bucket.start}`}>
												<rect
													x={index * cellWidth}
													y={2}
													width={Math.max(4, cellWidth - 2)}
													height={22}
													fill={fill}
													stroke={
														fill === "transparent"
															? "var(--color-border-strong)"
															: undefined
													}
												>
													<title>{`${bucket.start} coverage ${((bucket.observedMs / (bucket.end - bucket.start)) * 100).toFixed(1)}% uptime ${bucket.uptimeRatio === null ? "insufficient data" : `${bucket.uptimeRatio * 100}%`}${config.showIncidentCount ? ` incidents ${bucket.incidentCount ?? 0}` : ""}`}</title>
												</rect>
												{config.showPercentage &&
												bucket.uptimeRatio !== null &&
												cellWidth >= 34 ? (
													<text
														x={index * cellWidth + 3}
														y={17}
														className="dashboard-state-cell-label"
													>
														{Math.round(bucket.uptimeRatio * 100)}%
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
							xDomain: [range.from, range.to],
							plotRect,
							canvasSize: { width, height },
						}}
					/>
				) : null}
			</div>
			<StateLegend hidden={hiddenStates} onToggle={toggleState} />
			<p className="dashboard-panel-summary">{uptimeSummary(model.buckets)}</p>
			<UptimeTable buckets={model.buckets} />
			{annotationLayers?.length ? (
				<DeferredAnnotationList layers={annotationLayers} range={range} />
			) : null}
		</figure>
	);
}

export function buildAccessibleSummary(
	context: DashboardRendererContext<UptimeGridConfigV1>,
) {
	const result = modelFor(context);
	return `${context.panel.accessibleLabel}: ${result ? uptimeSummary(result.model.buckets) : "Uptime data is unavailable"}`.slice(
		0,
		1000,
	);
}
