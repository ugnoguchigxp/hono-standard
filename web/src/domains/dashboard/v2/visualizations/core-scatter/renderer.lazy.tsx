import type { ScatterConfigV1 } from "@shared/schemas/dashboard/relationship-visualizations.schema";
import {
	CartesianGrid,
	Cell,
	Legend,
	ReferenceLine,
	Scatter,
	ScatterChart,
	Tooltip,
	XAxis,
	YAxis,
	ZAxis,
	ResponsiveContainer,
} from "recharts";
import type { DashboardRendererContext } from "../../runtime/visualization-types";
import { resolveThemeColor } from "../../runtime/theme";
import { buildScatterModel } from "../relationship/scatter-model";
export function Renderer({
	frames,
	config,
	preset,
	theme,
	panel,
}: DashboardRendererContext<ScatterConfigV1>) {
	const models = frames.map((frame) =>
		buildScatterModel(frame, { ...config, palette: theme.palette }),
	);
	const points = models.flatMap((model) => model.points);
	const groups = [...new Set(points.map((point) => point.series))];
	const isBubble = preset === "bubble";
	return (
		<figure
			className={`dashboard-chart dashboard-chart-${preset}`}
			aria-label={panel.accessibleLabel}
		>
			<div className="dashboard-chart-canvas">
				<ResponsiveContainer width="100%" height="100%">
					<ScatterChart>
						{config.showGrid ? <CartesianGrid /> : null}
						<XAxis
							type="number"
							dataKey="x"
							domain={
								config.xAxis.min === "auto"
									? ["auto", config.xAxis.max]
									: [config.xAxis.min, config.xAxis.max]
							}
						/>
						<YAxis
							type="number"
							dataKey="y"
							domain={
								config.yAxis.min === "auto"
									? ["auto", config.yAxis.max]
									: [config.yAxis.min, config.yAxis.max]
							}
						/>
						<ZAxis
							dataKey="z"
							range={
								isBubble
									? [config.bubbleRadius.min ** 2, config.bubbleRadius.max ** 2]
									: [config.pointSize, config.pointSize]
							}
						/>
						{preset === "quadrant" && config.quadrant ? (
							<>
								<ReferenceLine x={config.quadrant.x} />
								<ReferenceLine y={config.quadrant.y} />
							</>
						) : null}
						{groups.map((group) => {
							const groupPoints = points
								.filter((point) => point.series === group)
								.map((point) => ({
									...point,
									z: isBubble ? (point.size ?? 0) : 1,
								}));
							return (
								<Scatter
									key={group}
									name={group}
									data={groupPoints}
									fill={resolveThemeColor(groupPoints[0]?.colorToken)}
									isAnimationActive={false}
								>
									{groupPoints.map((point) => (
										<Cell
											key={point.id}
											fill={resolveThemeColor(point.colorToken)}
										/>
									))}
								</Scatter>
							);
						})}
						<Tooltip isAnimationActive={false} />
						{config.showLegend ? <Legend /> : null}
					</ScatterChart>
				</ResponsiveContainer>
			</div>
		</figure>
	);
}
export function buildAccessibleSummary({
	frames,
	config,
	panel,
	theme,
}: DashboardRendererContext<ScatterConfigV1>) {
	try {
		const models = frames.map((frame) =>
			buildScatterModel(frame, { ...config, palette: theme.palette }),
		);
		const points = models.reduce((sum, model) => sum + model.points.length, 0);
		const skipped = models.reduce((sum, model) => sum + model.skipped, 0);
		return `${panel.accessibleLabel}: ${points} points, ${skipped} skipped points`.slice(
			0,
			600,
		);
	} catch {
		return `${panel.accessibleLabel}: no valid scatter data`;
	}
}
