import type { SunburstConfigV1 } from "@shared/schemas/dashboard/hierarchy-flow-visualizations.schema";
import { ResponsiveContainer, SunburstChart } from "recharts";
import type { DashboardRendererContext } from "../../runtime/visualization-types";
import { resolveThemeColor } from "../../runtime/theme";
import { stableToken } from "../composition/category-model";
import {
	buildHierarchyModel,
	type HierarchyNodeModel,
} from "../hierarchy/hierarchy-model";
type SunburstNode = {
	name: string;
	value: number;
	fill: string;
	children?: SunburstNode[];
};
const sunburstData = (
	node: HierarchyNodeModel,
	config: SunburstConfigV1,
	palette: readonly string[],
	topLevelId = node.id,
): SunburstNode => ({
	name: node.label,
	value: node.value,
	fill: resolveThemeColor(
		stableToken(
			config.colorBy === "depth" ? `depth:${node.depth}` : topLevelId,
			palette,
		),
	),
	...(node.children.length
		? {
				children: node.children.map((child) =>
					sunburstData(
						child,
						config,
						palette,
						node.depth === 0 ? child.id : topLevelId,
					),
				),
			}
		: {}),
});
export function Renderer({
	frames,
	config,
	theme,
	panel,
}: DashboardRendererContext<SunburstConfigV1>) {
	const model = buildHierarchyModel(frames[0] as never, theme.palette);
	return (
		<figure
			className="dashboard-chart dashboard-chart-sunburst"
			aria-label={panel.accessibleLabel}
		>
			<div className="dashboard-chart-canvas">
				<ResponsiveContainer width="100%" height="100%">
					<SunburstChart
						data={sunburstData(model.syntheticRoot, config, theme.palette)}
						dataKey="value"
						nameKey="name"
						innerRadius={config.innerRadius}
						ringPadding={config.ringPadding}
						padding={config.sectorPadding}
						responsive
						stroke="var(--color-surface)"
						textOptions={{
							fontSize: 11,
							fill: "var(--color-surface)",
							stroke: "rgba(0, 0, 0, 0.35)",
							strokeWidth: 2,
							opacity: config.showLabels === "never" ? 0 : 1,
						}}
					/>
				</ResponsiveContainer>
			</div>
		</figure>
	);
}
export function buildAccessibleSummary({
	frames,
	theme,
	panel,
}: DashboardRendererContext<SunburstConfigV1>) {
	try {
		const model = buildHierarchyModel(frames[0] as never, theme.palette);
		return `${panel.accessibleLabel}: ${model.nodeCount} nodes, ${model.leafCount} leaves, depth ${model.maxDepth}`.slice(
			0,
			600,
		);
	} catch {
		return `${panel.accessibleLabel}: no valid hierarchy data`;
	}
}
