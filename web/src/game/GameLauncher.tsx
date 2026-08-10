import { useCallback, useMemo, useState } from "react";
import {
	createInitialGameState,
	GameSession,
	type GameState,
} from "@shared/game";
import { GameScreen } from "./GameScreen";
import {
	LocalGameSaveRepository,
	type LocalGameSaveLoadResult,
} from "./save/LocalGameSaveRepository";

const createRuntimeSession = (state: GameState): GameSession =>
	new GameSession({
		sessionId: `browser-${crypto.randomUUID()}`,
		initialState: state,
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

export function GameLauncher({ playerId }: { playerId: string }) {
	const repository = useMemo(
		() => new LocalGameSaveRepository(window.localStorage, playerId),
		[playerId],
	);
	const [loadResult, setLoadResult] = useState<LocalGameSaveLoadResult>(() =>
		repository.load(),
	);
	const [session, setSession] = useState<GameSession | null>(null);
	const [saveStatus, setSaveStatus] = useState<string | null>(null);

	const startNewGame = useCallback(() => {
		const state = createInitialGameState();
		const saved = repository.save(state);
		setSaveStatus(saved.ok ? "Initial checkpoint saved." : saved.message);
		if (saved.ok) {
			setLoadResult({ status: "ready", save: saved.save, migrated: false });
		}
		setSession(createRuntimeSession(state));
	}, [repository]);

	const continueGame = useCallback(() => {
		if (loadResult.status !== "ready") return;
		if (loadResult.migrated) {
			const upgraded = repository.save(loadResult.save.state);
			setSaveStatus(
				upgraded.ok ? "Save upgraded and loaded." : upgraded.message,
			);
		} else {
			setSaveStatus("Checkpoint loaded.");
		}
		setSession(createRuntimeSession(loadResult.save.state));
	}, [loadResult, repository]);

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
				{saveStatus ? (
					<p className="game-save-status" role="status">
						{saveStatus}
					</p>
				) : null}
				<GameScreen session={session} onAutosave={autosave} />
			</>
		);
	}

	const canContinue = loadResult.status === "ready";
	const hasLoadError = ["corrupt", "unsupported", "error"].includes(
		loadResult.status,
	);
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
				{saveSummary(loadResult)}
			</p>
		</section>
	);
}
