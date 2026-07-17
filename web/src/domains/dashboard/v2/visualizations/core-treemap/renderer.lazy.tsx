import type { TreemapConfigV1 } from "@shared/schemas/dashboard/hierarchy-flow-visualizations.schema";
import {
	ResponsiveContainer,
	Tooltip,
	Treemap,
	type TreemapNode,
} from "recharts";
import type { DashboardRendererContext } from "../../runtime/visualization-types";
import { resolveThemeColor } from "../../runtime/theme";
import {
	buildCategoryCompositionModel,
	stableToken,
} from "../composition/category-model";
import {
	buildHierarchyModel,
	type HierarchyNodeModel,
} from "../hierarchy/hierarchy-model";
const treeData = (
	node: HierarchyNodeModel,
	config: TreemapConfigV1,
	palette: readonly string[],
	topLevelId = node.id,
): Record<string, unknown> => {
	const token =
		config.colorBy === "item"
			? stableToken(node.id, palette)
			: config.colorBy === "depth"
				? stableToken(`depth:${node.depth}`, palette)
				: stableToken(topLevelId, palette);
	return {
		name: node.label,
		value: node.value,
		id: node.id,
		fill: resolveThemeColor(token),
		children: node.children.map((child) =>
			treeData(
				child,
				config,
				palette,
				node.depth === 0 ? child.id : topLevelId,
			),
		),
	};
};

function TreemapCell({
	node,
	config,
}: {
	node: TreemapNode;
	config: TreemapConfigV1;
}) {
	const showLabel =
		config.showLabels !== "never" &&
		node.depth <= config.maxLabelDepth &&
		(config.showLabels === "always" || node.width * node.height >= 2_400);
	const label =
		config.labelContent === "category"
			? node.name
			: config.labelContent === "value"
				? String(node.value)
				: `${node.name} ${node.value}`;
	return (
		<g>
			<rect
				x={node.x}
				y={node.y}
				width={Math.max(0, node.width)}
				height={Math.max(0, node.height)}
				fill={typeof node.fill === "string" ? node.fill : "var(--color-brand)"}
				stroke="var(--color-surface)"
				strokeWidth={2}
			/>
			{showLabel ? (
				<text
					x={node.x + 6}
					y={node.y + 16}
					fill="var(--color-surface)"
					fontSize={11}
					fontWeight={700}
					paintOrder="stroke"
					stroke="rgba(0, 0, 0, 0.35)"
					strokeWidth={2}
				>
					{label}
				</text>
			) : null}
		</g>
	);
}
export function Renderer({
	frames,
	config,
	theme,
	panel,
	preset,
}: DashboardRendererContext<TreemapConfigV1>) {
	const frame = frames[0] as never;
	const data =
		preset === "flat"
			? buildCategoryCompositionModel(frame, theme.palette).slices.map(
					(slice) => ({
						name: slice.label,
						value: slice.value,
						fill: resolveThemeColor(
							config.colorBy === "depth"
								? stableToken("depth:0", theme.palette)
								: slice.colorToken,
						),
					}),
				)
			: buildHierarchyModel(frame, theme.palette).roots.map((root) =>
					treeData(root, config, theme.palette),
				);
	return (
		<figure
			className={`dashboard-chart dashboard-chart-${preset}`}
			aria-label={panel.accessibleLabel}
		>
			<div className="dashboard-chart-canvas">
				<ResponsiveContainer width="100%" height="100%">
					<Treemap
						data={data}
						dataKey="value"
						stroke="var(--color-surface)"
						fill="var(--color-brand)"
						aspectRatio={4 / 3}
						nodeGap={config.padding}
						nodeInset={config.padding}
						content={(node) => <TreemapCell node={node} config={config} />}
						isAnimationActive={false}
					>
						<Tooltip isAnimationActive={false} />
					</Treemap>
				</ResponsiveContainer>
			</div>
			<p className="dashboard-chart-summary">
				{config.showLabels === "never"
					? "Labels available in table fallback."
					: "Hierarchy composition"}
			</p>
		</figure>
	);
}
export function buildAccessibleSummary({
	frames,
	panel,
	theme,
	preset,
}: DashboardRendererContext<TreemapConfigV1>) {
	try {
		if (preset === "flat") {
			const model = buildCategoryCompositionModel(
				frames[0] as never,
				theme.palette,
			);
			return `${panel.accessibleLabel}: ${model.slices.length} categories, total ${model.total}`.slice(
				0,
				600,
			);
		}
		const model = buildHierarchyModel(frames[0] as never, theme.palette);
		return `${panel.accessibleLabel}: ${model.leafCount} leaves across ${model.maxDepth + 1} levels`.slice(
			0,
			600,
		);
	} catch {
		return `${panel.accessibleLabel}: no valid hierarchy data`;
	}
}
