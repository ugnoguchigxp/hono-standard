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
	type Action3dCloudConflict,
	type Action3dSaveLoadResult,
	ServerAction3dSaveRepository,
} from "./save/ServerAction3dSaveRepository";
import { BufferedBrowserAction3dTelemetry } from "./telemetry/Action3dTelemetry";

type ContentState =
	| { status: "loading" }
	| { status: "ready"; registry: Action3dContentRegistry }
	| { status: "failed"; error: Action3dContentLoadError };
type SaveLoadState = { status: "loading" } | Action3dSaveLoadResult;
const saveSummary = (result: SaveLoadState) =>
	result.status === "loading"
		? "Loading Action3D checkpoint…"
		: result.status === "empty"
			? "No Action3D checkpoint yet."
			: result.status === "ready"
				? `Checkpoint · ${new Date(result.save.savedAt).toLocaleString()}`
				: result.message;
const checkpointSummary = (save: { savedAt: string; state: Action3dState }) =>
	`${save.state.location.worldId} · ${save.state.location.checkpointId} · ${new Date(save.savedAt).toLocaleString()}`;

export function Action3dLauncher({
	playerId,
	contentLoader: providedLoader,
}: {
	playerId: string;
	contentLoader?: Action3dContentLoader;
}) {
	const repository = useMemo(
		() => new ServerAction3dSaveRepository(window.localStorage, playerId),
		[playerId],
	);
	const contentLoader = useMemo(
		() => providedLoader ?? new Action3dContentLoader(),
		[providedLoader],
	);
	const telemetry = useMemo(() => new BufferedBrowserAction3dTelemetry(), []);
	const [attempt, setAttempt] = useState(0);
	const [content, setContent] = useState<ContentState>({ status: "loading" });
	const [loadResult, setLoadResult] = useState<SaveLoadState>({
		status: "loading",
	});
	const [session, setSession] = useState<Action3dSession | null>(null);
	const [checkpoint, setCheckpoint] = useState<Action3dState | null>(null);
	const [saveStatus, setSaveStatus] = useState<string | null>(null);
	const [openingSave, setOpeningSave] = useState(false);
	const [resolvingConflict, setResolvingConflict] = useState(false);
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
				if (!controller.signal.aborted) {
					telemetry.capture("action3d_content_load_failed", {
						errorCode:
							error instanceof Action3dContentLoadError
								? error.kind
								: "unknown",
					});
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
				}
			},
		);
		return () => controller.abort();
	}, [attempt, contentLoader, telemetry]);

	useEffect(() => {
		const controller = new AbortController();
		setLoadResult({ status: "loading" });
		void repository.load(controller.signal).then((result) => {
			if (!controller.signal.aborted) setLoadResult(result);
		});
		return () => controller.abort();
	}, [repository]);

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
		telemetry.capture("action3d_session_started", {
			contentVersion: content.registry.contentVersion,
			worldId: state.location.worldId,
		});
		begin(state, content.registry);
	}, [begin, content, telemetry]);
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
		setOpeningSave(true);
		void contentLoader
			.loadWorld(content.registry, loadResult.save.state.location.worldId)
			.then(() => {
				setSaveStatus("Action3D checkpoint loaded.");
				begin(loadResult.save.state, content.registry);
			})
			.catch((error: unknown) => {
				setSaveStatus(
					error instanceof Error
						? error.message
						: "The saved Action3D world could not load.",
				);
			})
			.finally(() => setOpeningSave(false));
	}, [begin, content, contentLoader, loadResult]);
	const autosave = useCallback(
		(state: Action3dState) => {
			if (content.status !== "ready") return;
			const stable = createAction3dCheckpointState(state, content.registry);
			setCheckpoint(stable);
			setSaveStatus("Saving checkpoint…");
			void repository.save(stable).then((result) => {
				telemetry.capture(
					result.ok
						? "action3d_checkpoint_saved"
						: result.status === "conflict"
							? "action3d_save_conflict"
							: "action3d_runtime_interrupted",
					{
						contentVersion: stable.contentVersion,
						worldId: stable.location.worldId,
						errorCode: result.ok ? undefined : result.status,
					},
				);
				setSaveStatus(
					result.ok ? "Checkpoint saved to your account." : result.message,
				);
				if (!result.ok && result.status === "conflict" && result.conflict) {
					setLoadResult({
						status: "conflict",
						message: result.message,
						conflict: result.conflict,
						source: "server",
					});
					setSession(null);
				} else if (result.save)
					setLoadResult({
						status: "ready",
						save: result.save,
						migrated: false,
						source: result.ok ? "server" : "local",
					});
			});
		},
		[content, repository, telemetry],
	);
	const resolveSaveConflict = useCallback(
		async (
			conflict: Action3dCloudConflict,
			resolution: "cloud" | "browser",
		) => {
			if (content.status !== "ready") return;
			setResolvingConflict(true);
			setSaveStatus("Resolving checkpoint conflict…");
			try {
				const result = await repository.resolveConflict(conflict, resolution);
				setLoadResult(result);
				if (result.status === "ready") {
					await contentLoader.loadWorld(
						content.registry,
						result.save.state.location.worldId,
					);
					setSaveStatus(result.syncMessage ?? "Checkpoint conflict resolved.");
					begin(result.save.state, content.registry);
				} else if (result.status === "empty") {
					setSaveStatus("Cloud checkpoint removed; start a new session.");
				} else {
					setSaveStatus(result.message);
				}
			} catch {
				setSaveStatus(
					"Checkpoint conflict could not be resolved. Both candidates are still safe.",
				);
			} finally {
				setResolvingConflict(false);
			}
		},
		[begin, content, contentLoader, repository],
	);

	if (session && content.status === "ready" && checkpoint)
		return (
			<Action3dGameScreen
				session={session}
				checkpoint={checkpoint}
				onAutosave={autosave}
				onExit={() => setSession(null)}
				saveStatus={saveStatus}
				contentLoader={contentLoader}
				telemetry={telemetry}
			/>
		);
	if (content.status === "ready" && loadResult.status === "conflict") {
		const { conflict } = loadResult;
		return (
			<main className="action3d-shell" data-game-id={ACTION3D_GAME_ID}>
				<section
					className="action3d-panel"
					aria-labelledby="action3d-save-conflict-title"
				>
					<div
						role="alertdialog"
						aria-modal="true"
						aria-labelledby="action3d-save-conflict-title"
					>
						<h1 id="action3d-save-conflict-title">
							Choose checkpoint progress
						</h1>
						<p>{loadResult.message}</p>
						<div className="game-save-conflict-candidates">
							<section>
								<h2>This browser</h2>
								<p>{checkpointSummary(conflict.browserSave)}</p>
							</section>
							<section>
								<h2>Cloud</h2>
								<p>
									{conflict.cloudSave
										? checkpointSummary(conflict.cloudSave.save)
										: "No cloud checkpoint"}
								</p>
							</section>
						</div>
						<div className="action3d-launch-actions">
							<button
								type="button"
								disabled={resolvingConflict}
								onClick={() => void resolveSaveConflict(conflict, "cloud")}
							>
								Keep cloud
							</button>
							<button
								type="button"
								className="action3d-primary"
								disabled={resolvingConflict}
								onClick={() => void resolveSaveConflict(conflict, "browser")}
							>
								Keep this browser
							</button>
						</div>
						<p role="status">{saveStatus}</p>
					</div>
				</section>
			</main>
		);
	}
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
								disabled={loadResult.status !== "ready" || openingSave}
							>
								{openingSave ? "Loading…" : "Continue"}
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
