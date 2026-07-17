import type { SankeyConfigV1 } from "@shared/schemas/dashboard/hierarchy-flow-visualizations.schema";
import {
	ResponsiveContainer,
	Sankey,
	Tooltip,
	type SankeyLinkProps,
	type SankeyNodeProps,
} from "recharts";
import type { DashboardRendererContext } from "../../runtime/visualization-types";
import { resolveThemeColor } from "../../runtime/theme";
import { buildSankeyModel } from "../flow/sankey-model";

type SankeyNodePayload = {
	name?: string;
	colorToken?: string;
};

function SankeyNodeShape({
	props,
	showLabel,
}: {
	props: SankeyNodeProps;
	showLabel: boolean;
}) {
	const payload = props.payload as SankeyNodePayload;
	return (
		<g>
			<rect
				x={props.x}
				y={props.y}
				width={props.width}
				height={Math.max(1, props.height)}
				fill={resolveThemeColor(payload.colorToken)}
				rx={2}
			/>
			{showLabel ? (
				<text
					x={props.x + props.width + 6}
					y={props.y + Math.max(12, props.height / 2)}
					fill="var(--color-ink)"
					fontSize={11}
				>
					{payload.name ?? "Node"}
				</text>
			) : null}
		</g>
	);
}

function SankeyLinkShape({
	props,
	opacity,
}: {
	props: SankeyLinkProps;
	opacity: number;
}) {
	const source = props.payload.source as SankeyNodePayload;
	return (
		<path
			d={`M${props.sourceX},${props.sourceY} C${props.sourceControlX},${props.sourceY} ${props.targetControlX},${props.targetY} ${props.targetX},${props.targetY}`}
			fill="none"
			stroke={resolveThemeColor(source.colorToken)}
			strokeWidth={Math.max(1, props.linkWidth)}
			strokeOpacity={opacity}
		/>
	);
}
export function Renderer({
	frames,
	config,
	theme,
	panel,
}: DashboardRendererContext<SankeyConfigV1>) {
	const nodes = frames.find((frame) => frame.meta.shapeHint === "graph-nodes");
	const edges = frames.find((frame) => frame.meta.shapeHint === "graph-edges");
	if (!nodes || !edges) return null;
	const model = buildSankeyModel(nodes, edges, theme.palette);
	return (
		<figure
			className="dashboard-chart dashboard-chart-sankey"
			aria-label={panel.accessibleLabel}
		>
			<div className="dashboard-chart-canvas">
				<ResponsiveContainer width="100%" height="100%">
					<Sankey
						data={{ nodes: model.nodes, links: model.links }}
						nodeWidth={config.nodeWidth}
						nodePadding={config.nodePadding}
						iterations={config.iterations}
						align={config.align}
						verticalAlign={config.verticalAlign}
						sort={false}
						node={(props) => (
							<SankeyNodeShape
								props={props}
								showLabel={config.showNodeLabels}
							/>
						)}
						link={(props) => (
							<SankeyLinkShape props={props} opacity={config.linkOpacity} />
						)}
					>
						<Tooltip isAnimationActive={false} />
					</Sankey>
				</ResponsiveContainer>
			</div>
		</figure>
	);
}
export function buildAccessibleSummary({
	frames,
	theme,
	panel,
}: DashboardRendererContext<SankeyConfigV1>) {
	const nodes = frames.find((frame) => frame.meta.shapeHint === "graph-nodes");
	const edges = frames.find((frame) => frame.meta.shapeHint === "graph-edges");
	if (!nodes || !edges) return `${panel.accessibleLabel}: missing graph frames`;
	try {
		const model = buildSankeyModel(nodes, edges, theme.palette);
		const largest = [...model.links].sort((a, b) => b.value - a.value)[0];
		return `${panel.accessibleLabel}: ${model.nodes.length} nodes, ${model.links.length} links, total source flow ${model.totalFlow}${largest ? `, largest ${largest.sourceId} to ${largest.targetId}` : ""}`.slice(
			0,
			600,
		);
	} catch {
		return `${panel.accessibleLabel}: no valid Sankey data`;
	}
}
