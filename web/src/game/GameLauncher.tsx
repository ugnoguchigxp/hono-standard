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
	LocalGameSaveRepository,
	type LocalGameSaveLoadResult,
} from "./save/LocalGameSaveRepository";

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
		encounterProvider: createDemoEncounterProvider(),
	});

const saveSummary = (result: LocalGameSaveLoadResult): string => {
	switch (result.status) {
		case "empty":
			return "No checkpoint found.";
		case "ready":
			return `Autosave · ${new Date(result.save.savedAt).toLocaleString()}`;
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

export function GameLauncher({
	playerId,
	contentLoader: providedContentLoader,
}: {
	playerId: string;
	contentLoader?: GameContentLoader;
}) {
	const repository = useMemo(
		() => new LocalGameSaveRepository(window.localStorage, playerId),
		[playerId],
	);
	const contentLoader = useMemo(
		() => providedContentLoader ?? new GameContentLoader(),
		[providedContentLoader],
	);
	const [contentAttempt, setContentAttempt] = useState(0);
	const [contentState, setContentState] = useState<ContentState>({
		status: "loading",
	});
	const [loadResult, setLoadResult] = useState<LocalGameSaveLoadResult>(() =>
		repository.load(),
	);
	const [session, setSession] = useState<GameSession | null>(null);
	const [saveStatus, setSaveStatus] = useState<string | null>(null);

	useEffect(() => {
		const controller = new AbortController();
		if (contentAttempt > 0) contentLoader.reset();
		setContentState({ status: "loading" });
		void contentLoader.load(controller.signal).then(
			(registry) => {
				if (!controller.signal.aborted) {
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
	}, [contentAttempt, contentLoader]);

	const retryContent = useCallback(() => {
		setContentAttempt((attempt) => attempt + 1);
	}, []);

	const startNewGame = useCallback(() => {
		if (contentState.status !== "ready") return;
		const state = createInitialGameState({ registry: contentState.registry });
		const saved = repository.save(state);
		setSaveStatus(saved.ok ? "Initial checkpoint saved." : saved.message);
		if (saved.ok) {
			setLoadResult({ status: "ready", save: saved.save, migrated: false });
		}
		setSession(createRuntimeSession(state, contentState.registry));
	}, [contentState, repository]);

	const continueGame = useCallback(() => {
		if (
			loadResult.status !== "ready" ||
			contentState.status !== "ready" ||
			saveCompatibilityMessage(loadResult.save.state, contentState.registry)
		) {
			return;
		}
		if (loadResult.migrated) {
			const upgraded = repository.save(loadResult.save.state);
			setSaveStatus(
				upgraded.ok ? "Save upgraded and loaded." : upgraded.message,
			);
		} else {
			setSaveStatus("Checkpoint loaded.");
		}
		setSession(
			createRuntimeSession(loadResult.save.state, contentState.registry),
		);
	}, [contentState, loadResult, repository]);

	const autosave = useCallback(
		(state: GameState) => {
			const result = repository.save(state);
			setSaveStatus(result.ok ? "Checkpoint saved." : result.message);
			if (result.ok) {
				setLoadResult({
					status: "ready",
					save: result.save,
					migrated: false,
				});
			}
		},
		[repository],
	);

	if (session) {
		return (
			<>
				<p className="game-save-status" role="status">
					{saveStatus}
				</p>
				<GameScreen
					session={session}
					registry={session.content}
					onAutosave={autosave}
					onExit={() => setSession(null)}
				/>
			</>
		);
	}

	if (contentState.status === "loading") {
		return (
			<section className="game-launcher" aria-labelledby="game-loading-title">
				<p className="game-kicker">Echoes at Dawn</p>
				<h1 id="game-loading-title">Loading world…</h1>
				<p role="status">Validating maps, events, and assets.</p>
			</section>
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
				checkpoints in this browser.
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
