import {
	ACTION3D_GAME_ID,
	type Action3dContentRegistry,
	Action3dSession,
	type Action3dState,
	createAction3dCheckpointState,
	createInitialAction3dState,
} from "@shared/action3d";
import { Link } from "@tanstack/react-router";
import { Box, Gamepad2, Orbit, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	Action3dContentLoadError,
	Action3dContentLoader,
	type Action3dContentProgress,
} from "./content/Action3dContentLoader";
import { Action3dGameScreen } from "./runtime/Action3dGameScreen";
import {
	type LocalAction3dLoadResult,
	LocalAction3dSaveRepository,
} from "./save/LocalAction3dSaveRepository";

type ContentState =
	| { status: "loading" }
	| { status: "ready"; registry: Action3dContentRegistry }
	| { status: "failed"; error: Action3dContentLoadError };
const saveSummary = (result: LocalAction3dLoadResult) =>
	result.status === "empty"
		? "No Action3D checkpoint yet."
		: result.status === "ready"
			? `Checkpoint · ${new Date(result.save.savedAt).toLocaleString()}`
			: result.message;

export function Action3dLauncher({
	playerId,
	contentLoader: providedLoader,
}: {
	playerId: string;
	contentLoader?: Action3dContentLoader;
}) {
	const repository = useMemo(
		() => new LocalAction3dSaveRepository(window.localStorage, playerId),
		[playerId],
	);
	const contentLoader = useMemo(
		() => providedLoader ?? new Action3dContentLoader(),
		[providedLoader],
	);
	const [attempt, setAttempt] = useState(0);
	const [content, setContent] = useState<ContentState>({ status: "loading" });
	const [loadResult, setLoadResult] = useState<LocalAction3dLoadResult>(() =>
		repository.load(),
	);
	const [session, setSession] = useState<Action3dSession | null>(null);
	const [checkpoint, setCheckpoint] = useState<Action3dState | null>(null);
	const [saveStatus, setSaveStatus] = useState<string | null>(null);
	const [loadProgress, setLoadProgress] = useState<Action3dContentProgress>({
		loaded: 0,
		total: 1,
		label: "Manifest",
	});

	useEffect(() => {
		const controller = new AbortController();
		if (attempt) contentLoader.reset();
		setLoadProgress({ loaded: 0, total: 1, label: "Manifest" });
		setContent({ status: "loading" });
		void contentLoader.load(controller.signal, setLoadProgress).then(
			(registry) => {
				if (!controller.signal.aborted)
					setContent({ status: "ready", registry });
			},
			(error: unknown) => {
				if (!controller.signal.aborted)
					setContent({
						status: "failed",
						error:
							error instanceof Action3dContentLoadError
								? error
								: new Action3dContentLoadError(
										"network",
										"The Action3D field could not be reached.",
									),
					});
			},
		);
		return () => controller.abort();
	}, [attempt, contentLoader]);

	const begin = useCallback(
		(state: Action3dState, registry: Action3dContentRegistry) => {
			setCheckpoint(createAction3dCheckpointState(state, registry));
			setSession(new Action3dSession(state, registry));
		},
		[],
	);
	const startNew = useCallback(() => {
		if (content.status !== "ready") return;
		const state = createInitialAction3dState(content.registry);
		setSaveStatus(
			"New Action3D session started · existing checkpoint preserved.",
		);
		begin(state, content.registry);
	}, [begin, content]);
	const continueGame = useCallback(() => {
		if (content.status !== "ready" || loadResult.status !== "ready") return;
		if (
			loadResult.save.state.contentVersion !== content.registry.contentVersion
		) {
			setSaveStatus(
				"This checkpoint belongs to a different Action3D content version.",
			);
			return;
		}
		setSaveStatus("Action3D checkpoint loaded.");
		begin(loadResult.save.state, content.registry);
	}, [begin, content, loadResult]);
	const autosave = useCallback(
		(state: Action3dState) => {
			if (content.status !== "ready") return;
			const stable = createAction3dCheckpointState(state, content.registry);
			const result = repository.save(stable);
			setSaveStatus(
				result.ok ? "North beacon secured · checkpoint saved." : result.message,
			);
			if (result.ok) {
				setCheckpoint(stable);
				setLoadResult({ status: "ready", save: result.save });
			}
		},
		[content, repository],
	);

	if (session && content.status === "ready" && checkpoint)
		return (
			<Action3dGameScreen
				session={session}
				checkpoint={checkpoint}
				onAutosave={autosave}
				onExit={() => setSession(null)}
				saveStatus={saveStatus}
			/>
		);
	return (
		<main className="action3d-shell" data-game-id={ACTION3D_GAME_ID}>
			<section className="action3d-panel" aria-labelledby="action3d-title">
				<div className="action3d-mark" aria-hidden="true">
					<Orbit />
				</div>
				<p className="action3d-kicker">Browser Action Lab · WebGL2</p>
				<h1 id="action3d-title">Action3D Field Lab</h1>
				<p className="action3d-copy">
					A standalone third-person action field. Defeat three sentinels, secure
					the beacon, and keep an independent Action3D checkpoint.
				</p>
				{content.status === "loading" && (
					<div className="action3d-status" role="status">
						<Box className="icon" />
						<span>
							Loading world contract · {loadProgress.loaded}/
							{loadProgress.total} · {loadProgress.label}
						</span>
					</div>
				)}
				{content.status === "failed" && (
					<div className="action3d-error" role="alert">
						<strong>World load failed</strong>
						<span>{content.error.message}</span>
						<button
							type="button"
							onClick={() => setAttempt((value) => value + 1)}
						>
							<RotateCcw className="icon" />
							Retry
						</button>
					</div>
				)}
				{content.status === "ready" && (
					<>
						<div className="action3d-status" role="status">
							<Box className="icon" />
							<span>{saveStatus ?? saveSummary(loadResult)}</span>
						</div>
						<div className="action3d-launch-actions">
							<button
								type="button"
								className="action3d-primary"
								onClick={startNew}
							>
								New Game
							</button>
							<button
								type="button"
								onClick={continueGame}
								disabled={loadResult.status !== "ready"}
							>
								Continue
							</button>
						</div>
					</>
				)}
				<div className="action3d-actions">
					<Link to="/game" className="auth-open-button">
						<Gamepad2 className="icon" />
						Open the 2D RPG
					</Link>
					<Link to="/" className="auth-open-button">
						Back to home
					</Link>
				</div>
			</section>
		</main>
	);
}
