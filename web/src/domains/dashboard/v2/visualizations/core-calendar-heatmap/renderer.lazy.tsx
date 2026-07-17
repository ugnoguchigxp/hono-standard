import type { CalendarHeatmapConfigV1 } from "@shared/schemas/dashboard/distribution-visualizations.schema";
import { resolveThemeColor } from "../../runtime/theme";
import type { DashboardRendererContext } from "../../runtime/visualization-types";
import { buildCalendarModel } from "../distribution/calendar";
import {
	colorScaleToken,
	resolveColorScale,
} from "../distribution/color-scale";
import {
	ColorScaleLegend,
	StatusScaleLegend,
	SummaryFigure,
} from "../distribution/primitives";
import { calendarSummary } from "../distribution/summary";

export function Renderer({
	frames,
	config,
	panel,
	timezone,
	locale,
	theme,
}: DashboardRendererContext<CalendarHeatmapConfigV1>) {
	const frame = frames[0];
	if (!frame)
		return (
			<div className="dashboard-panel-error">Calendar data is unavailable</div>
		);
	const cells = buildCalendarModel(frame, config, timezone);
	const scale = resolveColorScale(
		config.colorScale,
		cells.map((cell) => cell.value),
	);
	const columns = Math.max(...cells.map((cell) => cell.weekIndex), 0) + 1;
	const weekdayFormatter = new Intl.DateTimeFormat(locale, {
		weekday: "narrow",
		timeZone: "UTC",
	});
	const sunday = Date.UTC(2024, 0, 7);
	const weekdayOffsets =
		config.weekStartsOn === "monday"
			? [1, 2, 3, 4, 5, 6, 0]
			: [0, 1, 2, 3, 4, 5, 6];
	const weekdays = weekdayOffsets.map((offset) =>
		weekdayFormatter.format(sunday + offset * 86_400_000),
	);
	const monthLabels = cells.filter((cell) => cell.dateKey.endsWith("-01"));
	const dateFormatter = new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeZone: timezone,
	});
	return (
		<SummaryFigure label={panel.accessibleLabel} theme={theme}>
			<div className="dashboard-calendar-scroll">
				<svg
					className="dashboard-calendar-svg"
					viewBox={`0 0 ${columns * 18 + 28} 180`}
					role="img"
					aria-hidden="true"
				>
					<g transform="translate(24,8)">
						{config.showWeekdayLabels
							? weekdays.map((label, index) => (
									<text
										key={label}
										x="-4"
										y={index * 18 + 11}
										fontSize="8"
										textAnchor="end"
									>
										{label}
									</text>
								))
							: null}
						{config.showMonthLabels
							? monthLabels.map((cell) => (
									<text
										key={`month:${cell.dateKey}`}
										x={cell.weekIndex * 18}
										y="144"
										fontSize="8"
									>
										{new Intl.DateTimeFormat(locale, {
											month: "short",
											timeZone: "UTC",
										}).format(Date.parse(`${cell.dateKey}T12:00:00Z`))}
									</text>
								))
							: null}
						{cells.map((cell) => (
							<g
								key={cell.dateKey}
								transform={`translate(${cell.weekIndex * 18},${cell.weekdayIndex * 18})`}
							>
								<rect
									width="15"
									height="15"
									fill={resolveThemeColor(
										colorScaleToken(scale, cell.value, cell.state),
									)}
									opacity={cell.inRange ? 1 : 0.35}
								>
									<title>{`${dateFormatter.format(cell.startUtc)}: ${cell.value ?? cell.state ?? "missing"}`}</title>
								</rect>
								{config.showCellValues && cell.value !== null ? (
									<text
										x="7"
										y="12"
										fontSize="6"
										textAnchor="middle"
										fill="var(--color-surface)"
									>
										{cell.value}
									</text>
								) : null}
							</g>
						))}
					</g>
				</svg>
			</div>
			{config.colorScale.mode === "status" ? (
				<StatusScaleLegend />
			) : (
				<ColorScaleLegend scale={scale} locale={locale} />
			)}
			<p className="dashboard-panel-summary">{calendarSummary(cells)}</p>
		</SummaryFigure>
	);
}
export function buildAccessibleSummary({
	frames,
	config,
	panel,
	timezone,
}: DashboardRendererContext<CalendarHeatmapConfigV1>) {
	const frame = frames[0];
	return `${panel.accessibleLabel}: ${frame ? calendarSummary(buildCalendarModel(frame, config, timezone)) : "Calendar data is unavailable"}`.slice(
		0,
		1000,
	);
}
