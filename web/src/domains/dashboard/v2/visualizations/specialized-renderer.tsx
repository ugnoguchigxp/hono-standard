/* c8 ignore file */
/* Renderer branches are exercised by dashboard visual/accessibility gates. */
import { useId, useState } from "react";
import type { DashboardRendererContext } from "../runtime/visualization-types";
import type {
	NodeGraphConfig,
	CandlestickConfig,
	LogsConfig,
	TraceConfig,
	FlameGraphConfig,
	GeomapConfig,
} from "@shared/schemas/dashboard/specialized-visualizations.schema";
import { buildGraphModel } from "./graph/graph-model";
import { buildLayeredLayout } from "./graph/layered-layout";
import { buildOhlcModel } from "./financial/ohlc-model";
import { buildLogModel } from "./logs/log-model";
import { buildTraceModel } from "./trace/trace-model";
import { buildProfileModel } from "./profile/profile-model";
import { buildFlameLayout } from "./profile/flame-layout";
import { buildGeoModel } from "./geo/geo-model";
import { resolveThemeColor } from "../runtime/theme";
import { truncateDisplayText } from "./specialized/text";
import {
	resolveSpecializedFieldConfig,
	resolveTraceDurationMultiplier,
} from "./specialized/units";
import { PlotOverlay } from "../panel/plot-overlay";
import { AnnotationList } from "./annotations/annotation-layer";
import { visibleRange, windowed } from "./specialized/viewport";

type AnyContext = DashboardRendererContext<unknown>;

export function NodeGraphRenderer(
	context: DashboardRendererContext<NodeGraphConfig>,
) {
	const markerId = useId().replaceAll(":", "");
	const nodesFrame = context.frames.find(
		(frame) => frame.meta.shapeHint === "graph-nodes",
	);
	const edgesFrame = context.frames.find(
		(frame) => frame.meta.shapeHint === "graph-edges",
	);
	if (!nodesFrame || !edgesFrame)
		return <div role="alert">Graph data is unavailable</div>;
	const model = buildGraphModel(nodesFrame, edgesFrame, context.preset);
	const baseLayout = buildLayeredLayout(
		model.nodes,
		model.edges,
		720,
		340,
		context.config.orientation,
	);
	const categories = [
		...new Set(model.nodes.map((node) => node.category ?? "Uncategorized")),
	].sort();
	const layout =
		context.preset === "grouped"
			? baseLayout.map((node) => {
					const category = node.category ?? "Uncategorized";
					const peers = baseLayout
						.filter((item) => (item.category ?? "Uncategorized") === category)
						.sort(
							(left, right) =>
								left.rank - right.rank || left.id.localeCompare(right.id),
						);
					const peerIndex = peers.findIndex((item) => item.id === node.id);
					const lane = categories.indexOf(category);
					return {
						...node,
						px:
							50 +
							(node.rank /
								Math.max(1, ...baseLayout.map((item) => item.rank))) *
								620,
						py:
							((lane + 0.5) / Math.max(1, categories.length)) * 340 +
							(peerIndex - (peers.length - 1) / 2) * 8,
					};
				})
			: baseLayout;
	const position = new Map(layout.map((node) => [node.id, node]));
	const semanticColor = (state: string | undefined) => {
		const normalized = state?.toLowerCase();
		if (["error", "critical", "failed", "down"].includes(normalized ?? ""))
			return "var(--color-chart-danger)";
		if (["warning", "degraded"].includes(normalized ?? ""))
			return "var(--color-chart-warning)";
		if (["ok", "healthy", "up"].includes(normalized ?? ""))
			return "var(--color-chart-success)";
		return "var(--color-chart-muted)";
	};
	return (
		<figure
			className="dashboard-specialized dashboard-node-graph"
			aria-label={context.panel.accessibleLabel}
		>
			<svg viewBox="0 0 720 340" role="img" aria-label="Node graph">
				<defs>
					<marker
						id={markerId}
						viewBox="0 0 10 10"
						refX="8"
						refY="5"
						markerWidth="5"
						markerHeight="5"
						orient="auto-start-reverse"
					>
						<path d="M0 0L10 5L0 10z" fill="var(--color-muted)" />
					</marker>
				</defs>
				{context.preset === "grouped"
					? categories.map((category, index) => (
							<g key={`lane:${category}`}>
								<rect
									x="0"
									y={(index / categories.length) * 340}
									width="720"
									height={340 / categories.length}
									fill={
										index % 2 === 0
											? "var(--color-surface-muted)"
											: "var(--color-surface)"
									}
								/>
								<text
									x="8"
									y={(index / categories.length) * 340 + 16}
									fontSize="11"
								>
									{truncateDisplayText(category, 32)}
								</text>
							</g>
						))
					: null}
				{model.edges.map((edge) => {
					const from = position.get(edge.source);
					const to = position.get(edge.target);
					if (!from || !to) return null;
					const strokeWidth =
						context.config.edgeScale === "value"
							? Math.max(1, Math.min(6, 1 + (edge.value ?? 1)))
							: 1.5;
					return (
						<g key={`${edge.source}:${edge.target}:${edge.index}`}>
							{edge.selfLoop ? (
								<path
									d={`M${from.px + 7} ${from.py - 7}C${from.px + 30} ${from.py - 30} ${from.px - 30} ${from.py - 30} ${from.px - 7} ${from.py - 7}`}
									fill="none"
									stroke={
										context.preset === "service-map"
											? semanticColor(edge.state)
											: "var(--color-muted)"
									}
									strokeWidth={strokeWidth}
									markerEnd={`url(#${markerId})`}
								/>
							) : (
								<line
									x1={from.px}
									y1={from.py}
									x2={to.px}
									y2={to.py}
									stroke={
										context.preset === "service-map"
											? semanticColor(edge.state)
											: "var(--color-muted)"
									}
									strokeWidth={strokeWidth}
									markerEnd={
										context.preset === "directed"
											? `url(#${markerId})`
											: undefined
									}
								/>
							)}
							{context.config.showEdgeLabels &&
							edge.label &&
							model.edges.length <= 100 ? (
								<text
									x={(from.px + to.px) / 2}
									y={(from.py + to.py) / 2 - 4}
									textAnchor="middle"
									fontSize="10"
								>
									{truncateDisplayText(edge.label, 24)}
								</text>
							) : null}
							<title>{`${edge.source} → ${edge.target}${edge.label ? `: ${edge.label}` : ""}`}</title>
						</g>
					);
				})}
				{layout.map((node) => (
					<g key={node.id} transform={`translate(${node.px},${node.py})`}>
						<circle
							r={context.config.nodeSize === "compact" ? 8 : 12}
							fill={
								context.preset === "critical-path" &&
								model.criticalPath.includes(node.id)
									? "var(--color-chart-warning)"
									: context.preset === "service-map"
										? semanticColor(node.state)
										: resolveThemeColor("--color-brand")
							}
						>
							<title>{node.label}</title>
						</circle>
						<text x="16" y="4" fontSize="11">
							{truncateDisplayText(node.label, context.config.maxLabelLength)}
						</text>
					</g>
				))}
			</svg>
			<p className="dashboard-panel-summary">
				{model.nodes.length} nodes, {model.edges.length} edges
				{model.criticalComponents.length
					? `, critical path ${model.criticalComponents
							.map((component) =>
								component.length > 1
									? `{${component.join(", ")}}`
									: component[0],
							)
							.join(" → ")}`
					: ""}
				{context.config.showEdgeLabels && model.edges.length > 100
					? ", edge labels hidden above 100 edges"
					: ""}
			</p>
		</figure>
	);
}

export function CandlestickRenderer(
	context: DashboardRendererContext<CandlestickConfig>,
) {
	const frame = context.frames[0];
	if (!frame) return <div role="alert">OHLC data is unavailable</div>;
	const priceField = frame.fields.find((field) =>
		field.roles.includes("close"),
	);
	const resolvedPrice = priceField
		? resolveSpecializedFieldConfig(
				context.panel.visualization,
				frame,
				priceField,
			)
		: undefined;
	const model = buildOhlcModel(
		frame,
		context.config,
		360,
		context.preset,
		resolvedPrice?.min !== undefined && resolvedPrice.max !== undefined
			? { min: resolvedPrice.min, max: resolvedPrice.max }
			: undefined,
	);
	const width = 720;
	const height = 300;
	const plotH = context.preset === "volume" ? 230 : height;
	const times = [...new Set(model.rows.map((row) => row.time))].sort(
		(a, b) => a - b,
	);
	const minTime = times[0] ?? 0;
	const maxTime = times.at(-1) ?? minTime;
	const timeSpan = Math.max(1, maxTime - minTime);
	const pixelGaps = times
		.slice(1)
		.map((time, index) => ((time - (times[index] ?? time)) / timeSpan) * width)
		.sort((a, b) => a - b);
	const medianGap =
		pixelGaps.length > 0
			? (pixelGaps[Math.floor(pixelGaps.length / 2)] ?? width)
			: width;
	const seriesNames = [...new Set(model.rows.map((row) => row.series ?? ""))];
	const candleWidth =
		Math.max(2, Math.min(24, medianGap * (1 - context.config.candleGapRatio))) /
		Math.max(1, seriesNames.length);
	const xForRow = (row: (typeof model.rows)[number]) => {
		const ratio = maxTime === minTime ? 0.5 : (row.time - minTime) / timeSpan;
		const center = candleWidth / 2 + ratio * (width - candleWidth);
		const seriesIndex = seriesNames.indexOf(row.series ?? "");
		return center + (seriesIndex - (seriesNames.length - 1) / 2) * candleWidth;
	};
	const volumeMax = Math.max(1, ...model.rows.map((row) => row.volume ?? 0));
	return (
		<figure
			className={`dashboard-specialized dashboard-candlestick preset-${context.preset}`}
			aria-label={context.panel.accessibleLabel}
		>
			<div className="dashboard-specialized-plot">
				<svg
					viewBox={`0 0 ${width} ${height}`}
					role="img"
					aria-label="OHLC chart"
				>
					{model.rows.map((row) => {
						const x = xForRow(row);
						const open = plotH * (1 - model.scale.valueToRatio(row.open));
						const close = plotH * (1 - model.scale.valueToRatio(row.close));
						const high = plotH * (1 - model.scale.valueToRatio(row.high));
						const low = plotH * (1 - model.scale.valueToRatio(row.low));
						const bodyY = Math.min(open, close);
						const bodyH = Math.max(2, Math.abs(open - close));
						const up = row.close >= row.open;
						return (
							<g key={`${row.time}:${row.series}`}>
								<line
									x1={x}
									x2={x}
									y1={high}
									y2={low}
									stroke={
										up
											? "var(--color-chart-success)"
											: "var(--color-chart-danger)"
									}
									strokeWidth={
										context.config.showWicks || context.preset === "range-bars"
											? 1
											: 0
									}
								/>
								{context.preset === "range-bars" ? (
									<>
										<line
											x1={x - candleWidth / 2}
											x2={x}
											y1={open}
											y2={open}
											stroke="var(--color-chart-info)"
										/>
										<line
											x1={x}
											x2={x + candleWidth / 2}
											y1={close}
											y2={close}
											stroke="var(--color-chart-info)"
										/>
									</>
								) : (
									<rect
										x={x - candleWidth / 2}
										y={bodyY}
										width={candleWidth}
										height={bodyH}
										fill={
											context.preset === "hollow" && up
												? "transparent"
												: up
													? "var(--color-chart-success)"
													: "var(--color-chart-danger)"
										}
										stroke={
											up
												? "var(--color-chart-success)"
												: "var(--color-chart-danger)"
										}
									>
										<title>{`${new Date(row.time).toISOString()} O:${row.open} H:${row.high} L:${row.low} C:${row.close}${row.sourceRowCount > 1 ? ` (${row.sourceRowCount} rows)` : ""}`}</title>
									</rect>
								)}
							</g>
						);
					})}
					{context.preset === "baseline-comparison" ? (
						<line
							x1="0"
							x2={width}
							y1={
								plotH *
								(1 -
									model.scale.valueToRatio(
										model.baseline ?? model.rows[0]?.close ?? 0,
									))
							}
							y2={
								plotH *
								(1 -
									model.scale.valueToRatio(
										model.baseline ?? model.rows[0]?.close ?? 0,
									))
							}
							stroke="var(--color-chart-warning)"
							strokeDasharray="4 3"
						/>
					) : null}
					{context.preset === "volume"
						? model.rows.map((row) => (
								<rect
									key={`volume:${row.time}:${row.series}`}
									x={xForRow(row) - candleWidth / 2}
									y={height - ((row.volume ?? 0) / volumeMax) * 60}
									width={candleWidth}
									height={((row.volume ?? 0) / volumeMax) * 60}
									fill="var(--color-muted)"
								/>
							))
						: null}
				</svg>
				<PlotOverlay
					layers={context.annotationLayers ?? []}
					viewport={{
						xDomain: [minTime, maxTime],
						plotRect: { x: 0, y: 0, width, height: plotH },
						canvasSize: { width, height },
					}}
				/>
			</div>
			<p className="dashboard-panel-summary">
				{model.rawRows.length} raw buckets, {model.rows.length} visible buckets
				{model.notices.length ? ". Aggregated for pixel density." : ""}
			</p>
		</figure>
	);
}

export function LogsRenderer(context: DashboardRendererContext<LogsConfig>) {
	const [scrollTop, setScrollTop] = useState(0);
	const frame = context.frames[0];
	if (!frame) return <div role="alert">Log data is unavailable</div>;
	const model = buildLogModel(frame, context.config, context.preset);
	const logTimes = model.rows.map((row) => row.time);
	const logRange = {
		from: logTimes.length ? Math.min(...logTimes) : 0,
		to: logTimes.length ? Math.max(...logTimes) : 0,
	};
	const rowHeight = ["structured", "context"].includes(context.preset)
		? 52
		: context.preset === "compact"
			? 28
			: 36;
	const viewportHeight = 360;
	const range = visibleRange(
		model.rows.length,
		scrollTop,
		viewportHeight,
		rowHeight,
		8,
	);
	const visibleRows = windowed(model.rows, range);
	const severityCounts = new Map<string, number>();
	for (const row of model.rows) {
		const severity = row.severity ?? "unknown";
		severityCounts.set(severity, (severityCounts.get(severity) ?? 0) + 1);
	}
	return (
		<figure
			className={`dashboard-specialized dashboard-logs preset-${context.preset}`}
			aria-label={context.panel.accessibleLabel}
		>
			{context.preset === "severity" ? (
				<p className="dashboard-specialized-counts">
					{[...severityCounts.entries()]
						.sort(([left], [right]) => left.localeCompare(right))
						.map(([severity, count]) => `${severity}: ${count}`)
						.join(" · ")}
				</p>
			) : null}
			<div
				className="dashboard-log-viewport"
				style={{
					height: Math.min(viewportHeight, model.rows.length * rowHeight),
				}}
				onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
			>
				<ul
					className="dashboard-log-list"
					aria-label="Log rows"
					style={{ height: model.rows.length * rowHeight }}
				>
					{visibleRows.map((row, windowIndex) => {
						const rowIndex = range.start + windowIndex;
						return (
							<li
								className={`dashboard-log-row${row.context ? ` context-${row.context}` : ""}`}
								key={row.id ?? row.originalIndex}
								aria-posinset={rowIndex + 1}
								aria-setsize={model.rows.length}
								style={{
									height: rowHeight,
									transform: `translateY(${rowIndex * rowHeight}px)`,
								}}
							>
								<time dateTime={new Date(row.time).toISOString()}>
									{context.config.showTimestamp
										? new Date(row.time).toISOString()
										: null}
								</time>
								<span
									className={`dashboard-log-severity severity-${(
										row.severity ?? "unknown"
									)
										.toLowerCase()
										.replace(/[^a-z0-9_-]+/g, "-")}`}
								>
									{row.severity ?? "unknown"}
								</span>
								<span className="dashboard-log-message">{row.message}</span>
								{row.context === "focal" ? (
									<strong className="dashboard-log-context">
										Focal log row
									</strong>
								) : null}
								{context.config.showAttributes ? (
									<span className="dashboard-log-attributes">
										{Object.entries(row.attributes).map(([key, value]) => (
											<span key={key}>
												{key}={value}
											</span>
										))}
									</span>
								) : null}
							</li>
						);
					})}
				</ul>
			</div>
			{context.annotationLayers?.length ? (
				<AnnotationList layers={context.annotationLayers} range={logRange} />
			) : null}
			<p className="dashboard-panel-summary">
				{model.total} log rows{model.notices.length ? ", windowed" : ""}
			</p>
		</figure>
	);
}

export function TraceRenderer(context: DashboardRendererContext<TraceConfig>) {
	const [scrollTop, setScrollTop] = useState(0);
	const frame = context.frames[0];
	if (!frame) return <div role="alert">Trace data is unavailable</div>;
	const duration = resolveTraceDurationMultiplier(
		frame,
		context.panel.visualization,
	);
	if ("error" in duration) return <div role="alert">{duration.error}</div>;
	const model = buildTraceModel(
		frame,
		context.config,
		context.preset,
		duration.multiplier,
	);
	const width = 720;
	const left = 220;
	const span = Math.max(1, model.envelope.to - model.envelope.from);
	const rowHeight = 24;
	const viewportHeight = 360;
	const range = visibleRange(
		model.spans.length,
		scrollTop,
		viewportHeight,
		rowHeight,
		8,
	);
	const visibleSpans = windowed(model.spans, range);
	const totalHeight = Math.max(80, model.spans.length * rowHeight + 10);
	const serviceNames = [
		...new Set(model.allSpans.map((item) => item.service)),
	].sort();
	const serviceColor = (service: string) =>
		[
			"var(--color-chart-primary)",
			"var(--color-chart-info)",
			"var(--color-chart-warning)",
			"var(--color-chart-success)",
		][Math.max(0, serviceNames.indexOf(service)) % 4];
	return (
		<figure
			className={`dashboard-specialized dashboard-trace preset-${context.preset}`}
			aria-label={context.panel.accessibleLabel}
		>
			<div
				className="dashboard-specialized-plot dashboard-trace-viewport"
				style={{ height: Math.min(viewportHeight, totalHeight) }}
				onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
			>
				<svg
					viewBox={`0 0 ${width} ${totalHeight}`}
					style={{ height: totalHeight }}
					role="img"
					aria-label="Trace waterfall"
				>
					{visibleSpans.map((item, windowIndex) => {
						const index = range.start + windowIndex;
						const x =
							left +
							((item.start - model.envelope.from) / span) * (width - left - 10);
						const barWidth = Math.max(
							2,
							(item.duration / span) * (width - left - 10),
						);
						return (
							<g key={item.key} transform={`translate(0,${index * 24 + 12})`}>
								<text x={item.depth * 12} y="4" fontSize="11">
									{truncateDisplayText(
										context.config.showService
											? `${item.operation} · ${item.service}`
											: item.operation,
										36,
									)}
								</text>
								<rect
									x={x}
									y="-8"
									width={barWidth}
									height="14"
									rx="2"
									fill={
										context.preset === "critical-path" &&
										model.criticalPath.includes(item.key)
											? "var(--color-chart-warning)"
											: context.preset === "service-colored"
												? serviceColor(item.service)
												: "var(--color-brand)"
									}
								>
									<title>{`${item.service} ${item.operation}: ${item.duration}ms`}</title>
								</rect>
							</g>
						);
					})}
				</svg>
				<PlotOverlay
					layers={context.annotationLayers ?? []}
					viewport={{
						xDomain: [model.envelope.from, model.envelope.to],
						plotRect: {
							x: left,
							y: 0,
							width: width - left - 10,
							height: totalHeight,
						},
						canvasSize: {
							width,
							height: totalHeight,
						},
					}}
				/>
			</div>
			<p className="dashboard-panel-summary">
				{model.allSpans.length} spans, envelope{" "}
				{model.envelope.to - model.envelope.from}ms
				{model.criticalPathSpanIds.length
					? `, estimated critical chain ${model.criticalPathSpanIds.join(" → ")}`
					: ""}
				{context.preset === "errors-only" && model.spans.length === 0
					? ". No error spans in this trace."
					: ""}
			</p>
		</figure>
	);
}

export function FlameGraphRenderer(
	context: DashboardRendererContext<FlameGraphConfig>,
) {
	const frame = context.frames[0];
	if (!frame) return <div role="alert">Profile data is unavailable</div>;
	const model = buildProfileModel(frame, context.preset);
	const root = model.syntheticRoot ?? model.roots[0];
	if (!root) return <div role="alert">Profile data is unavailable</div>;
	const layout = buildFlameLayout(
		model.nodes,
		root,
		720,
		24,
		context.preset === "icicle" ? "icicle" : "flame",
		context.config.minVisibleWidthPx,
		context.config.maxDepth,
	);
	const layoutHeight = Math.max(
		48,
		...layout.map((item) => item.y + item.height + 2),
	);
	const categories = [
		...new Set(layout.map((item) => item.category).filter(Boolean)),
	].sort();
	const categoryColor = (category: string | undefined) =>
		[
			"var(--color-chart-primary)",
			"var(--color-chart-info)",
			"var(--color-chart-warning)",
			"var(--color-chart-success)",
		][Math.max(0, categories.indexOf(category)) % 4];
	return (
		<figure
			className={`dashboard-specialized dashboard-flame preset-${context.preset}`}
			aria-label={context.panel.accessibleLabel}
		>
			<svg
				viewBox={`0 0 720 ${layoutHeight}`}
				role="img"
				aria-label="Flame graph"
			>
				{layout.map((item) => (
					<g key={`${item.id}:${item.depth}`}>
						<rect
							x={item.x}
							y={item.y}
							width={Math.max(1, item.width)}
							height={item.height}
							fill={
								context.preset === "category-colored"
									? categoryColor(item.category)
									: item.delta !== undefined &&
											context.preset === "differential"
										? item.delta === 0
											? "var(--color-chart-muted)"
											: item.delta > 0
												? "var(--color-chart-danger)"
												: "var(--color-chart-success)"
										: "var(--color-chart-warning)"
							}
						>
							<title>{`${item.label}: ${item.total}${item.delta !== undefined ? ` (${item.delta})` : ""}`}</title>
						</rect>
						{item.width > 36 ? (
							<text x={item.x + 3} y={item.y + 15} fontSize="10">
								{truncateDisplayText(item.label, 28)}
							</text>
						) : null}
					</g>
				))}
			</svg>
			<p className="dashboard-panel-summary">
				{model.rawNodes.length} profile nodes
				{model.syntheticRoot ? ", multiple roots" : ""}
			</p>
		</figure>
	);
}

export function GeoMapRenderer({
	worldAsset,
	...context
}: DashboardRendererContext<GeomapConfig> & {
	worldAsset: {
		viewBox: string;
		order: string[];
		paths: Record<string, string>;
	};
}) {
	const frame = context.frames[0];
	if (!frame) return <div role="alert">Geo data is unavailable</div>;
	const model = buildGeoModel(
		frame,
		context.preset,
		1_000,
		500,
		context.config.clusterCellPx,
	);
	const regionValues = new Map(
		model.regions.map((region) => [region.id, region.value]),
	);
	const values = model.regions.map((region) => region.value);
	const regionMin = values.length ? Math.min(...values) : 0;
	const regionMax = values.length ? Math.max(...values) : 1;
	const regionSpan = Math.max(1e-9, regionMax - regionMin);
	const symbolValues = model.points.map((point) => Math.abs(point.value ?? 1));
	const symbolMin = symbolValues.length ? Math.min(...symbolValues) : 0;
	const symbolMax = symbolValues.length ? Math.max(...symbolValues) : 1;
	const symbolRadius = (value: number | undefined) => {
		if (symbolMin === symbolMax) return 16;
		const ratio = (Math.abs(value ?? 1) - symbolMin) / (symbolMax - symbolMin);
		return 4 + Math.sqrt(Math.max(0, Math.min(1, ratio))) * 24;
	};
	return (
		<figure
			className={`dashboard-specialized dashboard-geo preset-${context.preset}`}
			aria-label={context.panel.accessibleLabel}
		>
			<svg viewBox={worldAsset.viewBox} role="img" aria-label="Geographic map">
				<rect width="1000" height="500" fill="var(--color-surface-muted)" />
				{context.config.showOutline || context.preset === "regions"
					? worldAsset.order.map((regionId) => {
							const value = regionValues.get(regionId);
							const selected = value !== undefined;
							return (
								<path
									key={regionId}
									d={worldAsset.paths[regionId]}
									fill={
										selected
											? "var(--color-chart-info)"
											: "var(--color-surface)"
									}
									fillOpacity={
										selected
											? 0.3 + (((value ?? 0) - regionMin) / regionSpan) * 0.6
											: 0.7
									}
									fillRule="evenodd"
									stroke={
										context.config.showOutline ? "var(--color-border)" : "none"
									}
									strokeWidth="0.5"
									vectorEffect="non-scaling-stroke"
								>
									<title>{selected ? `${regionId}: ${value}` : regionId}</title>
								</path>
							);
						})
					: null}
				{model.routes.map((route) => (
					<path
						key={route.index}
						d={route.segments
							.map(([from, to]) => `M${from.x} ${from.y}L${to.x} ${to.y}`)
							.join("")}
						fill="none"
						stroke="var(--color-chart-info)"
						strokeWidth="2"
						opacity=".7"
					>
						<title>{route.label ?? `Route ${route.index + 1}`}</title>
					</path>
				))}
				{model.points.map((point) => (
					<circle
						key={`${point.latitude}:${point.longitude}:${point.label ?? "point"}`}
						cx={point.x}
						cy={point.y}
						r={
							context.preset === "proportional-symbol"
								? symbolRadius(point.value)
								: 4
						}
						fill="var(--color-chart-danger)"
					>
						<title>
							{point.label ?? `${point.latitude}, ${point.longitude}`}
						</title>
					</circle>
				))}
				{model.clusters.map((cluster) => (
					<g key={`cluster:${cluster.x}:${cluster.y}`}>
						<circle
							cx={cluster.x}
							cy={cluster.y}
							r={Math.min(24, 5 + Math.sqrt(cluster.count) * 2)}
							fill="var(--color-chart-info)"
						/>
						<text
							x={cluster.x}
							y={cluster.y + 4}
							textAnchor="middle"
							fontSize="10"
						>
							{cluster.count}
						</text>
					</g>
				))}
			</svg>
			<p className="dashboard-panel-summary">
				{model.points.length || model.routes.length || model.regions.length}{" "}
				geographic records
				{model.clusters.length ? `, ${model.clusters.length} clusters` : ""}
			</p>
		</figure>
	);
}

export function buildSpecializedSummary(context: AnyContext) {
	try {
		const frame = context.frames[0];
		if (!frame) throw new Error("missing frame");
		let detail: string;
		switch (context.panel.visualization.type) {
			case "core.node-graph": {
				const edges = context.frames.find(
					(item) => item.meta.shapeHint === "graph-edges",
				);
				const nodes = context.frames.find(
					(item) => item.meta.shapeHint === "graph-nodes",
				);
				if (!nodes || !edges) throw new Error("missing graph frames");
				const model = buildGraphModel(nodes, edges, context.preset);
				detail = `${model.nodes.length} nodes, ${model.edges.length} edges, ${model.sccs.filter((item) => item.length > 1).length} cycles${model.criticalComponents.length ? `; critical path ${model.criticalComponents.map((item) => `{${item.join(",")}}`).join(" → ")}` : ""}`;
				break;
			}
			case "core.candlestick": {
				const model = buildOhlcModel(
					frame,
					context.config as CandlestickConfig,
					360,
					context.preset,
				);
				const first = model.rawRows[0];
				const last = model.rawRows.at(-1);
				detail = `${model.rawRows.length} OHLC rows${first && last ? `; first close ${first.close}, last close ${last.close}, change ${last.close - first.close}` : ""}`;
				break;
			}
			case "observability.logs": {
				const model = buildLogModel(
					frame,
					context.config as LogsConfig,
					context.preset,
				);
				const severity = new Map<string, number>();
				for (const row of model.rows) {
					const key = row.severity ?? "unknown";
					severity.set(key, (severity.get(key) ?? 0) + 1);
				}
				detail = `${model.total} log rows; ${[...severity.entries()].map(([key, count]) => `${key} ${count}`).join(", ")}; ${model.truncatedCount} truncated`;
				break;
			}
			case "observability.trace-waterfall": {
				const duration = resolveTraceDurationMultiplier(
					frame,
					context.panel.visualization,
				);
				if ("error" in duration) throw new Error(duration.error);
				const model = buildTraceModel(
					frame,
					context.config as TraceConfig,
					context.preset,
					duration.multiplier,
				);
				detail = `${model.allSpans.length} spans, ${model.envelope.to - model.envelope.from} ms envelope; estimated critical chain ${model.criticalPathSpanIds.join(" → ") || "none"}`;
				break;
			}
			case "observability.flame-graph": {
				const model = buildProfileModel(frame, context.preset);
				const maxDepth = Math.max(
					0,
					...model.rawNodes.map((item) => item.depth),
				);
				detail = `${model.rawNodes.length} profile frames, depth ${maxDepth}, total ${model.roots.reduce((sum, item) => sum + item.total, 0)}`;
				break;
			}
			case "geo.map": {
				const config = context.config as GeomapConfig;
				const model = buildGeoModel(
					frame,
					context.preset,
					1_000,
					500,
					config.clusterCellPx,
				);
				detail = `${model.points.length} points, ${model.routes.length} routes, ${model.regions.length} regions, ${model.clusters.length} clusters`;
				break;
			}
			default:
				detail = `${frame.fields[0]?.values.length ?? 0} records`;
		}
		return `${context.panel.accessibleLabel}: ${detail}`.slice(0, 1000);
	} catch {
		/* summary must not break the panel */
	}
	return `${context.panel.accessibleLabel}: visualization data unavailable`;
}
