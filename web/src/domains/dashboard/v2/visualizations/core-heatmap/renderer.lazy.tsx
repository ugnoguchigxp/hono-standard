import type { HeatmapConfigV1 } from "@shared/schemas/dashboard/distribution-visualizations.schema";
import { resolveThemeColor } from "../../runtime/theme";
import type { DashboardRendererContext } from "../../runtime/visualization-types";
import {
	colorScaleToken,
	resolveColorScale,
} from "../distribution/color-scale";
import { buildMatrixModel } from "../distribution/matrix";
import { ColorScaleLegend, SummaryFigure } from "../distribution/primitives";
import { matrixSummary } from "../distribution/summary";

export function Renderer({
	frames,
	config,
	preset,
	panel,
	locale,
	timezone,
	theme,
}: DashboardRendererContext<HeatmapConfigV1>) {
	const frame = frames[0];
	if (!frame)
		return (
			<div className="dashboard-panel-error">Heatmap data is unavailable</div>
		);
	const model = buildMatrixModel(frame, config, { locale, timezone });
	const scale = resolveColorScale(config.colorScale, model.values);
	const width = Math.max(360, model.x.length * 72);
	const height = Math.max(108, model.y.length * 36);
	const cellWidth = 72 - config.cellGap;
	const cellHeight = 36 - config.cellGap;
	const xIndexes = new Map(model.xKeys.map((key, index) => [key, index]));
	const yIndexes = new Map(model.yKeys.map((key, index) => [key, index]));
	return (
		<SummaryFigure label={panel.accessibleLabel} theme={theme}>
			<div className="dashboard-heatmap-scroll">
				<svg
					className="dashboard-heatmap-svg"
					viewBox={`0 0 ${width + 72} ${height + 48}`}
					role="img"
					aria-hidden="true"
				>
					<g transform="translate(72,32)">
						{model.cells.map((cell) => {
							const x = xIndexes.get(cell.xKey) ?? -1;
							const y = yIndexes.get(cell.yKey) ?? -1;
							return (
								<g
									key={`${cell.xKey}:${cell.yKey}`}
									transform={`translate(${x * 72},${y * 36})`}
								>
									<rect
										width={cellWidth}
										height={cellHeight}
										fill={resolveThemeColor(
											colorScaleToken(scale, cell.value, cell.state),
										)}
										opacity={cell.missing && config.missing === "gap" ? 0 : 1}
									/>
									<title>{`${cell.xLabel}, ${cell.yLabel}: ${cell.value ?? "missing"}`}</title>
									{(config.showCellValues || preset === "annotated") && (
										<text
											x={cellWidth / 2}
											y={cellHeight / 2 + 5}
											textAnchor="middle"
											fill="var(--color-surface)"
										>
											{cell.value ?? "—"}
										</text>
									)}
								</g>
							);
						})}
						{model.x.map((label, index) => (
							<text
								key={label}
								x={index * 72 + 35}
								y={height + 18}
								textAnchor="middle"
							>
								{label.slice(0, 10)}
							</text>
						))}
						{model.y.map((label, index) => (
							<text key={label} x="-8" y={index * 36 + 22} textAnchor="end">
								{label.slice(0, 10)}
							</text>
						))}
					</g>
				</svg>
			</div>
			{config.showLegend && <ColorScaleLegend scale={scale} locale={locale} />}
			<p className="dashboard-panel-summary">{matrixSummary(model)}</p>
		</SummaryFigure>
	);
}
export function buildAccessibleSummary({
	frames,
	config,
	panel,
	locale,
	timezone,
}: DashboardRendererContext<HeatmapConfigV1>) {
	const frame = frames[0];
	return `${panel.accessibleLabel}: ${frame ? matrixSummary(buildMatrixModel(frame, config, { locale, timezone })) : "Heatmap data is unavailable"}`.slice(
		0,
		1000,
	);
}
