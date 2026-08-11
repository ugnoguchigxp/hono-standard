import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	createGameSave,
	createInitialGameState,
	type GameContentRegistry,
	type GameSession,
	type GameState,
} from "@shared/game";
import { validateGameContentDirectory } from "../../../scripts/validate-game-content";
import { GameLauncher } from "./GameLauncher";
import {
	ContentLoadError,
	GameContentLoader,
} from "./content/GameContentLoader";
import {
	gameSaveStorageKey,
	LocalGameSaveRepository,
} from "./save/LocalGameSaveRepository";
import type { GameSaveRepository } from "./save/ServerGameSaveRepository";

vi.mock("./save/ServerGameSaveRepository", async (importOriginal) => {
	const original =
		await importOriginal<typeof import("./save/ServerGameSaveRepository")>();
	const { LocalGameSaveRepository: LocalRepository } = await import(
		"./save/LocalGameSaveRepository"
	);
	class TestServerGameSaveRepository {
		private readonly local: LocalGameSaveRepository;

		constructor(storage: Storage, playerId: string) {
			this.local = new LocalRepository(storage, playerId);
		}

		load() {
			const result = this.local.load();
			return { ...result, source: "local" as const };
		}

		save(state: GameState, savedAt?: string) {
			const result = this.local.save(state, savedAt);
			return result.ok
				? { ...result, revision: 1, synced: true as const }
				: { ...result, synced: false as const };
		}
	}
	return {
		...original,
		ServerGameSaveRepository: TestServerGameSaveRepository,
	};
});

const registry = validateGameContentDirectory();
const mocks = vi.hoisted(() => ({ latestSession: null as GameSession | null }));

const toLegacyParty = (state: GameState) => ({
	members: state.party.members.map((member) => ({
		id: member.id,
		name: member.name,
		level: member.level,
		hp: member.hp,
		maxHp: member.maxHp,
		attack: member.attack,
		defense: member.defense,
		speed: member.speed,
		ability: {
			id: member.ability.id,
			name: member.ability.name,
			powerPercent: member.ability.powerPercent,
		},
	})),
});

vi.mock("./GameScreen", () => ({
	GameScreen: ({
		session,
		onAutosave,
	}: {
		session: GameSession;
		onAutosave: (state: GameState) => void;
	}) => {
		mocks.latestSession = session;
		return (
			<div data-testid="mock-game-screen">
				<button
					type="button"
					onClick={() => {
						const transition = session.dispatch({
							type: "checkpoint.reached",
							checkpointId: "signal-core",
						});
						onAutosave(transition.state);
					}}
				>
					Reach checkpoint
				</button>
			</div>
		);
	},
}));

const readyLoader = () => {
	const loader = new GameContentLoader();
	vi.spyOn(loader, "load").mockResolvedValue(registry);
	vi.spyOn(loader, "loadMap").mockResolvedValue(registry);
	vi.spyOn(loader, "reset").mockImplementation(() => undefined);
	return loader;
};

const renderReadyLauncher = async () => {
	const loader = readyLoader();
	render(<GameLauncher playerId="player@example.com" contentLoader={loader} />);
	await screen.findByRole("heading", { name: "The signal is waiting." });
	return loader;
};

beforeEach(() => {
	vi.restoreAllMocks();
	window.localStorage.clear();
	mocks.latestSession = null;
});

describe("GameLauncher", () => {
	it("uses the default browser content loader", async () => {
		vi.spyOn(GameContentLoader.prototype, "load").mockResolvedValue(registry);
		render(<GameLauncher playerId="default-loader@example.com" />);
		expect(
			await screen.findByRole("button", { name: "New Game" }),
		).toBeVisible();
	});

	it("shows world loading before enabling the launcher", async () => {
		let resolveLoad: ((value: typeof registry) => void) | undefined;
		const loader = new GameContentLoader();
		vi.spyOn(loader, "load").mockReturnValue(
			new Promise((resolve) => {
				resolveLoad = resolve;
			}),
		);
		render(
			<GameLauncher playerId="player@example.com" contentLoader={loader} />,
		);
		expect(
			screen.getByRole("heading", { name: "Loading world…" }),
		).toBeVisible();
		expect(screen.queryByRole("button", { name: "New Game" })).toBeNull();
		resolveLoad?.(registry);
		await screen.findByRole("button", { name: "New Game" });
	});

	it("starts a new game and writes the initial checkpoint", async () => {
		await renderReadyLauncher();
		expect(screen.getByText("No checkpoint found.")).toBeVisible();
		expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();

		fireEvent.click(screen.getByRole("button", { name: "New Game" }));
		expect(screen.getByTestId("mock-game-screen")).toBeVisible();
		expect(screen.getByRole("status")).toHaveTextContent(
			"Initial checkpoint saved.",
		);
		expect(mocks.latestSession?.content).toBe(registry);
		expect(
			window.localStorage.getItem(gameSaveStorageKey("player@example.com")),
		).not.toBeNull();
	});

	it("continues a saved checkpoint after remount", async () => {
		const first = render(
			<GameLauncher
				playerId="player@example.com"
				contentLoader={readyLoader()}
			/>,
		);
		await screen.findByRole("button", { name: "New Game" });
		fireEvent.click(screen.getByRole("button", { name: "New Game" }));
		fireEvent.click(screen.getByRole("button", { name: "Reach checkpoint" }));
		expect(screen.getByRole("status")).toHaveTextContent("Checkpoint saved.");
		first.unmount();

		render(
			<GameLauncher
				playerId="player@example.com"
				contentLoader={readyLoader()}
			/>,
		);
		fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
		expect(mocks.latestSession?.snapshot().location.checkpointId).toBe(
			"signal-core",
		);
		expect(screen.getByRole("status")).toHaveTextContent("Checkpoint loaded.");
	});

	it("blocks corrupt, unsupported, and incompatible saves", async () => {
		window.localStorage.setItem(
			gameSaveStorageKey("player@example.com"),
			"not-json",
		);
		const corrupt = render(
			<GameLauncher
				playerId="player@example.com"
				contentLoader={readyLoader()}
			/>,
		);
		await screen.findByRole("heading", { name: "The signal is waiting." });
		expect(screen.getByRole("alert")).toHaveTextContent("not valid JSON");
		expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
		corrupt.unmount();

		window.localStorage.setItem(
			gameSaveStorageKey("player@example.com"),
			JSON.stringify({ formatVersion: 99 }),
		);
		const unsupported = render(
			<GameLauncher
				playerId="player@example.com"
				contentLoader={readyLoader()}
			/>,
		);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Save format version 99 is not supported.",
		);
		unsupported.unmount();

		const state = createInitialGameState({ registry });
		state.contentVersion = "different-world";
		new LocalGameSaveRepository(
			window.localStorage,
			"incompatible@example.com",
		).save(state);
		const incompatibleView = render(
			<GameLauncher
				playerId="incompatible@example.com"
				contentLoader={readyLoader()}
			/>,
		);
		await screen.findByText(/different world version/i);
		expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
		incompatibleView.unmount();

		const missingMapState = createInitialGameState({ registry });
		missingMapState.location.mapId = "removed-map";
		const missingMapRepository = new LocalGameSaveRepository(
			window.localStorage,
			"missing-map@example.com",
		);
		expect(missingMapRepository.save(missingMapState).ok).toBe(true);
		render(
			<GameLauncher
				playerId="missing-map@example.com"
				contentLoader={readyLoader()}
			/>,
		);
		await screen.findByText(/world data that is no longer available/i);
		expect(screen.queryByRole("button", { name: "Continue" })).toBeNull();
		expect(missingMapRepository.load().status).toBe("ready");
	});

	it("upgrades a legacy save before continuing", async () => {
		const current = createInitialGameState({ registry });
		window.localStorage.setItem(
			gameSaveStorageKey("player@example.com"),
			JSON.stringify({
				formatVersion: 0,
				savedAt: "2026-08-10T00:00:00.000Z",
				state: {
					schemaVersion: 1,
					mode: current.mode,
					currentMap: {
						id: "signal-ruins",
						checkpoint: { x: 3, y: 6 },
					},
					party: toLegacyParty(current),
					story: current.story,
					battle: current.battle,
				},
			}),
		);
		await renderReadyLauncher();
		fireEvent.click(screen.getByRole("button", { name: "Continue" }));
		expect(screen.getByRole("status")).toHaveTextContent(
			"Save upgraded and loaded.",
		);
	});

	it("retries a player-facing content failure", async () => {
		const loader = new GameContentLoader();
		const load = vi
			.spyOn(loader, "load")
			.mockRejectedValueOnce(
				new ContentLoadError("http", "World request failed."),
			)
			.mockResolvedValueOnce(registry);
		const reset = vi.spyOn(loader, "reset").mockImplementation(() => undefined);
		render(
			<GameLauncher playerId="player@example.com" contentLoader={loader} />,
		);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"World request failed.",
		);
		fireEvent.click(screen.getByRole("button", { name: "Retry" }));
		await screen.findByRole("button", { name: "New Game" });
		expect(reset).toHaveBeenCalledOnce();
		expect(load).toHaveBeenCalledTimes(2);
	});

	it("normalizes an unexpected loader error for players", async () => {
		const loader = new GameContentLoader();
		vi.spyOn(loader, "load").mockRejectedValue(new Error("internal details"));
		render(
			<GameLauncher playerId="unexpected@example.com" contentLoader={loader} />,
		);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"The world could not be reached.",
		);
		expect(screen.queryByText("internal details")).toBeNull();
	});

	it("reports a failed legacy upgrade while still continuing", async () => {
		const current = createInitialGameState({ registry });
		window.localStorage.setItem(
			gameSaveStorageKey("upgrade-failure@example.com"),
			JSON.stringify({
				formatVersion: 0,
				savedAt: "2026-08-10T00:00:00.000Z",
				state: {
					schemaVersion: 1,
					mode: current.mode,
					currentMap: {
						id: "signal-ruins",
						checkpoint: { x: 3, y: 6 },
					},
					party: toLegacyParty(current),
					story: current.story,
					battle: current.battle,
				},
			}),
		);
		vi.spyOn(LocalGameSaveRepository.prototype, "save").mockReturnValue({
			ok: false,
			message: "Could not write the local autosave.",
		});
		render(
			<GameLauncher
				playerId="upgrade-failure@example.com"
				contentLoader={readyLoader()}
			/>,
		);
		fireEvent.click(await screen.findByRole("button", { name: "Continue" }));
		expect(screen.getByTestId("mock-game-screen")).toBeVisible();
		expect(
			screen.getByText("Could not write the local autosave."),
		).toBeVisible();
	});

	it("shows storage read and write failures without blocking play", async () => {
		vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("storage disabled");
		});
		const readFailure = render(
			<GameLauncher
				playerId="player@example.com"
				contentLoader={readyLoader()}
			/>,
		);
		await screen.findByRole("heading", { name: "The signal is waiting." });
		expect(screen.getByRole("alert")).toHaveTextContent(
			"Browser storage is unavailable.",
		);
		readFailure.unmount();

		vi.restoreAllMocks();
		const save = vi
			.spyOn(LocalGameSaveRepository.prototype, "save")
			.mockReturnValue({
				ok: false,
				message: "Could not write the local autosave.",
			});
		const view = render(
			<GameLauncher
				playerId="write@example.com"
				contentLoader={readyLoader()}
			/>,
		);
		fireEvent.click(await screen.findByRole("button", { name: "New Game" }));
		expect(
			screen.getByText("Could not write the local autosave."),
		).toBeVisible();
		fireEvent.click(screen.getByRole("button", { name: "Reach checkpoint" }));
		expect(save).toHaveBeenCalledTimes(2);
		view.unmount();
	});

	it("confirms async cloud writes and reports a browser-only autosave", async () => {
		const repository: GameSaveRepository = {
			load: async () => ({ status: "empty", source: "server" }),
			save: vi
				.fn()
				.mockImplementationOnce(async (state: GameState) => ({
					ok: true,
					save: createGameSave(state),
					revision: 1,
					synced: true,
				}))
				.mockImplementationOnce(async (state: GameState) => ({
					ok: false,
					message: "Cloud sync is waiting.",
					save: createGameSave(state),
					synced: false,
				})),
		};
		render(
			<GameLauncher
				playerId="cloud@example.com"
				contentLoader={readyLoader()}
				saveRepository={repository}
			/>,
		);
		fireEvent.click(await screen.findByRole("button", { name: "New Game" }));
		expect(screen.getByRole("status")).toHaveTextContent("Saving checkpoint…");
		await screen.findByText("Initial checkpoint saved.");

		fireEvent.click(screen.getByRole("button", { name: "Reach checkpoint" }));
		await screen.findByText("Cloud sync is waiting.");
		expect(repository.save).toHaveBeenCalledTimes(2);
	});

	it("normalizes rejected cloud loading and saving operations", async () => {
		const loadFailure: GameSaveRepository = {
			load: async () => {
				throw new Error("private load failure");
			},
			save: vi.fn(),
		};
		const failedLoadView = render(
			<GameLauncher
				playerId="load-failure@example.com"
				contentLoader={readyLoader()}
				saveRepository={loadFailure}
			/>,
		);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Cloud saves could not be loaded.",
		);
		failedLoadView.unmount();

		const saveFailure: GameSaveRepository = {
			load: async () => ({ status: "empty", source: "server" }),
			save: async () => {
				throw new Error("private save failure");
			},
		};
		render(
			<GameLauncher
				playerId="save-failure@example.com"
				contentLoader={readyLoader()}
				saveRepository={saveFailure}
			/>,
		);
		fireEvent.click(await screen.findByRole("button", { name: "New Game" }));
		expect(
			await screen.findByText(/please keep this page open and retry/i),
		).toBeVisible();
	});

	it("shows a cloud summary and loads a declared saved map on demand", async () => {
		const state = createInitialGameState({ registry });
		state.location = {
			mapId: "relay-camp",
			entranceId: "ruins-gate",
			checkpointId: "relay-gate",
		};
		state.field.partyPositions = [
			{ x: 2, y: 5 },
			{ x: 1, y: 5 },
			{ x: 1, y: 6 },
		];
		const repository: GameSaveRepository = {
			load: async () => ({
				status: "ready",
				save: createGameSave(state),
				migrated: false,
				source: "server",
			}),
			save: vi.fn(),
		};
		const loader = readyLoader();
		const baseRegistry = Object.assign(
			Object.create(Object.getPrototypeOf(registry)) as GameContentRegistry,
			registry,
			{
				mapsById: Object.fromEntries(
					Object.entries(registry.mapsById).filter(
						([id]) => id !== "relay-camp",
					),
				),
			},
		);
		vi.mocked(loader.load).mockResolvedValue(baseRegistry);
		vi.spyOn(loader, "hasDeclaredMap").mockReturnValue(true);

		render(
			<GameLauncher
				playerId="cloud@example.com"
				contentLoader={loader}
				saveRepository={repository}
			/>,
		);

		expect(await screen.findByText(/Cloud save/)).toBeVisible();
		expect(loader.loadMap).toHaveBeenCalledWith(
			"relay-camp",
			expect.any(AbortSignal),
		);
	});

	it("cancels an in-flight save load when unmounted", async () => {
		const repository: GameSaveRepository = {
			load: (signal) =>
				new Promise((_resolve, reject) => {
					signal?.addEventListener("abort", () =>
						reject(new DOMException("aborted", "AbortError")),
					);
				}),
			save: vi.fn(),
		};
		const view = render(
			<GameLauncher
				playerId="abort@example.com"
				contentLoader={readyLoader()}
				saveRepository={repository}
			/>,
		);

		view.unmount();
		await Promise.resolve();
	});
});
