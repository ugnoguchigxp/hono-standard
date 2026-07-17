import type { ReactNode } from "react";

export function CartesianLegend({
	series,
	hidden,
	onToggle,
	onIsolate,
	onReset,
}: {
	series: Array<{
		key: string;
		label: string;
		color?: string;
		detail?: string;
	}>;
	hidden: ReadonlySet<string>;
	onToggle: (key: string) => void;
	onIsolate: (key: string) => void;
	onReset: () => void;
}) {
	return (
		<fieldset className="dashboard-chart-legend">
			<legend className="dashboard-visually-hidden">Chart legend</legend>
			<CartesianLegendHint />
			{series.map((item) => (
				<button
					type="button"
					key={item.key}
					aria-pressed={!hidden.has(item.key)}
					onClick={() => onToggle(item.key)}
					onDoubleClick={() => onIsolate(item.key)}
					onKeyDown={(event) => {
						if (event.key === "Enter" && event.shiftKey) {
							event.preventDefault();
							onIsolate(item.key);
						}
					}}
				>
					{item.color ? (
						<span
							className="dashboard-chart-legend-swatch"
							style={{ backgroundColor: item.color }}
							aria-hidden="true"
						/>
					) : null}
					{item.label}
					{item.detail ? ` (${item.detail})` : null}
				</button>
			))}
			<button type="button" onClick={onReset}>
				Reset series
			</button>
		</fieldset>
	);
}

export function CartesianLegendHint(): ReactNode {
	return (
		<span className="dashboard-visually-hidden">
			Use Enter or Space to toggle a series. Double click isolates a series.
		</span>
	);
}
