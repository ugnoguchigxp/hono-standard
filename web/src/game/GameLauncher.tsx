import { useCallback, useEffect, useMemo, useState } from "react";
import {
	assertGameStateCompatible,
	createDemoEncounterProvider,
	createInitialGameState,
	GameSession,
	type GameContentRegistry,
	type GameState,
} from "@shared/game";
import { GameScreen } from "./GameScreen";
import {
	ContentLoadError,
	GameContentLoader,
} from "./content/GameContentLoader";
import {
	ServerGameSaveRepository,
	type GameSaveLoadResult,
	type GameSaveRepository,
	type GameSaveWriteResult,
} from "./save/ServerGameSaveRepository";

const saveCompatibilityMessage = (
	state: GameState,
	registry: GameContentRegistry,
): string | null => {
	if (state.contentVersion !== registry.contentVersion) {
		return "This checkpoint belongs to a different world version. Start a New Game to play without deleting the old save first.";
	}
	try {
		assertGameStateCompatible(state, registry);
		return null;
	} catch {
		return "This checkpoint references world data that is no longer available. Start a New Game to play without deleting the old save first.";
	}
};

const createRuntimeSession = (
	state: GameState,
	registry: GameContentRegistry,
): GameSession =>
	new GameSession({
		sessionId: `browser-${crypto.randomUUID()}`,
		initialState: state,
		registry,
		encounterProvider: createDemoEncounterProvider(registry),
	});

const saveSummary = (result: GameSaveLoadResult): string => {
	switch (result.status) {
		case "empty":
			return "No checkpoint found.";
		case "ready":
			return [
				`Autosave · ${new Date(result.save.savedAt).toLocaleString()}`,
				result.source === "server" ? "Cloud save" : "Browser backup",
				result.syncMessage,
			]
				.filter(Boolean)
				.join(" · ");
		case "corrupt":
		case "unsupported":
		case "error":
			return result.message;
	}
};

type ContentState =
	| { status: "loading" }
	| { status: "ready"; registry: GameContentRegistry }
	| { status: "failed"; error: ContentLoadError };

type SaveLoadState = { status: "loading" } | GameSaveLoadResult;

export function GameLauncher({
	playerId,
	contentLoader: providedContentLoader,
	saveRepository: providedSaveRepository,
}: {
	playerId: string;
	contentLoader?: GameContentLoader;
	saveRepository?: GameSaveRepository;
}) {
	const repository = useMemo(
		() =>
			providedSaveRepository ??
			new ServerGameSaveRepository(window.localStorage, playerId),
		[playerId, providedSaveRepository],
	);
	const contentLoader = useMemo(
		() => providedContentLoader ?? new GameContentLoader(),
		[providedContentLoader],
	);
	const [contentAttempt, setContentAttempt] = useState(0);
	const [contentState, setContentState] = useState<ContentState>({
		status: "loading",
	});
	const [loadResult, setLoadResult] = useState<SaveLoadState>({
		status: "loading",
	});
	const [session, setSession] = useState<GameSession | null>(null);
	const [saveStatus, setSaveStatus] = useState<string | null>(null);

	useEffect(() => {
		const controller = new AbortController();
		if (contentAttempt > 0) contentLoader.reset();
		setContentState({ status: "loading" });
		setLoadResult({ status: "loading" });
		const savePromise = Promise.resolve(
			repository.load(controller.signal),
		).catch((error: unknown): GameSaveLoadResult => {
			if (controller.signal.aborted) throw error;
			return {
				status: "error",
				message: "Cloud saves could not be loaded.",
				source: "server",
			};
		});
		void Promise.all([savePromise, contentLoader.load(controller.signal)])
			.then(async ([saveResult, registry]) => {
				const mapId =
					saveResult.status === "ready"
						? saveResult.save.state.location.mapId
						: null;
				return mapId &&
					!registry.mapsById[mapId] &&
					contentLoader.hasDeclaredMap(mapId) === true
					? ([
							saveResult,
							await contentLoader.loadMap(mapId, controller.signal),
						] as const)
					: ([saveResult, registry] as const);
			})
			.then(
				([saveResult, registry]) => {
					if (!controller.signal.aborted) {
						setLoadResult(saveResult);
						setContentState({ status: "ready", registry });
					}
				},
				(error: unknown) => {
					if (controller.signal.aborted) return;
					setContentState({
						status: "failed",
						error:
							error instanceof ContentLoadError
								? error
								: new ContentLoadError(
										"network",
										"The world could not be reached.",
									),
					});
				},
			);
		return () => controller.abort();
	}, [contentAttempt, contentLoader, repository]);

	const retryContent = useCallback(() => {
		setContentAttempt((attempt) => attempt + 1);
	}, []);

	const applySaveResult = useCallback(
		(result: GameSaveWriteResult, successMessage: string) => {
			setSaveStatus(result.ok ? successMessage : result.message);
			if (result.save) {
				setLoadResult({
					status: "ready",
					save: result.save,
					migrated: false,
					source: result.ok ? "server" : "local",
					syncMessage: result.ok ? undefined : result.message,
				});
			}
		},
		[],
	);

	const persistSave = useCallback(
		(
			write: Promise<GameSaveWriteResult> | GameSaveWriteResult,
			successMessage: string,
		) => {
			if (!(write instanceof Promise)) {
				applySaveResult(write, successMessage);
				return;
			}
			setSaveStatus("Saving checkpoint…");
			void write.then(
				(result) => applySaveResult(result, successMessage),
				() =>
					setSaveStatus(
						"Checkpoint could not be saved; please keep this page open and retry.",
					),
			);
		},
		[applySaveResult],
	);

	const startNewGame = useCallback(() => {
		if (contentState.status !== "ready") return;
		const state = createInitialGameState({ registry: contentState.registry });
		persistSave(repository.save(state), "Initial checkpoint saved.");
		setSession(createRuntimeSession(state, contentState.registry));
	}, [contentState, persistSave, repository]);

	const continueGame = useCallback(() => {
		if (
			loadResult.status !== "ready" ||
			contentState.status !== "ready" ||
			saveCompatibilityMessage(loadResult.save.state, contentState.registry)
		) {
			return;
		}
		if (loadResult.migrated) {
			persistSave(
				repository.save(loadResult.save.state),
				"Save upgraded and loaded.",
			);
		} else {
			setSaveStatus("Checkpoint loaded.");
		}
		setSession(
			createRuntimeSession(loadResult.save.state, contentState.registry),
		);
	}, [contentState, loadResult, persistSave, repository]);

	const autosave = useCallback(
		(state: GameState) => {
			persistSave(repository.save(state), "Checkpoint saved.");
		},
		[persistSave, repository],
	);

	if (session) {
		return (
			<>
				<p className="game-save-status" role="status">
					{saveStatus}
				</p>
				<GameScreen
					session={session}
					contentLoader={contentLoader}
					onAutosave={autosave}
					onExit={() => setSession(null)}
				/>
			</>
		);
	}

	if (contentState.status === "failed") {
		return (
			<section className="game-launcher" aria-labelledby="game-error-title">
				<p className="game-kicker">Echoes at Dawn</p>
				<h1 id="game-error-title">The world could not be loaded.</h1>
				<p className="game-save-summary error" role="alert">
					{contentState.error.message}
				</p>
				<button
					type="button"
					className="game-launch-button primary"
					onClick={retryContent}
				>
					Retry
				</button>
			</section>
		);
	}

	if (contentState.status === "loading" || loadResult.status === "loading") {
		return (
			<section className="game-launcher" aria-labelledby="game-loading-title">
				<p className="game-kicker">Echoes at Dawn</p>
				<h1 id="game-loading-title">Loading world…</h1>
				<p role="status">Validating maps, events, and assets.</p>
			</section>
		);
	}

	const compatibilityMessage =
		loadResult.status === "ready"
			? saveCompatibilityMessage(loadResult.save.state, contentState.registry)
			: null;
	const canContinue =
		loadResult.status === "ready" && compatibilityMessage === null;
	const hasLoadError =
		["corrupt", "unsupported", "error"].includes(loadResult.status) ||
		compatibilityMessage !== null;
	return (
		<section className="game-launcher" aria-labelledby="game-launcher-title">
			<p className="game-kicker">Echoes at Dawn</p>
			<h1 id="game-launcher-title">The signal is waiting.</h1>
			<p className="game-launcher-copy">
				Enter the Signal Ruins with Mira, Sol, and Lune. Progress is stored at
				checkpoints in your account and can be continued in another browser.
			</p>
			<div className="game-launch-actions">
				{canContinue ? (
					<button
						type="button"
						className="game-launch-button primary"
						onClick={continueGame}
					>
						Continue
					</button>
				) : null}
				<button
					type="button"
					className="game-launch-button"
					onClick={startNewGame}
				>
					New Game
				</button>
			</div>
			<p
				className={`game-save-summary${hasLoadError ? " error" : ""}`}
				role={hasLoadError ? "alert" : "status"}
			>
				{compatibilityMessage ?? saveSummary(loadResult)}
			</p>
		</section>
	);
}
