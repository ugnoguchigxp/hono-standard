import type { RadarConfigV1 } from "@shared/schemas/dashboard/composition-visualizations.schema";
import {
	Legend,
	PolarAngleAxis,
	PolarGrid,
	PolarRadiusAxis,
	Radar,
	RadarChart,
	ResponsiveContainer,
	Tooltip,
} from "recharts";
import { resolveThemeColor } from "../../runtime/theme";
import type { DashboardRendererContext } from "../../runtime/visualization-types";

export function Renderer({
	frames,
	config,
	preset,
	theme,
	panel,
}: DashboardRendererContext<RadarConfigV1>) {
	const frame = frames[0];
	const category = frame?.fields.find((field) =>
		field.roles.includes("category"),
	);
	const values =
		frame?.fields.filter(
			(field) => field.type === "number" && field.roles.includes("value"),
		) ?? [];
	const data = (category?.values ?? []).map((label, index) =>
		Object.fromEntries([
			["category", label ?? "No value"],
			...values.map((field) => [
				field.key,
				typeof field.values[index] === "number" ? field.values[index] : 0,
			]),
		]),
	) as Array<Record<string, string | number>>;
	const max =
		config.scaleMode === "percent"
			? 100
			: config.max === "auto"
				? Math.max(
						1,
						...values.flatMap((field) =>
							field.values.filter(
								(value): value is number => typeof value === "number",
							),
						),
					)
				: config.max;
	return (
		<figure
			className={`dashboard-chart dashboard-chart-${preset}`}
			aria-label={panel.accessibleLabel}
		>
			<div className="dashboard-chart-canvas">
				<ResponsiveContainer width="100%" height="100%">
					<RadarChart
						data={data}
						cy="42%"
						outerRadius="58%"
						margin={{ top: 8, right: 28, bottom: 8, left: 28 }}
					>
						{config.showGrid ? <PolarGrid /> : null}
						<PolarAngleAxis dataKey="category" hide={!config.showAxisLabels} />
						<PolarRadiusAxis domain={[0, max]} tick={false} axisLine={false} />
						{values.map((field, index) => (
							<Radar
								key={field.key}
								name={field.label}
								dataKey={field.key}
								stroke={resolveThemeColor(
									theme.palette[index % Math.max(1, theme.palette.length)],
								)}
								fill={resolveThemeColor(
									theme.palette[index % Math.max(1, theme.palette.length)],
								)}
								fillOpacity={preset === "line" ? 0 : config.fillOpacity}
								dot={config.showDots}
								isAnimationActive={false}
							/>
						))}
						<Tooltip isAnimationActive={false} />
						{config.showLegend ? (
							<Legend
								height={28}
								iconSize={10}
								wrapperStyle={{ fontSize: 11 }}
							/>
						) : null}
					</RadarChart>
				</ResponsiveContainer>
			</div>
		</figure>
	);
}
export function buildAccessibleSummary({
	frames,
	panel,
	preset,
}: DashboardRendererContext<RadarConfigV1>) {
	const frame = frames[0];
	const axes =
		frame?.fields.find((field) => field.roles.includes("category"))?.values
			.length ?? 0;
	const series =
		frame?.fields.filter(
			(field) => field.type === "number" && field.roles.includes("value"),
		).length ?? 0;
	return `${panel.accessibleLabel}: ${preset}, ${axes} axes and ${series} series`.slice(
		0,
		600,
	);
}
