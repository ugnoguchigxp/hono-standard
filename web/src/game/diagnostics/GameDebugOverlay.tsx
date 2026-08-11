import type { GameSession } from "@shared/game";
import { useEffect, useState } from "react";

const readSession = (session: GameSession) => {
	const state = session.snapshot();
	const leader = state.field.partyPositions[0];
	return {
		mapId: state.location.mapId,
		tile: leader ? `${leader.x},${leader.y}` : "-",
		mode: state.mode,
		revision: state.revision,
		sequence: session.sequence,
		rngDraws: state.rng.draws,
	};
};

export function GameDebugOverlay({
	session,
	getPendingSaveCount,
}: {
	session: GameSession;
	getPendingSaveCount?: () => number;
}) {
	const [state, setState] = useState(() => readSession(session));
	const [performanceState, setPerformanceState] = useState({
		fps: 0,
		pendingSaves: getPendingSaveCount?.() ?? 0,
	});

	useEffect(
		() => session.subscribe(() => setState(readSession(session))),
		[session],
	);

	useEffect(() => {
		let frame = 0;
		let sampleStartedAt = performance.now();
		let animationFrame = 0;
		const sample = (now: number) => {
			frame += 1;
			const elapsed = now - sampleStartedAt;
			if (elapsed >= 1_000) {
				setPerformanceState({
					fps: Math.round((frame * 1_000) / elapsed),
					pendingSaves: getPendingSaveCount?.() ?? 0,
				});
				frame = 0;
				sampleStartedAt = now;
			}
			animationFrame = requestAnimationFrame(sample);
		};
		animationFrame = requestAnimationFrame(sample);
		return () => cancelAnimationFrame(animationFrame);
	}, [getPendingSaveCount]);

	return (
		<output className="game-debug-overlay" aria-hidden="true">
			{state.mapId} @{state.tile} · {state.mode} · r{state.revision}/s
			{state.sequence} · rng {state.rngDraws} · {performanceState.fps}fps ·
			saveq {performanceState.pendingSaves}
		</output>
	);
}
