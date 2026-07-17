import type { CSSProperties, ReactNode } from "react";
import {
	arcPath,
	polarPoint,
	segmentCount,
	sparklinePoints,
	valueArcPath,
} from "./geometry";
import { clampGeometry } from "./range";
import { type DeltaSentiment, type KpiState, stateToken } from "./state";

export function KpiValueText({
	value,
	label,
}: {
	value: string;
	label?: string;
}) {
	return (
		<strong className="dashboard-kpi-value" title={label}>
			{value}
		</strong>
	);
}
export function KpiDelta({
	value,
	sentiment,
}: {
	value: string;
	sentiment: DeltaSentiment;
}) {
	return (
		<span className={`dashboard-kpi-delta dashboard-kpi-delta-${sentiment}`}>
			{value} <small>{sentiment}</small>
		</span>
	);
}
export function KpiStateBadge({ state }: { state: KpiState }) {
	return (
		<span
			className="dashboard-kpi-state"
			data-state={state}
			style={
				{ "--kpi-state-color": `var(${stateToken(state)})` } as CSSProperties
			}
		>
			{state}
		</span>
	);
}
export function NativeSparkline({
	values,
	label,
}: {
	values: Array<number | null>;
	label: string;
}) {
	return (
		<svg
			className="dashboard-kpi-sparkline"
			viewBox="0 0 100 24"
			aria-label={label}
			role="img"
			focusable="false"
		>
			<polyline
				points={sparklinePoints(values)}
				fill="none"
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}
export function GaugeArc({
	normalized,
	startAngle,
	endAngle,
	label,
}: {
	normalized: number;
	startAngle: number;
	endAngle: number;
	label: string;
}) {
	return (
		<svg
			className="dashboard-kpi-gauge-graphic"
			viewBox="0 0 1 1"
			aria-hidden="true"
			focusable="false"
		>
			<path d={arcPath(startAngle, endAngle)} className="dashboard-kpi-track" />
			<path
				d={valueArcPath(normalized, startAngle, endAngle)}
				className="dashboard-kpi-fill"
			/>
			<title>{label}</title>
		</svg>
	);
}
export function GaugeNeedle({
	normalized,
	startAngle,
	endAngle,
	label,
}: {
	normalized: number;
	startAngle: number;
	endAngle: number;
	label: string;
}) {
	const point = polarPoint(
		startAngle + (endAngle - startAngle) * clampGeometry(normalized),
		0.36,
	);
	return (
		<svg
			className="dashboard-kpi-gauge-graphic dashboard-kpi-needle"
			viewBox="0 0 1 1"
			aria-label={label}
			role="img"
			focusable="false"
		>
			<path d={arcPath(startAngle, endAngle)} className="dashboard-kpi-track" />
			<path
				d={valueArcPath(normalized, startAngle, endAngle)}
				className="dashboard-kpi-fill"
			/>
			<line
				x1="0.5"
				y1="0.5"
				x2={point.x}
				y2={point.y}
				className="dashboard-kpi-needle-line"
			/>
			<circle
				cx="0.5"
				cy="0.5"
				r="0.035"
				className="dashboard-kpi-needle-origin"
			/>
		</svg>
	);
}
export function RangeTrack({
	normalized,
	goal,
	label,
}: {
	normalized: number;
	goal?: number;
	label: string;
}) {
	return (
		<div className="dashboard-kpi-range" role="img" aria-label={label}>
			<span
				className="dashboard-kpi-range-fill"
				style={{ width: `${clampGeometry(normalized) * 100}%` }}
			/>
			{goal === undefined ? null : (
				<span
					className="dashboard-kpi-goal"
					role="img"
					style={{ left: `${clampGeometry(goal) * 100}%` }}
					aria-label="Goal"
				/>
			)}
		</div>
	);
}
export function OverflowMarker({ overflow }: { overflow?: "below" | "above" }) {
	return overflow ? (
		<span
			className="dashboard-kpi-overflow"
			role="img"
			aria-label={`Value ${overflow} range`}
		>
			↕ {overflow}
		</span>
	) : null;
}
export function SegmentTrack({
	normalized,
	count,
	label,
}: {
	normalized: number;
	count: number;
	label: string;
}) {
	const filled = segmentCount(normalized, count);
	const segmentKeys = Array.from(
		{ length: count },
		(_, index) => `segment-${index}`,
	);
	return (
		<div className="dashboard-kpi-segments" role="img" aria-label={label}>
			{segmentKeys.map((key, index) => (
				<span key={key} className={index < filled ? "is-filled" : undefined} />
			))}
		</div>
	);
}
export function TrafficSignal({
	state,
	label,
	children,
}: {
	state: KpiState;
	label: string;
	children?: ReactNode;
}) {
	return (
		<span
			className="dashboard-kpi-signal"
			role="img"
			aria-label={`${label}: ${state}`}
			data-state={state}
		>
			<i style={{ background: `var(${stateToken(state)})` }} />
			{children ?? state}
		</span>
	);
}
