import type { FunnelConfigV1 } from "@shared/schemas/dashboard/composition-visualizations.schema";
import {
	Funnel,
	FunnelChart,
	LabelList,
	type LabelProps,
	Legend,
	ResponsiveContainer,
	Tooltip,
} from "recharts";
import { resolveThemeColor } from "../../runtime/theme";
import type { DashboardRendererContext } from "../../runtime/visualization-types";
import { buildCategoryCompositionModel } from "../composition/category-model";

function FunnelStageLabel({ value, viewBox, parentViewBox }: LabelProps) {
	const box = viewBox as { y?: number; height?: number } | undefined;
	const parent = parentViewBox as { x?: number; width?: number } | undefined;
	if (
		typeof box?.y !== "number" ||
		typeof box.height !== "number" ||
		typeof parent?.x !== "number" ||
		typeof parent.width !== "number"
	)
		return null;
	return (
		<text
			x={parent.x + parent.width + 10}
			y={box.y + box.height / 2}
			dominantBaseline="middle"
			fill="currentColor"
			fontSize={11}
		>
			{String(value ?? "")}
		</text>
	);
}

export function Renderer({
	frames,
	config,
	preset,
	theme,
	panel,
	interaction,
}: DashboardRendererContext<FunnelConfigV1>) {
	const model = buildCategoryCompositionModel(
		frames[0] as never,
		theme.palette,
	);
	const first = model.slices[0]?.value ?? 1;
	const data = model.slices.map((slice, index) => {
		const percentFirst = (slice.value / first) * 100;
		const percentPrevious =
			index === 0
				? 100
				: (slice.value / (model.slices[index - 1]?.value || 1)) * 100;
		const displayLabel =
			config.labelContent === "value"
				? `${slice.label}: ${slice.value}`
				: config.labelContent === "percent-first"
					? `${slice.label}: ${percentFirst.toFixed(1)}%`
					: config.labelContent === "percent-previous"
						? `${slice.label}: ${percentPrevious.toFixed(1)}%`
						: `${slice.label}: ${slice.value} (${percentFirst.toFixed(1)}%)`;
		return {
			...slice,
			fill: resolveThemeColor(slice.colorToken),
			percentFirst,
			percentPrevious,
			displayLabel,
		};
	});
	return (
		<figure
			className={`dashboard-chart dashboard-chart-${preset}`}
			aria-label={panel.accessibleLabel}
		>
			<div className="dashboard-chart-canvas">
				<ResponsiveContainer width="100%" height="100%">
					<FunnelChart
						margin={{
							top: 8,
							right: config.showLabels ? 180 : 8,
							bottom: 8,
							left: 8,
						}}
					>
						<Tooltip
							isAnimationActive={false}
							formatter={(value, _name, item) => [
								String(value),
								`${item?.payload?.label ?? "Stage"} (${Number(item?.payload?.percentFirst ?? 0).toFixed(1)}% of first)`,
							]}
						/>
						<Funnel
							dataKey="value"
							nameKey="label"
							data={data}
							isAnimationActive={false}
							reversed={preset === "pyramid"}
							lastShapeType={config.lastShape}
							onClick={(_item, index) => {
								const slice = data[index];
								if (slice) interaction.onDatumActivate(slice.raw);
							}}
						>
							{config.showLabels ? (
								<LabelList dataKey="displayLabel" content={FunnelStageLabel} />
							) : null}
						</Funnel>
						{config.showLegend ? <Legend /> : null}
					</FunnelChart>
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
}: DashboardRendererContext<FunnelConfigV1>) {
	try {
		const model = buildCategoryCompositionModel(
			frames[0] as never,
			theme.palette,
		);
		const first = model.slices[0]?.value ?? 0;
		const last = model.slices.at(-1)?.value ?? 0;
		return `${panel.accessibleLabel}: ${model.slices.length} stages, conversion ${first > 0 ? ((last / first) * 100).toFixed(1) : 0}%${config.enforceMonotonic ? ", monotonic enforced" : ""}`.slice(
			0,
			600,
		);
	} catch {
		return `${panel.accessibleLabel}: no valid funnel data`;
	}
}
