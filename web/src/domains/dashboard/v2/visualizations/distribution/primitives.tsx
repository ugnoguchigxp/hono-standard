import { resolveThemeColor } from "../../runtime/theme";
import type { DashboardVisualizationTheme } from "../../runtime/visualization-types";
import {
	colorScaleLegend,
	colorScaleToken,
	type ResolvedColorScale,
} from "./color-scale";

export function ColorScaleLegend({
	scale,
	locale = "en-US",
}: {
	scale: ResolvedColorScale;
	locale?: string;
}) {
	return (
		<fieldset className="dashboard-distribution-legend">
			<legend className="sr-only">Color scale legend</legend>
			{colorScaleLegend(scale).map((item) => (
				<span key={`${item.token}:${item.value}`}>
					<i
						style={{ background: resolveThemeColor(item.token) }}
						aria-hidden="true"
					/>
					{item.value.toLocaleString(locale, { maximumFractionDigits: 2 })}
				</span>
			))}
		</fieldset>
	);
}
export function ScaleCell({
	scale,
	value,
	state,
}: {
	scale: ResolvedColorScale;
	value: number | null;
	state?: string;
}) {
	return (
		<span
			className="dashboard-distribution-cell"
			style={{
				background: resolveThemeColor(colorScaleToken(scale, value, state)),
			}}
		/>
	);
}
export function StatusScaleLegend() {
	const entries = [
		["Healthy", "--color-chart-success"],
		["Warning", "--color-chart-warning"],
		["Critical", "--color-chart-danger"],
		["Unknown", "--color-muted"],
	] as const;
	return (
		<fieldset className="dashboard-distribution-legend">
			<legend className="sr-only">Status legend</legend>
			{entries.map(([label, token]) => (
				<span key={label}>
					<i
						style={{ background: resolveThemeColor(token) }}
						aria-hidden="true"
					/>
					{label}
				</span>
			))}
		</fieldset>
	);
}
export function DistributionTable({
	caption,
	columns,
	rows,
}: {
	caption: string;
	columns: string[];
	rows: Array<Array<React.ReactNode>>;
}) {
	return (
		<section
			className="dashboard-table-scroll"
			aria-label={`${caption} scroll area`}
			// biome-ignore lint/a11y/noNoninteractiveTabindex: scrollable data tables must be keyboard focusable
			tabIndex={0}
		>
			<table className="dashboard-table" aria-label={caption}>
				<caption>{caption}</caption>
				<thead>
					<tr>
						{columns.map((column) => (
							<th scope="col" key={column}>
								{column}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.slice(0, 1000).map((row) => {
						const rowKey = row.map(String).join("|");
						return (
							<tr key={`${caption}:${rowKey}`}>
								{columns.map((column, columnIndex) => (
									<td key={`${caption}:${rowKey}:${column}`}>
										{row[columnIndex]}
									</td>
								))}
							</tr>
						);
					})}
				</tbody>
			</table>
		</section>
	);
}
export function SummaryFigure({
	label,
	theme,
	children,
}: {
	label: string;
	theme?: DashboardVisualizationTheme;
	children: React.ReactNode;
}) {
	return (
		<figure
			className={`dashboard-distribution dashboard-distribution-${theme?.mode ?? "dark"}`}
			aria-label={label}
		>
			{children}
		</figure>
	);
}
