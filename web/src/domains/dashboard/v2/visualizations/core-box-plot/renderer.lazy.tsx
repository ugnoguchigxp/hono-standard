import type { BoxPlotConfigV1 } from "@shared/schemas/dashboard/distribution-visualizations.schema";
import { type CSSProperties, useMemo, useState } from "react";
import { resolveThemeColor } from "../../runtime/theme";
import type { DashboardRendererContext } from "../../runtime/visualization-types";
import { buildBoxPlotModel, stableJitter } from "../distribution/box-plot";
import { SummaryFigure } from "../distribution/primitives";
import { boxSummary } from "../distribution/summary";

const boxLabel = (category: string, series?: string) =>
	series ? `${category} · ${series}` : category;

export function Renderer({
	frames,
	config,
	preset,
	panel,
	theme,
}: DashboardRendererContext<BoxPlotConfigV1>) {
	const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(
		() => new Set(),
	);
	const boxes = useMemo(
		() => buildBoxPlotModel(frames, config, preset),
		[frames, config, preset],
	);
	if (!boxes.length)
		return (
			<div className="dashboard-panel-error">Box plot data is unavailable</div>
		);
	const dataMin = Math.min(...boxes.map((box) => box.min));
	const dataMax = Math.max(...boxes.map((box) => box.max));
	const padding =
		dataMin === dataMax ? Math.max(Math.abs(dataMin) * 0.1, 0.5) : 0;
	const min =
		typeof config.valueScale.min === "number"
			? config.valueScale.min
			: dataMin - padding;
	const max =
		typeof config.valueScale.max === "number"
			? config.valueScale.max
			: dataMax + padding;
	const transform = (value: number) =>
		config.valueScale.mode === "log"
			? Math.log(value)
			: config.valueScale.mode === "symlog"
				? Math.sign(value) * Math.log1p(Math.abs(value))
				: value;
	const transformedMin = transform(min);
	const transformedMax = transform(max);
	const ratio = (value: number) =>
		Math.max(
			0,
			Math.min(
				1,
				(transform(value) - transformedMin) /
					(transformedMax - transformedMin || 1),
			),
		);
	const horizontalScale = (value: number) => 110 + ratio(value) * 270;
	const verticalScale = (value: number) => 126 - ratio(value) * 104;
	const vertical = config.orientation === "vertical";
	const showPoints = config.showAllPoints || preset === "box-and-points";
	const rangeSummary = preset === "range-summary";
	const seriesLabels = [
		...new Set(boxes.flatMap((box) => (box.series ? [box.series] : []))),
	];
	const visibleBoxes = boxes.filter(
		(box) => !box.series || !hiddenSeries.has(box.series),
	);
	const toggleSeries = (series: string) =>
		setHiddenSeries((current) => {
			const next = new Set(current);
			next.has(series) ? next.delete(series) : next.add(series);
			return next;
		});
	const seriesColor = (series: string | undefined, index: number) => {
		const paletteIndex = series ? seriesLabels.indexOf(series) : index;
		return resolveThemeColor(
			theme.palette.length
				? theme.palette[paletteIndex % theme.palette.length]
				: undefined,
		);
	};
	return (
		<SummaryFigure label={panel.accessibleLabel} theme={theme}>
			<svg
				className="dashboard-boxplot-svg"
				viewBox={
					vertical
						? "0 0 400 150"
						: `0 0 400 ${Math.max(150, visibleBoxes.length * 42)}`
				}
				data-orientation={vertical ? "vertical" : "horizontal"}
				role="img"
				aria-hidden="true"
			>
				{config.showGrid ? (
					<g opacity="0.35">
						{Array.from({ length: 5 }, (_, index) => {
							const position = index / 4;
							return vertical ? (
								<line
									key={position}
									x1="30"
									x2="370"
									y1={126 - position * 104}
									y2={126 - position * 104}
									stroke="var(--color-border-strong)"
								/>
							) : (
								<line
									key={position}
									x1={110 + position * 270}
									x2={110 + position * 270}
									y1="0"
									y2={Math.max(150, visibleBoxes.length * 42)}
									stroke="var(--color-border-strong)"
								/>
							);
						})}
					</g>
				) : null}
				{visibleBoxes.map((box, index) => {
					const label = boxLabel(box.category, box.series);
					const color = seriesColor(box.series, index);
					if (vertical) {
						const band = 320 / Math.max(1, visibleBoxes.length);
						const x = 40 + band * index + band / 2;
						const yLow = verticalScale(box.whiskerLow);
						const yHigh = verticalScale(box.whiskerHigh);
						const q1 = verticalScale(box.q1);
						const q3 = verticalScale(box.q3);
						const median = verticalScale(box.median);
						const boxWidth = Math.min(42, band * 0.55);
						const jitter = band * config.pointJitter;
						return (
							<g key={box.id}>
								<title>{`${label}: min ${box.min}, Q1 ${box.q1}, median ${box.median}, Q3 ${box.q3}, max ${box.max}`}</title>
								<text x={x} y="146" textAnchor="middle" fontSize="10">
									{label.slice(0, 16)}
								</text>
								<line
									x1={x}
									x2={x}
									y1={yHigh}
									y2={yLow}
									stroke="var(--color-muted-strong)"
								/>
								<line
									x1={x - 8}
									x2={x + 8}
									y1={yHigh}
									y2={yHigh}
									stroke="var(--color-muted-strong)"
								/>
								<line
									x1={x - 8}
									x2={x + 8}
									y1={yLow}
									y2={yLow}
									stroke="var(--color-muted-strong)"
								/>
								<rect
									x={x - boxWidth / 2}
									y={q3}
									width={boxWidth}
									height={Math.max(2, q1 - q3)}
									fill={color}
									opacity={rangeSummary ? 0.35 : 0.75}
								/>
								<line
									x1={x - boxWidth / 2}
									x2={x + boxWidth / 2}
									y1={median}
									y2={median}
									stroke="var(--color-ink)"
									strokeWidth={rangeSummary ? 3 : 2}
								/>
								{config.showMean && box.mean !== undefined ? (
									<circle
										cx={x}
										cy={verticalScale(box.mean)}
										r="3"
										fill="var(--color-surface)"
										stroke="var(--color-danger)"
										strokeWidth="2"
									/>
								) : null}
								{showPoints &&
									box.points.map((point, pointIndex) => (
										<circle
											key={`${box.id}:point:${point}:${stableJitter(box.id, pointIndex, jitter)}`}
											cx={x + stableJitter(box.id, pointIndex, jitter)}
											cy={verticalScale(point)}
											r="2"
											fill={color}
											opacity="0.7"
										/>
									))}
								{config.showOutliers &&
									!showPoints &&
									box.outliers.map((point, pointIndex) => (
										<circle
											key={`${box.id}:${point}:${stableJitter(box.id, pointIndex, jitter)}`}
											cx={x + stableJitter(box.id, pointIndex, jitter)}
											cy={verticalScale(point)}
											r="2.5"
											fill="var(--color-danger)"
										/>
									))}
							</g>
						);
					}
					const y = index * 42 + 20;
					const x1 = horizontalScale(box.whiskerLow);
					const x2 = horizontalScale(box.whiskerHigh);
					const q1 = horizontalScale(box.q1);
					const q3 = horizontalScale(box.q3);
					const median = horizontalScale(box.median);
					const jitter = 42 * config.pointJitter;
					return (
						<g key={box.id}>
							<title>{`${label}: min ${box.min}, Q1 ${box.q1}, median ${box.median}, Q3 ${box.q3}, max ${box.max}`}</title>
							<text x="4" y={y + 5}>
								{label.slice(0, 18)}
							</text>
							<line
								x1={x1}
								x2={x2}
								y1={y}
								y2={y}
								stroke="var(--color-muted-strong)"
							/>
							<line
								x1={x1}
								x2={x1}
								y1={y - 8}
								y2={y + 8}
								stroke="var(--color-muted-strong)"
							/>
							<line
								x1={x2}
								x2={x2}
								y1={y - 8}
								y2={y + 8}
								stroke="var(--color-muted-strong)"
							/>
							<rect
								x={q1}
								y={y - 10}
								width={Math.max(2, q3 - q1)}
								height="20"
								fill={color}
								opacity={rangeSummary ? 0.35 : 0.75}
							/>
							<line
								x1={median}
								x2={median}
								y1={y - 10}
								y2={y + 10}
								stroke="var(--color-ink)"
								strokeWidth={rangeSummary ? 3 : 2}
							/>
							{config.showMean && box.mean !== undefined ? (
								<circle
									cx={horizontalScale(box.mean)}
									cy={y}
									r="3"
									fill="var(--color-surface)"
									stroke="var(--color-danger)"
									strokeWidth="2"
								/>
							) : null}
							{showPoints &&
								box.points.map((point, pointIndex) => (
									<circle
										key={`${box.id}:point:${point}:${stableJitter(box.id, pointIndex, jitter)}`}
										cx={horizontalScale(point)}
										cy={y + stableJitter(box.id, pointIndex, jitter)}
										r="2"
										fill={color}
										opacity="0.7"
									/>
								))}
							{config.showOutliers &&
								!showPoints &&
								box.outliers.map((point, pointIndex) => (
									<circle
										key={`${box.id}:${point}:${stableJitter(box.id, pointIndex, jitter)}`}
										cx={horizontalScale(point)}
										cy={y + stableJitter(box.id, pointIndex, jitter)}
										r="2.5"
										fill="var(--color-danger)"
									/>
								))}
						</g>
					);
				})}
			</svg>
			{seriesLabels.length > 1 ? (
				<nav className="dashboard-chart-legend" aria-label="Box plot series">
					{seriesLabels.map((series, index) => (
						<button
							key={series}
							type="button"
							aria-pressed={!hiddenSeries.has(series)}
							onClick={() => toggleSeries(series)}
						>
							<i
								className="dashboard-chart-legend-swatch"
								style={
									{
										"--dashboard-series-color": seriesColor(series, index),
									} as CSSProperties
								}
								aria-hidden="true"
							/>
							{series}
						</button>
					))}
				</nav>
			) : null}
			<p className="dashboard-panel-summary">{boxSummary(boxes)}</p>
		</SummaryFigure>
	);
}
export function buildAccessibleSummary({
	frames,
	config,
	preset,
	panel,
}: DashboardRendererContext<BoxPlotConfigV1>) {
	return `${panel.accessibleLabel}: ${boxSummary(buildBoxPlotModel(frames, config, preset))}`.slice(
		0,
		1000,
	);
}
