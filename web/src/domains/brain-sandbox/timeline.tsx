type Action = { atMs: number; action: string; succeeded: boolean };
export function Timeline({
	simTimeMs,
	actions = [],
	counters,
}: {
	simTimeMs?: number;
	actions?: Action[];
	counters?: Record<string, number>;
}) {
	return (
		<section aria-label="Experiment timeline">
			<h2>Timeline & metrics</h2>
			<p>Simulation time: {simTimeMs ?? 0} ms</p>
			{counters ? (
				<dl>
					{Object.entries(counters).map(([name, value]) => (
						<div key={name}>
							<dt>{name}</dt>
							<dd>{value}</dd>
						</div>
					))}
				</dl>
			) : null}
			<ol>
				{actions.slice(-20).map((entry) => (
					<li key={`${entry.atMs}-${entry.action}-${entry.succeeded}`}>
						{entry.atMs} ms — {entry.action} (
						{entry.succeeded ? "success" : "no effect"})
					</li>
				))}
			</ol>
		</section>
	);
}
