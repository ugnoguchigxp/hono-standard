import { useCallback, useEffect, useRef, useState } from "react";
import type { GameContentRegistry, GameSession, GameState } from "@shared/game";
import type { PhaserGameInstance } from "./PhaserGame";
import {
	type BrowserGameRuntimeFactory,
	useBrowserGameRuntime,
} from "../game-platform";
import { loadPhaserGameFactory } from "./PhaserGameLoader";
import type { GameRuntimeError } from "./runtime-errors";

export function GameScreen({
	session,
	registry,
	onAutosave,
	onExit,
}: {
	session: GameSession;
	registry: GameContentRegistry;
	onAutosave?: (state: GameState) => void;
	onExit: () => void;
}) {
	const hostRef = useRef<HTMLDivElement>(null);
	const retryRef = useRef<HTMLButtonElement>(null);
	const [runtimeAttempt, setRuntimeAttempt] = useState(0);
	const [runtimeError, setRuntimeError] = useState<GameRuntimeError | null>(
		null,
	);
	const [mapId, setMapId] = useState(session.snapshot().location.mapId);
	const [gameMode, setGameMode] = useState(session.snapshot().mode);

	useEffect(() => {
		return session.subscribe((transition) => {
			setMapId(transition.state.location.mapId);
			setGameMode(transition.state.mode);
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
				game = createPhaserGame(host, session, registry, (error) => {
					if (!signal.aborted) setRuntimeError(error);
				});
			},
			dispose() {
				game?.destroy(true);
			},
		};
	}, [registry, runtimeAttempt, session]);
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
		if (runtimeError) retryRef.current?.focus();
	}, [runtimeError]);

	const map = registry.getMap(mapId);

	return (
		<section className="game-screen" aria-labelledby="game-screen-title">
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
			<div className="game-frame">
				<div
					ref={hostRef}
					className="game-canvas-host"
					data-game-mode={gameMode}
					data-testid="game-canvas-host"
				/>
				{runtimeError ? (
					<div className="game-runtime-error" role="alert">
						<strong>Asset loading failed.</strong>
						<p>{runtimeError.message}</p>
						<div className="game-runtime-actions">
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
							<button type="button" onClick={onExit}>
								Back to launcher
							</button>
						</div>
					</div>
				) : null}
			</div>
			<p className="game-screen-help">
				<span>MOVE</span> Arrow keys / WASD <i aria-hidden="true" />
				<span>CONFIRM</span> Z / Space / Enter <i aria-hidden="true" />
				<span>MENU</span> X / Esc / M
			</p>
		</section>
	);
}
