import { CircleSlash2 } from "lucide-react";
import type { z } from "zod";
import { resolveFieldConfig } from "../../runtime/field-config";
import type { DashboardRendererContext } from "../../runtime/visualization-types";
import { buildKpiListModel, buildKpiModel } from "../kpi/model";
import {
	KpiDelta,
	KpiStateBadge,
	KpiValueText,
	NativeSparkline,
} from "../kpi/primitives";
import { kpiSummary } from "../kpi/summary";
import type { statConfigSchema } from "./definition";

type Config = z.infer<typeof statConfigSchema>;

const hasNoUsableValues = (model: ReturnType<typeof buildKpiModel>) =>
	model.items.length > 0 &&
	model.items.every(
		(item) =>
			item.current === null ||
			item.current === undefined ||
			(typeof item.current === "number" && !Number.isFinite(item.current)),
	);

export function Renderer({
	frames,
	panel,
	preset,
	config: kpiConfig,
}: DashboardRendererContext<Partial<Config>>) {
	const field = frames[0]?.fields.find((item) => item.roles.includes("value"));
	const fieldConfig =
		frames[0] && field
			? resolveFieldConfig(panel, frames[0], field)
			: panel.visualization.fieldConfig;
	const options = { ...configFromPreset(kpiConfig), fieldConfig };
	const model =
		preset === "value-list"
			? buildKpiListModel(frames, {
					...options,
					maxItems: kpiConfig.list?.maxItems ?? 12,
				})
			: buildKpiModel(frames, options);
	if (!model.items.length)
		return (
			<div className="dashboard-kpi-empty">{model.error ?? "No data"}</div>
		);
	if (hasNoUsableValues(model))
		return (
			<div className="dashboard-kpi-no-value" role="status">
				<CircleSlash2 aria-hidden="true" />
				<strong>No current value</strong>
				<span>The latest sample did not include a usable reading.</span>
				<small>Unavailable</small>
			</div>
		);
	return (
		<div
			className={`dashboard-kpi dashboard-stat-value dashboard-kpi-${preset}`}
			role="img"
			aria-label={panel.accessibleLabel}
		>
			{model.items.map((item) => (
				<div className="dashboard-kpi-item" key={item.id}>
					<small>{item.label ?? panel.title}</small>
					<KpiValueText value={item.formatted.current ?? "—"} />
					{item.formatted.delta ? (
						<KpiDelta value={item.formatted.delta} sentiment={item.sentiment} />
					) : null}
					{item.sparkline && preset.includes("sparkline") ? (
						<NativeSparkline
							values={item.sparkline.map((point) => point.value)}
							label={`${item.label} trend`}
						/>
					) : null}
					<KpiStateBadge state={item.state} />
				</div>
			))}
		</div>
	);
}

export function buildAccessibleSummary({
	panel,
	frames,
	config,
	preset,
	timezone,
	locale,
}: DashboardRendererContext<Partial<Config>>) {
	const field = frames[0]?.fields.find((item) => item.roles.includes("value"));
	const fieldConfig =
		frames[0] && field
			? resolveFieldConfig(panel, frames[0], field)
			: panel.visualization.fieldConfig;
	const model =
		preset === "value-list"
			? buildKpiListModel(frames, {
					...configFromPreset(config),
					fieldConfig,
					locale,
					timezone,
					maxItems: config.list?.maxItems ?? 12,
				})
			: buildKpiModel(frames, {
					...configFromPreset(config),
					fieldConfig,
					locale,
					timezone,
				});
	if (hasNoUsableValues(model))
		return `${panel.accessibleLabel}: No current value; latest sample unavailable`;
	return kpiSummary(model, panel.accessibleLabel);
}

function configFromPreset(config: Partial<Config> = {}) {
	return {
		binding: {
			valueFieldKey: config.valueFieldKey,
			previousFieldKey: config.previousFieldKey,
			deltaFieldKey: config.deltaFieldKey,
			goalFieldKey: config.goalFieldKey,
		},
		delta: config.delta ?? {
			mode: "absolute",
			sentiment: "neutral",
			zeroTolerance: 0,
		},
		sparkline: config.sparkline ?? {
			maxPoints: 100,
			showFill: false,
			showMinMax: false,
		},
		list: config.list ?? { orientation: "auto", maxItems: 12 },
		maxPoints: config.sparkline?.maxPoints ?? 100,
	};
}
