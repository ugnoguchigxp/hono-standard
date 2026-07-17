import type { BarConfigV2 } from "@shared/schemas/dashboard/cartesian-visualizations.schema";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	LabelList,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
	type LabelProps,
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
import {
	buildCartesianModel,
	buildWaterfallRows,
	normalizePercentRows,
	resolveCartesianSeriesKey,
} from "../cartesian/model";
import { referenceLineStrokeDash } from "../cartesian/reference-lines";
import { summarizeCartesian } from "../cartesian/summary";
import { CartesianTooltip } from "../cartesian/tooltip";
import { PlotOverlay } from "../../panel/plot-overlay";

function truncateCategory(value: unknown) {
	const text = String(value);
	return text.length > 18 ? `${text.slice(0, 17)}…` : text;
}

function LollipopDot({
	viewBox,
	value,
	color,
	size,
}: LabelProps & { color: string; size: number }) {
	if (!viewBox || !("x" in viewBox) || !("y" in viewBox)) return null;
	const numeric = Number(value);
	if (!Number.isFinite(numeric)) return null;
	const cx = viewBox.x + viewBox.width / 2;
	const cy = numeric >= 0 ? viewBox.y : viewBox.y + viewBox.height;
	return <circle cx={cx} cy={cy} r={size / 2} fill={color} />;
}

const waterfallColor = (state: string) =>
	resolveThemeColor(
		state === "positive"
			? "--color-chart-success"
			: state === "negative"
				? "--color-chart-danger"
				: state === "total"
					? "--color-chart-primary-strong"
					: "--color-chart-muted",
	);

export function Renderer({
	frames,
	panel,
	config,
	preset,
	theme,
	interaction,
	timezone,
	locale,
	annotationLayers,
}: DashboardRendererContext<BarConfigV2>) {
	const model = buildCartesianModel(
		frames,
		preset.includes("time") ? "time" : "category",
		{
			resolveFieldConfig: (frame, field) =>
				resolveFieldConfig(panel, frame, field),
		},
	);
	const visible = model.series.filter(
		(item) => !interaction.hiddenFieldKeys.has(item.key),
	);
	const isHorizontal = preset === "horizontal";
	const isPercent = preset === "percent-stacked";
	const isWaterfall = preset === "waterfall";
	const isLollipop = preset === "lollipop";
	const requestedWaterfallKey =
		config.waterfall.valueFieldKey ?? model.series[0]?.key;
	const waterfallKey =
		isWaterfall && requestedWaterfallKey
			? resolveCartesianSeriesKey(model, requestedWaterfallKey)
			: undefined;
	const waterfallSeries = waterfallKey
		? model.series.find((series) => series.key === waterfallKey)
		: undefined;
	const waterfall =
		isWaterfall && waterfallKey
			? buildWaterfallRows(
					model,
					waterfallKey,
					config.waterfall.showTotal,
					config.waterfall.totalLabel,
				)
			: [];
	const rows = isWaterfall
		? waterfall
		: isPercent
			? normalizePercentRows(
					model,
					visible.map((series) => series.key),
				)
			: model.rows;
	const primarySeries = visible[0] ?? model.series[0];
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
			: truncateCategory(value);
	const formatValueTick = (value: unknown) =>
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
				: String(value);
	return (
		<figure
			className={`dashboard-chart dashboard-chart-${preset}`}
			aria-label={panel.accessibleLabel}
		>
			<div className="dashboard-chart-canvas">
				<ResponsiveContainer width="100%" height="100%">
					<BarChart
						data={rows}
						layout={isHorizontal ? "vertical" : "horizontal"}
						barGap={config.barGap}
						barCategoryGap={config.categoryGap}
						accessibilityLayer
					>
						{config.showGrid ? <CartesianGrid strokeDasharray="3 3" /> : null}
						{isHorizontal ? (
							<>
								<XAxis
									type="number"
									scale={config.valueAxis.scale}
									domain={resolveCartesianDomain(config.valueAxis)}
									hide={!config.valueAxis.show}
									tickFormatter={formatValueTick}
								/>
								<YAxis
									type="category"
									dataKey="domain"
									width={120}
									tickFormatter={truncateCategory}
								/>
							</>
						) : (
							<>
								<XAxis
									dataKey="domain"
									angle={config.categoryLabelAngle}
									textAnchor={config.categoryLabelAngle ? "end" : "middle"}
									tickFormatter={formatDomainTick}
								/>
								<YAxis
									scale={config.valueAxis.scale}
									domain={resolveCartesianDomain(config.valueAxis, isPercent)}
									hide={!config.valueAxis.show}
									tickFormatter={formatValueTick}
								/>
							</>
						)}
						<Tooltip
							isAnimationActive={false}
							filterNull={false}
							content={(props) => (
								<CartesianTooltip
									{...props}
									formatDomain={formatDomain}
									formatRow={(entry) => {
										if (isWaterfall) {
											if (entry.dataKey !== "range" || !waterfallSeries)
												return null;
											const row = entry.payload;
											const delta = row?.synthetic ? row.end : row?.delta;
											return {
												key: waterfallSeries.key,
												label: row?.synthetic
													? config.waterfall.totalLabel
													: waterfallSeries.label,
												value: formatCartesianValue(
													delta ?? null,
													waterfallSeries.fieldConfig,
													locale,
													timezone,
													"number",
												),
												detail: `cumulative ${formatCartesianValue(row?.end ?? null, waterfallSeries.fieldConfig, locale, timezone, "number")}`,
												color: waterfallColor(row?.state ?? "zero"),
											};
										}
										const series = findCartesianSeriesForDataKey(
											model,
											entry.dataKey,
										);
										if (!series) return null;
										const index = model.series.indexOf(series);
										const formatted = formatCartesianTooltipValue(
											entry.value,
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
											color: resolveCartesianSeriesColor(series, index, theme),
										};
									}}
								/>
							)}
						/>
						{config.referenceLines.map((line) => (
							<ReferenceLine
								key={`${line.value}:${line.label ?? ""}`}
								{...(isHorizontal ? { x: line.value } : { y: line.value })}
								label={line.label}
								stroke={resolveThemeColor(line.colorToken)}
								strokeDasharray={referenceLineStrokeDash(line)}
							/>
						))}
						{isWaterfall
							? waterfall.slice(1, model.rows.length).map((row, index) => {
									const previous = waterfall[index];
									return previous ? (
										<ReferenceLine
											key={`connector:${String(previous.domain)}:${String(row.domain)}`}
											segment={[
												{ x: previous.domain, y: previous.end },
												{ x: row.domain, y: row.start },
											]}
											stroke={resolveThemeColor("--color-chart-muted")}
											strokeDasharray="3 3"
										/>
									) : null;
								})
							: null}
						{isWaterfall ? (
							waterfallSeries &&
							!interaction.hiddenFieldKeys.has(waterfallSeries.key) ? (
								<Bar
									dataKey="range"
									name={waterfallSeries.label}
									isAnimationActive={false}
								>
									{waterfall.map((row) => (
										<Cell
											key={
												row.synthetic ? "synthetic-total" : String(row.domain)
											}
											fill={waterfallColor(row.state)}
										/>
									))}
								</Bar>
							) : null
						) : (
							visible.map((item) => {
								const index = model.series.indexOf(item);
								const color = resolveCartesianSeriesColor(item, index, theme);
								return (
									<Bar
										key={item.key}
										dataKey={`values.${item.key}`}
										name={item.label}
										stackId={
											preset.includes("stacked") || isPercent
												? "stack"
												: undefined
										}
										barSize={isLollipop ? 2 : undefined}
										fill={color}
										maxBarSize={
											config.maxBarSize === "auto"
												? undefined
												: config.maxBarSize
										}
										isAnimationActive={false}
									>
										{isLollipop ? (
											<LabelList
												dataKey={`values.${item.key}`}
												content={
													<LollipopDot
														color={color}
														size={config.lollipopDotSize}
													/>
												}
											/>
										) : null}
									</Bar>
								);
							})
						)}
					</BarChart>
				</ResponsiveContainer>
				{annotationLayers?.length && model.domainKind === "time" ? (
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
			{config.showLegend ? (
				<CartesianLegend
					series={model.series.map((item, index) => ({
						key: item.key,
						label: item.label,
						color: isWaterfall
							? resolveThemeColor("--color-chart-primary")
							: resolveCartesianSeriesColor(item, index, theme),
						detail:
							formatCartesianUnitLabel(item.fieldConfig.unit) || undefined,
					}))}
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
	preset,
	config,
	locale,
	timezone,
}: DashboardRendererContext<BarConfigV2>) {
	const model = buildCartesianModel(
		frames,
		preset.includes("time") ? "time" : "category",
		{
			resolveFieldConfig: (frame, field) =>
				resolveFieldConfig(panel, frame, field),
		},
	);
	const waterfall =
		preset === "waterfall" &&
		(config.waterfall.valueFieldKey ?? model.series[0]?.key)
			? {
					valueKey: resolveCartesianSeriesKey(
						model,
						config.waterfall.valueFieldKey ?? model.series[0]?.key ?? "",
					),
				}
			: undefined;
	return `${panel.accessibleLabel}: ${summarizeCartesian(model, preset, locale, timezone, { waterfall })}`;
}
