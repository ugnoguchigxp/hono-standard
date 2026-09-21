import { useEffect, useState } from "react";
import { useTelemetry } from "../domains/brain-sandbox/use-telemetry";
import { WorldCanvas } from "../domains/brain-sandbox/world-canvas";
import { NeuralCanvas } from "../domains/brain-sandbox/neural-canvas";
import { Timeline } from "../domains/brain-sandbox/timeline";
import { fetchWithSession } from "../api";
type Run = {
	runId: string;
	status: string;
	revision: number;
	simTimeMs: number;
	seed: number;
};
async function api<T>(path: string, init?: RequestInit): Promise<T> {
	const response = await fetchWithSession(`/api${path}`, {
		...init,
		credentials: "include",
		headers: { "Content-Type": "application/json", ...init?.headers },
	});
	if (!response.ok)
		throw new Error(
			(await response.json().catch(() => ({}))).message ??
				`Request failed: ${response.status}`,
		);
	return response.json() as Promise<T>;
}
export function BrainSandboxView() {
	const [run, setRun] = useState<Run>();
	const [history, setHistory] = useState<Run[]>([]);
	const [neuronId, setNeuronId] = useState("0");
	const [inspector, setInspector] = useState<unknown>();
	const [seed, setSeed] = useState("1");
	const [speed, setSpeed] = useState<0.1 | 1 | 10 | 100>(1);
	const [error, setError] = useState<string>();
	const telemetry = useTelemetry(run?.runId);
	const body = telemetry.snapshot?.body as
		| {
				energy?: number;
				hunger?: number;
				fatigue?: number;
				matingDrive?: number;
		  }
		| undefined;
	const world = telemetry.snapshot?.world as Parameters<
		typeof WorldCanvas
	>[0]["world"];
	const neurons = telemetry.snapshot?.neurons as Parameters<
		typeof NeuralCanvas
	>[0]["neurons"];
	const synapses = telemetry.snapshot?.synapses as Parameters<
		typeof NeuralCanvas
	>[0]["synapses"];
	const actions = telemetry.snapshot?.actions as Parameters<
		typeof Timeline
	>[0]["actions"];
	const counters = telemetry.snapshot?.counters as Parameters<
		typeof Timeline
	>[0]["counters"];
	useEffect(() => {
		void api<{ items: Run[] }>("/experiments")
			.then((result) => setHistory(result.items))
			.catch(() => undefined);
	}, []);
	const create = async () => {
		try {
			const created = await api<Run>("/experiments", {
				method: "POST",
				body: JSON.stringify({
					seed: Number(seed),
					scenario: "food",
					configOverrides: {},
				}),
			});
			setRun(created);
			setHistory((current) => [created, ...current]);
			setError(undefined);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not create experiment");
		}
	};
	const inspectNeuron = async () => {
		if (!run || !Number.isInteger(Number(neuronId))) return;
		try {
			setInspector(
				await api<unknown>(`/experiments/${run.runId}/neurons/${neuronId}`),
			);
			setError(undefined);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Inspector request failed");
		}
	};
	const control = async (action: "run" | "pause" | "step" | "reset") => {
		if (!run) return;
		try {
			setRun(
				await api<Run>(`/experiments/${run.runId}/control`, {
					method: "POST",
					body: JSON.stringify({
						commandId: crypto.randomUUID(),
						expectedRevision: run.revision,
						action,
						speed,
					}),
				}),
			);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Control failed");
		}
	};
	return (
		<main className="home-shell">
			<section className="home-panel">
				<h1>Organic Brain Sandbox</h1>
				<p>固定トポロジーの神経個体を、停止・進行・観察する実験用MVPです。</p>
				<label>
					<input
						value={seed}
						inputMode="numeric"
						onChange={(e) => setSeed(e.target.value)}
					/>
				</label>
				<button type="button" onClick={() => void create()}>
					Create experiment
				</button>
				{history.length ? (
					<section aria-label="Experiment history">
						<h2>Run history</h2>
						<ul>
							{history.map((item) => (
								<li key={item.runId}>
									<button type="button" onClick={() => setRun(item)}>
										{item.seed} · {item.status} · {item.simTimeMs} ms
									</button>
								</li>
							))}
						</ul>
					</section>
				) : null}
				{run ? (
					<section aria-live="polite">
						<p>Run: {run.runId}</p>
						<p>
							Status: {run.status} · simulation: {run.simTimeMs} ms
						</p>
						<button type="button" onClick={() => void control("run")}>
							Run
						</button>
						<button type="button" onClick={() => void control("pause")}>
							Pause
						</button>
						<button type="button" onClick={() => void control("step")}>
							Step 100 ms
						</button>
						<button type="button" onClick={() => void control("reset")}>
							Reset
						</button>
						<label>
							Speed
							<select
								value={speed}
								onChange={(event) =>
									setSpeed(Number(event.target.value) as 0.1 | 1 | 10 | 100)
								}
							>
								<option value={0.1}>x0.1</option>
								<option value={1}>x1</option>
								<option value={10}>x10</option>
								<option value={100}>x100</option>
							</select>
						</label>
						<p>
							Telemetry: {telemetry.connected ? "connected" : "reconnecting"}
						</p>
						{body ? (
							<dl>
								<dt>Energy</dt>
								<dd>{body.energy?.toFixed(3)}</dd>
								<dt>Hunger</dt>
								<dd>{body.hunger?.toFixed(3)}</dd>
								<dt>Fatigue</dt>
								<dd>{body.fatigue?.toFixed(3)}</dd>
								<dt>Mating drive</dt>
								<dd>{body.matingDrive?.toFixed(3)}</dd>
							</dl>
						) : null}
						<WorldCanvas world={world} />
						<NeuralCanvas neurons={neurons} synapses={synapses} />
						<Timeline
							simTimeMs={telemetry.snapshot?.simTimeMs as number | undefined}
							actions={actions}
							counters={counters}
						/>
						<section aria-label="Neuron inspector">
							<h2>Neuron inspector</h2>
							<label>
								Neuron ID
								<input
									value={neuronId}
									inputMode="numeric"
									onChange={(event) => setNeuronId(event.target.value)}
								/>
							</label>
							<button type="button" onClick={() => void inspectNeuron()}>
								Inspect neuron
							</button>
							{inspector ? (
								<pre>{JSON.stringify(inspector, null, 2)}</pre>
							) : null}
						</section>
					</section>
				) : null}
				{telemetry.error ? (
					<p className="status error">{telemetry.error}</p>
				) : null}
				{error ? <p className="status error">{error}</p> : null}
			</section>
		</main>
	);
}
