import { useEffect, useRef } from "react";
import type { GameSession, GameState } from "@shared/game";
import type { PhaserGameInstance } from "./PhaserGame";
import { loadPhaserGameFactory } from "./PhaserGameLoader";

export function GameScreen({
	session,
	onAutosave,
}: {
	session: GameSession;
	onAutosave?: (state: GameState) => void;
}) {
	const hostRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!onAutosave) return;
		return session.subscribe((transition) => {
			if (
				transition.events.some(
					({ event }) => event.type === "checkpoint.reached",
				)
			) {
				onAutosave(transition.state);
			}
		});
	}, [onAutosave, session]);

	useEffect(() => {
		const host = hostRef.current;
		if (!host) return;
		let disposed = false;
		let game: PhaserGameInstance | undefined;
		void loadPhaserGameFactory().then((createPhaserGame) => {
			if (disposed) return;
			game = createPhaserGame(host, session);
		});
		return () => {
			disposed = true;
			game?.destroy(true);
		};
	}, [session]);

	return (
		<section className="game-screen" aria-labelledby="game-screen-title">
			<div className="game-screen-heading">
				<div>
					<p className="game-kicker">Echoes at Dawn</p>
					<h1 id="game-screen-title">Signal Ruins</h1>
				</div>
				<p className="game-objective">
					<span>OBJECTIVE 01</span>
					Find the pale signal and survive what answers.
				</p>
			</div>
			<div className="game-frame">
				<div
					ref={hostRef}
					className="game-canvas-host"
					data-testid="game-canvas-host"
				/>
			</div>
			<p className="game-screen-help">
				<span>MOVE</span> Arrow keys / WASD <i aria-hidden="true" />
				<span>CONFIRM</span> Z / Space / Enter
			</p>
		</section>
	);
}
