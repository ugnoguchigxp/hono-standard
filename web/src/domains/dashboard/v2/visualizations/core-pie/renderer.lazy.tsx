import type { PieConfigV1 } from "@shared/schemas/dashboard/composition-visualizations.schema";
import type { CSSProperties } from "react";
import {
	Cell,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	type PieLabelRenderProps,
} from "recharts";
import type { DashboardRendererContext } from "../../runtime/visualization-types";
import { resolveThemeColor } from "../../runtime/theme";
import { formatDashboardValue } from "../../runtime/value-format";
import {
	buildCategoryCompositionModel,
	sortCategorySlices,
	visibleCategorySlices,
} from "../composition/category-model";

export function Renderer({
	frames,
	config,
	preset,
	theme,
	interaction,
	panel,
	locale,
	timezone,
}: DashboardRendererContext<PieConfigV1>) {
	const model = buildCategoryCompositionModel(
		frames[0] as never,
		theme.palette,
	);
	const visible = visibleCategorySlices(model, interaction.hiddenFieldKeys);
	const slices = sortCategorySlices(
		{ ...model, slices: visible.slices, total: visible.total },
		config.sort,
	);
	const data = slices.map((slice) => ({
		...slice,
		chartValue: preset === "rose" ? (slice.value > 0 ? 1 : 0) : slice.value,
		formattedValue: formatDashboardValue(
			slice.value,
			model.valueFieldConfig,
			locale,
			timezone,
			"number",
		),
	}));
	const maximum = Math.max(...data.map((slice) => slice.value), 1);
	const renderLabel = (props: PieLabelRenderProps) => {
		const slice = props.payload as (typeof data)[number] | undefined;
		if (!slice || config.showLabels === "never") return null;
		if (config.showLabels === "auto" && slice.percent < 5) return null;
		if (config.labelContent === "category") return slice.label;
		if (config.labelContent === "value") return slice.formattedValue;
		return `${slice.percent.toFixed(1)}%`;
	};
	return (
		<figure
			className={`dashboard-chart dashboard-chart-${preset}`}
			aria-label={panel.accessibleLabel}
		>
			<div className="dashboard-chart-canvas">
				<ResponsiveContainer width="100%" height="100%">
					<PieChart>
						<Pie
							data={data}
							dataKey="chartValue"
							nameKey="label"
							startAngle={preset === "semi-donut" ? 180 : 90}
							endAngle={preset === "semi-donut" ? 0 : -270}
							innerRadius={preset === "pie" || preset === "rose" ? 0 : "55%"}
							outerRadius={
								preset === "rose"
									? (item: { payload?: { value?: number } }) => {
											const value = item.payload?.value ?? 0;
											return value <= 0
												? 0
												: `${Math.sqrt(value / maximum) * 72}%`;
										}
									: "80%"
							}
							paddingAngle={config.paddingAngle}
							cornerRadius={config.cornerRadius}
							isAnimationActive={false}
							label={renderLabel}
							onClick={(_item, index) => {
								const slice = data[index];
								if (slice) interaction.onDatumActivate(slice.raw);
							}}
						>
							{data.map((slice) => (
								<Cell
									key={slice.id}
									fill={resolveThemeColor(slice.colorToken)}
								/>
							))}
						</Pie>
						<Tooltip
							isAnimationActive={false}
							formatter={(value, _name, item) => [
								String(item?.payload?.value ?? value),
								`${item?.payload?.label ?? "Category"} (${Number(item?.payload?.percent ?? 0).toFixed(1)}%)`,
							]}
						/>
					</PieChart>
				</ResponsiveContainer>
				{config.centerMetric === "total" &&
				preset !== "pie" &&
				preset !== "rose" ? (
					<div className="dashboard-chart-center-metric" aria-hidden="true">
						<strong>
							{formatDashboardValue(
								visible.total,
								model.valueFieldConfig,
								locale,
								timezone,
								"number",
							)}
						</strong>
						<span>Total</span>
					</div>
				) : null}
			</div>
			{config.showLegend ? (
				<fieldset className="dashboard-chart-legend">
					<legend className="dashboard-visually-hidden">Chart legend</legend>
					{model.slices.map((slice) => {
						const visibleSlice = !interaction.hiddenFieldKeys.has(slice.id);
						return (
							<button
								key={slice.id}
								type="button"
								aria-pressed={visibleSlice}
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
							</button>
						);
					})}
				</fieldset>
			) : null}
			{visible.slices.length === 0 ? (
				<button type="button" onClick={interaction.resetFields}>
					Reset filters
				</button>
			) : null}
		</figure>
	);
}

export function buildAccessibleSummary({
	frames,
	theme,
	panel,
	preset,
}: DashboardRendererContext<PieConfigV1>) {
	try {
		const model = buildCategoryCompositionModel(
			frames[0] as never,
			theme.palette,
		);
		const top = [...model.slices]
			.sort((a, b) => b.value - a.value)
			.slice(0, 3)
			.map((slice) => `${slice.label} ${slice.percent.toFixed(1)}%`)
			.join(", ");
		return `${panel.accessibleLabel}: ${preset}, total ${model.total}, ${model.slices.length} categories. Top: ${top}`.slice(
			0,
			600,
		);
	} catch {
		return `${panel.accessibleLabel}: no valid composition data`;
	}
}
