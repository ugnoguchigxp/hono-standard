import type { ComposedConfigV1 } from "@shared/schemas/dashboard/cartesian-visualizations.schema";
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
import { resolveFieldConfig } from "../../runtime/field-config";
import { resolveThemeColor } from "../../runtime/theme";
import type { DashboardRendererContext } from "../../runtime/visualization-types";
import { resolveCartesianDomain } from "../cartesian/axis";
import {
	findCartesianSeriesForDataKey,
	formatCartesianDomain,
	formatCartesianTimeTick,
	formatCartesianTooltipValue,
	formatCartesianUnitLabel,
	formatCartesianValue,
	resolveCartesianSeriesColor,
} from "../cartesian/formatters";
import { CartesianLegend } from "../cartesian/legend";
import { referenceLineStrokeDash } from "../cartesian/reference-lines";
import { summarizeCartesian } from "../cartesian/summary";
import { CartesianTooltip } from "../cartesian/tooltip";
import { buildComposedModel } from "./model";

const lineType = (style: "linear" | "monotone" | "stepAfter") =>
	style === "stepAfter"
		? "stepAfter"
		: style === "monotone"
			? "monotone"
			: "linear";

export function Renderer({
	frames,
	panel,
	config,
	theme,
	interaction,
	timezone,
	locale,
	dashboardId,
}: DashboardRendererContext<ComposedConfigV1>) {
	const { model, bindings } = buildComposedModel(frames, config, {
		resolveFieldConfig: (frame, field) =>
			resolveFieldConfig(panel, frame, field),
	});
	const visibleBindings = bindings.filter(
		(binding) => !interaction.hiddenFieldKeys.has(binding.fieldKey),
	);
	const data = model.rows.map((row) => ({ domain: row.domain, ...row.values }));
	const formatDomain = (value: string | number) =>
		model.domainKind === "time"
			? formatCartesianDomain(Number(value), timezone, locale)
			: String(value);
	const formatDomainTick = (value: string | number) =>
		model.domainKind === "time"
			? formatCartesianTimeTick(
					Number(value),
					model.rows.map((row) => row.domain),
					timezone,
					locale,
				)
			: String(value);
	const seriesForAxis = (axis: "left" | "right") => {
		const binding = visibleBindings.find((item) => item.axis === axis);
		return model.series.find((series) => series.key === binding?.fieldKey);
	};
	const formatAxis = (axis: "left" | "right", value: unknown) => {
		const series = seriesForAxis(axis);
		return series
			? formatCartesianValue(
					value,
					series.fieldConfig,
					locale,
					timezone,
					"number",
				)
			: String(value);
	};
	return (
		<figure className="dashboard-chart" aria-label={panel.accessibleLabel}>
			<div className="dashboard-chart-canvas">
				<ResponsiveContainer width="100%" height="100%">
					<ComposedChart
						data={data}
						accessibilityLayer
						syncId={`${dashboardId}:${panel.id}`}
					>
						{config.showGrid ? <CartesianGrid strokeDasharray="3 3" /> : null}
						<XAxis dataKey="domain" tickFormatter={formatDomainTick} />
						<YAxis
							yAxisId="left"
							scale={config.leftAxis.scale}
							domain={resolveCartesianDomain(config.leftAxis)}
							hide={!config.leftAxis.show}
							tickFormatter={(value) => formatAxis("left", value)}
						/>
						<YAxis
							yAxisId="right"
							orientation="right"
							scale={config.rightAxis.scale}
							domain={resolveCartesianDomain(config.rightAxis)}
							hide={!config.rightAxis.show}
							tickFormatter={(value) => formatAxis("right", value)}
						/>
						<Tooltip
							isAnimationActive={false}
							filterNull={false}
							content={(props) => (
								<CartesianTooltip
									{...props}
									formatDomain={formatDomain}
									formatRow={(entry) => {
										const series = findCartesianSeriesForDataKey(
											model,
											entry.dataKey,
										);
										const binding = bindings.find(
											(item) => item.fieldKey === series?.key,
										);
										if (!series || !binding) return null;
										const index = model.series.indexOf(series);
										const formatted = formatCartesianTooltipValue(
											entry.value,
											series,
											locale,
											timezone,
										);
										return {
											key: series.key,
											label: series.label,
											value: formatted.value,
											detail: `${binding.mark}, ${binding.axis} axis, ${formatCartesianUnitLabel(series.fieldConfig.unit) || "number"}${formatted.detail ? `, ${formatted.detail}` : ""}`,
											color: resolveCartesianSeriesColor(series, index, theme),
										};
									}}
								/>
							)}
						/>
						{config.referenceLines.map((line) => (
							<ReferenceLine
								key={`${line.axis}:${line.value}:${line.label ?? ""}`}
								yAxisId={line.axis}
								y={line.value}
								label={line.label}
								stroke={resolveThemeColor(line.colorToken)}
								strokeDasharray={referenceLineStrokeDash(line)}
							/>
						))}
						{visibleBindings.map((binding) => {
							const series = model.series.find(
								(item) => item.key === binding.fieldKey,
							);
							if (!series) return null;
							const index = model.series.indexOf(series);
							const color = resolveCartesianSeriesColor(series, index, theme);
							return binding.mark === "bar" ? (
								<Bar
									key={binding.fieldKey}
									dataKey={binding.fieldKey}
									name={series.label}
									yAxisId={binding.axis}
									fill={color}
									isAnimationActive={false}
								/>
							) : (
								<Line
									key={binding.fieldKey}
									dataKey={binding.fieldKey}
									name={series.label}
									yAxisId={binding.axis}
									type={lineType(binding.lineStyle)}
									stroke={color}
									dot={false}
									isAnimationActive={false}
								/>
							);
						})}
					</ComposedChart>
				</ResponsiveContainer>
			</div>
			{config.showLegend ? (
				<CartesianLegend
					series={bindings.flatMap((binding) => {
						const series = model.series.find(
							(item) => item.key === binding.fieldKey,
						);
						if (!series) return [];
						return [
							{
								key: series.key,
								label: series.label,
								detail: `${binding.mark}, ${binding.axis}, ${formatCartesianUnitLabel(series.fieldConfig.unit) || "number"}`,
								color: resolveCartesianSeriesColor(
									series,
									model.series.indexOf(series),
									theme,
								),
							},
						];
					})}
					hidden={interaction.hiddenFieldKeys}
					onToggle={interaction.toggleField}
					onIsolate={interaction.isolateField}
					onReset={interaction.resetFields}
				/>
			) : null}
		</figure>
	);
}

export function buildAccessibleSummary({
	panel,
	frames,
	config,
	locale,
	timezone,
}: DashboardRendererContext<ComposedConfigV1>) {
	const { model, bindings } = buildComposedModel(frames, config, {
		resolveFieldConfig: (frame, field) =>
			resolveFieldConfig(panel, frame, field),
	});
	const axes = (["left", "right"] as const)
		.map((axis) => {
			const labels = bindings
				.filter((binding) => binding.axis === axis)
				.flatMap((binding) => {
					const series = model.series.find(
						(item) => item.key === binding.fieldKey,
					);
					return series
						? [
								`${series.label} (${formatCartesianUnitLabel(series.fieldConfig.unit) || "number"})`,
							]
						: [];
				});
			return `${axis}: ${labels.join(", ")}`;
		})
		.join("; ");
	return `${panel.accessibleLabel}: dual axis ${axes}; ${summarizeCartesian(model, "dual-axis", locale, timezone)}`.slice(
		0,
		400,
	);
}
