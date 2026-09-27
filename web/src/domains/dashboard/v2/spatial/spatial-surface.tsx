import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import {
	buildSceneModel,
	type Selection,
	selectionExists,
} from "./scene-model";
import { summarize } from "./spatial-state";
import { useSpatialData } from "./use-spatial-data";

const SceneHost = lazy(() =>
	import("./scene-host").then((module) => ({ default: module.SceneHost })),
);

export function SpatialSurface() {
	const { data, status, retry } = useSpatialData();
	const [selected, setSelected] = useState<Selection>(null);
	const snapshot = data?.snapshot;
	const model = useMemo(
		() => (snapshot ? buildSceneModel(snapshot) : null),
		[snapshot],
	);
	useEffect(() => {
		if (selected && model && !selectionExists(model, selected))
			setSelected(null);
	}, [model, selected]);
	const summary = model ? summarize(model) : null;
	const selectedItem =
		selected && model
			? selected.kind === "entity"
				? model.entities.find((item) => item.id === selected.id)
				: selected.kind === "boundary"
					? model.boundaries.find((item) => item.id === selected.id)
					: selected.kind === "task"
						? model.tasks.find((item) => item.id === selected.id)
						: selected.kind === "stage"
							? model.stages.find(
									(item) =>
										item.pipelineId === selected.pipelineId &&
										item.id === selected.id,
								)
							: model.pipelines.find((item) => item.id === selected.id)
			: null;
	return (
		<main
			className="dashboard-page spatial-page"
			data-spatial-ready={snapshot ? "true" : undefined}
		>
			<header className="spatial-header">
				<div>
					<div className="dashboard-kicker">Spatial observability</div>
					<h1>System overview</h1>
					<p>Simulated signals modeled on SAAA self-diagnosis.</p>
				</div>
				<div className="spatial-connection" role="status" aria-live="polite">
					<span>Connection: {status}</span>
					{status !== "live" ? (
						<button type="button" onClick={retry}>
							Retry
						</button>
					) : null}
				</div>
			</header>
			{status === "unauthorized" ? (
				<p role="alert">
					Your session has expired. Sign in again to view live signals.
				</p>
			) : null}
			{status !== "live" && snapshot ? (
				<p className="spatial-stale" role="status">
					Showing last known state. Live updates are unavailable.
				</p>
			) : null}
			{!snapshot ? (
				<p className="dashboard-loading">Loading spatial state…</p>
			) : (
				<>
					{model ? (
						<Suspense
							fallback={
								<p className="spatial-scene-fallback">Loading system map…</p>
							}
						>
							<SceneHost
								model={model}
								selected={selected}
								onSelect={setSelected}
								active={status === "live"}
							/>
						</Suspense>
					) : null}
					<section className="spatial-summary" aria-label="System summary">
						<p>
							Scenario: <strong>{snapshot.scenario}</strong>
						</p>
						<p>Snapshot revision: {snapshot.revision}</p>
						<p>
							Last generated:{" "}
							<time dateTime={new Date(snapshot.generatedAt).toISOString()}>
								{new Date(snapshot.generatedAt).toLocaleString()}
							</time>
						</p>
						<p>
							Entities: {snapshot.entities.length}, tasks: {summary?.taskCount},
							pipelines: {summary?.pipelineCount}
						</p>
						<p>
							Entity health:{" "}
							{Object.entries(summary?.entityHealth ?? {})
								.map(([health, count]) => `${health} ${count}`)
								.join(", ")}
						</p>
						<p>
							Boundary health:{" "}
							{Object.entries(summary?.boundaryHealth ?? {})
								.map(([health, count]) => `${health} ${count}`)
								.join(", ")}
						</p>
					</section>
					<div className="spatial-columns">
						<section aria-labelledby="spatial-entities">
							<h2 id="spatial-entities">Entities</h2>
							<ul>
								{model?.entities.map((item) => (
									<li key={item.id}>
										<button
											type="button"
											onClick={() =>
												setSelected({ kind: "entity", id: item.id })
											}
										>
											{item.label} — {item.health}; activity{" "}
											{Math.round(item.activity * 100)}%
										</button>
									</li>
								))}
							</ul>
						</section>
						<section aria-labelledby="spatial-boundaries">
							<h2 id="spatial-boundaries">Boundaries</h2>
							<ul>
								{model?.boundaries.map((item) => (
									<li key={item.id}>
										<button
											type="button"
											onClick={() =>
												setSelected({ kind: "boundary", id: item.id })
											}
										>
											{item.source} → {item.target} — {item.health};{" "}
											{item.latencyMs} ms
										</button>
									</li>
								))}
							</ul>
						</section>
						<section aria-labelledby="spatial-tasks">
							<h2 id="spatial-tasks">Tasks</h2>
							<ul>
								{model?.tasks.map((item) => (
									<li key={item.id}>
										<button
											type="button"
											onClick={() => setSelected({ kind: "task", id: item.id })}
										>
											{item.label} — {item.state}
										</button>
									</li>
								))}
							</ul>
						</section>
						<section aria-labelledby="spatial-pipelines">
							<h2 id="spatial-pipelines">Pipelines</h2>
							<ul>
								{model?.pipelines.map((item) => (
									<li key={item.id}>
										<button
											type="button"
											onClick={() =>
												setSelected({ kind: "pipeline", id: item.id })
											}
										>
											{item.label} —{" "}
											{item.stages
												.filter((stage) => stage.kind === "step")
												.map(
													(stage) =>
														`${stage.label} ${stage.activeTaskId ? `active ${stage.activeTaskId}` : "idle"} (queue ${stage.queueDepth})`,
												)
												.join(" → ")}
											; queues:{" "}
											{item.stages
												.filter((stage) => stage.kind === "queue")
												.map(
													(stage) =>
														`${stage.label} ${stage.activeTaskId ? "active" : "idle"}, backlog ${stage.queueDepth}`,
												)
												.join(", ") || "none"}
										</button>
										<ul>
											{item.stages.map((stage) => (
												<li key={stage.id}>
													<button
														type="button"
														onClick={() =>
															setSelected({
																kind: "stage",
																id: stage.id,
																pipelineId: item.id,
															})
														}
													>
														{stage.label} {stage.kind} — {stage.status}, queue{" "}
														{stage.queueDepth};{" "}
														{stage.activeTaskId
															? `active task ${stage.activeTaskId}`
															: "idle"}
													</button>
												</li>
											))}
										</ul>
									</li>
								))}
							</ul>
						</section>
					</div>
					{selectedItem ? (
						<aside
							className="spatial-detail"
							aria-label="Selected signal details"
						>
							<h2>
								{"label" in selectedItem
									? selectedItem.label
									: `${selectedItem.source} → ${selectedItem.target}`}
							</h2>
							<dl>
								{"description" in selectedItem && selectedItem.description ? (
									<>
										<dt>Represents</dt>
										<dd>{selectedItem.description}</dd>
									</>
								) : null}
								{"diagnosisId" in selectedItem && selectedItem.diagnosisId ? (
									<>
										<dt>Diagnosis check</dt>
										<dd>{selectedItem.diagnosisId}</dd>
									</>
								) : null}
								{"health" in selectedItem ? (
									<>
										<dt>Health</dt>
										<dd>{selectedItem.health}</dd>
									</>
								) : null}
								{"activity" in selectedItem ? (
									<>
										<dt>Activity</dt>
										<dd>{Math.round(selectedItem.activity * 100)}%</dd>
									</>
								) : null}
								{"latencyMs" in selectedItem ? (
									<>
										<dt>Latency</dt>
										<dd>{selectedItem.latencyMs} ms</dd>
									</>
								) : null}
								{"state" in selectedItem ? (
									<>
										<dt>Task state</dt>
										<dd>{selectedItem.state}</dd>
										<dt>Current action</dt>
										<dd>{selectedItem.currentAction}</dd>
										<dt>Completed steps</dt>
										<dd>{selectedItem.completedSteps.join(", ") || "None"}</dd>
									</>
								) : null}
								{"stages" in selectedItem ? (
									<>
										<dt>Stages</dt>
										<dd>
											{selectedItem.stages
												.map(
													(stage) =>
														`${stage.label} (${stage.kind}): ${stage.status}, queue ${stage.queueDepth}, ${stage.activeTaskId ? `active ${stage.activeTaskId}` : "idle"}`,
												)
												.join("; ")}
										</dd>
									</>
								) : null}
								{"queueDepth" in selectedItem ? (
									<>
										<dt>Queue depth</dt>
										<dd>{selectedItem.queueDepth}</dd>
										<dt>Stage status</dt>
										<dd>{selectedItem.status}</dd>
										<dt>Active task</dt>
										<dd>{selectedItem.activeTaskId ?? "None"}</dd>
									</>
								) : null}
							</dl>
							<button type="button" onClick={() => setSelected(null)}>
								Close details
							</button>
						</aside>
					) : null}
					<section aria-labelledby="spatial-events">
						<h2 id="spatial-events">Recent events</h2>
						<ol>
							{data?.events.map((event) => (
								<li key={event.id}>
									{event.kind} from {event.source} at{" "}
									<time dateTime={new Date(event.timestamp).toISOString()}>
										{new Date(event.timestamp).toLocaleTimeString()}
									</time>
								</li>
							))}
						</ol>
					</section>
				</>
			)}
		</main>
	);
}
