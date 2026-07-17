import { useState } from "react";
import type {
	AnnotationLayerSpecV1,
	AnnotationMode,
} from "@shared/schemas/dashboard.schema";
import {
	buildAnnotationModel,
	type AnnotationDatum,
} from "../state/annotation-model";
import type { ResolvedAnnotationLayer } from "../../runtime/visualization-types";
import { resolveThemeColor } from "../../runtime/theme";

export type AnnotationViewport = {
	xDomain: [number, number];
	plotRect: { x: number; y: number; width: number; height: number };
	canvasSize?: { width: number; height: number };
};

type DisplayItem = {
	item: AnnotationDatum;
	mode: AnnotationMode;
	showLabel: AnnotationLayerSpecV1["showLabel"];
	x: number;
	width: number;
	labelRow: number;
	clusterCount: number;
};

export function AnnotationLayer({
	layers,
	viewport,
}: {
	layers: ResolvedAnnotationLayer[];
	viewport: AnnotationViewport;
}) {
	const span = Math.max(1, viewport.xDomain[1] - viewport.xDomain[0]);
	const canvas = viewport.canvasSize ?? {
		width: viewport.plotRect.x + viewport.plotRect.width,
		height: viewport.plotRect.y + viewport.plotRect.height,
	};
	const items = layers.flatMap(({ spec, frame }) => {
		try {
			return buildAnnotationModel(spec, frame, {
				from: viewport.xDomain[0],
				to: viewport.xDomain[1],
			}).annotations.map((item) => ({ item, spec }));
		} catch {
			return [];
		}
	});
	const positioned = items
		.map(({ item, spec }) => ({
			item,
			mode: spec.mode,
			showLabel: spec.showLabel,
			x:
				viewport.plotRect.x +
				((item.start - viewport.xDomain[0]) / span) * viewport.plotRect.width,
			width:
				item.end === undefined
					? 1
					: Math.max(
							1,
							((item.end - item.start) / span) * viewport.plotRect.width,
						),
		}))
		.sort((a, b) => a.x - b.x || a.item.id.localeCompare(b.item.id));
	const display: DisplayItem[] = [];
	const labelRowEnds = [
		Number.NEGATIVE_INFINITY,
		Number.NEGATIVE_INFINITY,
		Number.NEGATIVE_INFINITY,
	];
	for (const entry of positioned) {
		const prior = display.at(-1);
		if (
			entry.item.kind === "event" &&
			prior?.item.kind === "event" &&
			entry.item.layerId === prior.item.layerId &&
			entry.mode === prior.mode &&
			Math.abs(entry.x - prior.x) < 8 &&
			prior.clusterCount < 50
		) {
			prior.clusterCount += 1;
			continue;
		}
		const estimatedLabelWidth = Math.min(
			180,
			Math.max(36, entry.item.message.length * 6 + 8),
		);
		const labelRow = labelRowEnds.findIndex((end) => entry.x >= end + 4);
		if (labelRow >= 0) labelRowEnds[labelRow] = entry.x + estimatedLabelWidth;
		display.push({
			...entry,
			labelRow,
			clusterCount: 1,
		});
	}
	return (
		<svg
			className="dashboard-annotation-layer"
			aria-label="Annotations"
			role="img"
			viewBox={`0 0 ${canvas.width} ${canvas.height}`}
			preserveAspectRatio="none"
		>
			{display.map((entry) => (
				<AnnotationMark
					key={`${entry.item.layerId}:${entry.item.id}`}
					{...entry}
					y={viewport.plotRect.y}
					height={viewport.plotRect.height}
				/>
			))}
		</svg>
	);
}

function AnnotationMark({
	item,
	mode,
	x,
	y,
	width,
	height,
	showLabel,
	labelRow,
	clusterCount,
}: DisplayItem & { y: number; height: number }) {
	const color = resolveThemeColor(item.colorToken, "--color-chart-muted");
	const label =
		clusterCount > 1
			? `+${clusterCount}`
			: showLabel === "never"
				? "•"
				: item.message.slice(0, 64);
	const labelY = y + 14 + Math.max(0, labelRow) * 14;
	const labelVisible = showLabel !== "never" && labelRow >= 0;
	if (mode === "region")
		return (
			<g className="dashboard-annotation-mark dashboard-annotation-region">
				<rect
					x={x}
					y={y}
					width={width}
					height={height}
					fill={color}
					opacity={0.16}
					stroke={color}
					strokeWidth={1}
					vectorEffect="non-scaling-stroke"
				>
					<title>{item.message}</title>
				</rect>
				{labelVisible ? (
					<text x={x + 3} y={labelY} fill={color} data-label-mode={showLabel}>
						{label}
					</text>
				) : null}
			</g>
		);
	if (mode === "badge")
		return (
			<g className="dashboard-annotation-mark dashboard-annotation-badge">
				<rect
					x={x - 3}
					y={y + 2}
					width={Math.max(12, label.length * 6 + 8)}
					height={16}
					rx={4}
					fill={color}
				>
					<title>{item.message}</title>
				</rect>
				<text x={x + 1} y={y + 14} fill="Canvas" data-label-mode={showLabel}>
					{label}
				</text>
			</g>
		);
	return (
		<g className={`dashboard-annotation-mark dashboard-annotation-${mode}`}>
			<line
				x1={x}
				x2={x}
				y1={y}
				y2={y + height}
				stroke={color}
				strokeWidth={mode === "line" ? 2 : 1}
				strokeDasharray={mode === "point" ? "3 3" : undefined}
				vectorEffect="non-scaling-stroke"
			>
				<title>{item.message}</title>
			</line>
			{mode === "point" ? (
				<circle cx={x} cy={y + 5} r={4} fill={color} />
			) : null}
			{labelVisible ? (
				<text x={x + 3} y={labelY} fill={color} data-label-mode={showLabel}>
					{label}
				</text>
			) : null}
		</g>
	);
}

export function AnnotationList({
	layers,
	range,
}: {
	layers: ResolvedAnnotationLayer[];
	range: { from: number; to: number };
}) {
	const [hiddenLayerIds, setHiddenLayerIds] = useState<Set<string>>(new Set());
	const items = layers
		.filter(({ spec }) => !hiddenLayerIds.has(spec.id))
		.flatMap(({ spec, frame }) => {
			try {
				return buildAnnotationModel(spec, frame, range).annotations;
			} catch {
				return [];
			}
		})
		.sort((a, b) => {
			const severity = (value: AnnotationDatum) =>
				value.severity?.toLowerCase() === "critical" ? 0 : 1;
			return severity(a) - severity(b) || a.start - b.start;
		});
	return (
		<section
			className="dashboard-annotation-list-shell"
			aria-label="Annotations"
		>
			<fieldset
				className="dashboard-annotation-layer-toggles"
				aria-label="Annotation layers"
			>
				{layers.map(({ spec }) => {
					const visible = !hiddenLayerIds.has(spec.id);
					return (
						<button
							key={spec.id}
							type="button"
							aria-pressed={visible}
							onClick={() =>
								setHiddenLayerIds((current) => {
									const next = new Set(current);
									visible ? next.add(spec.id) : next.delete(spec.id);
									return next;
								})
							}
						>
							{spec.name}
						</button>
					);
				})}
			</fieldset>
			<ul className="dashboard-annotation-list" aria-label="Annotation list">
				{items.map((item) => (
					<li key={`${item.layerId}:${item.id}`}>
						<strong>{item.severity ?? item.category ?? item.kind}</strong>{" "}
						{item.message}{" "}
						<time dateTime={new Date(item.start).toISOString()}>
							{new Date(item.start).toISOString()}
						</time>
						{item.safeLink ? <a href={item.safeLink}>Open</a> : null}
					</li>
				))}
			</ul>
		</section>
	);
}
