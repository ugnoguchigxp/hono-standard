import {
	Component,
	type ErrorInfo,
	lazy,
	type ReactNode,
	Suspense,
	useState,
} from "react";
import type { SceneModel, Selection } from "./scene-model";

const loadScene = () =>
	import("./scene-canvas").then((module) => ({ default: module.SceneCanvas }));
const SceneCanvas = lazy(loadScene);
const stageMeaning: Record<string, string> = {
	finding: "Finds relevant material",
	covering: "Builds coverage from findings",
	finalize: "Completes the result",
	"review-queue": "Handles independent review work",
	"knowledge-queue": "Handles independent knowledge work",
};

function identifySelection(model: SceneModel, selected: Selection) {
	if (!selected) return null;
	if (selected.kind === "entity") {
		const entity = model.entities.find((item) => item.id === selected.id);
		return (
			entity && {
				name: entity.label,
				service: entity.label,
				type: entity.kind,
				state: entity.health,
				meaning: entity.description ?? entity.kind,
				diagnosisId: entity.diagnosisId,
			}
		);
	}
	if (selected.kind === "stage") {
		const stage = model.stages.find(
			(item) =>
				item.pipelineId === selected.pipelineId && item.id === selected.id,
		);
		const pipeline = model.pipelines.find(
			(item) => item.id === selected.pipelineId,
		);
		return (
			stage && {
				name: stage.label,
				service: pipeline?.label ?? stage.pipelineId,
				type: stage.kind === "queue" ? "Independent queue" : "Processing step",
				state: stage.activeTaskId
					? `Active: ${stage.activeTaskId}`
					: stage.status,
				meaning:
					stageMeaning[stage.id] ??
					(stage.kind === "queue"
						? "Independent queued work"
						: "Pipeline processing step"),
				diagnosisId: undefined,
			}
		);
	}
	if (selected.kind === "pipeline") {
		const pipeline = model.pipelines.find((item) => item.id === selected.id);
		return (
			pipeline && {
				name: pipeline.label,
				service: pipeline.label,
				type: "Pipeline",
				state: `${pipeline.stages.length} objects`,
				meaning: "Coordinates ordered steps and independent queues",
				diagnosisId: undefined,
			}
		);
	}
	if (selected.kind === "task") {
		const task = model.tasks.find((item) => item.id === selected.id);
		return (
			task && {
				name: task.label,
				service: "Task",
				type: "Task",
				state: task.state,
				meaning: task.currentAction || "Agent task",
				diagnosisId: undefined,
			}
		);
	}
	const boundary = model.boundaries.find((item) => item.id === selected.id);
	if (!boundary) return null;
	const source =
		model.entities.find((item) => item.id === boundary.source)?.label ??
		boundary.source;
	const target =
		model.entities.find((item) => item.id === boundary.target)?.label ??
		boundary.target;
	return {
		name: `${source} → ${target}`,
		service: `${source} / ${target}`,
		type: "Connection",
		state: boundary.health,
		meaning: "Observed connection between services",
		diagnosisId: undefined,
	};
}

function webglAvailable() {
	try {
		const canvas = document.createElement("canvas");
		const context = canvas.getContext("webgl2");
		context?.getExtension("WEBGL_lose_context")?.loseContext();
		return Boolean(context);
	} catch {
		return false;
	}
}

class SceneErrorBoundary extends Component<
	{ children: ReactNode; onError: (error: Error) => void },
	{ failed: boolean }
> {
	state = { failed: false };
	static getDerivedStateFromError() {
		return { failed: true };
	}
	componentDidCatch(error: Error, _info: ErrorInfo) {
		this.props.onError(error);
	}
	render() {
		return this.state.failed ? null : this.props.children;
	}
}

export function SceneHost({
	model,
	selected,
	onSelect,
	active,
}: {
	model: SceneModel;
	selected: Selection;
	onSelect: (selection: Selection) => void;
	active: boolean;
}) {
	const [failure, setFailure] = useState<{
		message: string;
		reload: boolean;
	} | null>(null);
	const [retryKey, setRetryKey] = useState(0);
	const [supported] = useState(
		() => typeof document !== "undefined" && webglAvailable(),
	);
	const identification = identifySelection(model, selected);
	return (
		<section className="spatial-scene-section" aria-label="Spatial scene">
			<div className="spatial-scene-heading">
				<h2>System map</h2>
				<p>Select a shape for details. Wheel to zoom; right-drag to pan.</p>
			</div>
			{!supported || failure ? (
				<div className="spatial-scene-fallback" role="status">
					<p>
						{failure?.message ?? "WebGL is unavailable on this device."} The
						system lists below remain available.
					</p>
					{supported ? (
						<button
							type="button"
							onClick={() => {
								if (failure?.reload) {
									window.location.reload();
									return;
								}
								setFailure(null);
								setRetryKey((key) => key + 1);
							}}
						>
							Retry scene
						</button>
					) : null}
				</div>
			) : (
				<SceneErrorBoundary
					key={retryKey}
					onError={(error) =>
						setFailure({
							message: "The scene could not be displayed.",
							reload: /import|fetch|module|chunk/i.test(error.message),
						})
					}
				>
					<Suspense
						fallback={
							<p className="spatial-scene-fallback">Loading system map…</p>
						}
					>
						<SceneCanvas
							model={model}
							selected={selected}
							onSelect={onSelect}
							active={active}
							onContextLost={() =>
								setFailure({
									message: "The graphics context was lost.",
									reload: false,
								})
							}
						/>
					</Suspense>
				</SceneErrorBoundary>
			)}
			{identification ? (
				<aside
					className="spatial-scene-identification"
					aria-label="Selected object"
					aria-live="polite"
				>
					<div className="spatial-scene-identification-top">
						<span>{identification.type}</span>
						<button
							type="button"
							onClick={() => onSelect(null)}
							aria-label="Close selected object"
						>
							×
						</button>
					</div>
					<strong>{identification.name}</strong>
					<p>{identification.meaning}</p>
					<dl>
						<dt>Service</dt>
						<dd>{identification.service}</dd>
						<dt>Status</dt>
						<dd>{identification.state}</dd>
						{identification.diagnosisId ? (
							<>
								<dt>Diagnosis check</dt>
								<dd>{identification.diagnosisId}</dd>
							</>
						) : null}
					</dl>
				</aside>
			) : null}
			<p className="spatial-legend">
				Symbols represent SAAA diagnosis targets. Select any object to see its
				meaning and diagnosis check. Node health: healthy solid teal · degraded
				amber diamond · stale dim · disconnected dark ring · fault red triangle
				· unknown outline. Boundary: solid / dashed / broken. Queue: amber
				animated shape means an active task; red means stalled.
			</p>
		</section>
	);
}
