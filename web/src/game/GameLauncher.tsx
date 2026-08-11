import {
	assertGameStateCompatible,
	createDemoEncounterProvider,
	createGameCorrelationId,
	createInitialGameState,
	type GameContentRegistry,
	type GameSaveSlotId,
	GameSession,
	type GameState,
	MANUAL_SAVE_SLOT_IDS,
} from "@shared/game";
import type { GameSaveSlotMetadata } from "@shared/schemas/game-save.schema";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
	ContentLoadError,
	GameContentLoader,
} from "./content/GameContentLoader";
import { browserGameDiagnostics } from "./diagnostics/BrowserGameDiagnostics";
import { GameScreen } from "./GameScreen";
import {
	type GameSaveConflict,
	type GameSaveLoadResult,
	type GameSaveRepository,
	type GameSaveWriteResult,
	ServerGameSaveRepository,
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
		listenerErrorSink: (_error, context) => {
			browserGameDiagnostics.capture({
				event: "session.listener.error",
				correlationId: createGameCorrelationId(),
				...context,
			});
		},
	});

const saveSummary = (result: GameSaveLoadResult): string => {
	switch (result.status) {
		case "empty":
			return "No checkpoint found.";
		case "recovery":
			return result.message;
		case "ready":
			return [
				`Autosave · ${new Date(result.save.savedAt).toLocaleString()}`,
				result.source === "server" ? "Cloud save" : "Browser backup",
				result.syncMessage,
			]
				.filter(Boolean)
				.join(" · ");
		case "conflict":
			return result.message;
		case "corrupt":
		case "unsupported":
		case "error":
			return result.message;
	}
};

const checkpointSummary = (save: GameSaveConflict["browserSave"]): string =>
	[
		save.state.location.mapId,
		save.state.location.checkpointId,
		`State r${save.state.revision}`,
		new Date(save.savedAt).toLocaleString(),
	].join(" · ");

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
	const [confirmNewGame, setConfirmNewGame] = useState(false);
	const [saveSlots, setSaveSlots] = useState<GameSaveSlotMetadata[]>([]);

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
						browserGameDiagnostics.capture({
							event:
								saveResult.status === "conflict"
									? "save.conflict"
									: saveResult.status === "recovery"
										? "save.recovery"
										: "save.load",
							correlationId: createGameCorrelationId(),
							code: `save.${saveResult.status}`,
						});
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
		if (repository.listSlots) {
			void repository
				.listSlots(controller.signal)
				.then((slots) => {
					if (!controller.signal.aborted) setSaveSlots(slots);
				})
				.catch(() => undefined);
		}
		return () => controller.abort();
	}, [contentAttempt, contentLoader, repository]);

	const retryContent = useCallback(() => {
		browserGameDiagnostics.capture({
			event: "content.retry",
			correlationId: createGameCorrelationId(),
			code: "content.retry",
		});
		setContentAttempt((attempt) => attempt + 1);
	}, []);

	const applySaveResult = useCallback(
		(result: GameSaveWriteResult, successMessage: string) => {
			const timedOut =
				!result.ok && "reason" in result && result.reason === "timeout";
			browserGameDiagnostics.capture({
				event: timedOut
					? "save.timeout"
					: result.ok
						? "save.write"
						: result.status === "conflict"
							? "save.conflict"
							: result.status === "queued-offline"
								? "save.offline"
								: "save.write",
				correlationId: createGameCorrelationId(),
				code: result.ok
					? "save.synced"
					: timedOut
						? "save.timeout"
						: `save.${result.status}`,
			});
			setSaveStatus(result.ok ? successMessage : result.message);
			if (!result.ok && result.status === "conflict") {
				setLoadResult({
					status: "conflict",
					message: result.message,
					conflict: result.conflict,
					source: "server",
				});
				return;
			}
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

	const beginNewGame = useCallback(
		(replaceExisting: boolean) => {
			if (contentState.status !== "ready") return;
			const state = createInitialGameState({ registry: contentState.registry });
			const write =
				replaceExisting && repository.reset
					? repository.reset(state)
					: repository.save(state);
			persistSave(write, "Initial checkpoint saved.");
			setConfirmNewGame(false);
			setSession(createRuntimeSession(state, contentState.registry));
		},
		[contentState, persistSave, repository],
	);

	const startNewGame = useCallback(() => {
		if (contentState.status !== "ready") return;
		if (loadResult.status === "ready" || loadResult.status === "recovery") {
			setConfirmNewGame(true);
			return;
		}
		beginNewGame(false);
	}, [beginNewGame, contentState, loadResult]);

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

	const manualSave = useCallback(
		(state: GameState, slotId: GameSaveSlotId) => {
			if (!repository.saveToSlot) {
				setSaveStatus("Manual cloud saves are unavailable.");
				return;
			}
			setSaveStatus(`Saving ${slotId}…`);
			void repository.saveToSlot(state, slotId).then((result) => {
				const timedOut =
					!result.ok && "reason" in result && result.reason === "timeout";
				browserGameDiagnostics.capture({
					event: timedOut
						? "save.timeout"
						: result.ok
							? "save.write"
							: result.status === "queued-offline"
								? "save.offline"
								: result.status === "conflict"
									? "save.conflict"
									: "save.write",
					correlationId: createGameCorrelationId(),
					code: result.ok
						? "save.manual-synced"
						: timedOut
							? "save.timeout"
							: `save.${result.status}`,
				});
				setSaveStatus(result.ok ? `${slotId} saved.` : result.message);
				if (result.ok) {
					setSaveSlots((current) => [
						...current.filter((slot) => slot.slotId !== slotId),
						{
							slotId,
							revision: result.revision,
							savedAt: result.save.savedAt,
							updatedAt: result.save.savedAt,
							contentVersion: result.save.state.contentVersion,
							stateRevision: result.save.state.revision,
							mapId: result.save.state.location.mapId,
							checkpointId: result.save.state.location.checkpointId,
							status: "ready",
						},
					]);
				}
			});
		},
		[repository],
	);

	const restoreManualSlot = useCallback(
		async (slotId: GameSaveSlotId) => {
			if (!repository.loadSlot || !repository.reset) return;
			setSaveStatus(`Loading ${slotId}…`);
			try {
				const loaded = await repository.loadSlot(slotId);
				if (loaded.status !== "ready") {
					setSaveStatus(saveSummary(loaded));
					return;
				}
				const restored = await repository.reset(loaded.save.state);
				applySaveResult(restored, `${slotId} restored to autosave.`);
			} catch {
				setSaveStatus(`${slotId} could not be restored.`);
			}
		},
		[applySaveResult, repository],
	);

	const resolveSaveConflict = useCallback(
		async (conflict: GameSaveConflict, resolution: "cloud" | "browser") => {
			if (!repository.resolveConflict) {
				setSaveStatus("This save repository cannot resolve cloud conflicts.");
				return;
			}
			setSaveStatus("Resolving checkpoint conflict…");
			try {
				const result = await repository.resolveConflict(conflict, resolution);
				browserGameDiagnostics.capture({
					event:
						result.status === "conflict" ? "save.conflict" : "save.resolved",
					correlationId: createGameCorrelationId(),
					code: `save.resolve-${resolution}`,
				});
				setLoadResult(result);
				setSaveStatus(
					result.status === "ready"
						? (result.syncMessage ?? "Checkpoint conflict resolved.")
						: result.status === "empty"
							? "Cloud checkpoint removed; browser conflict backup cleared."
							: result.message,
				);
				if (resolution === "cloud") setSession(null);
			} catch {
				setSaveStatus(
					"Checkpoint conflict could not be resolved. Both candidates are still safe.",
				);
			}
		},
		[repository],
	);

	if (loadResult.status === "recovery") {
		const { candidate } = loadResult;
		return (
			<section className="game-launcher" aria-labelledby="save-recovery-title">
				<p className="game-kicker">Echoes at Dawn</p>
				<div
					role="alertdialog"
					aria-modal="true"
					aria-labelledby="save-recovery-title"
				>
					<h1 id="save-recovery-title">Restore an earlier checkpoint?</h1>
					<p>{loadResult.message}</p>
					<p>{checkpointSummary(candidate.save)}</p>
					<div className="game-launch-actions">
						<button
							type="button"
							className="game-launch-button primary"
							onClick={() => {
								if (!repository.restoreRecovery) return;
								setSaveStatus("Restoring verified checkpoint…");
								void repository.restoreRecovery(candidate).then(
									(result) => {
										browserGameDiagnostics.capture({
											event: "save.recovery",
											correlationId: createGameCorrelationId(),
											code: `save.recovery-${result.status}`,
										});
										setLoadResult(result);
										setSaveStatus(
											result.status === "ready"
												? (result.syncMessage ?? "Checkpoint restored.")
												: saveSummary(result),
										);
									},
									() => setSaveStatus("Checkpoint recovery failed safely."),
								);
							}}
						>
							Restore checkpoint
						</button>
						<button
							type="button"
							className="game-launch-button"
							onClick={() => setConfirmNewGame(true)}
						>
							New Game
						</button>
					</div>
					{confirmNewGame ? (
						<div
							role="alertdialog"
							aria-modal="true"
							aria-labelledby="recovery-new-title"
						>
							<h2 id="recovery-new-title">Replace damaged progress?</h2>
							<div className="game-launch-actions">
								<button
									type="button"
									className="game-launch-button primary"
									onClick={() => beginNewGame(true)}
								>
									Replace and start
								</button>
								<button type="button" onClick={() => setConfirmNewGame(false)}>
									Cancel
								</button>
							</div>
						</div>
					) : null}
					<p role="status">{saveStatus}</p>
				</div>
			</section>
		);
	}

	if (loadResult.status === "conflict") {
		const { conflict } = loadResult;
		return (
			<section className="game-launcher" aria-labelledby="save-conflict-title">
				<p className="game-kicker">Echoes at Dawn</p>
				<div
					role="alertdialog"
					aria-modal="true"
					aria-labelledby="save-conflict-title"
				>
					<h1 id="save-conflict-title">Choose checkpoint progress</h1>
					<p>{loadResult.message}</p>
					<div className="game-save-conflict-candidates">
						<section aria-label="Browser checkpoint">
							<h2>This browser</h2>
							<p>{checkpointSummary(conflict.browserSave)}</p>
						</section>
						<section aria-label="Cloud checkpoint">
							<h2>Cloud</h2>
							<p>
								{conflict.cloudSave
									? checkpointSummary(conflict.cloudSave.save)
									: "No cloud checkpoint"}
							</p>
						</section>
					</div>
					<div className="game-launch-actions">
						<button
							type="button"
							className="game-launch-button primary"
							onClick={() => void resolveSaveConflict(conflict, "cloud")}
						>
							Use cloud progress
						</button>
						<button
							type="button"
							className="game-launch-button"
							onClick={() => void resolveSaveConflict(conflict, "browser")}
						>
							Use this browser
						</button>
						<button
							type="button"
							className="game-launch-button"
							onClick={() =>
								setSaveStatus("Both checkpoint candidates remain saved.")
							}
						>
							Decide later
						</button>
					</div>
					<p role="status">{saveStatus}</p>
				</div>
			</section>
		);
	}

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
					onManualSave={manualSave}
					getPendingSaveCount={() => repository.pendingWriteCount?.() ?? 0}
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
			{confirmNewGame ? (
				<div
					role="alertdialog"
					aria-modal="true"
					aria-labelledby="new-game-confirm-title"
				>
					<h2 id="new-game-confirm-title">Replace cloud progress?</h2>
					<p>
						New Game will replace the current autosave after you confirm. The
						current checkpoint is not changed by opening this dialog.
					</p>
					<div className="game-launch-actions">
						<button
							type="button"
							className="game-launch-button primary"
							onClick={() => beginNewGame(true)}
						>
							Replace and start
						</button>
						<button
							type="button"
							className="game-launch-button"
							onClick={() => setConfirmNewGame(false)}
						>
							Cancel
						</button>
					</div>
				</div>
			) : null}
			{saveSlots.some(({ slotId }) =>
				MANUAL_SAVE_SLOT_IDS.includes(
					slotId as (typeof MANUAL_SAVE_SLOT_IDS)[number],
				),
			) ? (
				<section
					className="game-save-slots"
					aria-labelledby="manual-save-title"
				>
					<h2 id="manual-save-title">Manual checkpoints</h2>
					{MANUAL_SAVE_SLOT_IDS.map((slotId) => {
						const metadata = saveSlots.find((slot) => slot.slotId === slotId);
						if (!metadata) return null;
						return (
							<div key={slotId}>
								<span>
									{slotId} · {metadata.mapId ?? metadata.status} ·{" "}
									{new Date(metadata.savedAt).toLocaleString()}
								</span>
								<button
									type="button"
									disabled={metadata.status !== "ready"}
									onClick={() => void restoreManualSlot(slotId)}
								>
									Restore to autosave
								</button>
							</div>
						);
					})}
				</section>
			) : null}
			<p
				className={`game-save-summary${hasLoadError ? " error" : ""}`}
				role={hasLoadError ? "alert" : "status"}
			>
				{saveStatus ?? compatibilityMessage ?? saveSummary(loadResult)}
			</p>
		</section>
	);
}
