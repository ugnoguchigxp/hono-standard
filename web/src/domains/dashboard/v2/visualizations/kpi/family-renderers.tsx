import type {
	DeltaConfig,
	KpiRangeConfig,
} from "@shared/schemas/dashboard/kpi-visualizations.schema";
import type { DashboardRendererContext } from "../../runtime/visualization-types";
import { buildKpiListModel, buildKpiModel, type KpiModel } from "./model";
import {
	GaugeArc,
	GaugeNeedle,
	KpiDelta,
	KpiStateBadge,
	KpiValueText,
	NativeSparkline,
	OverflowMarker,
	RangeTrack,
	SegmentTrack,
	TrafficSignal,
} from "./primitives";
import { buildProgressSteps, progressStepsSummary } from "./progress-steps";
import { kpiSummary } from "./summary";

type KpiRenderContext = Omit<DashboardRendererContext<unknown>, "config"> & {
	config: Record<string, unknown>;
};

function fieldConfig(context: KpiRenderContext) {
	const frame = context.frames[0];
	const field =
		frame?.fields.find((item) => item.roles.includes("value")) ??
		frame?.fields[0];
	return frame && field
		? { ...context.panel.visualization.fieldConfig, ...(field.config ?? {}) }
		: context.panel.visualization.fieldConfig;
}
function options(context: KpiRenderContext) {
	return {
		binding: context.config,
		fieldConfig: fieldConfig(context),
		locale: context.locale,
		timezone: context.timezone,
	};
}
function itemModel(context: KpiRenderContext): KpiModel {
	return buildKpiModel(context.frames, {
		...options(context),
		delta: context.config.delta as DeltaConfig,
		range: context.config.range as KpiRangeConfig,
	});
}
function listModel(context: KpiRenderContext, maxItems: number): KpiModel {
	return buildKpiListModel(context.frames, {
		...options(context),
		delta: context.config.delta as DeltaConfig,
		range: context.config.range as KpiRangeConfig,
		maxItems,
	});
}
function Empty({ model }: { model: KpiModel }) {
	return <div className="dashboard-kpi-empty">{model.error ?? "No data"}</div>;
}

export function GaugeView(context: KpiRenderContext) {
	const model = listModel(context, 6);
	if (!model.items.length) return <Empty model={model} />;
	return (
		<section
			className="dashboard-kpi dashboard-kpi-gauge"
			aria-label={context.panel.accessibleLabel}
		>
			{model.items.map((item) => (
				<div className="dashboard-kpi-item" key={item.id}>
					<small>{item.label}</small>
					{item.normalized === undefined ? null : context.preset ===
						"needle" ? (
						<GaugeNeedle
							normalized={item.normalized}
							startAngle={Number(context.config.startAngle ?? -225)}
							endAngle={Number(context.config.endAngle ?? 45)}
							label={`${item.label} needle`}
						/>
					) : (
						<GaugeArc
							normalized={item.normalized}
							startAngle={Number(
								context.config.startAngle ??
									(context.preset === "full-circle" ? -225 : -180),
							)}
							endAngle={Number(
								context.config.endAngle ??
									(context.preset === "full-circle" ? 45 : 0),
							)}
							label={`${item.label} gauge`}
						/>
					)}
					<KpiValueText
						value={item.formatted.current ?? "—"}
						label={item.label}
					/>
					<KpiStateBadge state={item.state} />
					<OverflowMarker overflow={item.overflow} />
				</div>
			))}
		</section>
	);
}
export function GaugeSummary(context: KpiRenderContext) {
	return kpiSummary(listModel(context, 6), context.panel.accessibleLabel);
}

export function BarGaugeView(context: KpiRenderContext) {
	const maxItems = context.preset === "vertical" ? 12 : 20;
	const model = listModel(context, maxItems);
	if (!model.items.length) return <Empty model={model} />;
	return (
		<section
			className={`dashboard-kpi dashboard-kpi-bar-gauge preset-${context.preset}`}
			aria-label={context.panel.accessibleLabel}
		>
			{model.items.map((item) => {
				const label = `${item.label}: ${item.formatted.current ?? "—"}`;
				return (
					<div className="dashboard-kpi-bar-item" key={item.id}>
						<span>{item.label}</span>
						{["segmented", "retro-lcd"].includes(context.preset) ? (
							<SegmentTrack
								normalized={item.normalized ?? 0}
								count={Number(context.config.segmentCount ?? 10)}
								label={label}
							/>
						) : (
							<RangeTrack normalized={item.normalized ?? 0} label={label} />
						)}
						<strong>{item.formatted.current ?? "—"}</strong>
						<OverflowMarker overflow={item.overflow} />
					</div>
				);
			})}
		</section>
	);
}
export function BarGaugeSummary(context: KpiRenderContext) {
	return kpiSummary(listModel(context, 20), context.panel.accessibleLabel);
}

export function BulletView(context: KpiRenderContext) {
	const model = listModel(context, 20);
	if (!model.items.length) return <Empty model={model} />;
	return (
		<section
			className={`dashboard-kpi dashboard-kpi-bullet preset-${context.preset}`}
			aria-label={context.panel.accessibleLabel}
		>
			{model.items.map((item) => (
				<div className="dashboard-kpi-bullet-item" key={item.id}>
					<span>{item.label}</span>
					<RangeTrack
						normalized={item.normalized ?? 0}
						goal={
							item.goal != null &&
							item.max !== undefined &&
							item.min !== undefined
								? (item.goal - item.min) / (item.max - item.min)
								: undefined
						}
						label={`${item.label}: ${item.formatted.current ?? "—"}`}
					/>
					<strong>{item.formatted.current ?? "—"}</strong>
					<span>goal {item.formatted.goal ?? "—"}</span>
				</div>
			))}
		</section>
	);
}
export function BulletSummary(context: KpiRenderContext) {
	return kpiSummary(listModel(context, 20), context.panel.accessibleLabel);
}

export function ProgressView(context: KpiRenderContext) {
	if (context.preset === "steps") {
		const steps = buildProgressSteps(context.frames[0], {
			currentStepFieldKey: context.config.currentStepFieldKey as
				| string
				| undefined,
			completedStateValues: context.config.completedStateValues as
				| string[]
				| undefined,
		});
		if (steps.error || !steps.steps.length)
			return <Empty model={{ items: [], error: steps.error }} />;
		return (
			<section
				className="dashboard-kpi dashboard-kpi-progress preset-steps"
				aria-label={context.panel.accessibleLabel}
			>
				<ol className="dashboard-kpi-steps">
					{steps.steps.map((step) => (
						<li
							className="dashboard-kpi-step"
							data-phase={step.phase}
							key={step.id}
						>
							<span>{step.label}</span>
							<small>{step.phase}</small>
						</li>
					))}
				</ol>
			</section>
		);
	}
	const model = itemModel(context);
	const item = model.items[0];
	if (!item) return <Empty model={model} />;
	const percentage =
		item.normalized === undefined
			? undefined
			: Math.round(Math.max(0, Math.min(1, item.normalized)) * 100);
	return (
		<section
			className={`dashboard-kpi dashboard-kpi-progress preset-${context.preset}`}
			aria-label={context.panel.accessibleLabel}
		>
			<RangeTrack
				normalized={item.normalized ?? 0}
				label={`${item.label}: ${percentage ?? "—"}%`}
			/>
			{context.preset === "segmented" ? (
				<SegmentTrack
					normalized={item.normalized ?? 0}
					count={Number(context.config.segmentCount ?? 10)}
					label={`${percentage ?? "—"}% complete`}
				/>
			) : null}
			<KpiValueText value={item.formatted.current ?? "—"} />
			<span>
				{percentage === undefined ? "unknown" : `${percentage}% complete`}
			</span>
			<OverflowMarker overflow={item.overflow} />
		</section>
	);
}
export function ProgressSummary(context: KpiRenderContext) {
	if (context.preset === "steps")
		return progressStepsSummary(
			buildProgressSteps(context.frames[0], {
				currentStepFieldKey: context.config.currentStepFieldKey as
					| string
					| undefined,
				completedStateValues: context.config.completedStateValues as
					| string[]
					| undefined,
			}),
			context.panel.accessibleLabel,
		);
	return kpiSummary(itemModel(context), context.panel.accessibleLabel);
}

export function TrafficView(context: KpiRenderContext) {
	const model = listModel(context, context.preset === "matrix" ? 20 : 30);
	if (!model.items.length) return <Empty model={model} />;
	return (
		<section
			className={`dashboard-kpi dashboard-kpi-traffic preset-${context.preset}`}
			aria-label={context.panel.accessibleLabel}
		>
			{model.items
				.slice(0, context.preset === "single" ? 1 : model.items.length)
				.map((item) => (
					<TrafficSignal key={item.id} state={item.state} label={item.label}>
						{item.label}: {item.formatted.current ?? "—"} · {item.state}
					</TrafficSignal>
				))}
		</section>
	);
}
export function TrafficSummary(context: KpiRenderContext) {
	return kpiSummary(
		listModel(context, context.preset === "matrix" ? 20 : 30),
		context.panel.accessibleLabel,
	);
}

export function StatLikeView(
	context: DashboardRendererContext<Record<string, unknown>>,
) {
	const model = itemModel(context);
	const item = model.items[0];
	if (!item) return <Empty model={model} />;
	return (
		<section
			className="dashboard-kpi dashboard-kpi-stat"
			aria-label={context.panel.accessibleLabel}
		>
			<KpiValueText value={item.formatted.current ?? "—"} />
			<KpiStateBadge state={item.state} />
			{item.formatted.delta ? (
				<KpiDelta value={item.formatted.delta} sentiment={item.sentiment} />
			) : null}
			{item.sparkline ? (
				<NativeSparkline
					values={item.sparkline.map((point) => point.value)}
					label={`${item.label} trend`}
				/>
			) : null}
		</section>
	);
}
