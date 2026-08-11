import type { GameSession, GameState } from "@shared/game";
import { useCallback, useEffect, useRef, useState } from "react";
import {
	type BrowserGameRuntimeFactory,
	useBrowserGameRuntime,
} from "../game-platform";
import { GameContentLoader } from "./content/GameContentLoader";
import { GameTouchControls } from "./input/GameTouchControls";
import type { PhaserGameInstance } from "./PhaserGame";
import { loadPhaserGameFactory } from "./PhaserGameLoader";
import type { GameRuntimeError } from "./runtime-errors";
import { GameSettingsPanel } from "./settings/GameSettingsPanel";
import { useGameSettings } from "./settings/GameSettingsStore";
import { OPEN_GAME_SETTINGS_EVENT } from "./settings/settings-events";

export function GameScreen({
	session,
	contentLoader: providedContentLoader,
	onAutosave,
	onExit,
}: {
	session: GameSession;
	contentLoader?: GameContentLoader;
	onAutosave?: (state: GameState) => void;
	onExit: () => void;
}) {
	const hostRef = useRef<HTMLDivElement>(null);
	const frameRef = useRef<HTMLDivElement>(null);
	const fallbackContentLoaderRef = useRef(new GameContentLoader());
	const contentLoader =
		providedContentLoader ?? fallbackContentLoaderRef.current;
	const retryRef = useRef<HTMLButtonElement>(null);
	const backRef = useRef<HTMLButtonElement>(null);
	const [runtimeAttempt, setRuntimeAttempt] = useState(0);
	const [runtimeError, setRuntimeError] = useState<GameRuntimeError | null>(
		null,
	);
	const [mapId, setMapId] = useState(session.snapshot().location.mapId);
	const [gameMode, setGameMode] = useState(session.snapshot().mode);
	const [battlePhase, setBattlePhase] = useState(
		session.snapshot().battle?.phase ?? null,
	);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const settings = useGameSettings();
	const toggleFullscreen = useCallback(() => {
		const operation = document.fullscreenElement
			? document.exitFullscreen?.()
			: frameRef.current?.requestFullscreen?.();
		void operation?.catch(() => undefined);
	}, []);

	useEffect(() => {
		const openSettings = () => setSettingsOpen(true);
		window.addEventListener(OPEN_GAME_SETTINGS_EVENT, openSettings);
		return () =>
			window.removeEventListener(OPEN_GAME_SETTINGS_EVENT, openSettings);
	}, []);

	useEffect(() => {
		return session.subscribe((transition) => {
			setMapId(transition.state.location.mapId);
			setGameMode(transition.state.mode);
			setBattlePhase(transition.state.battle?.phase ?? null);
			if (
				onAutosave &&
				transition.events.some(
					({ event }) => event.type === "checkpoint.reached",
				)
			) {
				onAutosave(transition.state);
			}
		});
	}, [onAutosave, session]);

	const createRuntime = useCallback<BrowserGameRuntimeFactory>(() => {
		let game: PhaserGameInstance | undefined;
		return {
			async start(host, signal) {
				host.dataset.runtimeAttempt = String(runtimeAttempt);
				const createPhaserGame = await loadPhaserGameFactory();
				if (signal.aborted) return;
				game = createPhaserGame(host, session, contentLoader, (error) => {
					if (!signal.aborted) setRuntimeError(error);
				});
			},
			dispose() {
				game?.destroy(true);
			},
		};
	}, [contentLoader, runtimeAttempt, session]);
	const handleRuntimeStartError = useCallback(() => {
		setRuntimeError({
			code: "asset",
			assetId: "phaser-runtime",
			retryable: true,
			message: "The game runtime could not be loaded.",
		});
	}, []);
	useBrowserGameRuntime({
		hostRef,
		createRuntime,
		onStartError: handleRuntimeStartError,
	});

	useEffect(() => {
		if (!runtimeError) return;
		if (runtimeError.retryable) retryRef.current?.focus();
		else backRef.current?.focus();
	}, [runtimeError]);

	const map = session.content.getMap(mapId);

	return (
		<section
			className="game-screen"
			aria-labelledby="game-screen-title"
			data-screen-scale={settings.screenScale}
			data-high-contrast={settings.highContrast || undefined}
		>
			<div className="game-screen-heading">
				<div>
					<p className="game-kicker">Echoes at Dawn</p>
					<h1 id="game-screen-title">{map.displayName}</h1>
				</div>
				<p className="game-objective">
					<span>OBJECTIVE 01</span>
					{map.objective}
				</p>
			</div>
			<div ref={frameRef} className="game-frame">
				<div
					ref={hostRef}
					className="game-canvas-host"
					role="application"
					// biome-ignore lint/a11y/noNoninteractiveTabindex: the Phaser application needs a keyboard-focus return target
					tabIndex={0}
					aria-label="Echoes at Dawn game canvas"
					data-game-mode={gameMode}
					data-battle-phase={battlePhase ?? undefined}
					data-testid="game-canvas-host"
				/>
				{runtimeError ? (
					<div className="game-runtime-error" role="alert">
						<strong>
							{runtimeError.code === "asset"
								? "Asset loading failed."
								: "World loading failed."}
						</strong>
						<p>{runtimeError.message}</p>
						<div className="game-runtime-actions">
							{runtimeError.retryable ? (
								<button
									ref={retryRef}
									type="button"
									onClick={() => {
										setRuntimeError(null);
										setRuntimeAttempt((attempt) => attempt + 1);
									}}
								>
									Retry
								</button>
							) : null}
							<button ref={backRef} type="button" onClick={onExit}>
								Back to launcher
							</button>
						</div>
					</div>
				) : null}
				<GameTouchControls mode={settings.touchControls} />
				<GameSettingsPanel
					open={settingsOpen}
					onClose={() => setSettingsOpen(false)}
					onToggleFullscreen={toggleFullscreen}
				/>
			</div>
			<div className="game-screen-controls">
				<p className="game-screen-help">
					<span>MOVE</span> Arrow keys / WASD <i aria-hidden="true" />
					<span>CONFIRM</span> Z / Space / Enter <i aria-hidden="true" />
					<span>MENU</span> X / Esc / M
				</p>
				<button type="button" onClick={() => setSettingsOpen(true)}>
					Settings
				</button>
			</div>
		</section>
	);
}
