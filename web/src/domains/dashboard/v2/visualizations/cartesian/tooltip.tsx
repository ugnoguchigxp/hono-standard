import type { TooltipContentProps, TooltipPayloadEntry } from "recharts";

export type CartesianTooltipRow = {
	key: string;
	label: string;
	value: string;
	color?: string;
	detail?: string;
};
export function CartesianTooltipContent({
	domain,
	rows,
}: {
	domain: string;
	rows: CartesianTooltipRow[];
}) {
	return (
		<div role="status" className="dashboard-cartesian-tooltip">
			<strong>{domain}</strong>
			{rows.slice(0, 20).map((row) => (
				<div key={row.key}>
					<span>
						{row.color ? (
							<span
								className="dashboard-chart-legend-swatch"
								style={{ backgroundColor: row.color }}
								aria-hidden="true"
							/>
						) : null}
						{row.label}
					</span>
					<span>{row.value}</span>
					{row.detail ? <small> ({row.detail})</small> : null}
				</div>
			))}
			{rows.length > 20 ? <div>+{rows.length - 20} more</div> : null}
		</div>
	);
}

export function CartesianTooltip({
	active,
	label,
	payload,
	formatDomain,
	formatRow,
}: TooltipContentProps & {
	formatDomain: (value: string | number) => string;
	formatRow: (entry: TooltipPayloadEntry) => CartesianTooltipRow | null;
}) {
	if (!active || label === undefined || payload.length === 0) return null;
	const rows = payload
		.map((entry) => formatRow(entry))
		.filter((row): row is CartesianTooltipRow => row !== null);
	if (rows.length === 0) return null;
	return <CartesianTooltipContent domain={formatDomain(label)} rows={rows} />;
}
