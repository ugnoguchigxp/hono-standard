import type { HistogramConfigV1 } from "@shared/schemas/dashboard/distribution-visualizations.schema";
import { type CSSProperties, useMemo, useState } from "react";
import {
	Bar,
	CartesianGrid,
	ComposedChart,
	Line,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { resolveThemeColor } from "../../runtime/theme";
import type { DashboardRendererContext } from "../../runtime/visualization-types";
import {
	buildHistogramModel,
	type HistogramModel,
	type HistogramSeriesMetric,
} from "../distribution/histogram";
import { SummaryFigure } from "../distribution/primitives";
import { histogramSummary } from "../distribution/summary";

type Metric = "count" | "density" | "probability";
type ChartRow = Record<string, number | string> & {
	label: string;
	start: number;
	end: number;
	cumulative: number;
	aggregate: number;
};

const metricValue = (metric: HistogramSeriesMetric, key: Metric) => metric[key];
const aggregateValue = (row: HistogramModel["rows"][number], metric: Metric) =>
	metric === "density"
		? row.density
		: metric === "probability"
			? row.probability
			: row.totalCount;

function buildChartRows(
	model: HistogramModel,
	metric: Metric,
	stackMode: HistogramConfigV1["stackMode"],
	cumulativeMode: HistogramConfigV1["cumulativeMode"],
): ChartRow[] {
	return model.rows.map((row) => {
		const chartRow: ChartRow = {
			label: row.label,
			start: row.start,
			end: row.end,
			aggregate: aggregateValue(row, metric),
			cumulative:
				cumulativeMode === "probability"
					? row.cumulativeProbability
					: row.cumulativeCount,
		};
		for (const series of model.series) {
			const value = row.series[series.key];
			chartRow[series.key] = value
				? stackMode === "percent"
					? row.totalCount > 0
						? (value.count / row.totalCount) * 100
						: 0
					: metricValue(value, metric)
				: 0;
		}
		return chartRow;
	});
}

const referenceCategory = (rows: readonly ChartRow[], value: number) =>
	rows.find(
		(row, index) =>
			value >= row.start &&
			(value < row.end || (index === rows.length - 1 && value <= row.end)),
	)?.label;

export function Renderer({
	frames,
	config,
	preset,
	panel,
	locale,
	theme,
}: DashboardRendererContext<HistogramConfigV1>) {
	const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(
		() => new Set(),
	);
	const frame = frames[0];
	const model = useMemo(
		() => (frame ? buildHistogramModel(frame, locale) : null),
		[frame, locale],
	);
	if (!model)
		return (
			<div className="dashboard-panel-error">Histogram data is unavailable</div>
		);
	const metric: Metric = config.normalization;
	const cumulative = preset === "cumulative";
	const stackMode =
		preset === "stacked" && config.stackMode === "none"
			? "stack"
			: config.stackMode;
	const domainMin =
		typeof config.xScale.min === "number"
			? config.xScale.min
			: Number.NEGATIVE_INFINITY;
	const domainMax =
		typeof config.xScale.max === "number"
			? config.xScale.max
			: Number.POSITIVE_INFINITY;
	const rows = buildChartRows(
		model,
		metric,
		stackMode,
		config.cumulativeMode,
	).filter((row) => row.end > domainMin && row.start < domainMax);
	const horizontal = config.orientation === "horizontal";
	const seriesColor = (index: number) =>
		resolveThemeColor(
			theme.palette.length
				? theme.palette[index % theme.palette.length]
				: undefined,
		);
	const toggleSeries = (key: string) =>
		setHiddenSeries((current) => {
			const next = new Set(current);
			next.has(key) ? next.delete(key) : next.add(key);
			return next;
		});
	const stackId = stackMode === "none" ? undefined : "histogram";
	const cumulativeDomain: [number | "auto", number | "auto"] =
		config.cumulativeMode === "probability" ? [0, 1] : [0, "auto"];
	const summary = histogramSummary(
		model.rows.map((row) => ({ count: row.totalCount })),
		cumulative ? `cumulative ${config.cumulativeMode}` : metric,
	);
	return (
		<SummaryFigure label={panel.accessibleLabel} theme={theme}>
			<div className="dashboard-chart-canvas">
				<ResponsiveContainer width="100%" height="100%">
					<ComposedChart
						data={rows}
						layout={horizontal ? "vertical" : "horizontal"}
						accessibilityLayer
					>
						{config.showGrid ? <CartesianGrid strokeDasharray="3 3" /> : null}
						{horizontal ? (
							<>
								<XAxis type="number" xAxisId="metric" />
								<YAxis
									type="category"
									dataKey="label"
									width={config.showBinLabels ? 90 : 12}
									tick={config.showBinLabels}
								/>
								{cumulative ? (
									<XAxis
										type="number"
										xAxisId="cumulative"
										orientation="top"
										domain={cumulativeDomain}
									/>
								) : null}
							</>
						) : (
							<>
								<XAxis
									type="category"
									dataKey="label"
									tick={config.showBinLabels}
								/>
								<YAxis type="number" yAxisId="metric" />
								{cumulative ? (
									<YAxis
										type="number"
										yAxisId="cumulative"
										orientation="right"
										domain={cumulativeDomain}
									/>
								) : null}
							</>
						)}
						<Tooltip isAnimationActive={false} />
						{cumulative ? (
							<>
								<Bar
									dataKey="aggregate"
									name={metric}
									fill="var(--color-brand)"
									isAnimationActive={false}
									{...(horizontal
										? { xAxisId: "metric" }
										: { yAxisId: "metric" })}
								/>
								<Line
									type="monotone"
									dataKey="cumulative"
									name={`cumulative ${config.cumulativeMode}`}
									stroke="var(--color-danger)"
									strokeWidth={2}
									dot={false}
									isAnimationActive={false}
									{...(horizontal
										? { xAxisId: "cumulative" }
										: { yAxisId: "cumulative" })}
								/>
							</>
						) : (
							model.series.map((series, index) =>
								hiddenSeries.has(series.key) ? null : (
									<Bar
										key={series.key}
										dataKey={series.key}
										name={series.label}
										stackId={stackId}
										fill={seriesColor(index)}
										isAnimationActive={false}
										{...(horizontal
											? { xAxisId: "metric" }
											: { yAxisId: "metric" })}
									/>
								),
							)
						)}
						{config.referenceLines.map((line) => {
							const category = referenceCategory(rows, line.value);
							return category ? (
								<ReferenceLine
									key={`${line.value}:${line.label ?? ""}`}
									{...(horizontal ? { y: category } : { x: category })}
									label={line.label}
									stroke={resolveThemeColor(line.colorToken)}
								/>
							) : null;
						})}
					</ComposedChart>
				</ResponsiveContainer>
			</div>
			{config.showLegend && !cumulative && model.series.length > 1 ? (
				<nav className="dashboard-chart-legend" aria-label="Histogram series">
					{model.series.map((series, index) => (
						<button
							key={series.key}
							type="button"
							aria-pressed={!hiddenSeries.has(series.key)}
							onClick={() => toggleSeries(series.key)}
						>
							<i
								className="dashboard-chart-legend-swatch"
								style={
									{
										"--dashboard-series-color": seriesColor(index),
									} as CSSProperties
								}
								aria-hidden="true"
							/>
							{series.label}
						</button>
					))}
				</nav>
			) : null}
			<p className="dashboard-panel-summary">{summary}</p>
		</SummaryFigure>
	);
}

export function buildAccessibleSummary({
	frames,
	config,
	preset,
	panel,
	locale,
}: DashboardRendererContext<HistogramConfigV1>) {
	const frame = frames[0];
	if (!frame) return `${panel.accessibleLabel}: Histogram data is unavailable`;
	const model = buildHistogramModel(frame, locale);
	const mode =
		preset === "cumulative"
			? `cumulative ${config.cumulativeMode}`
			: config.normalization;
	return `${panel.accessibleLabel}: ${histogramSummary(
		model.rows.map((row) => ({ count: row.totalCount })),
		mode,
	)}`.slice(0, 1000);
}
