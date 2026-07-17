import type { RadialBarConfigV1 } from "@shared/schemas/dashboard/composition-visualizations.schema";
import type { CSSProperties } from "react";
import {
	Cell,
	PolarAngleAxis,
	RadialBar,
	RadialBarChart,
	ResponsiveContainer,
	Tooltip,
} from "recharts";
import { resolveThemeColor } from "../../runtime/theme";
import { formatDashboardValue } from "../../runtime/value-format";
import type { DashboardRendererContext } from "../../runtime/visualization-types";
import { buildRadialBarModel, resolveRadialBarMax } from "./model";
export function Renderer({
	frames,
	config,
	preset,
	theme,
	panel,
	locale,
	timezone,
	interaction,
}: DashboardRendererContext<RadialBarConfigV1>) {
	const model = buildRadialBarModel(frames[0] as never, theme.palette, {
		allowAllZero: preset === "progress",
	});
	const max = resolveRadialBarMax(model, config.max, preset);
	const data = model.slices
		.filter((slice) => !interaction.hiddenFieldKeys.has(slice.id))
		.map((slice) => ({
			...slice,
			name: slice.label,
			percent: (slice.value / max) * 100,
			chartValue:
				preset === "progress" ? (slice.value / max) * 100 : slice.value,
			formattedValue: formatDashboardValue(
				slice.value,
				model.valueFieldConfig,
				locale,
				timezone,
				"number",
			),
		}));
	return (
		<figure
			className={`dashboard-chart dashboard-chart-${preset}`}
			aria-label={panel.accessibleLabel}
		>
			<div className="dashboard-chart-canvas">
				<ResponsiveContainer width="100%" height="100%">
					<RadialBarChart
						data={data}
						startAngle={config.startAngle}
						endAngle={config.endAngle}
						innerRadius={`${config.innerRadiusPercent}%`}
						outerRadius={`${config.outerRadiusPercent}%`}
					>
						{preset === "progress" ? (
							<PolarAngleAxis
								type="number"
								domain={[0, 100]}
								tick={false}
								axisLine={false}
							/>
						) : null}
						<RadialBar
							dataKey="chartValue"
							background={config.showTrack}
							label={false}
							isAnimationActive={false}
						>
							{data.map((slice) => (
								<Cell
									key={slice.id}
									fill={resolveThemeColor(slice.colorToken)}
								/>
							))}
						</RadialBar>
						<Tooltip
							isAnimationActive={false}
							formatter={(_value, _name, item) => [
								item?.payload?.formattedValue ?? "—",
								`${item?.payload?.label ?? "Value"} (${Number(item?.payload?.percent ?? 0).toFixed(1)}%)`,
							]}
						/>
					</RadialBarChart>
				</ResponsiveContainer>
			</div>
			{config.showLegend || config.showLabels ? (
				<fieldset className="dashboard-chart-legend">
					<legend className="dashboard-visually-hidden">Chart legend</legend>
					{model.slices.map((slice) => {
						const visible = !interaction.hiddenFieldKeys.has(slice.id);
						const formattedValue = formatDashboardValue(
							slice.value,
							model.valueFieldConfig,
							locale,
							timezone,
							"number",
						);
						return (
							<button
								key={slice.id}
								type="button"
								aria-pressed={visible}
								onClick={() => interaction.toggleField(slice.id)}
								onDoubleClick={() => interaction.isolateField(slice.id)}
							>
								<span
									className="dashboard-chart-legend-swatch"
									style={
										{
											"--dashboard-series-color": resolveThemeColor(
												slice.colorToken,
											),
										} as CSSProperties
									}
								/>
								{slice.label}
								{config.showLabels ? ` ${formattedValue}` : ""}
							</button>
						);
					})}
				</fieldset>
			) : null}
			{data.length === 0 ? (
				<button type="button" onClick={interaction.resetFields}>
					Reset filters
				</button>
			) : null}
		</figure>
	);
}
// Cell carries the stable token fill to Recharts without using raw colors.
export function buildAccessibleSummary({
	frames,
	theme,
	panel,
	preset,
	config,
}: DashboardRendererContext<RadialBarConfigV1>) {
	try {
		const model = buildRadialBarModel(frames[0] as never, theme.palette, {
			allowAllZero: preset === "progress",
		});
		const max = resolveRadialBarMax(model, config.max, preset);
		const detail =
			preset === "progress"
				? model.slices
						.slice(0, 5)
						.map(
							(slice) =>
								`${slice.label} ${((slice.value / max) * 100).toFixed(1)}%`,
						)
						.join(", ")
				: `top ${[...model.slices].sort((a, b) => b.value - a.value)[0]?.label ?? "none"}`;
		return `${panel.accessibleLabel}: ${preset}, ${model.slices.length} categories, maximum ${max}. ${detail}`.slice(
			0,
			600,
		);
	} catch {
		return `${panel.accessibleLabel}: no valid radial data`;
	}
}
