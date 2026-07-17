import type { MissingInterval, StateInterval } from "./interval-model";
import type { StateSample } from "./sample-model";
import type { UptimeBucket } from "./uptime-model";
import type { StateSemantic } from "./state-value";

const legendItems: Array<[StateSemantic, string]> = [
	["healthy", "Healthy"],
	["warning", "Warning"],
	["critical", "Critical"],
	["unknown", "Unknown / missing"],
];
export function StateLegend({
	hidden = new Set(),
	onToggle,
}: {
	hidden?: ReadonlySet<StateSemantic>;
	onToggle?: (semantic: StateSemantic) => void;
}) {
	return (
		<section className="dashboard-state-legend" aria-label="State legend">
			{legendItems.map(([semantic, label]) => (
				<button
					key={semantic}
					type="button"
					aria-pressed={!hidden.has(semantic)}
					onClick={() => onToggle?.(semantic)}
				>
					● {label}
				</button>
			))}
		</section>
	);
}
export function StateTable({
	intervals,
	gaps = [],
}: {
	intervals: StateInterval[];
	gaps?: MissingInterval[];
}) {
	const rows = [
		...intervals.map((item) => ({ ...item, missing: false as const })),
		...gaps.map((item) => ({
			...item,
			id: `${item.laneId}:missing:${item.start}`,
			state: undefined,
			durationMs: item.end - item.start,
			openEnded: false,
		})),
	].sort((a, b) => a.start - b.start || a.laneId.localeCompare(b.laneId));
	return (
		<div className="dashboard-table-scroll">
			<table className="dashboard-table" aria-label="State intervals">
				<caption>State intervals</caption>
				<thead>
					<tr>
						{[
							"Lane",
							"State",
							"Start",
							"End",
							"Duration",
							"Missing",
							"Open",
						].map((item) => (
							<th scope="col" key={item}>
								{item}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{rows.map((item) => (
						<tr key={item.id}>
							<td>{item.laneLabel}</td>
							<td>{item.state?.text ?? "Missing"}</td>
							<td>{item.start}</td>
							<td>{item.end}</td>
							<td>{item.durationMs}</td>
							<td>{item.missing ? "Yes" : "No"}</td>
							<td>{item.openEnded ? "Yes" : "No"}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
export function SampleTable({ samples }: { samples: StateSample[] }) {
	return (
		<div className="dashboard-table-scroll">
			<table className="dashboard-table" aria-label="Status samples">
				<caption>Status samples</caption>
				<thead>
					<tr>
						{["Lane", "Time", "State", "Missing", "Synthetic"].map((item) => (
							<th scope="col" key={item}>
								{item}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{samples.map((item) => (
						<tr key={item.id}>
							<td>{item.laneLabel}</td>
							<td>{item.time}</td>
							<td>{item.state.text}</td>
							<td>{item.missing ? "Yes" : "No"}</td>
							<td>{item.synthetic ? "Yes" : "No"}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
export function UptimeTable({ buckets }: { buckets: UptimeBucket[] }) {
	return (
		<div className="dashboard-table-scroll">
			<table className="dashboard-table" aria-label="Uptime buckets">
				<caption>Uptime buckets</caption>
				<thead>
					<tr>
						{[
							"Lane",
							"Bucket",
							"Coverage",
							"Healthy",
							"Warning",
							"Critical",
							"Unknown",
							"Missing",
							"Uptime",
							"Incidents",
						].map((item) => (
							<th scope="col" key={item}>
								{item}
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					{buckets.map((item) => (
						<tr key={`${item.laneId}:${item.start}`}>
							<td>{item.laneLabel}</td>
							<td>
								{item.start}–{item.end}
							</td>
							<td>
								{((item.observedMs / (item.end - item.start)) * 100).toFixed(1)}
								%
							</td>
							<td>{item.healthyMs}</td>
							<td>{item.warningMs}</td>
							<td>{item.criticalMs}</td>
							<td>{item.unknownMs}</td>
							<td>{item.missingMs}</td>
							<td>
								{item.uptimeRatio === null
									? "insufficient data"
									: `${(item.uptimeRatio * 100).toFixed(2)}%`}
							</td>
							<td>{item.incidentCount ?? 0}</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
