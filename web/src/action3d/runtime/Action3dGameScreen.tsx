import type {
	Action3dEvent,
	Action3dSession,
	Action3dState,
} from "@shared/action3d";
import { Link } from "@tanstack/react-router";
import {
	CirclePause,
	CirclePlay,
	Crosshair,
	DoorOpen,
	RotateCcw,
	Swords,
	Volume2,
	VolumeX,
} from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useBrowserGameRuntime } from "../../game-platform";
import type { Action3dContentLoader } from "../content/Action3dContentLoader";
import type { Action3dTelemetry } from "../telemetry/Action3dTelemetry";
import { LazyAction3dRuntime } from "./LazyAction3dRuntime";
import type { Action3dRuntimeError, Action3dRuntimeSnapshot } from "./types";

export function Action3dGameScreen({
	session,
	checkpoint,
	onAutosave,
	onExit,
	saveStatus,
	contentLoader,
	telemetry,
}: {
	session: Action3dSession;
	checkpoint: Action3dState;
	onAutosave: (state: Action3dState) => void;
	onExit: () => void;
	saveStatus: string | null;
	contentLoader: Action3dContentLoader;
	telemetry: Action3dTelemetry;
}) {
	const hostRef = useRef<HTMLDivElement>(null);
	const [snapshot, setSnapshot] = useState<Action3dRuntimeSnapshot>({
		state: session.getState(),
		stats: { fps: 0, frameTimeMs: 0, activeMeshes: 0, drawCalls: 0 },
		pointerLocked: false,
	});
	const [runtimeError, setRuntimeError] = useState<Action3dRuntimeError | null>(
		null,
	);
	const [warning, setWarning] = useState<Action3dRuntimeError | null>(null);
	const [runtimeAttempt, setRuntimeAttempt] = useState(0);
	const [lastEvent, setLastEvent] = useState(
		"Reach the sentinels beyond the south gate.",
	);
	const [muted, setMuted] = useState(false);
	const mutedRef = useRef(false);
	const isMuted = useCallback(() => mutedRef.current, []);
	const toggleMuted = () => {
		mutedRef.current = !mutedRef.current;
		setMuted(mutedRef.current);
	};
	const onEvent = useCallback(
		(event: Action3dEvent) => {
			if (event.type === "enemy-hit")
				setLastEvent(`Hit ${event.enemyId} for ${event.damage}.`);
			else if (event.type === "player-hit")
				setLastEvent(`${event.enemyId} hit you for ${event.damage}.`);
			else if (event.type === "enemy-defeated")
				setLastEvent(`${event.enemyId} defeated.`);
			else if (event.type === "victory")
				setLastEvent("North beacon secured. Checkpoint saved.");
			else if (event.type === "defeat")
				setLastEvent("You fell. Retry from the last checkpoint.");
			else if (event.type === "projectile-spawned")
				setLastEvent(`${event.enemyId} launched a projectile.`);
			else if (event.type === "world-transition-requested")
				setLastEvent("Opening the path to the next field…");
			else if (event.type === "world-entered")
				setLastEvent(`Entered ${event.worldId}.`);
			if (event.type === "defeat")
				telemetry.capture("action3d_player_defeated", {
					worldId: session.getState().location.worldId,
				});
			if (event.type === "victory")
				telemetry.capture("action3d_combat_completed", {
					worldId: session.getState().location.worldId,
				});
		},
		[session, telemetry],
	);
	const onWorldTransition = useCallback(
		(worldId: string, spawnId: string) => {
			void contentLoader
				.loadWorld(session.content, worldId)
				.then(() => {
					const state = session.enterWorld(worldId, spawnId);
					telemetry.capture("action3d_world_entered", {
						contentVersion: state.contentVersion,
						worldId,
					});
					onAutosave(state);
					setSnapshot((value) => ({ ...value, state }));
					setRuntimeAttempt((value) => value + 1);
				})
				.catch((error: unknown) => {
					setRuntimeError({
						code: "startup",
						message:
							error instanceof Error
								? error.message
								: "The next Action3D world could not load.",
						recoverable: true,
					});
				});
		},
		[contentLoader, onAutosave, session, telemetry],
	);
	const onWarning = useCallback(
		(value: Action3dRuntimeError) => {
			setWarning(value);
			telemetry.capture(
				value.code === "asset-load"
					? "action3d_asset_fallback_used"
					: "action3d_performance_degraded",
				{ errorCode: value.code },
			);
		},
		[telemetry],
	);
	const onRuntimeError = useCallback(
		(value: Action3dRuntimeError) => {
			setRuntimeError(value);
			telemetry.capture("action3d_runtime_interrupted", {
				errorCode: value.code,
			});
		},
		[telemetry],
	);
	const createRuntime = useMemo(
		() => () =>
			new LazyAction3dRuntime({
				generation: runtimeAttempt,
				session,
				onSnapshot: setSnapshot,
				onEvent,
				onCheckpoint: onAutosave,
				onWorldTransition,
				isMuted,
				onWarning,
				onError: onRuntimeError,
			}),
		[
			isMuted,
			onAutosave,
			onEvent,
			onRuntimeError,
			onWarning,
			onWorldTransition,
			runtimeAttempt,
			session,
		],
	);
	const onStartError = useCallback((error: unknown) => {
		setRuntimeError({
			code: "startup",
			message:
				error instanceof Error ? error.message : "Action3D could not start.",
			recoverable: true,
		});
	}, []);
	useBrowserGameRuntime({
		hostRef,
		createRuntime,
		onStartError,
	});
	const paused = snapshot.state.phase === "paused";
	const togglePause = () => {
		session.setPaused(!paused);
		setSnapshot((value) => ({ ...value, state: session.getState() }));
	};
	const retry = () => {
		session.restore(checkpoint);
		setRuntimeError(null);
		setWarning(null);
		setSnapshot((value) => ({ ...value, state: session.getState() }));
		setRuntimeAttempt((value) => value + 1);
	};
	const activeEnemies = snapshot.state.enemies.filter(
		(enemy) => enemy.state !== "defeated",
	);
	const lockOnTarget = snapshot.state.enemies.find(
		(enemy) => enemy.id === snapshot.state.player.lockOnEnemyId,
	);
	return (
		<main
			className="action3d-game"
			data-action3d-phase={snapshot.state.phase}
			data-action3d-revision={snapshot.state.revision}
			data-action3d-player-x={snapshot.state.player.position.x.toFixed(2)}
			data-action3d-player-z={snapshot.state.player.position.z.toFixed(2)}
			data-action3d-player-hp={snapshot.state.player.hp}
			data-action3d-enemies={activeEnemies.length}
			data-action3d-lock-on={lockOnTarget?.id ?? ""}
			data-action3d-world={snapshot.state.location.worldId}
			data-action3d-fps={snapshot.stats.fps}
			data-action3d-frame-ms={snapshot.stats.frameTimeMs}
			data-action3d-draw-calls={snapshot.stats.drawCalls}
			data-action3d-active-meshes={snapshot.stats.activeMeshes}
		>
			<div className="action3d-game-bar">
				<button type="button" onClick={onExit}>
					<DoorOpen className="icon" />
					Field Lab
				</button>
				<span>{saveStatus}</span>
				<button type="button" onClick={toggleMuted} aria-pressed={muted}>
					{muted ? <VolumeX className="icon" /> : <Volume2 className="icon" />}
					{muted ? "Sound off" : "Sound on"}
				</button>
				<button
					type="button"
					onClick={togglePause}
					disabled={
						snapshot.state.phase === "victory" ||
						snapshot.state.phase === "defeat"
					}
				>
					{paused ? (
						<CirclePlay className="icon" />
					) : (
						<CirclePause className="icon" />
					)}
					{paused ? "Resume" : "Pause"}
				</button>
			</div>
			<div className="action3d-stage">
				<section
					ref={hostRef}
					className="action3d-canvas-host"
					aria-label="Action3D WebGL field"
				/>
				<div className="action3d-hud action3d-hud-left">
					<div>
						<span>HP</span>
						<meter
							min="0"
							max={snapshot.state.player.maxHp}
							value={snapshot.state.player.hp}
						/>
					</div>
					<div>
						<span>ST</span>
						<meter
							min="0"
							max={snapshot.state.player.maxStamina}
							value={snapshot.state.player.stamina}
						/>
					</div>
				</div>
				<div className="action3d-objective">
					<Crosshair className="icon" />
					<span>
						{lockOnTarget
							? `Locked · ${lockOnTarget.id} · ${lockOnTarget.hp}/${lockOnTarget.maxHp} HP`
							: activeEnemies.length
								? `Sentinels remaining · ${activeEnemies.length}`
								: snapshot.state.phase === "victory"
									? "North beacon secured"
									: "Path to the next field is open"}
					</span>
				</div>
				<div className="action3d-event" aria-live="polite">
					{lastEvent}
				</div>
				<output className="action3d-stats" aria-label="Runtime performance">
					{snapshot.stats.fps} FPS · {snapshot.stats.frameTimeMs} ms ·{" "}
					{snapshot.stats.drawCalls} draws · {snapshot.stats.activeMeshes}{" "}
					meshes
				</output>
				{!snapshot.pointerLocked && snapshot.state.phase === "playing" && (
					<div className="action3d-pointer-hint">
						Click the field to capture the pointer
					</div>
				)}
				{warning && (
					<div className="action3d-warning" role="status">
						{warning.message}
					</div>
				)}
				{(paused ||
					snapshot.state.phase === "victory" ||
					snapshot.state.phase === "defeat" ||
					runtimeError) && (
					<section className="action3d-overlay" aria-live="polite">
						<Swords aria-hidden="true" />
						<h1>
							{runtimeError
								? "Runtime interrupted"
								: snapshot.state.phase === "victory"
									? "Field secured"
									: snapshot.state.phase === "defeat"
										? "Beacon lost"
										: "Paused"}
						</h1>
						<p>
							{runtimeError?.message ??
								(snapshot.state.phase === "victory"
									? "The victory checkpoint is ready for Continue."
									: snapshot.state.phase === "defeat"
										? "Return to the south beacon with full health."
										: "The fixed-step simulation is stopped.")}
						</p>
						<div>
							{(runtimeError?.recoverable ||
								snapshot.state.phase === "defeat") && (
								<button type="button" onClick={retry}>
									<RotateCcw className="icon" />
									Retry checkpoint
								</button>
							)}
							{paused && (
								<button type="button" onClick={togglePause}>
									Resume
								</button>
							)}
							<button type="button" onClick={onExit}>
								Exit field
							</button>
						</div>
					</section>
				)}
			</div>
			<div className="action3d-controls">
				<strong>Controls</strong>
				<span>
					WASD / left stick · Mouse · Space jump · Shift sprint · Ctrl / B dodge
					· Click / X light · Q / Y heavy · E / R3 lock-on · P / Start pause
				</span>
				<Link to="/">Home</Link>
			</div>
		</main>
	);
}
