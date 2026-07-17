import {
	Area,
	AreaChart,
	CartesianGrid,
	Line,
	LineChart,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import type { TimeseriesConfigV2 } from "@shared/schemas/dashboard/cartesian-visualizations.schema";
import { resolveFieldConfig } from "../../runtime/field-config";
import type { DashboardRendererContext } from "../../runtime/visualization-types";
import { resolveThemeColor } from "../../runtime/theme";
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
import {
	buildCartesianModel,
	buildRangeBandRows,
	normalizePercentRows,
	resolveCartesianSeriesKey,
} from "../cartesian/model";
import { referenceLineStrokeDash } from "../cartesian/reference-lines";
import { summarizeCartesian } from "../cartesian/summary";
import { CartesianTooltip } from "../cartesian/tooltip";
import { PlotOverlay } from "../../panel/plot-overlay";

function curveFor(preset: string) {
	return preset === "smooth-line" ||
		preset === "area" ||
		preset.includes("stacked") ||
		preset === "sparkline"
		? "monotone"
		: preset === "step-line"
			? "stepAfter"
			: "linear";
}

export function Renderer({
	frames,
	panel,
	config,
	preset,
	theme,
	interaction,
	dashboardId,
	timezone,
	locale,
	annotationLayers,
}: DashboardRendererContext<TimeseriesConfigV2>) {
	const model = buildCartesianModel(frames, "time", {
		resolveFieldConfig: (frame, field) =>
			resolveFieldConfig(panel, frame, field),
	});
	const isSparkline = preset === "sparkline";
	const isArea = preset.includes("area") || preset === "range-band";
	const isPercent = preset === "percent-stacked-area";
	const visible = model.series.filter(
		(item) => !interaction.hiddenFieldKeys.has(item.key),
	);
	const chartRows = isPercent
		? normalizePercentRows(
				model,
				visible.map((series) => series.key),
			)
		: model.rows;
	const lowerKey =
		preset === "range-band" && config.rangeBand
			? resolveCartesianSeriesKey(model, config.rangeBand.lowerFieldKey)
			: undefined;
	const upperKey =
		preset === "range-band" && config.rangeBand
			? resolveCartesianSeriesKey(model, config.rangeBand.upperFieldKey)
			: undefined;
	const rangeRows =
		lowerKey && upperKey ? buildRangeBandRows(model, lowerKey, upperKey) : [];
	const rows = rangeRows.length
		? rangeRows.map((row) => ({ ...row, lower: row.lower, width: row.width }))
		: chartRows;
	const primarySeries = visible[0] ?? model.series[0];
	const rangeSeries = lowerKey
		? model.series.find((series) => series.key === lowerKey)
		: undefined;
	const rangeColor = rangeSeries
		? resolveCartesianSeriesColor(
				rangeSeries,
				Math.max(
					0,
					model.series.findIndex((series) => series.key === rangeSeries.key),
				),
				theme,
			)
		: resolveThemeColor(theme.palette[0]);
	const rangeVisible =
		lowerKey !== undefined &&
		upperKey !== undefined &&
		!interaction.hiddenFieldKeys.has(lowerKey) &&
		!interaction.hiddenFieldKeys.has(upperKey);
	const rangeLegendKey = "range-band";
	const legendSeries =
		preset === "range-band" && lowerKey && upperKey
			? [
					{
						key: rangeLegendKey,
						label: `${model.series.find((series) => series.key === lowerKey)?.label ?? lowerKey} – ${model.series.find((series) => series.key === upperKey)?.label ?? upperKey}`,
						color: rangeColor,
						detail: rangeSeries
							? formatCartesianUnitLabel(rangeSeries.fieldConfig.unit)
							: undefined,
					},
				]
			: model.series.map((item, index) => ({
					key: item.key,
					label: item.label,
					color: resolveCartesianSeriesColor(item, index, theme),
					detail: formatCartesianUnitLabel(item.fieldConfig.unit) || undefined,
				}));
	const legendHidden =
		preset === "range-band"
			? new Set(rangeVisible ? [] : [rangeLegendKey])
			: interaction.hiddenFieldKeys;
	const toggleLegendSeries = (key: string) => {
		if (key !== rangeLegendKey || !lowerKey || !upperKey)
			return interaction.toggleField(key);
		for (const fieldKey of [lowerKey, upperKey]) {
			if (rangeVisible || interaction.hiddenFieldKeys.has(fieldKey))
				interaction.toggleField(fieldKey);
		}
	};
	const isolateLegendSeries = (key: string) => {
		if (key !== rangeLegendKey || !lowerKey || !upperKey)
			return interaction.isolateField(key);
		interaction.resetFields();
		for (const series of model.series) {
			if (series.key !== lowerKey && series.key !== upperKey)
				interaction.toggleField(series.key);
		}
	};
	const Chart = isArea ? AreaChart : LineChart;
	return (
		<figure
			className={`dashboard-chart dashboard-chart-${preset}`}
			aria-label={panel.accessibleLabel}
		>
			<div className="dashboard-chart-canvas">
				<ResponsiveContainer width="100%" height="100%">
					<Chart
						data={rows}
						accessibilityLayer
						syncId={`${dashboardId}:${panel.id}`}
					>
						{!isSparkline && config.showGrid ? (
							<CartesianGrid strokeDasharray="3 3" />
						) : null}
						{!isSparkline ? (
							<XAxis
								dataKey="domain"
								tickFormatter={(value) =>
									formatCartesianTimeTick(
										Number(value),
										model.rows.map((row) => row.domain),
										timezone,
										locale,
									)
								}
							/>
						) : null}
						{!isSparkline && config.valueAxis.show ? (
							<YAxis
								scale={config.valueAxis.scale}
								domain={resolveCartesianDomain(config.valueAxis, isPercent)}
								tickFormatter={(value) =>
									isPercent
										? `${Number(value).toLocaleString(locale, { maximumFractionDigits: 2 })}%`
										: primarySeries
											? formatCartesianValue(
													value,
													primarySeries.fieldConfig,
													locale,
													timezone,
													"number",
												)
											: String(value)
								}
							/>
						) : null}
						{!isSparkline ? (
							<Tooltip
								isAnimationActive={false}
								filterNull={false}
								content={(props) => (
									<CartesianTooltip
										{...props}
										formatDomain={(value) =>
											formatCartesianDomain(Number(value), timezone, locale)
										}
										formatRow={(entry) => {
											if (preset === "range-band") {
												if (entry.dataKey !== "width" || !lowerKey || !upperKey)
													return null;
												const lowerSeries = model.series.find(
													(series) => series.key === lowerKey,
												);
												const upperSeries = model.series.find(
													(series) => series.key === upperKey,
												);
												if (!lowerSeries || !upperSeries) return null;
												const lower = entry.payload?.lower ?? null;
												const upper = entry.payload?.upper ?? null;
												return {
													key: rangeLegendKey,
													label: `${lowerSeries.label} – ${upperSeries.label}`,
													value: `${formatCartesianValue(lower, lowerSeries.fieldConfig, locale, timezone, "number")} – ${formatCartesianValue(upper, upperSeries.fieldConfig, locale, timezone, "number")}`,
													color: rangeColor,
												};
											}
											const series = findCartesianSeriesForDataKey(
												model,
												entry.dataKey,
											);
											if (!series) return null;
											const index = model.series.indexOf(series);
											const formatted = formatCartesianTooltipValue(
												isPercent
													? entry.payload?.values?.[series.key]
													: entry.value,
												series,
												locale,
												timezone,
											);
											const rawRow = model.rows.find(
												(row) =>
													String(row.domain) === String(entry.payload?.domain),
											);
											return {
												key: series.key,
												label: series.label,
												value: isPercent
													? `${Number(entry.value ?? 0).toLocaleString(locale, { maximumFractionDigits: 2 })}%`
													: formatted.value,
												detail: isPercent
													? `raw ${formatCartesianTooltipValue(rawRow?.values[series.key] ?? null, series, locale, timezone).value}`
													: formatted.detail,
												color: resolveCartesianSeriesColor(
													series,
													index,
													theme,
												),
											};
										}}
									/>
								)}
							/>
						) : null}
						{!isSparkline
							? config.referenceLines.map((line) => (
									<ReferenceLine
										key={`${line.value}:${line.label ?? ""}`}
										y={line.value}
										label={line.label}
										stroke={resolveThemeColor(line.colorToken)}
										strokeDasharray={referenceLineStrokeDash(line)}
									/>
								))
							: null}
						{preset === "range-band" && rangeVisible ? (
							<>
								<Area
									dataKey="lower"
									stackId="range"
									stroke={rangeColor}
									fill="transparent"
									isAnimationActive={false}
								/>
								<Area
									dataKey="width"
									stackId="range"
									stroke={rangeColor}
									fill={rangeColor}
									fillOpacity={config.areaOpacity}
									isAnimationActive={false}
								/>
							</>
						) : (
							visible.map((item) => {
								const index = model.series.indexOf(item);
								const color = resolveCartesianSeriesColor(item, index, theme);
								return isArea ? (
									<Area
										key={item.key}
										dataKey={`values.${item.key}`}
										name={item.label}
										type={curveFor(preset)}
										stackId={preset.includes("stacked") ? "stack" : undefined}
										stroke={color}
										fill={color}
										fillOpacity={config.areaOpacity}
										connectNulls={config.connectNulls}
										dot={config.showPoints === "always"}
										isAnimationActive={false}
									/>
								) : (
									<Line
										key={item.key}
										dataKey={`values.${item.key}`}
										name={item.label}
										type={curveFor(preset)}
										stroke={color}
										strokeWidth={config.lineWidth}
										dot={
											config.showPoints === "always" ||
											(config.showPoints === "auto" && model.rows.length <= 20)
										}
										connectNulls={config.connectNulls}
										isAnimationActive={false}
									/>
								);
							})
						)}
					</Chart>
				</ResponsiveContainer>
				{annotationLayers?.length ? (
					<PlotOverlay
						layers={annotationLayers}
						viewport={{
							xDomain: [
								Number(model.rows[0]?.domain ?? 0),
								Number(model.rows.at(-1)?.domain ?? 1),
							],
							plotRect: { x: 9, y: 4, width: 88, height: 82 },
							canvasSize: { width: 100, height: 100 },
						}}
					/>
				) : null}
			</div>
			{!isSparkline && config.showLegend ? (
				<CartesianLegend
					series={legendSeries}
					hidden={legendHidden}
					onToggle={toggleLegendSeries}
					onIsolate={isolateLegendSeries}
					onReset={interaction.resetFields}
				/>
			) : null}
			{isSparkline && config.sparklineShowLastValue ? (
				<output className="dashboard-chart-last-value">
					{model.series[0]
						? formatCartesianValue(
								model.series[0].values.at(-1),
								model.series[0].fieldConfig,
								locale,
								timezone,
								"number",
							)
						: "N/A"}
				</output>
			) : null}
		</figure>
	);
}

export function buildAccessibleSummary({
	panel,
	frames,
	preset,
	config,
	locale,
	timezone,
}: DashboardRendererContext<TimeseriesConfigV2>) {
	const model = buildCartesianModel(frames, "time", {
		resolveFieldConfig: (frame, field) =>
			resolveFieldConfig(panel, frame, field),
	});
	const rangeBand =
		preset === "range-band" && config.rangeBand
			? {
					lowerKey: resolveCartesianSeriesKey(
						model,
						config.rangeBand.lowerFieldKey,
					),
					upperKey: resolveCartesianSeriesKey(
						model,
						config.rangeBand.upperFieldKey,
					),
				}
			: undefined;
	return `${panel.accessibleLabel}: ${summarizeCartesian(model, preset, locale, timezone, { rangeBand })}`;
}
